-- rp3：使用者 2026-10-18 10:30 決定：複製上限 100,000 → 300,000（新增遷移，不改舊檔）。
-- 儲存保護改為 450MB（免費 500MB 留 50MB 安全邊際），保護優先於上限：fit=(450MB-目前DB)/(實測每代理位元組×1.3)，made=least(eligible, cap餘額, fit)。
-- 保護值可在 aivault_floor_state k='replication:guard_mb' 調低（預設 450，函式內不允許超過 470）。緊急停止不變：replication:off。不刪除/重設任何代理。
-- 復原：重新執行 20261018150000_aivault_replication_double.sql（回到 10 萬/350MB）。
create or replace function public.aivault_replicate_daily() returns jsonb language plpgsql security definer set search_path=public as $$
declare total int; want int; room int; fit int; bpa numeric; dbb numeric; lim numeric := least(470, coalesce((select (v->>'mb')::numeric from aivault_floor_state where k='replication:guard_mb'),450))*1048576; made int; why text := ''; begin
  if coalesce((select v->>'off' from aivault_floor_state where k='replication:off'),'0')='1' then return jsonb_build_object('ok',false,'error','replication:off (emergency stop)'); end if;
  if not pg_try_advisory_xact_lock(hashtext('aivault-replicate')) then return jsonb_build_object('ok',false,'error','already running'); end if;
  select count(*) into total from aivault_agent_lineage; select count(*) into want from public.aivault_replication_eligible();
  room := greatest(0, 300000 - total); bpa := greatest(public.aivault_agent_bytes(), 1500); dbb := pg_database_size(current_database());
  fit := greatest(0, floor((lim - dbb) / (bpa * 1.3))::int); -- 1.3：索引膨脹與 WAL 安全係數
  made := least(want, room, fit);
  if made < want then why := case when room <= fit then 'hard cap 300000' else 'db guard (would exceed '||round(lim/1048576)||'MB of 500MB free)' end; end if;
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
insert into public.aivault_floor_state(k,v) values ('replication:guard_mb','{"mb":450}') on conflict (k) do nothing;
update public.aivault_floor_state set v='{"cap":"none (doubling until 300000; db guard 450MB wins)"}' where k='replication:cap';
insert into public.aivault_audit_events(actor,action,target,detail) values ('owner','replication_policy','city','{"decision":"user 2026-10-18 10:30: cap 100000 -> 300000; storage guard 450MB of free 500MB takes precedence"}');
