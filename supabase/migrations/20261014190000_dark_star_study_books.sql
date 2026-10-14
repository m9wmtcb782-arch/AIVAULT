-- 暗星學習書籍：每位使用者自己選擇讓暗星讀哪些書（純新增，不更動既有表）
create table if not exists public.dark_star_study_books (
  user_id uuid not null references auth.users(id) on delete cascade,
  ebook_id uuid not null references public.dark_star_ebooks(id) on delete cascade,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, ebook_id)
);
alter table public.dark_star_study_books enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='dark_star_study_books' and policyname='study_books_own_select') then
    create policy study_books_own_select on public.dark_star_study_books for select to authenticated using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='dark_star_study_books' and policyname='study_books_own_insert') then
    create policy study_books_own_insert on public.dark_star_study_books for insert to authenticated with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='dark_star_study_books' and policyname='study_books_own_update') then
    create policy study_books_own_update on public.dark_star_study_books for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='dark_star_study_books' and policyname='study_books_own_delete') then
    create policy study_books_own_delete on public.dark_star_study_books for delete to authenticated using (auth.uid() = user_id);
  end if;
end $$;

-- DML grants (table was created without them; edge function uses service_role)
grant select, insert, update, delete on table public.dark_star_study_books to service_role;
grant select, insert, update, delete on table public.dark_star_study_books to authenticated;
