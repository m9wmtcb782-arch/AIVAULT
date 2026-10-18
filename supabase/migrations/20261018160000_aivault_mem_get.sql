-- sm2：單筆讀取（暗星／曙光引用 mem#id 時用；與代理同一套權限檢查），回傳與 aivault_mem_search 相同形狀，並記錄查詢。
create or replace function public.aivault_mem_get(p_agent text, p_id bigint) returns jsonb language plpgsql security definer set search_path=public as $$
declare k aivault_kb; t0 timestamptz := clock_timestamp(); begin select * into k from aivault_kb where id=p_id; if not found or not public.aivault_mem_can_read(p_agent,k) then return null; end if;
  update aivault_kb set hits=hits+1 where id=p_id;
  insert into aivault_mem_queries(agent_id,q,filters,hits,top_id,latency_ms) values (p_agent,'get mem#'||p_id,'{"get":true}',1,p_id,extract(epoch from clock_timestamp()-t0)*1000);
  return jsonb_build_object('id',k.id,'kind',k.kind,'status',k.status,'layer',k.layer,'title',k.title,'snippet',left(coalesce(k.solution,k.summary),400),'repro',left(k.repro,400),'error',left(k.error_message,200),'author',k.agent_id,'solved_by',k.solved_by,'verifier',k.verifier,'duplicate_of',k.parent_id,'code_version',k.code_version); end $$;
revoke all on function public.aivault_mem_get(text,bigint) from public, anon, authenticated; grant execute on function public.aivault_mem_get(text,bigint) to service_role;
