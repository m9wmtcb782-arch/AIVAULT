-- Dark Star tiered autobiographical memory (isolated from shared aivault_kb).
-- Capacity goals are logical budgets, not preallocated storage.
create table if not exists public.dark_star_personal_memories (
  id bigint generated always as identity primary key,
  owner_uid uuid not null references auth.users(id) on delete cascade,
  tier text not null check (tier in ('working','short','episodic','long','self')),
  kind text not null default 'event',
  content text not null check (char_length(content) between 1 and 100000),
  summary text,
  importance smallint not null default 5 check (importance between 0 and 10),
  confidence numeric(3,2) not null default 1 check (confidence between 0 and 1),
  consent_basis text not null default 'owner_provided',
  protected boolean not null default false,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_recalled_at timestamptz,
  expires_at timestamptz,
  deleted_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);
create index if not exists dark_star_mem_owner_tier_recent
  on public.dark_star_personal_memories(owner_uid,tier,occurred_at desc)
  where deleted_at is null;
create index if not exists dark_star_mem_owner_importance
  on public.dark_star_personal_memories(owner_uid,importance desc,created_at desc)
  where deleted_at is null;
alter table public.dark_star_personal_memories enable row level security;
revoke all on public.dark_star_personal_memories from anon;
grant select, insert, update, delete on public.dark_star_personal_memories to authenticated;
grant usage, select on sequence public.dark_star_personal_memories_id_seq to authenticated;
drop policy if exists dark_star_mem_owner_select on public.dark_star_personal_memories;
create policy dark_star_mem_owner_select on public.dark_star_personal_memories
 for select to authenticated using (owner_uid = (select auth.uid()));
drop policy if exists dark_star_mem_owner_insert on public.dark_star_personal_memories;
create policy dark_star_mem_owner_insert on public.dark_star_personal_memories
 for insert to authenticated with check (owner_uid = (select auth.uid()));
drop policy if exists dark_star_mem_owner_update on public.dark_star_personal_memories;
create policy dark_star_mem_owner_update on public.dark_star_personal_memories
 for update to authenticated using (owner_uid = (select auth.uid()))
 with check (owner_uid = (select auth.uid()));
drop policy if exists dark_star_mem_owner_delete on public.dark_star_personal_memories;
create policy dark_star_mem_owner_delete on public.dark_star_personal_memories
 for delete to authenticated using (owner_uid = (select auth.uid()));
comment on table public.dark_star_personal_memories is
 'Dark Star personal memory; tiered recall, user-controlled deletion and privacy. 1000000-character short-term target; long-term scales with storage.';
