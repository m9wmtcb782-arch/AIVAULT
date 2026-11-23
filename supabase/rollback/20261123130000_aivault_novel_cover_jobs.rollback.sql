-- 回滾 20261123130000。不刪 bucket 內檔案與 dark_star_ebooks 資料；cover_source 欄位保留（無害），如需移除再手動 drop。
do $$ begin if exists (select 1 from pg_extension where extname='pg_cron') then if exists (select 1 from cron.job where jobname='aivault-novel-covers') then perform cron.unschedule('aivault-novel-covers'); end if; end if; end $$;
drop trigger if exists aivault_novel_cover_bind on public.dark_star_ebooks;
drop function if exists public.aivault_novel_cover_bind_on_ebook();
drop function if exists public.aivault_novel_cover_enqueue_missing();
drop view if exists public.aivault_novel_cover_status;
drop table if exists public.aivault_novel_cover_attempts;
drop table if exists public.aivault_novel_cover_jobs;
drop table if exists public.aivault_novel_cover_config;
