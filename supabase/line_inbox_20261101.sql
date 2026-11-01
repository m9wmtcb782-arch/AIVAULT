-- 只新增：LINE webhook 原始事件收件匣（RLS 開，僅 service_role）。不修改任何既有物件。
create table if not exists public.line_inbox (
  id bigint generated always as identity primary key,
  received_at timestamptz not null default now(),
  signature text not null,
  raw_body text not null,
  consumed_at timestamptz
);
alter table public.line_inbox enable row level security;
revoke all on public.line_inbox from anon, authenticated;
create index if not exists line_inbox_pending on public.line_inbox (id) where consumed_at is null;
-- 回滾：drop table public.line_inbox;
