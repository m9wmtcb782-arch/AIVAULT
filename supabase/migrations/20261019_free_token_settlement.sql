-- AIVAULT FREE-ONLY reservation lifecycle, draft migration (NOT APPLIED).
-- Must be reviewed alongside 20261019_free_token_quota.sql before deployment.
-- Caller must use service_role; never expose service_role credentials to browsers.
create or replace function public.aivault_finish_free_reservation(
  p_reservation uuid, p_action text, p_actual_tokens bigint default 0
) returns text language plpgsql security definer set search_path = '' as $$
declare
  v public.aivault_free_token_reservations%rowtype;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'FORBIDDEN'; end if;
  if p_action not in ('SETTLE', 'RELEASE') or p_actual_tokens is null or p_actual_tokens < 0 then
    raise exception 'INVALID_ACTION';
  end if;
  select * into v from public.aivault_free_token_reservations
    where id = p_reservation for update;
  if not found then raise exception 'RESERVATION_NOT_FOUND'; end if;
  if v.state <> 'RESERVED' then return v.state; end if;
  if p_action = 'SETTLE' and p_actual_tokens > v.tokens_reserved then
    raise exception 'ACTUAL_USAGE_EXCEEDS_RESERVATION';
  end if;
  -- Serialize account mutations; updates are atomic within this transaction.
  update public.aivault_free_token_accounts
    set reserved_requests = reserved_requests - 1,
        reserved_tokens = reserved_tokens - v.tokens_reserved,
        spent_requests = spent_requests + case when p_action = 'SETTLE' then 1 else 0 end,
        spent_tokens = spent_tokens + case when p_action = 'SETTLE' then p_actual_tokens else 0 end,
        updated_at = now()
    where id = v.account_id;
  if not found then raise exception 'ACCOUNT_NOT_FOUND'; end if;
  update public.aivault_free_token_reservations
    set state = case when p_action = 'SETTLE' then 'SETTLED' else 'RELEASED' end
    where id = v.id;
  return case when p_action = 'SETTLE' then 'SETTLED' else 'RELEASED' end;
end $$;

create or replace function public.aivault_reclaim_expired_free_reservations(
  p_limit integer default 100
) returns integer language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_count integer := 0;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'FORBIDDEN'; end if;
  if p_limit is null or p_limit < 1 or p_limit > 1000 then raise exception 'INVALID_LIMIT'; end if;
  -- Claim reservation row locks to avoid double release. Processing uses same transaction.
  for v_id in select id from public.aivault_free_token_reservations
    where state = 'RESERVED' and expires_at < now()
    order by expires_at, id limit p_limit for update skip locked
  loop
    perform public.aivault_finish_free_reservation(v_id, 'RELEASE', 0);
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;
revoke all on function public.aivault_finish_free_reservation(uuid,text,bigint)
  from public, anon, authenticated;
grant execute on function public.aivault_finish_free_reservation(uuid,text,bigint)
  to service_role;
revoke all on function public.aivault_reclaim_expired_free_reservations(integer)
  from public, anon, authenticated;
grant execute on function public.aivault_reclaim_expired_free_reservations(integer)
  to service_role;
-- Important limitations: reservation expiry must not imply provider cancellation;
-- settle only after confirmed usage, reconcile overage separately and halt dispatch.
-- No automatic cron, provider calls, registration, or live traffic enabled here.
