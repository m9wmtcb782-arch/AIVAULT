-- AIVAULT Base1 (clcddygkaaqqtsbswgdf) post-recovery plan — NOT EXECUTED (DB down 2026-11-22 06:45 Asia/Taipei).
-- Run only after the DB accepts connections; in this order; each block measured before/after.
-- 0) measure (read-only)
select pg_size_pretty(pg_database_size(current_database())) db_size;
select n.nspname, c.relname, pg_total_relation_size(c.oid) total, pg_relation_size(c.oid) heap, pg_indexes_size(c.oid) idx,
       coalesce(pg_total_relation_size(c.reltoastrelid),0) toast, c.reltuples::bigint est_rows
  from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind in ('r','m') order by 3 desc limit 40;
select count(*) wal_files, pg_size_pretty(sum(size)) wal_size from pg_ls_waldir();
-- 1) backup cron config, then change job 9 to every minute (pg_cron cron syntax; '1 minute' is INVALID — that failed at 2026-11-21 22:43:17 UTC)
select jobid, jobname, schedule, command, active, database, username from cron.job order by jobid;   -- save to artifact
select cron.alter_job(9, schedule := '* * * * *');
-- 2) cron history: summary backup, then TRUNCATE (minimal WAL, frees disk immediately; a big DELETE generates ~table-size WAL and can re-fill the disk)
select jobid, status, count(*), min(start_time), max(start_time) from cron.job_run_details group by 1,2 order by 1,2;  -- save
truncate cron.job_run_details;
-- 3) blocked tasks (authorized): export rows to artifact first, then
-- select status, count(*) from public.aivault_pool_agent_tasks group by 1;        -- before
-- delete from public.aivault_pool_agent_tasks where status='blocked';             -- in batches of 5,000 to limit WAL
-- select status, count(*) from public.aivault_pool_agent_tasks group by 1;        -- after (only blocked changes)
-- 4) legal books: inventory by created_at, keep earliest 5, export all rows of the rest (dark_star_ebooks, _pages, _toc, _ingest_chunks,
--    _ingestion_jobs, _reading_progress, dark_star_study_books, storage.objects list + files), then FK-ordered delete in a transaction;
--    novels tables (aivault_novel_*) untouched; verify 8 books / 106 chapters before & after.
-- 5) VACUUM (ANALYZE) the touched tables (not VACUUM FULL while disk is tight), re-measure db size / disk util / WAL.
