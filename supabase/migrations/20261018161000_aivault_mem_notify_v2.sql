-- sm2b：通知也送給作者本人（訂閱者）與作者的上級（supervisor）；仍是每人每條每事件一次、10 分鐘節流、通知不觸發通知、不呼叫模型。
create or replace function public.aivault_mem_notify(p_kb bigint, p_event text) returns int language plpgsql security definer set search_path=public as $$
declare k aivault_kb; s record; n int := 0; r jsonb; begin select * into k from aivault_kb where id=p_kb; if not found then return 0; end if;
  for s in select distinct agent_id, target from (select agent_id, target from aivault_mem_subscriptions where target in ('kb:'||k.id, 'kb:'||coalesce(k.parent_id,k.id), 'fp:'||coalesce(k.fingerprint,'-'), 'project:'||coalesce(k.project_id,'-')) union select a.supervisor_id, 'supervisor' from aivault_pool_agents a where a.id=k.agent_id and a.supervisor_id is not null) z where agent_id is not null loop
    if not public.aivault_mem_can_read(s.agent_id, k) then continue; end if;
    if exists (select 1 from aivault_mem_notify_log where agent_id=s.agent_id and kb_id=k.id and (event=p_event or created_at>now()-interval '10 minutes')) then continue; end if;
    r := public.aivault_comm_send('system','dm',s.agent_id,'info',jsonb_build_object('text','記憶更新：'||k.title||'（'||p_event||'，狀態 '||k.status||'）','kb_id',k.id,'event',p_event,'notify',true),k.project_id,null,'mem-'||k.id,null,'memn-'||k.id||'-'||p_event||'-'||s.agent_id);
    insert into aivault_mem_notify_log(agent_id,target,event,kb_id,message_id) values (s.agent_id,s.target,p_event,k.id,(r->>'id')::bigint); n := n+1; end loop; return n; end $$;
