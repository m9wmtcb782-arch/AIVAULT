-- AIVAULT autonomous-agent approvals; additive, isolated schema. NOT APPLIED.
-- Only trusted backend DB role may use these records. No browser grants.
begin;
create schema if not exists aivault_agent_security;
revoke all on schema aivault_agent_security from public, anon, authenticated;
create table if not exists aivault_agent_security.approval_challenges (
 request_id text primary key,
 agent_id text not null check(length(agent_id)>0),
 owner_id text not null check(length(owner_id)>0),
 tool_name text not null check(length(tool_name)>0),
 kind text not null check(kind in ('external_write','spend','commitment')),
 input_digest text not null check(input_digest ~ '^[a-f0-9]{64}$'),
 expires_at timestamptz not null,
 issued_at timestamptz not null default now(),
 consumed_at timestamptz,
 decision text check(decision in ('approved','denied')),
 constraint challenge_consume_consistent check ((consumed_at is null and decision is null) or (consumed_at is not null and decision is not null))
);
alter table aivault_agent_security.approval_challenges enable row level security;
revoke all on aivault_agent_security.approval_challenges from public, anon, authenticated;
-- A single atomic UPDATE is the consumption linearization point.
-- Run inside an authenticated, server-side transaction only; verify one row returned.
create or replace function aivault_agent_security.consume_approval(
 p_request_id text, p_agent_id text, p_owner_id text,
 p_tool_name text, p_kind text, p_input_digest text, p_decision text
) returns boolean
language sql security invoker set search_path = ''
as $$
 with consumed as (
   update aivault_agent_security.approval_challenges
   set consumed_at = now(), decision = p_decision
   where request_id = p_request_id and agent_id = p_agent_id
     and owner_id = p_owner_id and tool_name = p_tool_name
     and kind = p_kind and input_digest = p_input_digest
     and expires_at > now() and consumed_at is null
     and p_decision in ('approved','denied')
   returning request_id
 )
 select exists(select 1 from consumed);
$$;
revoke all on function aivault_agent_security.consume_approval(text,text,text,text,text,text,text) from public, anon, authenticated;
commit;
