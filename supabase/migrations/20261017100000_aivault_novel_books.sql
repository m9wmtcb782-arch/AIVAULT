-- 1000 人工作區長篇小說流水線：書（大綱、進度）與章（作者代理、模型、token），可續跑
create table if not exists public.aivault_novel_books (
  id uuid primary key default gen_random_uuid(), title text, genre text not null, outline text, arcs jsonb not null default '[]'::jsonb,
  target_chapters int not null default 100, chapters_done int not null default 0, chars int not null default 0,
  status text not null default 'outline', approved boolean not null default false, zone text, outline_task uuid, outline_agent text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists public.aivault_novel_chapters (
  book_id uuid not null references public.aivault_novel_books(id) on delete cascade, ch int not null, title text, text text not null,
  chars int not null default 0, agent_id text, task_id uuid, model text, usage jsonb, created_at timestamptz not null default now(), primary key (book_id, ch));
alter table public.aivault_novel_books enable row level security; alter table public.aivault_novel_chapters enable row level security;
revoke all on public.aivault_novel_books from anon; revoke all on public.aivault_novel_chapters from anon;
grant select, insert, update, delete on public.aivault_novel_books, public.aivault_novel_chapters to authenticated, service_role;
drop policy if exists owner_admin_all on public.aivault_novel_books;
create policy owner_admin_all on public.aivault_novel_books for all to authenticated using ((auth.jwt()->'app_metadata'->>'role') in ('owner','admin')) with check ((auth.jwt()->'app_metadata'->>'role') in ('owner','admin'));
drop policy if exists read_approved on public.aivault_novel_books;
create policy read_approved on public.aivault_novel_books for select to authenticated using (approved);
drop policy if exists owner_admin_all on public.aivault_novel_chapters;
create policy owner_admin_all on public.aivault_novel_chapters for all to authenticated using ((auth.jwt()->'app_metadata'->>'role') in ('owner','admin')) with check ((auth.jwt()->'app_metadata'->>'role') in ('owner','admin'));
drop policy if exists read_approved on public.aivault_novel_chapters;
create policy read_approved on public.aivault_novel_chapters for select to authenticated using (exists (select 1 from public.aivault_novel_books b where b.id = book_id and b.approved));
-- 舊版 3 章短篇試跑任務：停止排隊（已完成的保留在帳本）
update public.aivault_pool_agent_tasks set status='failed', result='舊版短篇流程已改為長篇書籍流水線' where source='floor' and status in ('queued','running') and plan ? 'novel' and not (plan->'novel' ? 'book');
