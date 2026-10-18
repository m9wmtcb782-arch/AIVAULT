-- pb1：協作池書架（獨立於使用者電子書 dark_star_ebooks；不改動、不列入使用者書架）
create table if not exists public.aivault_pool_books(
  id text primary key, title text not null, tier text not null check (tier in ('基礎','入門','專業')),
  tier_order int not null default 1, sort_order int not null default 100, domains text[] not null default '{}',
  kind text not null default 'written' check (kind in ('written','anthology')), author text not null default 'Grok Bot',
  status text not null default 'pending' check (status in ('pending','published','rejected')),
  chapters int not null default 0, chars int not null default 0, sources jsonb not null default '[]', review jsonb not null default '{}',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists public.aivault_pool_book_chapters(
  book_id text not null references public.aivault_pool_books(id) on delete cascade, chapter_no int not null,
  title text not null, content text not null, primary key(book_id,chapter_no));
alter table public.aivault_pool_books enable row level security;
alter table public.aivault_pool_book_chapters enable row level security;
drop policy if exists pool_books_read on public.aivault_pool_books;
create policy pool_books_read on public.aivault_pool_books for select to anon, authenticated using (status='published');
drop policy if exists pool_chapters_read on public.aivault_pool_book_chapters;
create policy pool_chapters_read on public.aivault_pool_book_chapters for select to anon, authenticated
  using (exists(select 1 from public.aivault_pool_books b where b.id=book_id and b.status='published'));
grant select on public.aivault_pool_books, public.aivault_pool_book_chapters to anon, authenticated;
grant all on public.aivault_pool_books, public.aivault_pool_book_chapters to service_role;
-- 每位代理的讀書進度（從學習紀錄 url='poolbook:<id>#ch<n>' 計算，不另存）
create or replace function public.aivault_pool_book_progress(p_agent text default null)
returns table(agent_id text, chapters_read bigint, books_started bigint) language sql stable security definer set search_path=public as $$
  select l.agent_id, count(distinct l.url), count(distinct split_part(l.url,'#',1))
  from public.aivault_pool_agent_learning l where l.url like 'poolbook:%' and (p_agent is null or l.agent_id=p_agent) group by l.agent_id $$;
revoke all on function public.aivault_pool_book_progress(text) from public, anon, authenticated;
grant execute on function public.aivault_pool_book_progress(text) to service_role;
