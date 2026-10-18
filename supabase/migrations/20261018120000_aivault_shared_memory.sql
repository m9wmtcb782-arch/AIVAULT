-- sm1：全城共享記憶。延伸 aivault_kb（8124889 建）而不另建一套；全部在資料庫函式完成（查、寫、通知都不呼叫模型）。只增不改，不清任何資料。
-- 五層：public 全城、district 同沙盒、project 同專案群組、agent 個人、admin 限暗星／曙光／owner。暗星管技術記憶、曙光管視覺／作品記憶（governor 欄位）。
alter table public.aivault_kb add column if not exists layer text not null default 'public';
alter table public.aivault_kb add column if not exists district text;
alter table public.aivault_kb add column if not exists project_id text;
alter table public.aivault_kb add column if not exists kind text not null default 'solution';
alter table public.aivault_kb add column if not exists status text not null default 'verified';
alter table public.aivault_kb add column if not exists fingerprint text;
alter table public.aivault_kb add column if not exists error_message text;
alter table public.aivault_kb add column if not exists env text;
alter table public.aivault_kb add column if not exists code_version text;
alter table public.aivault_kb add column if not exists repro text;
alter table public.aivault_kb add column if not exists solution text;
alter table public.aivault_kb add column if not exists solved_by text;
alter table public.aivault_kb add column if not exists verifier text;
alter table public.aivault_kb add column if not exists verify_evidence jsonb;
alter table public.aivault_kb add column if not exists parent_id bigint references public.aivault_kb(id);
alter table public.aivault_kb add column if not exists dup_count int not null default 0;
alter table public.aivault_kb add column if not exists hits int not null default 0;
alter table public.aivault_kb add column if not exists governor text;
alter table public.aivault_kb add column if not exists history jsonb not null default '[]';
alter table public.aivault_kb add column if not exists updated_at timestamptz not null default now();
alter table public.aivault_kb add column if not exists revalidate_at timestamptz;
alter table public.aivault_kb add column if not exists expires_at timestamptz;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='aivault_kb_layer_chk') then alter table public.aivault_kb add constraint aivault_kb_layer_chk check (layer in ('public','district','project','agent','admin')); end if;
  if not exists (select 1 from pg_constraint where conname='aivault_kb_kind_chk') then alter table public.aivault_kb add constraint aivault_kb_kind_chk check (kind in ('problem','solution','progress','note','protocol')); end if;
  if not exists (select 1 from pg_constraint where conname='aivault_kb_status_chk') then alter table public.aivault_kb add constraint aivault_kb_status_chk check (status in ('open','solved','verified','stale','rejected')); end if;
end $$;
create index if not exists aivault_kb_fp on public.aivault_kb(fingerprint);
create index if not exists aivault_kb_filter on public.aivault_kb(layer, district, status, updated_at desc);
-- 既有條目：照原本 verified 欄位補 status
update public.aivault_kb set status='open' where not verified and status='verified' and source<>'mem_write';
update public.aivault_kb set kind='protocol' where title like '交接協定%' and kind='solution';
create table if not exists public.aivault_mem_subscriptions (agent_id text not null, target text not null, created_at timestamptz not null default now(), primary key (agent_id, target)); -- target: 'kb:<id>' | 'project:<id>' | 'fp:<fingerprint>'
create table if not exists public.aivault_mem_notify_log (id bigserial primary key, agent_id text, target text, event text, kb_id bigint, message_id bigint, created_at timestamptz not null default now());
create table if not exists public.aivault_mem_queries (id bigserial primary key, agent_id text, q text, fingerprint text, filters jsonb, hits int, top_id bigint, latency_ms numeric, created_at timestamptz not null default now());
-- 編輯歷史：每次更新把舊版重點附進 history（不覆蓋）
create or replace function public.aivault_kb_hist() returns trigger language plpgsql as $$ begin
  if (old.status, old.solution, old.summary, old.verifier) is distinct from (new.status, new.solution, new.summary, new.verifier) then
    new.history := old.history || jsonb_build_array(jsonb_build_object('at', now(), 'status', old.status, 'solution', left(old.solution, 2000), 'summary', left(old.summary, 1000), 'verifier', old.verifier, 'solved_by', old.solved_by)); end if;
  new.updated_at := now(); return new; end $$;
