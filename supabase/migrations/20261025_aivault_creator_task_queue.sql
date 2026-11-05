-- Optional queue for Dark Star creator ordinary-task execution path.
-- Safe to apply later; Gateway treats missing table as non-fatal (persisted=false).
-- Does NOT grant privileges. High-risk actions never enqueue here.
create table if not exists public.aivault_creator_task_queue (
  id bigserial primary key,
  task_id uuid not null unique,
  user_id uuid not null,
  action text not null,
  status text not null default 'accepted',
  detail jsonb not null default '{}'::jsonb,
  gateway_version text,
  created_at timestamptz not null default now()
);
create index if not exists aivault_creator_task_queue_user_created_idx
  on public.aivault_creator_task_queue (user_id, created_at desc);
