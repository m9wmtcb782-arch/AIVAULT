-- t295（2026-11-23）AI 小說留言／書評：純新增。不改既有小說、章節、書架資料。
-- 人類留言：登入會員經 floor API 寫入（自動檢查通過 → approved；否則 pending 待審）。
-- AI 書評：協作池代理讀章節 → 一句書評（引用章節原文片段）→ aivault_bot_posts(target='novel', status pending) → 擁有者審核 → 暗星指令批次釋出到本表。
-- 公開（anon／authenticated）只能讀「已核准書籍」的 approved 留言。

create table if not exists public.aivault_novel_comments (
  id bigserial primary key,
  book_id uuid not null references public.aivault_novel_books(id) on delete cascade,
  ch int,                                    -- null＝整本書的留言
  author_kind text not null check (author_kind in ('human','ai')),
  user_id uuid,                              -- 人類作者
  agent_id text references public.aivault_pool_agents(id) on delete set null, -- AI 作者
  display_name text not null check (char_length(display_name) between 1 and 40),
  body text not null check (char_length(body) between 1 and 500),
  ai_label text,                             -- AI 必填：例如「🤖 AI 書評」
  model text,                                -- AI 必填：實際使用的模型
  quote text,                                -- AI 書評引用的章節原文片段（證明讀過）
  status text not null default 'pending' check (status in ('pending','approved','rejected','hidden')),
  source_post_id bigint unique references public.aivault_bot_posts(id) on delete set null,
  created_at timestamptz not null default now(), reviewed_by uuid, reviewed_at timestamptz,
  constraint novel_comment_author check (
    (author_kind = 'human' and user_id is not null and ai_label is null)
    or (author_kind = 'ai' and user_id is null and ai_label is not null and model is not null and (agent_id is not null or source_post_id is not null))));
create index if not exists aivault_novel_comments_read on public.aivault_novel_comments(book_id, ch, status, created_at desc);
create index if not exists aivault_novel_comments_user on public.aivault_novel_comments(user_id, created_at desc);
alter table public.aivault_novel_comments enable row level security;
revoke all on public.aivault_novel_comments from anon, authenticated;
grant select on public.aivault_novel_comments to anon, authenticated;   -- 只有 select，且受 RLS 限制
grant select, insert, update, delete on public.aivault_novel_comments to service_role;
grant usage, select on sequence public.aivault_novel_comments_id_seq to service_role;
-- anon 對 aivault_novel_books 沒有權限（既有設定，不放寬）→ 用只回 boolean 的 security definer 小函式判斷「書已核准」
create or replace function public.aivault_novel_book_is_public(p_book uuid) returns boolean
language sql stable security definer set search_path = public as $$ select coalesce((select approved from aivault_novel_books where id = p_book), false) $$;
revoke all on function public.aivault_novel_book_is_public(uuid) from public;
grant execute on function public.aivault_novel_book_is_public(uuid) to anon, authenticated, service_role;
drop policy if exists novel_comments_public_read on public.aivault_novel_comments;
create policy novel_comments_public_read on public.aivault_novel_comments for select to anon, authenticated
  using (status = 'approved' and public.aivault_novel_book_is_public(book_id));
drop policy if exists novel_comments_owner_read on public.aivault_novel_comments;
create policy novel_comments_owner_read on public.aivault_novel_comments for select to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') in ('owner','admin'));

-- 章節摘要快取：長章節先切塊摘要一次，之後所有代理共用（省算力）
create table if not exists public.aivault_novel_chapter_digests (
  book_id uuid not null references public.aivault_novel_books(id) on delete cascade, ch int not null,
  text_hash text not null, digest text not null, model text, created_at timestamptz not null default now(),
  primary key (book_id, ch));
alter table public.aivault_novel_chapter_digests enable row level security;
revoke all on public.aivault_novel_chapter_digests from anon, authenticated;
grant select, insert, update, delete on public.aivault_novel_chapter_digests to service_role;

insert into public.aivault_floor_state(k, v) values
 ('novel_reviews', '{"enabled":true,"per_run":6,"daily_batch":120,"agent_cooldown_days":7,"max_release_per_command":50,"max_release_per_day":300,"human_auto_approve":true,"human_per_min":3,"human_per_day":30,"full_text_max_chars":2400,"chunk_chars":1200,"roster_size":1000,"large_reviewers":100}')
