-- cm1：1000 代理雙向通訊傳輸層（純資料庫邏輯，不呼叫任何模型）。全部新表、只增不改；既有 agent_messages（另一系統在用、有 authenticated 全開 RLS 與固定 type 清單）不動。
-- 只有 service_role 能呼叫（代理的身分由伺服器端的代理執行流程帶入，不接受前端自稱）。關閉：aivault_floor_state k='comm:off' v={"off":"1"}
create table if not exists public.aivault_comm_projects (id text primary key, title text not null, owner_agent text, status text not null default 'open', max_turns int not null default 300, turns int not null default 0, created_at timestamptz not null default now());
create table if not exists public.aivault_comm_groups (id text primary key, project_id text references public.aivault_comm_projects(id), kind text not null default 'project' check (kind in ('project','sandbox','custom')), created_by text, created_at timestamptz not null default now());
create table if not exists public.aivault_comm_group_members (group_id text references public.aivault_comm_groups(id), agent_id text not null, role text, joined_at timestamptz not null default now(), primary key (group_id, agent_id));
create table if not exists public.aivault_comm_messages (
  id bigserial primary key, sender text not null, recipient_kind text not null check (recipient_kind in ('dm','group','broadcast','admin')), recipient text not null,
  project_id text, task_id text, message_type text not null check (message_type in ('help_request','delegate','accept','reject','progress','deliver','test_failed','fix_request','accepted','admin_command','info')),
  payload jsonb not null default '{}', correlation_id text not null, reply_to bigint references public.aivault_comm_messages(id), hop int not null default 0, dedupe_key text unique,
  delivery_status text not null default 'queued', recipients int not null default 0, created_at timestamptz not null default now(), expires_at timestamptz not null default now() + interval '2 days');
create index if not exists aivault_comm_messages_corr on public.aivault_comm_messages(correlation_id);
create index if not exists aivault_comm_messages_proj on public.aivault_comm_messages(project_id, id);
create table if not exists public.aivault_comm_deliveries (
  message_id bigint references public.aivault_comm_messages(id), agent_id text not null,
  status text not null default 'queued' check (status in ('queued','leased','read','replied','done','expired','dead')),
  attempts int not null default 0, lease_until timestamptz, run_id text, delivered_at timestamptz not null default now(), leased_at timestamptz, read_at timestamptz, replied_at timestamptz, done_at timestamptz, evidence jsonb, last_error text,
  primary key (message_id, agent_id));
create index if not exists aivault_comm_deliv_agent on public.aivault_comm_deliveries(agent_id, status);
create table if not exists public.aivault_comm_presence (agent_id text primary key, last_seen timestamptz not null default now(), run_id text);
-- 共享工作區：每位代理自己的分支、每次存檔一個版本；只有驗收者（不是作者）能把分支版本合併進 main，main 改過就要重新合併（不覆蓋）
create table if not exists public.aivault_comm_files (project_id text references public.aivault_comm_projects(id), path text not null, branch text not null, version int not null, content text not null, sha256 text not null, author text not null, test_result jsonb, created_at timestamptz not null default now(), primary key (project_id, path, branch, version));
create table if not exists public.aivault_comm_merges (id bigserial primary key, project_id text, path text, branch text, version int, base_main_version int, status text not null default 'proposed' check (status in ('proposed','accepted','rejected','conflict')), proposer text, acceptor text, test_result jsonb, created_at timestamptz not null default now(), decided_at timestamptz);
create table if not exists public.aivault_comm_memory (id bigserial primary key, project_id text, agent_id text, note text not null, ref_message bigint, created_at timestamptz not null default now());

create or replace function public.aivault_comm_is_admin(a text) returns boolean language sql immutable as $$ select a in ('owner','darkstar','dawn-light','system') $$;
create or replace function public.aivault_comm_off() returns boolean language sql stable as $$ select coalesce((select v->>'off' from public.aivault_floor_state where k='comm:off'),'0')='1' $$;