drop trigger if exists aivault_kb_hist on public.aivault_kb; create trigger aivault_kb_hist before update on public.aivault_kb for each row execute function public.aivault_kb_hist();
-- 錯誤指紋：小寫、去掉數字／十六進位／路徑／引號內容／行列號
create or replace function public.aivault_mem_fp(e text) returns text language sql immutable as $$
  select md5(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(lower(coalesce(e,'')), '(/[\w.\-]+)+', '<path>', 'g'), '0x[0-9a-f]+', '<hex>', 'g'), '''[^'']*''|"[^"]*"|`[^`]*`', '<str>', 'g'), '\d+', '<n>', 'g'), '\s+', ' ', 'g')) $$;
-- 密鑰掃描：寫入前拒收看起來像金鑰／密碼／個資的內容
create or replace function public.aivault_mem_secret(t text) returns text language sql immutable as $$
  select case when t ~ '(sk-[A-Za-z0-9]{16,}|gsk_[A-Za-z0-9]{16,}|ghp_[A-Za-z0-9]{20,}|github_pat_\w{20,}|AKIA[0-9A-Z]{16}|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}|xox[bp]-[0-9A-Za-z-]{10,}|-----BEGIN [A-Z ]*PRIVATE KEY|(password|passwd|secret|api[_-]?key|token)\s*[:=]\s*\S{6,})' then 'secret-like content' 
              when t ~ '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}' and t !~ '@(example|mail\.grokbot)\.' then 'email address' else null end $$;
create or replace function public.aivault_mem_can_read(p_agent text, k public.aivault_kb) returns boolean language sql stable as $$
  select case k.layer when 'public' then true
    when 'district' then public.aivault_comm_is_admin(p_agent) or exists (select 1 from public.aivault_sandbox_members m where m.agent_id=p_agent and m.sandbox=k.district)
    when 'project' then public.aivault_comm_is_admin(p_agent) or exists (select 1 from public.aivault_comm_group_members g where g.group_id=k.project_id||'-g' and g.agent_id=p_agent)
    when 'agent' then k.agent_id=p_agent or p_agent='owner'
    else public.aivault_comm_is_admin(p_agent) end $$;
-- 通知訂閱者（經通訊系統；同一條目同一事件同一人只通知一次、每人 10 分鐘內同條目最多 1 次；通知本身不會再觸發通知）
create or replace function public.aivault_mem_notify(p_kb bigint, p_event text) returns int language plpgsql security definer set search_path=public as $$
declare k aivault_kb; s record; n int := 0; r jsonb; begin select * into k from aivault_kb where id=p_kb; if not found then return 0; end if;
  for s in select distinct agent_id, target from aivault_mem_subscriptions where target in ('kb:'||k.id, 'kb:'||coalesce(k.parent_id,k.id), 'fp:'||coalesce(k.fingerprint,'-'), 'project:'||coalesce(k.project_id,'-')) and agent_id<>coalesce(k.agent_id,'') loop
    if not public.aivault_mem_can_read(s.agent_id, k) then continue; end if;
    if exists (select 1 from aivault_mem_notify_log where agent_id=s.agent_id and kb_id=k.id and (event=p_event or created_at>now()-interval '10 minutes')) then continue; end if;
    r := public.aivault_comm_send('system','dm',s.agent_id,'info',jsonb_build_object('text','記憶更新：'||k.title||'（'||p_event||'，狀態 '||k.status||'）','kb_id',k.id,'event',p_event,'notify',true),k.project_id,null,'mem-'||k.id,null,'memn-'||k.id||'-'||p_event||'-'||s.agent_id);
    insert into aivault_mem_notify_log(agent_id,target,event,kb_id,message_id) values (s.agent_id,s.target,p_event,k.id,(r->>'id')::bigint); n := n+1; end loop; return n; end $$;
-- 寫入（問題／解法／進度／筆記）：密鑰掃描、指紋去重（同指紋 → 連到第一筆並計數）
create or replace function public.aivault_mem_write(p_agent text, p_kind text, p_layer text, p_title text, p_body text, p_district text default null, p_project text default null, p_error text default null, p_env text default null, p_code_version text default null, p_repro text default null) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_fp text; v_par bigint; v_id bigint; v_bad text; begin
  if not public.aivault_comm_is_admin(p_agent) and not exists (select 1 from aivault_pool_agents where id=p_agent) then return jsonb_build_object('ok',false,'error','unknown agent'); end if;
  if p_layer='admin' and not public.aivault_comm_is_admin(p_agent) then return jsonb_build_object('ok',false,'error','admin layer is admin-only'); end if;
  v_bad := public.aivault_mem_secret(concat_ws(' ',p_title,p_body,p_error,p_env,p_repro)); if v_bad is not null then return jsonb_build_object('ok',false,'error','rejected: '||v_bad); end if;
  if p_error is not null then v_fp := public.aivault_mem_fp(p_error); select id into v_par from aivault_kb where fingerprint=v_fp and parent_id is null and kind='problem' order by id limit 1; end if;
  insert into aivault_kb(sha256,agent_id,title,summary,source,verified,layer,district,project_id,kind,status,fingerprint,error_message,env,code_version,repro,parent_id,governor,revalidate_at)
    values (encode(sha256(convert_to(concat_ws('|',p_agent,p_title,p_body,p_error,now()::text),'UTF8')),'hex'),p_agent,left(p_title,200),left(p_body,4000),'mem_write',false,p_layer,p_district,p_project,p_kind,case when p_kind='problem' then 'open' else 'open' end,v_fp,left(p_error,4000),left(p_env,500),left(p_code_version,100),left(p_repro,4000),v_par,
      case when p_district in ('image','3d','av','music') then 'dawn-light' else 'darkstar' end, now()+interval '30 days') returning id into v_id;
  if v_par is not null then update aivault_kb set dup_count=dup_count+1 where id=v_par; perform public.aivault_mem_notify(v_par,'duplicate'); end if;
  if p_project is not null then perform public.aivault_mem_notify(v_id,'new'); end if;
  return jsonb_build_object('ok',true,'id',v_id,'fingerprint',v_fp,'duplicate_of',v_par); end $$;
-- 查詢：全文＋指紋，權限、層、區、專案、狀態、時間、版本過濾；只回片段（每筆 ≤ 400 字、最多 10 筆），記錄延遲與命中
create or replace function public.aivault_mem_search(p_agent text, p_q text, p_error text default null, p_layers text[] default null, p_district text default null, p_project text default null, p_status text[] default null, p_since timestamptz default null, p_version text default null, p_k int default 5) returns jsonb language plpgsql security definer set search_path=public as $$
declare t0 timestamptz := clock_timestamp(); v_fp text := case when p_error is not null then public.aivault_mem_fp(p_error) end; v jsonb; n int; tq tsquery; begin
  tq := case when coalesce(trim(p_q),'')='' then null else (select to_tsquery('simple', string_agg(quote_literal(w)||':*',' | ')) from (select w from regexp_split_to_table(lower(regexp_replace(p_q,'[^[:alnum:][:space:]一-龥]',' ','g')),'\s+') w where length(w)>1 limit 8) x) end;
  with c as (select k.*, (case when v_fp is not null and k.fingerprint=v_fp then 10 else 0 end) + coalesce(ts_rank(k.tsv, tq),0) + (case k.status when 'verified' then 2 when 'solved' then 1 else 0 end) score
    from aivault_kb k where (k.expires_at is null or k.expires_at>now()) and k.status<>'rejected'
      and ((v_fp is not null and k.fingerprint=v_fp) or (tq is not null and k.tsv @@ tq))
      and (p_layers is null or k.layer=any(p_layers)) and (p_district is null or k.district=p_district) and (p_project is null or k.project_id=p_project)
      and (p_status is null or k.status=any(p_status)) and (p_since is null or k.updated_at>=p_since) and (p_version is null or k.code_version=p_version)
      and public.aivault_mem_can_read(p_agent,k)
    order by score desc, k.id limit least(greatest(p_k,1),10))
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'kind',kind,'status',status,'layer',layer,'title',title,'snippet',left(coalesce(solution,summary),400),'repro',left(repro,400),'error',left(error_message,200),'author',agent_id,'solved_by',solved_by,'verifier',verifier,'duplicate_of',parent_id,'dups',dup_count,'code_version',code_version,'score',round(score::numeric,3)) order by score desc),'[]'::jsonb), count(*) into v, n from c;
  update aivault_kb set hits=hits+1 where id in (select (x->>'id')::bigint from jsonb_array_elements(v) x);
  insert into aivault_mem_queries(agent_id,q,fingerprint,filters,hits,top_id,latency_ms) values (p_agent,left(p_q,300),v_fp,jsonb_build_object('layers',p_layers,'district',p_district,'project',p_project,'status',p_status),n,(v->0->>'id')::bigint,extract(epoch from clock_timestamp()-t0)*1000);
  return jsonb_build_object('ok',true,'hits',n,'results',v,'latency_ms',round((extract(epoch from clock_timestamp()-t0)*1000)::numeric,2)); end $$;
-- 解決（任何代理，但不能驗證自己的）→ 驗證（必須是第三者，且附真實沙盒通過證據）→ 升為全城公開已驗證知識
create or replace function public.aivault_mem_solve(p_agent text, p_id bigint, p_solution text, p_evidence jsonb default null) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_bad text; begin v_bad := public.aivault_mem_secret(p_solution); if v_bad is not null then return jsonb_build_object('ok',false,'error','rejected: '||v_bad); end if;
  update aivault_kb set solution=left(p_solution,8000), solved_by=p_agent, status='solved', verify_evidence=coalesce(verify_evidence,'{}'::jsonb)||jsonb_build_object('solve',p_evidence) where id=p_id and status in ('open','solved','stale'); if not found then return jsonb_build_object('ok',false,'error','not solvable'); end if;
  perform public.aivault_mem_notify(p_id,'solved'); return jsonb_build_object('ok',true); end $$;
create or replace function public.aivault_mem_verify(p_agent text, p_id bigint, p_pass boolean, p_evidence jsonb) returns jsonb language plpgsql security definer set search_path=public as $$
declare k aivault_kb; begin select * into k from aivault_kb where id=p_id for update; if not found or k.status<>'solved' then return jsonb_build_object('ok',false,'error','not in solved state'); end if;
  if p_agent in (coalesce(k.agent_id,''), coalesce(k.solved_by,'')) then return jsonb_build_object('ok',false,'error','verifier must differ from reporter and solver'); end if;
  if p_evidence is null or not (p_evidence ? 'tests') then return jsonb_build_object('ok',false,'error','evidence must include real sandbox test result'); end if;
  update aivault_kb set status=case when p_pass then 'verified' else 'open' end, verified=p_pass, verifier=p_agent, layer=case when p_pass and layer in ('district','project','agent') then 'public' else layer end, verify_evidence=coalesce(verify_evidence,'{}'::jsonb)||jsonb_build_object('verify',p_evidence), revalidate_at=now()+interval '30 days' where id=p_id;
  perform public.aivault_mem_notify(p_id, case when p_pass then 'verified' else 'verify_failed' end); return jsonb_build_object('ok',true,'status',case when p_pass then 'verified' else 'open' end); end $$;
create or replace function public.aivault_mem_subscribe(p_agent text, p_target text) returns jsonb language sql security definer set search_path=public as $$
  insert into public.aivault_mem_subscriptions(agent_id,target) values (p_agent,p_target) on conflict do nothing returning jsonb_build_object('ok',true) $$;
create or replace view public.aivault_mem_metrics as select
  (select count(*) from public.aivault_mem_queries) queries, (select round(avg(latency_ms),2) from public.aivault_mem_queries) avg_latency_ms,
  (select percentile_cont(0.95) within group (order by latency_ms) from public.aivault_mem_queries) p95_latency_ms,
  (select round(avg((hits>0)::int)::numeric,3) from public.aivault_mem_queries) hit_rate,
  (select count(*) from public.aivault_kb where kind='problem') problems, (select count(*) from public.aivault_kb where kind='problem' and parent_id is not null) duplicates,
  (select round(count(*) filter (where parent_id is not null)::numeric/nullif(count(*),0),3) from public.aivault_kb where kind='problem') duplicate_ratio,
  (select count(*) from public.aivault_kb where status='verified') verified;
do $$ declare t text; begin foreach t in array array['aivault_mem_subscriptions','aivault_mem_notify_log','aivault_mem_queries'] loop
  execute format('alter table public.%I enable row level security', t); execute format('revoke all on public.%I from anon, authenticated', t); execute format('grant all on public.%I to service_role', t); end loop; end $$;
revoke all on public.aivault_mem_metrics from anon, authenticated; grant select on public.aivault_mem_metrics to service_role;
do $$ declare f text; begin foreach f in array array['aivault_mem_write(text,text,text,text,text,text,text,text,text,text,text)','aivault_mem_search(text,text,text,text[],text,text,text[],timestamptz,text,int)','aivault_mem_solve(text,bigint,text,jsonb)','aivault_mem_verify(text,bigint,boolean,jsonb)','aivault_mem_subscribe(text,text)','aivault_mem_notify(bigint,text)'] loop
  execute format('revoke all on function public.%s from public, anon, authenticated', f); execute format('grant execute on function public.%s to service_role', f); end loop; end $$;
grant usage on all sequences in schema public to service_role;
