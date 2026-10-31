-- AIVAULT Agent Ops Phase 1 — 100k AI identity / mailbox / platform / task / audit schema.
-- FILE ONLY: not applied to live Supabase. Additive; does not alter existing tables.
-- Identity count != real mailbox count: a mailbox row is only VERIFIED after a real send+receive proof.

create schema if not exists agent_ops;

do $$ begin
  create type agent_ops.mailbox_status as enum ('NOT_PROVISIONED','PENDING','VERIFIED','SUSPENDED','REVOKED');
exception when duplicate_object then null; end $$;
do $$ begin
  create type agent_ops.task_type as enum ('CHECK_MAIL','READ_MAIL','DRAFT_MAIL','SEND_MAIL','REPLY_MAIL',
    'AUTHORIZE_PLATFORM','PUBLISH_COMMENT','REPLY_COMMENT','SYNC_ACCOUNT','VERIFY_STATUS');
exception when duplicate_object then null; end $$;
do $$ begin
  create type agent_ops.task_status as enum ('QUEUED','AWAITING_REVIEW','APPROVED','RUNNING','DONE','FAILED','REJECTED','CANCELLED');
exception when duplicate_object then null; end $$;

-- 1. Identities (up to 100,000). agent_no 1..100000 drives rank code (1U..10W).
create table if not exists agent_ops.agents (
  agent_no      integer primary key check (agent_no between 1 and 100000),
  agent_id      text not null unique,                 -- e.g. Worker-001 or ag-00001 (never merged without mapping)
  legacy_ref    text,                                 -- explicit mapping to existing identity tables, nullable
  name_zh       text not null,
  surname_zh    text not null,
  given_zh      text not null,
  pinyin        text not null check (pinyin ~ '^[a-z]{2,40}$'),
  rank_code     text not null check (rank_code ~ '^([1-9]W|10W)?([1-9]K)?([1-9]H)?([1-9]T)?([1-9]U)?$' and rank_code <> ''),
  mail_local    text generated always as (pinyin || lower(rank_code)) stored,
  role          text,
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  unique (mail_local)
);

-- 2. Mailboxes: separate table; absence of row = NOT_PROVISIONED.
create table if not exists agent_ops.mailboxes (
  id            bigserial primary key,
  agent_no      integer not null unique references agent_ops.agents(agent_no) on delete restrict,
  address       text not null unique check (address ~* '^[a-z0-9._+-]+@[a-z0-9.-]+\.[a-z]{2,}$'),
  domain        text not null,
  provider      text not null,                        -- e.g. stalwart-self-hosted, zoho, local-test
  status        agent_ops.mailbox_status not null default 'PENDING',
  credential_ref text,                                -- opaque vault reference (vault.secrets id); NEVER the password
  is_test       boolean not null default false,       -- LOCAL test mailboxes excluded from real counts
  verified_at   timestamptz,
  verify_evidence jsonb,                              -- {inbound_message_id, outbound_message_id, ...}
  daily_send_quota integer not null default 20 check (daily_send_quota between 0 and 1000),
  created_at    timestamptz not null default now(),
  constraint verified_needs_evidence check (status <> 'VERIFIED' or (verified_at is not null and verify_evidence ? 'inbound_message_id' and verify_evidence ? 'outbound_message_id'))
);

-- 3. Platform accounts (official OAuth/token only; one owner-authorized account may be shared via delegation).
create table if not exists agent_ops.platform_accounts (
  id            bigserial primary key,
  agent_no      integer references agent_ops.agents(agent_no),
  platform      text not null check (platform in ('github')),
  account_login text not null,
  auth_kind     text not null check (auth_kind in ('oauth','fine_grained_pat','github_app')),
  credential_ref text,
  scopes        text[] not null default '{}',
  status        text not null default 'PENDING' check (status in ('PENDING','AUTHORIZED','VERIFIED','REVOKED')),
  verified_at   timestamptz,
  created_at    timestamptz not null default now(),
  unique (platform, account_login, agent_no)
);

-- 4. Permissions per agent.
create table if not exists agent_ops.permissions (
  agent_no   integer not null references agent_ops.agents(agent_no),
  task_type  agent_ops.task_type not null,
  allowed    boolean not null default false,
  daily_quota integer not null default 0,
  granted_by text,
  granted_at timestamptz not null default now(),
  primary key (agent_no, task_type)
);