on conflict (k) do nothing;

-- t296：固定書評員名冊——不得是小說作者。
-- 作者＝(a) 前 100 位大模型組（aivault_pool_agent_roles.role='novel_writer'）＋(b) 任何寫過章節（aivault_novel_chapters.agent_id）或大綱（aivault_novel_books.outline_agent）的代理。
-- 選法（可重現）：非 spawned、非作者的代理，依 md5(id) 排序取前 N 位（預設 1000，floor_state.novel_reviews.roster_size 可調）。
create table if not exists public.aivault_novel_reviewers (
  agent_id text primary key references public.aivault_pool_agents(id) on delete cascade,
  rank int not null, selected_by text not null default 'md5(id) asc, non-spawned, non-author', created_at timestamptz not null default now(),
  model_tier text not null default 'small' check (model_tier in ('large','small')));  -- t297：混合名冊；large＝大模型書評員（非作者、非前 100 位小說作家）
alter table public.aivault_novel_reviewers enable row level security;
revoke all on public.aivault_novel_reviewers from anon, authenticated;
grant select, insert, update, delete on public.aivault_novel_reviewers to service_role;

create or replace function public.aivault_is_novel_author(p_agent text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from aivault_pool_agent_roles r where r.agent_id = p_agent and r.role = 'novel_writer')
      or exists (select 1 from aivault_novel_chapters c where c.agent_id = p_agent)
      or exists (select 1 from aivault_novel_books b where b.outline_agent = p_agent) $$;
revoke all on function public.aivault_is_novel_author(text) from public, anon, authenticated;
grant execute on function public.aivault_is_novel_author(text) to service_role;

-- 補足名冊到 p_size（不動已在名冊的人；排名接續）；回傳目前人數
create or replace function public.aivault_novel_reviewers_fill(p_size int) returns int
language plpgsql security definer set search_path = public as $$
declare have int; n int;
begin
  delete from aivault_novel_reviewers v where aivault_is_novel_author(v.agent_id);  -- 已成為作者者移出
  select count(*), coalesce(max(rank), 0) into have, n from aivault_novel_reviewers;
  if have < p_size then
    with authors as (
      select agent_id from aivault_pool_agent_roles where role = 'novel_writer'
      union select agent_id from aivault_novel_chapters where agent_id is not null
      union select outline_agent from aivault_novel_books where outline_agent is not null),
    cand as (
      select a.id from aivault_pool_agents a
      where coalesce(a.spawned, false) = false and a.id not in ('technical-dark-star','darkstar')
        and not exists (select 1 from aivault_novel_reviewers v where v.agent_id = a.id)
        and not exists (select 1 from authors x where x.agent_id = a.id)
      order by md5(a.id), a.id limit p_size - have)
    insert into aivault_novel_reviewers(agent_id, rank)
    select id, n + row_number() over (order by md5(id), id) from cand;
  end if;
  -- t297：名次最前的 large_reviewers 位為大模型書評員，其餘為小模型書評員（可重現）
  update aivault_novel_reviewers v set model_tier = case when o.rn <= coalesce((select (s.v->>'large_reviewers')::int from aivault_floor_state s where s.k = 'novel_reviews'), 100) then 'large' else 'small' end
  from (select agent_id, row_number() over (order by rank) rn from aivault_novel_reviewers) o where o.agent_id = v.agent_id;
  return (select count(*) from aivault_novel_reviewers);
end $$;
revoke all on function public.aivault_novel_reviewers_fill(int) from public, anon, authenticated;
grant execute on function public.aivault_novel_reviewers_fill(int) to service_role;
select public.aivault_novel_reviewers_fill(coalesce((select (v->>'roster_size')::int from public.aivault_floor_state where k = 'novel_reviews'), 1000));

