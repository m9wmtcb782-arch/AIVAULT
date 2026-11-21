Subject: [Free plan] Project clcddygkaaqqtsbswgdf (AIVAULT, ap-northeast-1) stuck in crash-recovery loop – disk full, WAL cannot be written (53100 / 57P03)

Project ref: clcddygkaaqqtsbswgdf  (name: AIVAULT, org: jnkalguitfcdeasdhbfm, region ap-northeast-1)
Postgres: 17.6.1.155 (engine 17, release channel ga)
Plan: Free (no add-ons). Disk: gp3 2 GB (Management API /config/disk/util at 2026-11-21 23:08:27 UTC: fs_size 2,077,073,408 B, used 2,061,139,968 B, available 15,933,440 B ≈ 15 MB). PITR disabled; /database/backups lists no backups.
Project status in API: ACTIVE_HEALTHY, but health check: db, rest, storage, realtime UNHEALTHY (auth, pooler healthy).

Timeline (UTC, from postgres_logs):
- 2026-11-21 22:44:36 postmaster: SIGHUP, default_transaction_read_only -> on (disk-full protection)
- 22:45:00 pg_cron launcher: cannot execute nextval() in a read-only transaction; pg_cron launcher exited
- 22:45:03.867 walwriter: could not write to file "pg_wal/xlogtemp.4289": No space left on device (SQLSTATE 53100); WAL writer terminated by signal 6; archiver terminated by signal 3
- 22:45:04 database system was interrupted; last known up at 22:38:20; automatic recovery; redo starts at 114/8E0015B8
- Since then, every ~40–70 s: redo 114/8E0015B8 → redo done at 114/A4FE80E8 (~32 s), then startup: could not write to file "pg_wal/xlogtemp.NNN": No space left on device (53100) → startup process exited with code 1 → shutdown → restart. Clients receive 57P03 "the database system is not accepting connections / Hot standby mode is disabled". Still looping at 23:11 UTC (32+ cycles).

What we have NOT done: no WAL files deleted, no pause, no restore, no repeated SQL (one `select 1` connectivity check only), no plan change.

Request:
1. Please give the database enough temporary disk headroom (or free space safely on your side) so crash recovery can finish the end-of-recovery checkpoint and the instance can start, without data loss and without restoring an older backup.
2. After it is up, keep it in read-only mode (or tell us the window) so we can immediately: (a) change pg_cron job 9 `SELECT public.aivault_learning_dispatch_tick(1000)` from every second to every minute, (b) TRUNCATE/purge cron.job_run_details (~700 MB of run history), (c) remove large unneeded data, then VACUUM, bringing the database under the 500 MB Free limit. We will then confirm and you can return the disk to normal.
3. If only option is to expand disk on a paid plan, please tell us before doing anything (we cannot incur costs).

Contact: project owner (AIVAULT founder).