-- 5. Tasks (queue).
create table if not exists agent_ops.tasks (
  id          bigserial primary key,
  agent_no    integer not null references agent_ops.agents(agent_no),
  task_type   agent_ops.task_type not null,
  payload     jsonb not null default '{}',
  dedupe_key  text not null,
  status      agent_ops.task_status not null default 'QUEUED',
  requires_review boolean not null default false,
  reviewed_by text,
  attempts    integer not null default 0,
  last_error  text,
  run_after   timestamptz not null default now(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (dedupe_key)
);
create index if not exists tasks_queue_idx on agent_ops.tasks (status, run_after);

-- 6. Memory / task logs, mail history, platform history, audit.
create table if not exists agent_ops.agent_memory (
  id bigserial primary key, agent_no integer not null references agent_ops.agents(agent_no),
  kind text not null, content jsonb not null, created_at timestamptz not null default now());
create table if not exists agent_ops.mail_messages (
  id bigserial primary key, mailbox_id bigint not null references agent_ops.mailboxes(id),
  direction text not null check (direction in ('IN','OUT')), message_id text, peer text, subject text,
  status text not null default 'OK' check (status in ('OK','BOUNCED','COMPLAINT','DEFERRED','FAILED')),
  detail jsonb, created_at timestamptz not null default now(), unique (mailbox_id, direction, message_id));
create table if not exists agent_ops.platform_actions (
  id bigserial primary key, account_id bigint references agent_ops.platform_accounts(id),
  agent_no integer references agent_ops.agents(agent_no), action text not null, target text,
  result text not null, detail jsonb, created_at timestamptz not null default now());
create table if not exists agent_ops.audit_log (
  id bigserial primary key, actor text not null, action text not null, target text,
  detail jsonb, created_at timestamptz not null default now());

-- 7. Honest counts view.
create or replace view agent_ops.v_honest_counts as
select
  (select count(*) from agent_ops.agents)                                             as identities,
  (select count(*) from agent_ops.mailboxes where status='VERIFIED' and not is_test)  as real_verified_mailboxes,
  (select count(*) from agent_ops.mailboxes where status='PENDING' and not is_test)   as pending_mailboxes,
  (select count(*) from agent_ops.mailboxes where is_test)                            as local_test_mailboxes,
  (select count(*) from agent_ops.platform_accounts where status in ('AUTHORIZED','VERIFIED')) as authorized_platform_accounts,
  (select count(*) from agent_ops.platform_accounts where status='VERIFIED')          as verified_platform_accounts,
  (select count(*) from agent_ops.mail_messages where direction='OUT' and status='OK') as mails_sent,
  (select count(*) from agent_ops.mail_messages where direction='IN')                 as mails_received;

-- 8. RLS: deny-by-default; only service_role (backend) and founder role read.
do $$ declare t text; begin
  foreach t in array array['agents','mailboxes','platform_accounts','permissions','tasks','agent_memory','mail_messages','platform_actions','audit_log'] loop
    execute format('alter table agent_ops.%I enable row level security', t);
    execute format('alter table agent_ops.%I force row level security', t);
  end loop;
end $$;
-- Founder read-only policy (founder identified by JWT app_metadata.role = 'founder').
do $$ declare t text; begin
  if exists (select 1 from pg_roles where rolname='authenticated') then
    foreach t in array array['agents','mailboxes','platform_accounts','tasks','mail_messages','platform_actions','audit_log'] loop
      execute format('drop policy if exists founder_read on agent_ops.%I', t);
      execute format($p$create policy founder_read on agent_ops.%I for select to authenticated
        using (coalesce((auth.jwt()->'app_metadata'->>'role'),'') = 'founder')$p$, t);
    end loop;
  end if;
end $$;
-- Audit log is append-only.
create or replace function agent_ops.no_audit_mutation() returns trigger language plpgsql as $$
begin raise exception 'audit_log is append-only'; end $$;
drop trigger if exists audit_append_only on agent_ops.audit_log;
create trigger audit_append_only before update or delete on agent_ops.audit_log
  for each row execute function agent_ops.no_audit_mutation();