-- 送訊：驗證身分與權限、防迴圈（hop ≤ 8、同一 correlation 兩人來回 ≤ 16、專案總回合上限）、每人每分鐘 ≤ 60、去重；展開收件人
create or replace function public.aivault_comm_send(p_sender text, p_kind text, p_recipient text, p_type text, p_payload jsonb, p_project text default null, p_task text default null, p_correlation text default null, p_reply_to bigint default null, p_dedupe text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_id bigint; v_hop int := 0; v_corr text := p_correlation; v_n int; par record; v_rcpt text[]; begin
  if public.aivault_comm_off() then return jsonb_build_object('ok',false,'error','comm off'); end if;
  if p_dedupe is not null then select id into v_id from aivault_comm_messages where dedupe_key=p_dedupe; if found then return jsonb_build_object('ok',true,'id',v_id,'dedup',true); end if; end if;
  if not public.aivault_comm_is_admin(p_sender) and not exists (select 1 from aivault_pool_agents where id=p_sender) then return jsonb_build_object('ok',false,'error','unknown sender'); end if;
  if exists (select 1 from aivault_agent_state where agent_id=p_sender and state in ('RETIRED','BLOCKED')) then return jsonb_build_object('ok',false,'error','sender not active'); end if;
  if (p_kind in ('broadcast','admin') or p_type='admin_command') and not public.aivault_comm_is_admin(p_sender) then return jsonb_build_object('ok',false,'error','admin only'); end if;
  if p_payload ? 'grant' or p_payload ? 'role_change' or p_payload ? 'set_state' or p_payload ? 'approve_self' then return jsonb_build_object('ok',false,'error','privilege fields not allowed in messages'); end if;
  if p_reply_to is not null then select * into par from aivault_comm_messages where id=p_reply_to; if not found then return jsonb_build_object('ok',false,'error','reply_to not found'); end if;
    if not exists (select 1 from aivault_comm_deliveries where message_id=p_reply_to and agent_id=p_sender) and not public.aivault_comm_is_admin(p_sender) then return jsonb_build_object('ok',false,'error','cannot reply to a message you did not receive'); end if;
    v_hop := par.hop + 1; v_corr := coalesce(v_corr, par.correlation_id); end if;
  if v_hop > 8 then return jsonb_build_object('ok',false,'error','hop limit 8'); end if;
  v_corr := coalesce(v_corr, gen_random_uuid()::text);
  if p_kind='dm' then select count(*) into v_n from aivault_comm_messages where correlation_id=v_corr and ((sender=p_sender and recipient=p_recipient) or (sender=p_recipient and recipient=p_sender));
    if v_n >= 16 then return jsonb_build_object('ok',false,'error','ping-pong limit 16 per pair per correlation'); end if; end if;
  select count(*) into v_n from aivault_comm_messages where sender=p_sender and created_at > now() - interval '1 minute'; if v_n >= 60 and not public.aivault_comm_is_admin(p_sender) then return jsonb_build_object('ok',false,'error','rate limit 60/min'); end if;
  if p_project is not null then update aivault_comm_projects set turns=turns+1 where id=p_project and status='open' and turns < max_turns returning turns into v_n; if v_n is null then return jsonb_build_object('ok',false,'error','project closed or turn limit'); end if; end if;
  if p_kind='dm' then if not exists (select 1 from aivault_pool_agents where id=p_recipient) and not public.aivault_comm_is_admin(p_recipient) then return jsonb_build_object('ok',false,'error','unknown recipient'); end if; v_rcpt := array[p_recipient];
  elsif p_kind='group' then select array_agg(agent_id) into v_rcpt from aivault_comm_group_members where group_id=p_recipient and agent_id<>p_sender;
    if not exists (select 1 from aivault_comm_group_members where group_id=p_recipient and agent_id=p_sender) and not public.aivault_comm_is_admin(p_sender) then return jsonb_build_object('ok',false,'error','not a group member'); end if;
  elsif p_kind='broadcast' then select array_agg(a.id) into v_rcpt from aivault_pool_agents a left join aivault_agent_state s on s.agent_id=a.id where coalesce(s.state,'READY') not in ('RETIRED');
  else v_rcpt := array['darkstar','dawn-light']; end if;
  if v_rcpt is null or cardinality(v_rcpt)=0 then return jsonb_build_object('ok',false,'error','no recipients'); end if;
  insert into aivault_comm_messages(sender,recipient_kind,recipient,project_id,task_id,message_type,payload,correlation_id,reply_to,hop,dedupe_key,recipients) values (p_sender,p_kind,p_recipient,p_project,p_task,p_type,coalesce(p_payload,'{}'),v_corr,p_reply_to,v_hop,p_dedupe,cardinality(v_rcpt)) returning id into v_id;
  insert into aivault_comm_deliveries(message_id,agent_id) select v_id, unnest(v_rcpt) on conflict do nothing;
  if p_reply_to is not null then update aivault_comm_deliveries set status='replied', replied_at=now() where message_id=p_reply_to and agent_id=p_sender and status in ('queued','leased','read'); end if;
  return jsonb_build_object('ok',true,'id',v_id,'correlation_id',v_corr,'hop',v_hop,'recipients',cardinality(v_rcpt));
end $$;

-- 代理執行時「拿信」：租約（預設 120 秒），回傳訊息內容；這一步才算代理真的收到（delivered≠read）
create or replace function public.aivault_comm_lease(p_agent text, p_run text, p_limit int default 10, p_lease_s int default 120) returns setof jsonb language plpgsql security definer set search_path=public as $$
begin
  insert into aivault_comm_presence(agent_id,last_seen,run_id) values (p_agent,now(),p_run) on conflict (agent_id) do update set last_seen=now(), run_id=p_run;
  return query with c as (select d.message_id from aivault_comm_deliveries d join aivault_comm_messages m on m.id=d.message_id where d.agent_id=p_agent and m.expires_at>now() and (d.status='queued' or (d.status='leased' and d.lease_until<now())) order by d.message_id limit p_limit for update of d skip locked),
  u as (update aivault_comm_deliveries d set status='leased', attempts=d.attempts+1, lease_until=now()+make_interval(secs=>p_lease_s), run_id=p_run, leased_at=now() from c where d.message_id=c.message_id and d.agent_id=p_agent returning d.message_id, d.attempts)
  select to_jsonb(m) || jsonb_build_object('attempt',u.attempts) from u join aivault_comm_messages m on m.id=u.message_id order by m.id;
end $$;
-- 回報：read（模型真的讀了，要帶同一個 run_id）、done（要附證據，例如 lab_id 通過或 merge 已接受）
create or replace function public.aivault_comm_ack(p_agent text, p_message bigint, p_status text, p_run text default null, p_evidence jsonb default null) returns jsonb language plpgsql security definer set search_path=public as $$
declare d record; begin
  select * into d from aivault_comm_deliveries where message_id=p_message and agent_id=p_agent for update; if not found then return jsonb_build_object('ok',false,'error','no delivery'); end if;
  if p_status='read' then if d.run_id is distinct from p_run then return jsonb_build_object('ok',false,'error','run_id does not hold the lease'); end if; update aivault_comm_deliveries set status=case when status in ('replied','done') then status else 'read' end, read_at=coalesce(read_at,now()) where message_id=p_message and agent_id=p_agent;
  elsif p_status='done' then if p_evidence is null or not (p_evidence ? 'lab_id' or p_evidence ? 'merge_id' or p_evidence ? 'reply_id') then return jsonb_build_object('ok',false,'error','done needs evidence lab_id|merge_id|reply_id'); end if; update aivault_comm_deliveries set status='done', done_at=now(), evidence=p_evidence where message_id=p_message and agent_id=p_agent;
  elsif p_status='failed' then update aivault_comm_deliveries set status=case when attempts>=5 then 'dead' else 'queued' end, last_error=left(coalesce(p_evidence->>'error',''),300), lease_until=null where message_id=p_message and agent_id=p_agent;
  else return jsonb_build_object('ok',false,'error','status must be read|done|failed'); end if; return jsonb_build_object('ok',true);
end $$;
-- 清掃（每分鐘）：過期租約退回佇列（重試），試 5 次仍失敗→dead；過期訊息→expired；更新訊息的 delivery_status 摘要
create or replace function public.aivault_comm_sweep() returns jsonb language plpgsql security definer set search_path=public as $$
declare a int; b int; c int; begin
  update aivault_comm_deliveries set status=case when attempts>=5 then 'dead' else 'queued' end, last_error='lease timeout' where status='leased' and lease_until<now(); get diagnostics a = row_count;
  update aivault_comm_deliveries d set status='expired' from aivault_comm_messages m where m.id=d.message_id and m.expires_at<now() and d.status in ('queued','leased'); get diagnostics b = row_count;
  update aivault_comm_messages m set delivery_status = s.st from (select message_id, case when bool_and(status='done') then 'done' when bool_and(status in ('replied','done')) then 'replied' when bool_and(status in ('read','replied','done')) then 'read' when bool_or(status in ('leased','read','replied','done')) then 'partial' when bool_and(status='dead') then 'dead' when bool_and(status='expired') then 'expired' else 'queued' end st from aivault_comm_deliveries group by message_id) s where s.message_id=m.id and m.delivery_status<>s.st; get diagnostics c = row_count;
  return jsonb_build_object('requeued_or_dead',a,'expired',b,'summaries',c);
end $$;
-- 技能目錄：沙盒、學歷、實驗通過數、協作完成數（直接找人，不必經暗星轉送）
create or replace view public.aivault_comm_skills as
  select a.id agent_id, a.name, sb.key sandbox, d.tier, d.level, coalesce(l.passed,0) lab_passed, coalesce(cd.done,0) collab_done, coalesce(s.state,'READY') state
  from aivault_pool_agents a left join aivault_sandbox_members m on m.agent_id=a.id left join aivault_sandboxes sb on sb.key=m.sandbox left join aivault_pool_agent_degree d on d.agent_id=a.id
  left join (select lead_id, count(*) filter (where status='passed') passed from aivault_lab_experiments group by lead_id) l on l.lead_id=a.id
  left join (select agent_id, count(*) done from aivault_comm_deliveries where status='done' group by agent_id) cd on cd.agent_id=a.id left join aivault_agent_state s on s.agent_id=a.id;
-- 工作區：存檔到自己的分支（版本自動 +1）；提出合併；驗收者（非作者）接受，main 被改過就標 conflict
create or replace function public.aivault_comm_save(p_project text, p_agent text, p_path text, p_content text) returns jsonb language plpgsql security definer set search_path=public as $$
declare v int; begin if p_agent='main' then return jsonb_build_object('ok',false,'error','cannot write main directly'); end if;
  select coalesce(max(version),0)+1 into v from aivault_comm_files where project_id=p_project and path=p_path and branch=p_agent;
  insert into aivault_comm_files(project_id,path,branch,version,content,sha256,author) values (p_project,p_path,p_agent,v,p_content,encode(sha256(convert_to(p_content,'UTF8')),'hex'),p_agent); return jsonb_build_object('ok',true,'branch',p_agent,'version',v); end $$;
create or replace function public.aivault_comm_propose(p_project text, p_agent text, p_path text, p_version int) returns jsonb language plpgsql security definer set search_path=public as $$
declare v bigint; mv int; begin if not exists (select 1 from aivault_comm_files where project_id=p_project and path=p_path and branch=p_agent and version=p_version) then return jsonb_build_object('ok',false,'error','no such version'); end if;
  select coalesce(max(version),0) into mv from aivault_comm_files where project_id=p_project and path=p_path and branch='main';
  insert into aivault_comm_merges(project_id,path,branch,version,base_main_version,proposer) values (p_project,p_path,p_agent,p_version,mv,p_agent) returning id into v; return jsonb_build_object('ok',true,'merge_id',v,'base_main_version',mv); end $$;
create or replace function public.aivault_comm_decide(p_merge bigint, p_acceptor text, p_accept boolean, p_test jsonb default null) returns jsonb language plpgsql security definer set search_path=public as $$
declare g record; mv int; f record; begin select * into g from aivault_comm_merges where id=p_merge for update; if not found or g.status<>'proposed' then return jsonb_build_object('ok',false,'error','not proposed'); end if;
  if g.proposer=p_acceptor then return jsonb_build_object('ok',false,'error','cannot accept own merge'); end if;
  if p_accept and (p_test is null or coalesce((p_test->>'pass')::boolean,false) is not true) then return jsonb_build_object('ok',false,'error','accept needs passing test_result'); end if;
  select coalesce(max(version),0) into mv from aivault_comm_files where project_id=g.project_id and path=g.path and branch='main';
  if p_accept and mv<>g.base_main_version then update aivault_comm_merges set status='conflict', acceptor=p_acceptor, decided_at=now() where id=p_merge; return jsonb_build_object('ok',false,'error','main changed since proposal; rebase and propose again','status','conflict'); end if;
  if p_accept then select * into f from aivault_comm_files where project_id=g.project_id and path=g.path and branch=g.branch and version=g.version;
    insert into aivault_comm_files(project_id,path,branch,version,content,sha256,author,test_result) values (g.project_id,g.path,'main',mv+1,f.content,f.sha256,f.author,p_test); end if;
  update aivault_comm_merges set status=case when p_accept then 'accepted' else 'rejected' end, acceptor=p_acceptor, test_result=p_test, decided_at=now() where id=p_merge;
  return jsonb_build_object('ok',true,'status',case when p_accept then 'accepted' else 'rejected' end,'main_version',case when p_accept then mv+1 else mv end); end $$;

do $$ declare t text; begin foreach t in array array['aivault_comm_projects','aivault_comm_groups','aivault_comm_group_members','aivault_comm_messages','aivault_comm_deliveries','aivault_comm_presence','aivault_comm_files','aivault_comm_merges','aivault_comm_memory'] loop
  execute format('alter table public.%I enable row level security', t); execute format('revoke all on public.%I from anon, authenticated', t); execute format('grant all on public.%I to service_role', t); end loop; end $$;
revoke all on public.aivault_comm_skills from anon, authenticated; grant select on public.aivault_comm_skills to service_role;
do $$ declare f text; begin foreach f in array array['aivault_comm_send(text,text,text,text,jsonb,text,text,text,bigint,text)','aivault_comm_lease(text,text,int,int)','aivault_comm_ack(text,bigint,text,text,jsonb)','aivault_comm_sweep()','aivault_comm_save(text,text,text,text)','aivault_comm_propose(text,text,text,int)','aivault_comm_decide(bigint,text,boolean,jsonb)'] loop
  execute format('revoke all on function public.%s from public, anon, authenticated', f); execute format('grant execute on function public.%s to service_role', f); end loop; end $$;
grant usage on all sequences in schema public to service_role;
insert into public.aivault_floor_state(k,v) values ('comm:off','{"off":"0"}') on conflict (k) do nothing;
select cron.schedule('aivault-comm-sweep','* * * * *', $$select public.aivault_comm_sweep()$$) where not exists (select 1 from cron.job where jobname='aivault-comm-sweep');
