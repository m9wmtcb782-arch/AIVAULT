-- rp1：自動複製（使用者 2026-10-18 09:48 決定：不需擁有者開啟，每日 pg_cron 自動執行，上限 100,000）。緊急停止仍是 replication:off，但預設開啟。
-- 安全閘：資格（學階 L3+ 且實驗工廠至少 1 件通過＝沿用升級規則）、每代理每日 1 次、全城每日上限（replication:cap，預設 50）、
-- 新代理一律 SLEEPING（未喚醒前不呼叫模型、不吃額度；資料庫 >70% 或額度睡眠時理由註明）、不繼承任何金鑰（model_route 清空）、唯一 ID、稽核、族譜可撤銷（撤銷＝RETIRED，不刪除）。
alter table public.aivault_agent_lineage add column if not exists revoked_at timestamptz;
alter table public.aivault_agent_lineage add column if not exists revoked_by text;
create sequence if not exists public.aivault_offspring_seq start 100001;
create or replace function public.aivault_replication_eligible() returns table(agent_id text, tier int, level int, lab_passed bigint) language sql stable as $$
  select d.agent_id, d.tier, d.level, l.n from public.aivault_pool_agent_degree d join (select lead_id, count(*) n from public.aivault_lab_experiments where status='passed' group by 1) l on l.lead_id=d.agent_id
  join public.aivault_pool_agents a on a.id=d.agent_id left join public.aivault_agent_state s on s.agent_id=d.agent_id left join public.aivault_agent_lineage g on g.agent_id=d.agent_id
  where d.tier>=3 and l.n>=1 and coalesce(s.state,'READY') not in ('RETIRED','BLOCKED') and g.revoked_at is null
    and not public.aivault_comm_is_admin(d.agent_id) and d.agent_id ~ '^ag-\d+$'
    and not exists (select 1 from public.aivault_audit_events e where e.action='replicate' and e.actor=d.agent_id and e.created_at > now() - interval '1 day') $$;
create or replace function public.aivault_replicate_daily() returns jsonb language plpgsql security definer set search_path=public as $$
declare cap int := coalesce((select (v->>'cap')::int from aivault_floor_state where k='replication:cap'),50); total int; dbmb numeric; sleepq boolean; r record; nid text; made int := 0; why text; g int; begin
  if coalesce((select v->>'off' from aivault_floor_state where k='replication:off'),'0')='1' then return jsonb_build_object('ok',false,'error','replication:off (emergency stop)'); end if;
  if pg_try_advisory_xact_lock(hashtext('aivault-replicate')) is false then return jsonb_build_object('ok',false,'error','already running'); end if;
  cap := least(cap, greatest(0, cap - (select count(*) from aivault_audit_events where action='replicate' and created_at > date_trunc('day', now()))));
  dbmb := pg_database_size(current_database())/1048576.0; sleepq := coalesce((select (v->>'until')::timestamptz > now() from aivault_floor_state where k='quota:sleep'), false);
  why := '新生代理，未喚醒前不呼叫模型' || case when dbmb > 350 then '；資料庫已超過 70%（'||round(dbmb)||'MB/500MB）' else '' end || case when sleepq then '；目前模型額度睡眠中' else '' end;
  for r in select * from public.aivault_replication_eligible() order by tier desc, level desc, lab_passed desc limit cap loop
    select count(*) into total from aivault_agent_lineage; if total >= 100000 then exit; end if;
    nid := 'ag-' || nextval('aivault_offspring_seq'); select coalesce(generation,0)+1 into g from aivault_agent_lineage where agent_id=r.agent_id;
    insert into aivault_pool_agents(id,name,domain,specialty,persona,model_route,avatar,status,stats,zone,parent_agent_id,spawned)
      select nid, a.name||'·'||substr(nid,4), a.domain, a.specialty, a.persona, '{}'::jsonb, a.avatar, 'idle', jsonb_build_object('born',now(),'parent',a.id), a.zone, a.id, true from aivault_pool_agents a where a.id=r.agent_id;
    insert into aivault_agent_lineage(agent_id,parent_id,generation,template_version) values (nid, r.agent_id, coalesce(g,1), 'v1');
    insert into aivault_agent_state(agent_id,state,reason) values (nid,'SLEEPING',why) on conflict (agent_id) do update set state='SLEEPING', reason=excluded.reason;
    insert into aivault_ancn_skills(agent_id,skill,level,evidence) select nid, skill, round(level*0.5,3), jsonb_build_array('inherited at 50% from '||r.agent_id) from aivault_ancn_skills where agent_id=r.agent_id on conflict do nothing;
    insert into aivault_audit_events(actor,action,target,detail) values (r.agent_id,'replicate',nid,jsonb_build_object('tier',r.tier,'level',r.level,'lab_passed',r.lab_passed,'generation',g,'db_mb',round(dbmb),'quota_sleeping',sleepq));
    made := made + 1; end loop;
  insert into aivault_audit_events(actor,action,target,detail) values ('system','replicate_daily','city',jsonb_build_object('made',made,'cap',cap,'db_mb',round(dbmb)));
  return jsonb_build_object('ok',true,'made',made,'cap_today',cap,'db_mb',round(dbmb),'total',(select count(*) from aivault_agent_lineage)); end $$;
-- 撤銷族譜（只限 owner／暗星／曙光）：該代理與所有後代改 RETIRED，保留紀錄
create or replace function public.aivault_lineage_revoke(p_agent text, p_by text) returns jsonb language plpgsql security definer set search_path=public as $$
declare n int; begin if not public.aivault_comm_is_admin(p_by) then return jsonb_build_object('ok',false,'error','admin only'); end if;
  with recursive t as (select agent_id from aivault_agent_lineage where agent_id=p_agent union select l.agent_id from aivault_agent_lineage l join t on l.parent_id=t.agent_id)
  , u as (update aivault_agent_lineage set revoked_at=now(), revoked_by=p_by where agent_id in (select agent_id from t) and revoked_at is null returning agent_id)
  , s as (update aivault_agent_state set state='RETIRED', reason='族譜撤銷 by '||p_by, since=now() where agent_id in (select agent_id from u) returning 1)
  select count(*) into n from u; insert into aivault_audit_events(actor,action,target,detail) values (p_by,'lineage_revoke',p_agent,jsonb_build_object('count',n)); return jsonb_build_object('ok',true,'revoked',n); end $$;
revoke all on function public.aivault_replicate_daily() from public, anon, authenticated; grant execute on function public.aivault_replicate_daily() to service_role;
revoke all on function public.aivault_lineage_revoke(text,text) from public, anon, authenticated; grant execute on function public.aivault_lineage_revoke(text,text) to service_role;
revoke all on function public.aivault_replication_eligible() from public, anon, authenticated; grant execute on function public.aivault_replication_eligible() to service_role;
insert into public.aivault_floor_state(k,v) values ('replication:cap','{"cap":50}') on conflict (k) do nothing;
update public.aivault_floor_state set v='{"off":"0"}' where k='replication:off';
insert into public.aivault_audit_events(actor,action,target,detail) values ('owner','replication_auto_on','city','{"decision":"user 2026-10-18 09:48: automatic daily, cap 100000"}');
select cron.schedule('aivault-replicate-daily','15 19 * * *', $$select public.aivault_replicate_daily()$$) where not exists (select 1 from cron.job where jobname='aivault-replicate-daily');
