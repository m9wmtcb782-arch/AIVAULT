-- 暗星多機器人工作區：每位使用者自己的 bots（含聊天紀錄）與 App 管家的修改提案（純新增）
create table if not exists public.dark_star_bots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default '新機器人',
  role text not null default 'general',
  avatar jsonb not null default '{}'::jsonb,
  history jsonb not null default '[]'::jsonb,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists dark_star_bots_user_idx on public.dark_star_bots(user_id, sort);
create table if not exists public.dark_star_bot_proposals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  bot_id uuid,
  title text not null,
  description text not null default '',
  files jsonb not null default '[]'::jsonb,
  status text not null default 'proposed',
  pr_url text,
  branch text,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.dark_star_bots enable row level security;
alter table public.dark_star_bot_proposals enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='dark_star_bots' and policyname='bots_own_all') then
    create policy bots_own_all on public.dark_star_bots for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename='dark_star_bot_proposals' and policyname='bot_proposals_own_select') then
    create policy bot_proposals_own_select on public.dark_star_bot_proposals for select to authenticated using (auth.uid() = user_id);
  end if;
end $$;
-- 提案只能經 edge function（service_role）寫入／更新狀態
grant select, insert, update, delete on table public.dark_star_bots to service_role, authenticated;
grant select, insert, update, delete on table public.dark_star_bot_proposals to service_role;
grant select on table public.dark_star_bot_proposals to authenticated;
