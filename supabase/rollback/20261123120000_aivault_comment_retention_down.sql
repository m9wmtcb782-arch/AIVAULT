-- 回滾 20261123120000_aivault_comment_retention.sql（先跑本檔，再跑 110000、100000 的回滾）
do $do$ begin
  if to_regclass('cron.job') is not null then
    if exists (select 1 from cron.job where jobname = 'aivault-comment-retention') then perform cron.unschedule('aivault-comment-retention'); end if;
  end if;
end $do$;
drop policy if exists wc_hide_expired_ai on public.aivault_world_chat;
drop policy if exists bot_posts_hide_expired on public.aivault_bot_posts;
drop policy if exists novel_comments_hide_expired on public.aivault_novel_comments;
drop function if exists public.aivault_comment_retention_purge();
delete from public.aivault_floor_state where k = 'comment_retention';
