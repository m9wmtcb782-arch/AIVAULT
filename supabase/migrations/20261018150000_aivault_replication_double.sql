-- rp2：使用者 09:49 修正：每位代理（含新生代）每天複製 1 次、沒有資格門檻，人口每日倍增，直到硬上限 100,000 停止。
-- 新生代：SLEEPING（只有按需喚醒、在額度內才會呼叫模型）；只繼承模板＋摘要（persona 前 300 字、技能 1 筆減半），model_route 清空＝不繼承任何金鑰；精簡列（目標 ≈2KB）。
-- 資料庫保護：建立前估算（實測每代理位元組 × 數量），超過 350MB（500MB 的 70%）就只建能放下的數量並在稽核記錄「停止原因」。緊急停止：replication:off。
alter table public.aivault_agent_lineage add column if not exists last_replicated_at timestamptz;
drop function if exists public.aivault_replication_eligible();
create or replace function public.aivault_replication_eligible() returns table(agent_id text) language sql stable as $$
  select a.id from public.aivault_pool_agents a join public.aivault_agent_lineage g on g.agent_id=a.id left join public.aivault_agent_state s on s.agent_id=a.id
  where a.id ~ '^ag-\d+$' and g.revoked_at is null and coalesce(s.state,'READY') not in ('RETIRED','BLOCKED')
    and (g.last_replicated_at is null or g.last_replicated_at < now() - interval '20 hours') $$;
create or replace function public.aivault_agent_bytes() returns numeric language sql stable as $$
  select (pg_total_relation_size('public.aivault_pool_agents')+pg_total_relation_size('public.aivault_agent_state')+pg_total_relation_size('public.aivault_agent_lineage')+pg_total_relation_size('public.aivault_ancn_skills'))::numeric / greatest(1,(select count(*) from public.aivault_pool_agents)) $$;
create or replace function public.aivault_replicate_daily() returns jsonb language plpgsql security definer set search_path=public as $$
declare total int; want int; room int; fit int; bpa numeric; dbb numeric; lim numeric := 350*1048576; made int; why text := ''; begin
  if coalesce((select v->>'off' from aivault_floor_state where k='replication:off'),'0')='1' then return jsonb_build_object('ok',false,'error','replication:off (emergency stop)'); end if;
  if not pg_try_advisory_xact_lock(hashtext('aivault-replicate')) then return jsonb_build_object('ok',false,'error','already running'); end if;
  select count(*) into total from aivault_agent_lineage; select count(*) into want from public.aivault_replication_eligible();
  room := greatest(0, 100000 - total); bpa := greatest(public.aivault_agent_bytes(), 1500); dbb := pg_database_size(current_database());
  fit := greatest(0, floor((lim - dbb) / (bpa * 1.3))::int); -- 1.3：索引膨脹與 WAL 安全係數
  made := least(want, room, fit);
  if made < want then why := case when room <= fit then 'hard cap 100000' else 'db guard 70% (would exceed 350MB)' end; end if;
  create temp table _rep on commit drop as select e.agent_id parent, 'ag-'||nextval('aivault_offspring_seq') child from (select agent_id from public.aivault_replication_eligible() order by agent_id limit made) e;
  insert into aivault_pool_agents(id,name,domain,specialty,persona,model_route,avatar,status,stats,zone,parent_agent_id,spawned)
    select r.child, left(a.name,40)||'·'||substr(r.child,4), a.domain, a.specialty, left(a.persona,300), '{}'::jsonb, null, 'idle', '{}'::jsonb, a.zone, a.id, true from _rep r join aivault_pool_agents a on a.id=r.parent;
  insert into aivault_agent_lineage(agent_id,parent_id,generation,template_version) select r.child, r.parent, g.generation+1, 'v1-lean' from _rep r join aivault_agent_lineage g on g.agent_id=r.parent;
  insert into aivault_agent_state(agent_id,state,reason) select child,'SLEEPING','新生，按需喚醒' from _rep on conflict (agent_id) do nothing;
  insert into aivault_ancn_skills(agent_id,skill,level,evidence) select distinct on (r.child) r.child, k.skill, round(k.level*0.5,3), '[]'::jsonb from _rep r join aivault_ancn_skills k on k.agent_id=r.parent order by r.child, k.level desc on conflict do nothing;
  update aivault_agent_lineage g set last_replicated_at=now() from _rep r where g.agent_id=r.parent;
  insert into aivault_audit_events(actor,action,target,detail) values ('system','replicate_daily','city',jsonb_build_object('eligible',want,'made',made,'total_after',total+made,'bytes_per_agent',round(bpa),'db_mb_before',round(dbb/1048576),'stopped_reason',nullif(why,'')));
  return jsonb_build_object('ok',true,'eligible',want,'made',made,'total_after',total+made,'bytes_per_agent',round(bpa),'db_mb_before',round(dbb/1048576),'stopped_reason',nullif(why,'')); end $$;
revoke all on function public.aivault_replicate_daily() from public, anon, authenticated; grant execute on function public.aivault_replicate_daily() to service_role;
revoke all on function public.aivault_replication_eligible() from public, anon, authenticated; grant execute on function public.aivault_replication_eligible() to service_role;
update public.aivault_floor_state set v='{"cap":"none (doubling until 100000)"}' where k='replication:cap';
insert into public.aivault_audit_events(actor,action,target,detail) values ('owner','replication_policy','city','{"decision":"user 2026-10-18 09:49: every agent once/day, no eligibility, until 100000; offspring SLEEPING lean"}');
