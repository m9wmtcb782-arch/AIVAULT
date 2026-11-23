-- t297（2026-11-23）留言只保留 7 天：pg_cron 每小時刪除超過 7 天的「留言列」。純新增，可回滾。
-- 只會刪：
--   (1) aivault_novel_comments（小說留言／AI 書評）全部超過 7 天的列
--   (2) aivault_bot_posts（機器人留言佇列／草稿）超過 7 天的列
--   (3) aivault_world_chat 中「本流程釋出的 AI 留言」：kind='ai' 且內文以【AI 生成】開頭、超過 7 天（人類訊息一律不動）
-- 絕不碰：小說（aivault_novel_books）、章節（aivault_novel_chapters）、電子書（dark_star_ebooks*）或任何其他表。
insert into public.aivault_floor_state(k, v) values ('comment_retention', '{"enabled":true,"days":7}') on conflict (k) do nothing;

create or replace function public.aivault_comment_retention_purge() returns jsonb
language plpgsql security definer set search_path = public as $$
declare cfg jsonb := coalesce((select v from aivault_floor_state where k = 'comment_retention'), '{}'::jsonb);
        cutoff timestamptz; n1 int := 0; n2 int := 0; n3 int := 0;
begin
  if coalesce((cfg->>'enabled')::boolean, true) = false then return jsonb_build_object('ok', false, 'error', 'disabled'); end if;
  cutoff := now() - make_interval(days => greatest(1, coalesce((cfg->>'days')::int, 7)));
  delete from aivault_world_chat where kind = 'ai' and body like '【AI 生成】%' and created_at < cutoff; get diagnostics n1 = row_count;
  delete from aivault_novel_comments where created_at < cutoff; get diagnostics n2 = row_count;
  delete from aivault_bot_posts where created_at < cutoff; get diagnostics n3 = row_count;
  insert into aivault_audit_events(actor, action, target, detail)
    values ('pg_cron', 'comment_retention_purge', 'comments', jsonb_build_object('cutoff', cutoff, 'world_chat_ai', n1, 'novel_comments', n2, 'bot_posts', n3));
  return jsonb_build_object('ok', true, 'cutoff', cutoff, 'world_chat_ai', n1, 'novel_comments', n2, 'bot_posts', n3);
end $$;
revoke all on function public.aivault_comment_retention_purge() from public, anon, authenticated;
grant execute on function public.aivault_comment_retention_purge() to service_role;

-- 刪除前的空窗：以 RESTRICTIVE 政策隱藏已過期的留言（新增政策；不改既有政策）
drop policy if exists novel_comments_hide_expired on public.aivault_novel_comments;
create policy novel_comments_hide_expired on public.aivault_novel_comments as restrictive for select to anon, authenticated
  using (created_at > now() - interval '7 days');
drop policy if exists bot_posts_hide_expired on public.aivault_bot_posts;
create policy bot_posts_hide_expired on public.aivault_bot_posts as restrictive for select to anon, authenticated
  using (created_at > now() - interval '7 days');
drop policy if exists wc_hide_expired_ai on public.aivault_world_chat;
create policy wc_hide_expired_ai on public.aivault_world_chat as restrictive for select to anon, authenticated
  using (not (kind = 'ai' and body like '【AI 生成】%' and created_at <= now() - interval '7 days'));

-- 每小時第 23 分執行（沿用既有 cron.schedule … where not exists 寫法）；本機測試環境沒有 pg_cron 時略過排程
do $do$ begin
  if to_regclass('cron.job') is not null then
    perform cron.schedule('aivault-comment-retention', '23 * * * *', $$select public.aivault_comment_retention_purge()$$)
      where not exists (select 1 from cron.job where jobname = 'aivault-comment-retention');
  else raise notice 'pg_cron not available: schedule skipped'; end if;
end $do$;
