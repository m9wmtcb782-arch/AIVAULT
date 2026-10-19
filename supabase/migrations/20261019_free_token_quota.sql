-- Free-only quota accounting. Migration not applied to production.
create table if not exists public.aivault_free_token_accounts (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  model text not null,
  verified_free boolean not null default false,
  payment_method_required boolean not null default true,
  terms_approved boolean not null default false,
  enabled boolean not null default false,
  quota_requests bigint not null default 0 check (quota_requests >= 0),
  quota_tokens bigint not null default 0 check (quota_tokens >= 0),
  reserved_requests bigint not null default 0 check (reserved_requests >= 0),
  reserved_tokens bigint not null default 0 check (reserved_tokens >= 0),
  spent_requests bigint not null default 0 check (spent_requests >= 0),
  spent_tokens bigint not null default 0 check (spent_tokens >= 0),
  quota_expires_at timestamptz not null,
  updated_at timestamptz not null default now(),
  check (reserved_requests + spent_requests <= quota_requests),
  check (reserved_tokens + spent_tokens <= quota_tokens)
);
create table if not exists public.aivault_free_token_reservations (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.aivault_free_token_accounts(id),
  request_key text not null unique,
  tokens_reserved bigint not null check (tokens_reserved > 0),
  state text not null default 'RESERVED' check (state in ('RESERVED','SETTLED','RELEASED')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
alter table public.aivault_free_token_accounts enable row level security;
alter table public.aivault_free_token_reservations enable row level security;
revoke all on public.aivault_free_token_accounts from anon, authenticated;
revoke all on public.aivault_free_token_reservations from anon, authenticated;
create or replace function public.aivault_reserve_free_tokens(
  p_account uuid, p_request_key text, p_tokens bigint, p_ttl_seconds integer default 120
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if auth.role() <> 'service_role' then raise exception 'FORBIDDEN'; end if;
  if p_tokens is null or p_tokens <= 0 or p_tokens > 1000000 or
     p_request_key is null or length(p_request_key) < 8 or
     p_ttl_seconds < 1 or p_ttl_seconds > 600 then
    raise exception 'INVALID_RESERVATION';
  end if;
  update public.aivault_free_token_accounts
  set reserved_requests = reserved_requests + 1,
      reserved_tokens = reserved_tokens + p_tokens, updated_at = now()
  where id = p_account and enabled and verified_free and
    not payment_method_required and terms_approved and quota_expires_at > now()
    and quota_requests - spent_requests - reserved_requests >= 1
    and quota_tokens - spent_tokens - reserved_tokens >= p_tokens;
  if not found then raise exception 'NO_VERIFIED_FREE_CAPACITY'; end if;
  insert into public.aivault_free_token_reservations(account_id,request_key,tokens_reserved,expires_at)
  values(p_account,p_request_key,p_tokens,now() + make_interval(secs => p_ttl_seconds))
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public.aivault_reserve_free_tokens(uuid,text,bigint,integer) from public, anon, authenticated;
grant execute on function public.aivault_reserve_free_tokens(uuid,text,bigint,integer) to service_role;
-- Next: transactional settle/release, stale reservation recovery, quota reset
-- windows, authoritative provider usage reconciliation and audit ledger.
-- Do not execute this migration before review; it is not production-ready.
