-- an1：ANCN 神經協作網路。只增不改：技能（多技能、與學歷／權限分開）、稀疏邊（只在需要時建立，權重只由已驗證結果更新）、按需啟動流水線紀錄。全部資料庫函式，不呼叫模型。
-- 緊急停止：aivault_floor_state k='ancn:off' v={"off":"1"}（啟動、自動求助、權重更新全停）
create table if not exists public.aivault_ancn_skills (agent_id text not null, skill text not null, level numeric not null default 0, evidence jsonb not null default '[]', updated_at timestamptz not null default now(), primary key (agent_id, skill));
create index if not exists aivault_ancn_skills_skill on public.aivault_ancn_skills(skill, level desc);
create table if not exists public.aivault_ancn_edges (source text not null, target text not null, relation text not null check (relation in ('help','verify','handoff','review','build')),
  success int not null default 0, fail int not null default 0, last_at timestamptz, weight numeric not null default 0.5, evidence jsonb not null default '[]', available boolean not null default true, created_at timestamptz not null default now(),
  primary key (source, target, relation), check (source <> target));
create index if not exists aivault_ancn_edges_src on public.aivault_ancn_edges(source, weight desc);
create table if not exists public.aivault_ancn_activations (id bigserial primary key, requester text not null, skill text, goal text, kb_id bigint, status text not null default 'queued' check (status in ('queued','memory_hit','activated','building','verifying','done','failed','stopped','timeout')),
  memory_hits jsonb, picked jsonb, message_id bigint, dedupe_key text unique, deadline timestamptz not null default now() + interval '2 hours', result jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create or replace function public.aivault_ancn_off() returns boolean language sql stable as $$ select coalesce((select v->>'off' from public.aivault_floor_state where k='ancn:off'),'0')='1' $$;
-- 神經元狀態（對應既有狀態機；學歷、技能、權限分開欄位）
create or replace view public.aivault_ancn_neurons as
  select a.id agent_id, a.name, case when s.state='SLEEPING' or s.state='RETIRED' or s.state='BLOCKED' then '離線'
    when exists (select 1 from public.aivault_comm_deliveries d where d.agent_id=a.id and d.status='leased' and d.lease_until>now()) then '工作'
    when exists (select 1 from public.aivault_lab_experiments l where (l.lead_id=a.id or l.tester_id=a.id or l.verifier_id=a.id) and l.status='running') then '測試'
    when exists (select 1 from public.aivault_pool_agent_learning g where g.agent_id=a.id and g.created_at>now()-interval '15 minutes') then '學習' else '待命' end neuron_state,
    coalesce(s.state,'READY') machine_state, d.tier degree_tier, d.level degree_level, public.aivault_comm_is_admin(a.id) is_admin,
    (select coalesce(jsonb_object_agg(k.skill, k.level),'{}') from public.aivault_ancn_skills k where k.agent_id=a.id) skills
  from public.aivault_pool_agents a left join public.aivault_agent_state s on s.agent_id=a.id left join public.aivault_pool_agent_degree d on d.agent_id=a.id;
-- 初始技能（只從真實紀錄來：所屬沙盒 0.1、實驗通過每件 +0.2）
insert into public.aivault_ancn_skills(agent_id, skill, level, evidence) select m.agent_id, m.sandbox, 0.1, '["sandbox membership"]' from public.aivault_sandbox_members m on conflict do nothing;
update public.aivault_ancn_skills k set level = least(1, 0.1 + 0.2*x.n), evidence = evidence || jsonb_build_array('lab passed x'||x.n) from (select lead_id, coalesce(sandbox,'code') sb, count(*) n from public.aivault_lab_experiments where status='passed' group by 1,2) x where k.agent_id=x.lead_id and k.skill=x.sb and k.level < least(1, 0.1 + 0.2*x.n);
-- 權重更新：只接受可在資料庫查證的證據（kb 已驗證、merge 已接受、lab 已通過）；權重 = 成功率(拉普拉斯) × 品質，不看訊息數、不看互評
create or replace function public.aivault_ancn_learn(p_source text, p_target text, p_relation text, p_success boolean, p_evidence jsonb, p_quality numeric default 1) returns jsonb language plpgsql security definer set search_path=public as $$
declare ok boolean := false; e record; begin
  if public.aivault_ancn_off() then return jsonb_build_object('ok',false,'error','ancn off'); end if;
  if p_evidence ? 'kb_id' then ok := exists (select 1 from aivault_kb where id=(p_evidence->>'kb_id')::bigint and status='verified' and verifier is not null and (verifier not in (p_source, p_target) or (p_relation='verify' and verifier=p_target)));
  elsif p_evidence ? 'merge_id' then ok := exists (select 1 from aivault_comm_merges where id=(p_evidence->>'merge_id')::bigint and status in ('accepted','rejected') and (test_result->>'by')='lab-runner');
  elsif p_evidence ? 'lab_id' then ok := exists (select 1 from aivault_lab_experiments where id=(p_evidence->>'lab_id')::bigint and status in ('passed','failed')); end if;
  if not ok then return jsonb_build_object('ok',false,'error','unverified evidence; weight unchanged'); end if;
  if exists (select 1 from aivault_ancn_edges where source=p_source and target=p_target and relation=p_relation and evidence @> jsonb_build_array(p_evidence)) then return jsonb_build_object('ok',false,'error','evidence already counted'); end if;
  insert into aivault_ancn_edges(source,target,relation) values (p_source,p_target,p_relation) on conflict do nothing;
  update aivault_ancn_edges set success=success+p_success::int, fail=fail+(not p_success)::int, last_at=now(), evidence=evidence||jsonb_build_array(p_evidence),
    weight=round(((success+p_success::int+1)::numeric/(success+fail+3)) * greatest(0.2,least(1,coalesce(p_quality,1))),4) where source=p_source and target=p_target and relation=p_relation returning * into e;
  if p_success then insert into aivault_ancn_skills(agent_id,skill,level,evidence) select p_target, coalesce(p_evidence->>'skill','code'), 0.15, jsonb_build_array(p_evidence) on conflict (agent_id,skill) do update set level=least(1,aivault_ancn_skills.level+0.05), evidence=aivault_ancn_skills.evidence||jsonb_build_array(p_evidence), updated_at=now(); end if;
  return jsonb_build_object('ok',true,'weight',e.weight,'success',e.success,'fail',e.fail); end $$;
-- 選神經元：技能索引 × 來自請求者的邊權重 × 可用（不在離線、沒有過多未處理信件），排除自己
create or replace function public.aivault_ancn_pick(p_requester text, p_skill text, p_k int default 3) returns jsonb language sql stable security definer set search_path=public as $$
  select coalesce(jsonb_agg(x order by x->>'score' desc),'[]') from (select jsonb_build_object('agent_id',k.agent_id,'skill_level',k.level,'edge_weight',coalesce(e.weight,0.5),'score',round(k.level*0.6+coalesce(e.weight,0.5)*0.4,4)) x
    from aivault_ancn_skills k left join aivault_ancn_edges e on e.source=p_requester and e.target=k.agent_id and e.relation='help' left join aivault_agent_state s on s.agent_id=k.agent_id
    where k.skill=p_skill and k.agent_id<>p_requester and coalesce(s.state,'READY') not in ('RETIRED','BLOCKED') and coalesce(e.available,true)
      and (select count(*) from aivault_comm_deliveries d where d.agent_id=k.agent_id and d.status in ('queued','leased')) < 20
    order by k.level*0.6+coalesce(e.weight,0.5)*0.4 desc, random() limit least(greatest(p_k,1),10)) t $$;
-- 按需啟動：記憶查詢 → 命中已驗證就直接回（不啟動任何人）→ 否則挑神經元、經通訊系統送 help_request（自動），記錄流水線
create or replace function public.aivault_ancn_activate(p_requester text, p_skill text, p_goal text, p_error text default null, p_kb bigint default null) returns jsonb language plpgsql security definer set search_path=public as $$
declare mem jsonb; pk jsonb; v_id bigint; tgt text; m jsonb; dk text := 'ancn-'||p_requester||'-'||coalesce(p_kb::text, md5(coalesce(p_goal,'')||coalesce(p_error,''))); begin
  if public.aivault_ancn_off() then return jsonb_build_object('ok',false,'error','ancn emergency stop'); end if;
  select id into v_id from aivault_ancn_activations where dedupe_key=dk; if found then return jsonb_build_object('ok',true,'id',v_id,'dedup',true); end if;
  mem := public.aivault_mem_search(p_requester, p_goal, p_error, null, null, null, array['verified'], null, null, 3);
  if (mem->>'hits')::int > 0 then insert into aivault_ancn_activations(requester,skill,goal,kb_id,status,memory_hits,dedupe_key) values (p_requester,p_skill,left(p_goal,500),p_kb,'memory_hit',mem->'results',dk) returning id into v_id;
    return jsonb_build_object('ok',true,'id',v_id,'status','memory_hit','results',mem->'results','model_calls',0); end if;
  pk := public.aivault_ancn_pick(p_requester, p_skill, 3); tgt := pk->0->>'agent_id'; if tgt is null then return jsonb_build_object('ok',false,'error','no neuron for skill '||p_skill); end if;
  insert into aivault_ancn_activations(requester,skill,goal,kb_id,status,memory_hits,picked,dedupe_key) values (p_requester,p_skill,left(p_goal,500),p_kb,'activated',mem->'results',pk,dk) returning id into v_id;
  m := public.aivault_comm_send(p_requester,'dm',tgt,'help_request',jsonb_build_object('text','求助：'||left(p_goal,400),'kb_id',p_kb,'activation_id',v_id,'skill',p_skill),null,null,'ancn-'||v_id,null,dk||'-msg');
  update aivault_ancn_activations set message_id=(m->>'id')::bigint, status=case when (m->>'ok')::boolean then 'activated' else 'failed' end, result=case when (m->>'ok')::boolean then null else m end where id=v_id;
  return jsonb_build_object('ok',(m->>'ok')::boolean,'id',v_id,'status','activated','helper',tgt,'picked',pk,'message',m); end $$;
create or replace function public.aivault_ancn_sweep() returns int language sql security definer set search_path=public as $$
  with u as (update aivault_ancn_activations set status='timeout', updated_at=now() where status in ('queued','activated','building','verifying') and deadline<now() returning 1) select count(*)::int from u $$;
do $$ declare t text; begin foreach t in array array['aivault_ancn_skills','aivault_ancn_edges','aivault_ancn_activations'] loop
  execute format('alter table public.%I enable row level security', t); execute format('revoke all on public.%I from anon, authenticated', t); execute format('grant all on public.%I to service_role', t); end loop; end $$;
revoke all on public.aivault_ancn_neurons from anon, authenticated; grant select on public.aivault_ancn_neurons to service_role;
do $$ declare f text; begin foreach f in array array['aivault_ancn_learn(text,text,text,boolean,jsonb,numeric)','aivault_ancn_pick(text,text,int)','aivault_ancn_activate(text,text,text,text,bigint)','aivault_ancn_sweep()'] loop
  execute format('revoke all on function public.%s from public, anon, authenticated', f); execute format('grant execute on function public.%s to service_role', f); end loop; end $$;
grant usage on all sequences in schema public to service_role;
insert into public.aivault_floor_state(k,v) values ('ancn:off','{"off":"0"}') on conflict (k) do nothing;
select cron.schedule('aivault-ancn-sweep','*/5 * * * *', $$select public.aivault_ancn_sweep()$$) where not exists (select 1 from cron.job where jobname='aivault-ancn-sweep');
