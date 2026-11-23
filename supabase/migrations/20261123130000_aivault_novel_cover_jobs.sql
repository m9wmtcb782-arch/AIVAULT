-- t310–t317：暗星 Gemini 封面佇列＋嘗試紀錄（只加不刪）。預設關閉 enabled=false。沒有硬性出版閘門（t316）：無 Gemini 封面照常上架，cover_pending=true。
-- 狀態：PREPARED，尚未套用到正式站（Gemini 圖像模型官方定價頁顯示免費層 Not available，待創辦人決定）。
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('novel-covers', 'novel-covers', true, 3145728, array['image/jpeg']) on conflict (id) do nothing;
alter table public.dark_star_ebooks add column if not exists cover_source text; -- 'gemini' 表示由暗星以 Gemini 繪製
create table if not exists public.aivault_novel_cover_config (
  id int primary key default 1 check (id = 1),
  enabled boolean not null default false,          -- 第二把鎖（另需函式密鑰 NOVEL_COVER_GEMINI_ENABLED=1）
  daily_cap int not null default 5 check (daily_cap >= 0),
  model text not null default 'gemini-3.1-flash-lite-image',
  quota_paused_until date,
  updated_at timestamptz not null default now());
insert into public.aivault_novel_cover_config (id) values (1) on conflict do nothing;
create table if not exists public.aivault_novel_cover_jobs (
  book_id uuid primary key references public.aivault_novel_books(id) on delete cascade,
  status text not null default 'queued' check (status in ('queued','running','done','failed','quota_wait')),
  attempts int not null default 0, attempt_day date, prompt text, model text,
  url text, storage_path text, image_sha text, error text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create index if not exists aivault_novel_cover_jobs_day on public.aivault_novel_cover_jobs(attempt_day);
alter table public.aivault_novel_cover_config enable row level security;
alter table public.aivault_novel_cover_jobs enable row level security; -- 只有 service role（暗星）可讀寫
-- 缺封面的小說（含未核准但已有書名者，好讓出版前先有封面）排入佇列；已有有效封面者不排
create or replace function public.aivault_novel_cover_enqueue_missing() returns int language sql security definer set search_path = public as $$
  with ins as (insert into aivault_novel_cover_jobs(book_id)
    select b.id from aivault_novel_books b left join dark_star_ebooks e on e.id = b.id
    where b.title is not null and coalesce(e.cover_source,'') <> 'gemini' on conflict (book_id) do nothing returning 1)
  select count(*)::int from ins $$;
revoke all on function public.aivault_novel_cover_enqueue_missing() from public, anon, authenticated;
-- 電子書列建立時（核准後由同步觸發器建立），若已有 Gemini 封面就補綁；只寫封面欄位
create or replace function public.aivault_novel_cover_bind_on_ebook() returns trigger language plpgsql security definer set search_path = public as $$
declare j record; begin
  if coalesce(new.cover_source,'') <> 'gemini' then
    select url, storage_path into j from aivault_novel_cover_jobs where book_id = new.id and status = 'done';
    if found then new.cover_url := j.url; new.cover_storage_path := j.storage_path; new.cover_source := 'gemini'; end if;
  end if; return new; end $$;
drop trigger if exists aivault_novel_cover_bind on public.dark_star_ebooks;
create trigger aivault_novel_cover_bind before insert on public.dark_star_ebooks for each row execute function public.aivault_novel_cover_bind_on_ebook();
-- t317：每次 Gemini 嘗試的紀錄（金鑰已在函式端去除）
create table if not exists public.aivault_novel_cover_attempts (
  id bigserial primary key, book_id uuid, at timestamptz not null default now(), model text, http_status int,
  category text not null check (category in ('ok','quota_exhausted','model_not_allowed','safety_block','timeout','other')), message text);
create index if not exists aivault_novel_cover_attempts_book on public.aivault_novel_cover_attempts(book_id, at desc);
alter table public.aivault_novel_cover_attempts enable row level security;
create policy aivault_novel_cover_attempts_owner_read on public.aivault_novel_cover_attempts for select to authenticated
  using (coalesce((auth.jwt()->'app_metadata'->>'role') in ('owner','admin'), false));
-- 擁有者總覽：每本小說封面來源與 cover_pending（非 Gemini 封面＝待補）、最近一次嘗試
create or replace view public.aivault_novel_cover_status with (security_invoker = true) as
select b.id as book_id, b.title, b.status, b.approved, e.cover_url, e.cover_source,
  (coalesce(e.cover_source,'') <> 'gemini') as cover_pending, j.status as job_status, j.attempts,
  a.at as last_attempt_at, a.model as last_model, a.http_status as last_http_status, a.category as last_category, a.message as last_message
from public.aivault_novel_books b left join public.dark_star_ebooks e on e.id = b.id left join public.aivault_novel_cover_jobs j on j.book_id = b.id
left join lateral (select * from public.aivault_novel_cover_attempts x where x.book_id = b.id order by x.at desc limit 1) a on true;
revoke all on public.aivault_novel_cover_status from anon;
-- 暗星排程：每小時一次；函式內 enabled 未開則只排佇列不呼叫 Gemini
do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('aivault-novel-covers', '41 * * * *', $c$select net.http_post(url:=$u$https://clcddygkaaqqtsbswgdf.supabase.co/functions/v1/dark-star-ebook-ingest?feature=floor$u$,headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='aivault_cron_sr'),'apikey',(select decrypted_secret from vault.decrypted_secrets where name='aivault_cron_sr')),body:='{"action":"novel_covers"}'::jsonb)$c$);
  end if; end $$;
