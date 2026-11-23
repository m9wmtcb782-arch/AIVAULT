-- 回滾 20261123100000_aivault_pool_smallmodel.sql（只移除本次新增的物件；不動既有資料表與既有 guard）
drop trigger if exists aivault_world_chat_guard_zz_ai on public.aivault_world_chat;
drop function if exists public.aivault_world_chat_ai_mark();
drop function if exists public.aivault_bot_post_publish(bigint, text);
drop function if exists public.aivault_bot_post_release(int, text);
drop function if exists public.aivault_rate_hit(text, int, int);
-- 以下會移除新表的資料；如需保留先匯出：copy (select * from public.aivault_bot_posts) ...
drop table if exists public.aivault_bot_posts;
drop table if exists public.aivault_pool_agent_roles;
drop table if exists public.aivault_rate_limits;
delete from public.aivault_floor_state where k in ('novel_gemini','bot_posts','pool_smallmodel','bot_release');
-- 章節欄位：先把 pending 章節設回可見再移除欄位（避免待審章節遺失可見性設定）
alter table public.aivault_novel_chapters drop column if exists review_status;
