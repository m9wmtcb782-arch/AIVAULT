-- 電子書可見度與「只限本人」（PR 審核用；尚未在正式資料庫執行，需創辦人核准後再套用）
-- 原則：
--   * 只新增欄位／函式／bucket／policy，不刪除任何書、頁面或圖片。
--   * 目前公開的書維持公開（visibility 預設 'public'），包括《宪法学讲义》e0bc8c57 等既有公開書，不會被改成私人。
--   * 只有既有 metadata.private=true 的書對應為 'members'（與現在的限制相同：登入會員可讀），不會變得更公開。
--   * 'owner'（只限本人）只用在之後明確建立／標記為只限本人的書。
begin;

-- 1) 欄位
alter table public.dark_star_ebooks add column if not exists visibility text not null default 'public';
alter table public.dark_star_ebooks add column if not exists owner_id uuid null references auth.users(id) on delete set null;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='dark_star_ebooks_visibility_chk') then
    alter table public.dark_star_ebooks add constraint dark_star_ebooks_visibility_chk check (visibility in ('public','members','owner'));
  end if;
  if not exists (select 1 from pg_constraint where conname='dark_star_ebooks_owner_requires_owner_id') then
    -- owner-only 書必須有 owner_id（避免無主的私人書）
    alter table public.dark_star_ebooks add constraint dark_star_ebooks_owner_requires_owner_id check (visibility <> 'owner' or owner_id is not null);
  end if;
end $$;
create index if not exists dark_star_ebooks_visibility_idx on public.dark_star_ebooks(visibility, owner_id);

-- 2) 既有私人書 → members（維持現有限制；只動 metadata.private=true 的書，公開書完全不變）
update public.dark_star_ebooks
   set visibility = 'members'
 where visibility = 'public'
   and (metadata->>'private') = 'true';

-- 3) 有效可見度：欄位與 metadata 取最嚴格者（任何一邊標私人都算私人）
create or replace function public.dark_star_ebook_visibility(b public.dark_star_ebooks)
returns text language sql immutable set search_path = public as $$
  select case
    when b.visibility = 'owner' or (b.metadata->>'visibility') = 'owner' then 'owner'
    when b.visibility = 'members' or (b.metadata->>'visibility') = 'members' or (b.metadata->>'private') = 'true' then 'members'
    else 'public' end
$$;

create or replace function public.dark_star_ebook_can_read(b public.dark_star_ebooks, viewer_id uuid, viewer_is_member boolean, viewer_is_admin boolean)
returns boolean language sql immutable set search_path = public as $$
  select case public.dark_star_ebook_visibility(b)
    when 'public' then true
    when 'members' then coalesce(viewer_is_member, false)
    else coalesce(viewer_is_admin, false)
      or (coalesce(viewer_is_member, false) and viewer_id is not null
          and viewer_id = coalesce(b.owner_id, nullif(b.metadata->>'owner_id','')::uuid))
  end
$$;

-- 4) 全文搜尋：取代舊 3 參數版本（舊版不看私人標記，訪客可透過 photo-solve 讀到私人書摘錄）
--    新增 viewer_* 參數，預設 = 訪客（只搜 public）。只給 service_role 執行（由 edge function 驗證身分後傳入）。
drop function if exists public.dark_star_search_ebook_pages(text[], uuid, integer);
create or replace function public.dark_star_search_ebook_pages(
  terms text[], book_id uuid default null, result_limit integer default 6,
  viewer_id uuid default null, viewer_is_member boolean default false, viewer_is_admin boolean default false)
returns table(page_id uuid, ebook_id uuid, book_title text, page_number integer, chapter text, section text, excerpt text, score integer)
language sql stable set search_path = public as $function$
  with keywords as (
    select distinct lower(left(trim(t),80)) term
    from unnest(terms[1:24]) t where length(trim(t)) between 2 and 80
  ), books as (
    select b.id, b.title from public.dark_star_ebooks b
    where (book_id is null or b.id = book_id)
      and public.dark_star_ebook_can_read(b, viewer_id, viewer_is_member, viewer_is_admin)
  ), ranked as (
    select p.id, p.ebook_id, b.title book_title, p.page_number, p.chapter, p.section,
      p.content, sum(case when strpos(lower(p.content),k.term)>0 then length(k.term) else 0 end
        + case when strpos(lower(coalesce(p.title,'')||' '||coalesce(p.chapter,'')||' '||coalesce(p.section,'')),k.term)>0 then 3 else 0 end)::integer score,
      min(nullif(strpos(lower(p.content),k.term),0)) first_match
    from public.dark_star_ebook_pages p join books b on b.id=p.ebook_id
    cross join keywords k
    where coalesce(p.content,'')<>''
    group by p.id,p.ebook_id,b.title,p.page_number,p.chapter,p.section,p.content
  )
  select id,ebook_id,book_title,page_number,chapter,section,
    substring(content from greatest(1,coalesce(first_match,1)-600) for 5000),score
  from ranked where score>0 order by score desc,ebook_id,page_number
  limit greatest(1,least(coalesce(result_limit,6),10));
$function$;
revoke all on function public.dark_star_search_ebook_pages(text[], uuid, integer, uuid, boolean, boolean) from public, anon, authenticated;
grant execute on function public.dark_star_search_ebook_pages(text[], uuid, integer, uuid, boolean, boolean) to service_role;
revoke all on function public.dark_star_ebook_can_read(public.dark_star_ebooks, uuid, boolean, boolean) from public, anon, authenticated;
grant execute on function public.dark_star_ebook_can_read(public.dark_star_ebooks, uuid, boolean, boolean) to service_role;
revoke all on function public.dark_star_ebook_visibility(public.dark_star_ebooks) from public, anon, authenticated;
grant execute on function public.dark_star_ebook_visibility(public.dark_star_ebooks) to service_role;

-- 5) 只限本人的頁面圖片：獨立私有 bucket ebook-owner，路徑 {owner_id}/{ebook_id}/{page}.jpg
--    只有 auth.uid() = 第一層資料夾 的本人（或 app_metadata.role 為 owner/admin）可讀；不寫入 repo、不放 GitHub Pages。
--    既有 ebook-private（會員可讀）bucket 與其 policy 不變。
insert into storage.buckets (id, name, public) values ('ebook-owner','ebook-owner', false)
  on conflict (id) do update set public = false;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='ebook_owner_read_self') then
    create policy ebook_owner_read_self on storage.objects for select to authenticated
      using (bucket_id = 'ebook-owner' and (
        (storage.foldername(name))[1] = auth.uid()::text
        or coalesce(auth.jwt()->'app_metadata'->>'role','') in ('owner','admin')));
  end if;
end $$;

commit;

-- 驗證（只讀，套用後執行）：
--   select visibility, count(*) from public.dark_star_ebooks group by 1;               -- 公開書數量應與套用前相同
--   select id, visibility from public.dark_star_ebooks where id='e0bc8c57-646d-474c-988e-d6cb3d4f8972'; -- 應為 public
--   select count(*) from public.dark_star_ebooks where (metadata->>'private')='true' and visibility<>'members'; -- 應為 0
--
-- 回滾（只還原函式；欄位保留不影響舊程式）：
--   drop function if exists public.dark_star_search_ebook_pages(text[], uuid, integer, uuid, boolean, boolean);
--   重新建立舊版 3 參數函式（見 backups schema-catalog）。注意：回滾後訪客搜尋私人書摘錄的漏洞會回來。
