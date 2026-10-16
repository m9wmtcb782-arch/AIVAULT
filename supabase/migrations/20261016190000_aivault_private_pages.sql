-- 機密頁內容（協作池／算力池）：只有已登入（已核准）使用者可讀；寫入只經 service role / SQL。
create table if not exists public.aivault_private_pages (
  slug text primary key,
  html text not null,
  updated_at timestamptz not null default now()
);
alter table public.aivault_private_pages enable row level security;
revoke all on public.aivault_private_pages from anon, authenticated;
grant select on public.aivault_private_pages to authenticated;
drop policy if exists aivault_private_pages_read on public.aivault_private_pages;
create policy aivault_private_pages_read on public.aivault_private_pages
  for select to authenticated using (true);