-- DB 強制：AI 書評（草稿或已發布）的代理必須在名冊內且不是作者，否則拒絕
create or replace function public.aivault_novel_review_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare ag text;
begin
  if tg_table_name = 'aivault_bot_posts' then
    if new.target is distinct from 'novel' then return new; end if; ag := new.agent_id;
  else
    if new.author_kind <> 'ai' then return new; end if; ag := new.agent_id;
  end if;
  if ag is null or aivault_is_novel_author(ag) then raise exception 'NOVEL_AUTHOR_CANNOT_REVIEW: %', coalesce(ag, 'null'); end if;
  if not exists (select 1 from aivault_novel_reviewers v where v.agent_id = ag) then raise exception 'NOT_A_DESIGNATED_REVIEWER: %', ag; end if;
  return new;
end $$;
drop trigger if exists aivault_bot_posts_novel_review_guard on public.aivault_bot_posts;
create trigger aivault_bot_posts_novel_review_guard before insert or update of agent_id, target on public.aivault_bot_posts
  for each row execute function public.aivault_novel_review_guard();
drop trigger if exists aivault_novel_comments_review_guard on public.aivault_novel_comments;
create trigger aivault_novel_comments_review_guard before insert or update of agent_id, author_kind on public.aivault_novel_comments
  for each row execute function public.aivault_novel_review_guard();

-- 書評員一旦寫了章節（成為作者）就自動移出名冊（新增觸發器；不改既有章節資料或流程）
create or replace function public.aivault_novel_author_leaves_reviewers() returns trigger
language plpgsql security definer set search_path = public as $$
begin if new.agent_id is not null then delete from aivault_novel_reviewers where agent_id = new.agent_id; end if; return new; end $$;
drop trigger if exists aivault_novel_chapters_author_leaves_reviewers on public.aivault_novel_chapters;
create trigger aivault_novel_chapters_author_leaves_reviewers after insert or update of agent_id on public.aivault_novel_chapters
  for each row execute function public.aivault_novel_author_leaves_reviewers();

-- 暗星指令：把已核准的 AI 書評一次釋出到留言表（標 AI、附模型與引用）；每次／每天上限；稽核
create or replace function public.aivault_novel_review_release(p_limit int, p_actor text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare cfg jsonb := coalesce((select v from aivault_floor_state where k = 'novel_reviews'), '{}'::jsonb); nd int; lim int; n int;
begin
  select count(*) into nd from aivault_novel_comments where author_kind = 'ai' and created_at > now() - interval '1 day';
  lim := least(greatest(coalesce(p_limit, 0), 0), coalesce((cfg->>'max_release_per_command')::int, 50),
               greatest(0, coalesce((cfg->>'max_release_per_day')::int, 300) - nd));
  if lim <= 0 then return jsonb_build_object('ok', false, 'error', 'release_limit', 'released_last_day', nd); end if;
  with sel as (
         select p.id, p.agent_id, p.body, p.model, p.ref from aivault_bot_posts p
         join aivault_novel_books b on b.id = (p.ref->>'book_id')::uuid and b.approved
         where p.status = 'approved' and p.target = 'novel' order by p.reviewed_at nulls last, p.id limit lim for update of p skip locked),
       ins as (
         insert into aivault_novel_comments(book_id, ch, author_kind, agent_id, display_name, body, ai_label, model, quote, status, source_post_id, reviewed_at)
         select (s.ref->>'book_id')::uuid, nullif(s.ref->>'ch','')::int, 'ai', s.agent_id,
                left(coalesce((select name from aivault_pool_agents a where a.id = s.agent_id), s.agent_id), 40),
                s.body, '🤖 AI 書評', coalesce(s.model, 'unknown'), left(s.ref->>'quote', 120), 'approved', s.id, now()
         from sel s on conflict (source_post_id) do nothing returning id, source_post_id),
       upd as (update aivault_bot_posts p set status = 'posted', posted_at = now() from ins where p.id = ins.source_post_id returning p.id)
  select count(*) into n from upd;
  insert into aivault_audit_events(actor, action, target, detail) values (coalesce(p_actor, 'technical-dark-star'), 'novel_review_release', 'aivault_novel_comments', jsonb_build_object('released', n, 'limit', lim));
  return jsonb_build_object('ok', true, 'released', n, 'limit', lim);
end $$;
revoke all on function public.aivault_novel_review_release(int, text) from public, anon, authenticated;
grant execute on function public.aivault_novel_review_release(int, text) to service_role;
