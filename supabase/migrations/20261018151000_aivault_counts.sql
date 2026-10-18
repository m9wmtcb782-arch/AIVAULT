-- rp2b：人口變大後頁面改用資料庫彙總（REST 每次最多回 1000 列，原本逐列計數會失真）；新生 SLEEPING 代理不被自動挑中（只能按需喚醒）。
create or replace function public.aivault_city_counts() returns jsonb language sql stable security definer set search_path=public as $$
  select jsonb_build_object(
    'states', (select jsonb_object_agg(state, n) from (select state, count(*) n from aivault_agent_state group by 1) x),
    'neurons', (select jsonb_object_agg(st, n) from (select case when s.state in ('SLEEPING','RETIRED','BLOCKED') then '離線' when d.agent_id is not null then '工作' else '待命' end st, count(*) n
        from aivault_agent_state s left join (select distinct agent_id from aivault_comm_deliveries where status='leased' and lease_until>now()) d on d.agent_id=s.agent_id group by 1) y),
    'members', (select jsonb_object_agg(sandbox, n) from (select sandbox, count(*) n from aivault_sandbox_members group by 1) z),
    'offspring', (select count(*) from aivault_agent_lineage where generation>0), 'population', (select count(*) from aivault_agent_lineage where revoked_at is null),
    'db_mb', round(pg_database_size(current_database())/1048576.0,1)) $$;
revoke all on function public.aivault_city_counts() from public, anon, authenticated; grant execute on function public.aivault_city_counts() to service_role;
create or replace function public.aivault_ancn_pick(p_requester text, p_skill text, p_k int default 3) returns jsonb language sql stable security definer set search_path=public as $$
  select coalesce(jsonb_agg(x order by x->>'score' desc),'[]') from (select jsonb_build_object('agent_id',k.agent_id,'skill_level',k.level,'edge_weight',coalesce(e.weight,0.5),'score',round(k.level*0.6+coalesce(e.weight,0.5)*0.4,4)) x
    from aivault_ancn_skills k left join aivault_ancn_edges e on e.source=p_requester and e.target=k.agent_id and e.relation='help' left join aivault_agent_state s on s.agent_id=k.agent_id
    where k.skill=p_skill and k.agent_id<>p_requester and coalesce(s.state,'READY') not in ('RETIRED','BLOCKED') and not (s.state='SLEEPING' and s.reason like '新生%') and coalesce(e.available,true)
      and (select count(*) from aivault_comm_deliveries d where d.agent_id=k.agent_id and d.status in ('queued','leased')) < 20
    order by k.level*0.6+coalesce(e.weight,0.5)*0.4 desc, random() limit least(greatest(p_k,1),10)) t $$;
