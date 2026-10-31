-- AIVAULT shared worker lease foundation (review before applying)
-- This migration does not call any AI provider or start any worker.
create or replace function public.aivault_claim_learning_batch(p_limit integer default 10)
returns table(agent_id text, mission text, execution_id uuid, lease_until timestamptz)
language plpgsql security invoker set search_path=public
as $$
begin
  if current_user not in ('postgres','service_role') then
    raise exception 'service_role required';
  end if;
  return query
  with selected as (
    select d.agent_id from public.aivault_learning_dispatch d
    where (d.state in ('waiting_executor','retry_wait') and (d.next_due is null or d.next_due<=now()))
       or (d.state='leased' and d.lease_until<now())
    order by d.next_due nulls first,d.agent_id
    for update skip locked
    limit least(greatest(p_limit,1),100)
  ), claimed as (
    update public.aivault_learning_dispatch d
    set state='leased',lease_until=now()+interval '2 minutes',
        execution_id=gen_random_uuid(),updated_at=now()
    from selected s where d.agent_id=s.agent_id
    returning d.agent_id,d.mission,d.execution_id,d.lease_until
  )
  select c.agent_id,c.mission,c.execution_id,c.lease_until from claimed c;
end $$;
revoke all on function public.aivault_claim_learning_batch(integer) from public,anon,authenticated;
grant execute on function public.aivault_claim_learning_batch(integer) to service_role;

create or replace function public.aivault_finish_learning_task(
 p_agent_id text,p_execution_id uuid,p_success boolean,p_error text default null
) returns boolean
language plpgsql security invoker set search_path=public
as $$
begin
 if current_user not in ('postgres','service_role') then raise exception 'service_role required'; end if;
 update public.aivault_learning_dispatch d
 set state=case when p_success then 'verifying' else 'retry_wait' end,
     lease_until=null, last_error=case when p_success then null else left(coalesce(p_error,'worker_failed'),500) end,
     next_due=case when p_success then now() else now()+interval '5 minutes' end,
     updated_at=now()
 where d.agent_id=p_agent_id and d.execution_id=p_execution_id
 and d.state='leased' and d.lease_until>now();
 return found;
end $$;
revoke all on function public.aivault_finish_learning_task(text,uuid,boolean,text) from public,anon,authenticated;
grant execute on function public.aivault_finish_learning_task(text,uuid,boolean,text) to service_role;
