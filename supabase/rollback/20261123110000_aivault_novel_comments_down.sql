-- 回滾 20261123110000_aivault_novel_comments.sql（只移除本次新增物件；既有小說／章節／書架不受影響）
-- 如需保留留言先匯出：copy (select * from public.aivault_novel_comments) to stdout with csv header;
-- 注意：先跑本檔，再跑 20261123100000 的回滾（本表參照 aivault_bot_posts）
drop trigger if exists aivault_bot_posts_novel_review_guard on public.aivault_bot_posts;
drop trigger if exists aivault_novel_chapters_author_leaves_reviewers on public.aivault_novel_chapters;
drop function if exists public.aivault_novel_author_leaves_reviewers();
drop function if exists public.aivault_novel_review_release(int, text);
drop table if exists public.aivault_novel_comments;
drop function if exists public.aivault_novel_book_is_public(uuid);
drop table if exists public.aivault_novel_chapter_digests;
drop function if exists public.aivault_novel_review_guard();
drop function if exists public.aivault_novel_reviewers_fill(int);
drop table if exists public.aivault_novel_reviewers;
drop function if exists public.aivault_is_novel_author(text);
delete from public.aivault_floor_state where k = 'novel_reviews';
-- AI 書評草稿在 aivault_bot_posts（target='novel'）；若也要回滾 20261123100000，整張表會一併移除。只清書評草稿：
-- delete from public.aivault_bot_posts where target = 'novel';
