#!/usr/bin/env python3
"""Base1 DB maintenance steps via Supabase Management API (project clcddygkaaqqtsbswgdf only)."""
import json, os, sys, time, urllib.request, urllib.error
REF = "clcddygkaaqqtsbswgdf"  # 第一基地 only. Base2 (svtkpdmqemidlasowqew) is never referenced.
API = "https://api.supabase.com/v1/projects/" + REF
TOKEN = os.environ.get("TOKEN", "")
STEP = os.environ.get("STEP", "health")
CONFIRM = os.environ.get("CONFIRM", "")
OUT = "ops-out"; os.makedirs(OUT, exist_ok=True)
LOG = open(os.path.join(OUT, f"{STEP}.log"), "a", encoding="utf-8")

def log(*a):
    s = " ".join(str(x) for x in a); print(s, flush=True); LOG.write(s + "\n"); LOG.flush()

def req(method, path, body=None, timeout=120):
    r = urllib.request.Request(API + path, method=method, data=json.dumps(body).encode() if body is not None else None,
        headers={"Authorization": "Bearer " + TOKEN, "Content-Type": "application/json", "User-Agent": "aivault-db-maint"})
    try:
        with urllib.request.urlopen(r, timeout=timeout) as x:
            t = x.read().decode(); return x.status, (json.loads(t) if t.strip().startswith(("[", "{")) else t)
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:2000]
    except Exception as e:
        return 0, f"{type(e).__name__}: {e}"

def q(sql, label=None, timeout=300):
    log(f"-- SQL[{label or ''}]:\n{sql.strip()}")
    st, d = req("POST", "/database/query", {"query": sql}, timeout)
    if st not in (200, 201):
        log(f"   -> HTTP {st}: {str(d)[:1500]}"); raise SystemExit(f"SQL failed ({label})")
    log(f"   -> {json.dumps(d, ensure_ascii=False, default=str)[:4000]}")
    return d

def save(name, data):
    with open(os.path.join(OUT, name), "w", encoding="utf-8") as f: json.dump(data, f, ensure_ascii=False, default=str)
    log(f"   saved {name}")

def step_health():
    st, d = req("GET", ""); log("PROJECT", st, json.dumps({k: d.get(k) for k in ("id", "name", "status", "region", "created_at")} if isinstance(d, dict) else d, ensure_ascii=False))
    st, d = req("GET", "/health?services=db,rest,auth,storage,realtime"); log("HEALTH", st, json.dumps(d, ensure_ascii=False)[:2000])
    # ONE lightweight connectivity check
    st, d = req("POST", "/database/query", {"query": "select 1 as ok, now() as at, pg_is_in_recovery() as recovery"}, 60)
    log("SELECT1", st, str(d)[:1500])

def logs(sql, hours=24, label="", ago_days=0):
    import urllib.parse
    now = time.time() - ago_days * 86400
    end = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime(now)); start = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime(now - min(hours, 24) * 3600 + 60))
    st, d = req("GET", "/analytics/endpoints/logs?" + urllib.parse.urlencode({"sql": sql, "iso_timestamp_start": start, "iso_timestamp_end": end}))
    rows = (d.get("result") if isinstance(d, dict) else None) or []
    log(f"LOGS[{label}] HTTP {st} rows={len(rows)} err={str(d.get('error') if isinstance(d, dict) else d)[:300]}")
    save(f"logs-{label}.json", d)
    return rows

def step_diag():
    """NO SQL against the database: Management API + log analytics only (safe while DB is down)."""
    for path in ["", "/health?services=db,rest,auth,storage,realtime,pooler", "/config/disk", "/config/disk/util", "/config/disk/autoscale",
                 "/database/backups", "/readonly", "/config/database/postgres", "/upgrade/status", "/billing/addons"]:
        st, d = req("GET", path); log(f"GET {path or '/'} -> {st} {json.dumps(d, ensure_ascii=False, default=str)[:2500]}")
        save("api" + (path.replace('/', '_').split('?')[0] or "_project") + ".json", {"status": st, "body": d})
    rows = logs("select timestamp, event_message from postgres_logs order by timestamp desc limit 400", 24, "postgres-24h")
    for r in rows[:120]: log("  PG", r.get("timestamp"), str(r.get("event_message"))[:300].replace("\n", " "))
    for h in (24, 72, 168):
        rows = logs("select timestamp, event_message from postgres_logs where regexp_contains(event_message, '53100|57P03|No space|xlogtemp|PANIC|could not write|checkpoint|redo|database system') order by timestamp asc limit 300", h, f"postgres-errors-{h}h")
        for r in rows[:80]: log("  ERR", r.get("timestamp"), str(r.get("event_message"))[:300])
        if rows: break

def step_logs():
    step_diag_logs()

def step_diag_logs():
    W = "source = 'postgres_logs'"
    rows = logs(f"SELECT timestamp, severity_text, event_message FROM logs WHERE {W} ORDER BY timestamp DESC LIMIT 300", 24, "postgres-last24h")
    for r in rows[:120]: log("  PG", r.get("timestamp"), r.get("severity_text"), str(r.get("event_message"))[:300])
    for d in range(0, 7):
        rows = logs(f"SELECT timestamp, log_attributes['parsed.sql_state_code'] AS code, event_message FROM logs WHERE {W} AND (match(event_message, '53100|57P03|No space|xlogtemp|PANIC|could not write|redo |database system is|checkpointer|disk') OR log_attributes['parsed.sql_state_code'] IN ('53100','57P03','58P01','XX000')) ORDER BY timestamp ASC LIMIT 200", 24, f"postgres-errors-day-{d}", ago_days=d)
        for r in rows[:40]: log(f"  ERR d-{d}", r.get("timestamp"), r.get("code"), str(r.get("event_message"))[:260])
    rows = logs("SELECT source, count() AS n FROM logs GROUP BY source ORDER BY n DESC", 24, "sources-24h")
    for r in rows: log("  SRC", r)

def step_crashlog():
    W = "source = 'postgres_logs'"
    for d in range(0, 4):
        rows = logs(f"SELECT min(timestamp) AS first, max(timestamp) AS last, count() AS n FROM logs WHERE {W} AND match(event_message, 'No space left|xlogtemp|53100')", 24, f"nospace-day-{d}", ago_days=d)
        log(f"  NOSPACE d-{d}", rows)
        rows = logs(f"SELECT min(timestamp) AS first, max(timestamp) AS last, count() AS n FROM logs WHERE {W} AND match(event_message, 'not accepting connections|57P03')", 24, f"57p03-day-{d}", ago_days=d)
        log(f"  57P03 d-{d}", rows)
    rows = logs(f"SELECT timestamp, severity_text, log_attributes['parsed.sql_state_code'] AS code, event_message FROM logs WHERE {W} AND NOT match(event_message, 'checkpoint (starting|complete)|not accepting connections|connection (received|authorized|authenticated)|disconnection') ORDER BY timestamp ASC LIMIT 400", 24, "pg-notable-24h")
    for r in rows[:400]: log("  N", r.get("timestamp"), r.get("code"), str(r.get("event_message"))[:240])

def step_window():
    import urllib.parse
    start, end = CONFIRM.split("|")
    sql = "SELECT timestamp, log_attributes['parsed.sql_state_code'] AS code, log_attributes['parsed.backend_type'] AS bt, event_message FROM logs WHERE source = 'postgres_logs' AND position(event_message, 'cron job') = 0 AND position(event_message, 'connection ') = 0 AND position(event_message, 'disconnection') = 0 ORDER BY timestamp ASC LIMIT 500"
    st, d = req("GET", "/analytics/endpoints/logs?" + urllib.parse.urlencode({"sql": sql, "iso_timestamp_start": start, "iso_timestamp_end": end}))
    rows = (d.get("result") if isinstance(d, dict) else None) or []
    log(f"WINDOW {start}..{end} HTTP {st} rows={len(rows)} err={str(d.get('error') if isinstance(d, dict) else d)[:300]}")
    save("logs-window.json", d)
    for r in rows: log("  W", r.get("timestamp"), r.get("code"), r.get("bt"), str(r.get("event_message"))[:260])

MASK = "coalesce(substring(command from '(functions/v1/[a-zA-Z0-9_/-]+|[a-z_]+\\.[a-z_]+\\([^)]{0,30}\\)|[a-z_]+\\([^)]{0,30}\\))'), '(other)')"

def qs(sql, label, timeout=120):
    """read-only SQL; tolerant (logs error, continues); short pause to avoid hammering."""
    log(f"-- SQL[{label}]: {' '.join(sql.split())[:600]}")
    t0 = time.time(); st, d = req("POST", "/database/query", {"query": sql}, timeout); dt = time.time() - t0
    log(f"   -> HTTP {st} in {dt:.1f}s: {json.dumps(d, ensure_ascii=False, default=str)[:6000]}")
    save(f"q-{label}.json", {"status": st, "secs": round(dt, 2), "body": d}); time.sleep(1)
    return d if st in (200, 201) else None

def step_measure():
    """READ-ONLY: connectivity x5, sizes, connections, cron, WAL, Management API disk/health. No writes."""
    for path in ["", "/health?services=db,rest,auth,storage,realtime,pooler", "/config/disk", "/config/disk/util", "/config/disk/autoscale", "/readonly", "/billing/addons", "/config/database/pooler"]:
        st, d = req("GET", path); log(f"GET {path or '/'} -> {st} {json.dumps(d, ensure_ascii=False, default=str)[:2500]}")
        save("api" + (path.replace('/', '_').split('?')[0] or "_project") + ".json", {"status": st, "body": d})
    for i in range(5):
        qs("select 1 as ok, now() as at, pg_is_in_recovery() as recovery, current_setting('default_transaction_read_only') ro, current_setting('transaction_read_only') tro", f"select1-{i}", 60); time.sleep(3)
    qs("select version(), pg_size_pretty(pg_database_size(current_database())) db_size, pg_database_size(current_database()) db_bytes, current_setting('max_connections') maxconn, current_setting('shared_buffers') sb, current_setting('max_wal_size') mws, current_setting('wal_keep_size') wks, current_setting('archive_mode') am", "settings")
    qs("select datname, pg_database_size(datname) bytes from pg_database order by 2 desc", "dbsizes")
    qs("select count(*) wal_files, sum(size) wal_bytes from pg_ls_waldir()", "wal")
    qs("select * from pg_stat_archiver", "archiver")
    qs("select slot_name, slot_type, active, wal_status, pg_wal_lsn_diff(pg_current_wal_lsn(), restart_lsn) retained_bytes from pg_replication_slots", "slots")
    qs("select n.nspname, c.relname, c.relkind, pg_total_relation_size(c.oid) total, pg_relation_size(c.oid) heap, pg_indexes_size(c.oid) idx, coalesce(pg_total_relation_size(c.reltoastrelid),0) toast, c.reltuples::bigint est_rows from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind in ('r','m','p') order by 4 desc limit 60", "toptables")
    qs("select n.nspname, sum(pg_total_relation_size(c.oid)) bytes from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind in ('r','m','p') group by 1 order by 2 desc", "schemas")
    qs("select schemaname, relname, n_live_tup, n_dead_tup, last_autovacuum, last_vacuum, n_tup_ins, n_tup_upd, n_tup_del from pg_stat_user_tables order by n_dead_tup desc limit 30", "deadtup")
    qs("select state, wait_event_type, wait_event, backend_type, usename, application_name, count(*) n, max(now()-coalesce(xact_start,backend_start)) oldest from pg_stat_activity group by 1,2,3,4,5,6 order by n desc", "activity")
    qs("select pid, usename, application_name, state, now()-query_start dur, wait_event, left(query,160) q from pg_stat_activity where state<>'idle' and pid<>pg_backend_pid() order by dur desc nulls last limit 20", "active")
    qs(f"select jobid, jobname, schedule, active, username, left({MASK},220) cmd from cron.job order by jobid", "cronjobs")
    qs("select pg_total_relation_size('cron.job_run_details') bytes, (select count(*) from cron.job_run_details) n, (select min(start_time) from cron.job_run_details) first, (select max(start_time) from cron.job_run_details) last", "cronhist")
    qs("select jobid, status, count(*) n, max(start_time) last from cron.job_run_details where start_time > now()-interval '3 hours' group by 1,2 order by 1,2", "cronrecent")
    qs("select relname, pg_total_relation_size(c.oid) bytes from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='net' and c.relkind='r'", "pgnet")
    qs("select checkpoints_timed, checkpoints_req, buffers_checkpoint from pg_stat_bgwriter", "bgwriter")
    qs("select * from pg_stat_checkpointer", "checkpointer")
    qs("select sum(blks_read) blks_read, sum(blks_hit) blks_hit, sum(temp_bytes) temp_bytes, sum(xact_commit) commits from pg_stat_database", "iostats")

def wq(sql, label, timeout=300):
    """write SQL (only inside destructive steps gated by CONFIRM)."""
    log(f"-- WRITE[{label}]: {' '.join(sql.split())[:600]}")
    t0 = time.time(); st, d = req("POST", "/database/query", {"query": sql}, timeout); dt = time.time() - t0
    log(f"   -> HTTP {st} in {dt:.1f}s: {json.dumps(d, ensure_ascii=False, default=str)[:3000]}")
    save(f"w-{label}.json", {"status": st, "secs": round(dt, 2), "body": d}); time.sleep(2)
    return st in (200, 201), d

def step_cronfix():
    """t224u/t225u authorized. Job 9 is already '0 * * * *' (hourly, lighter than every minute) -> not touched.
    cron.job_run_details (~700 MB run-log history) -> lean backup of newest 500 rows (index scan) then TRUNCATE (instant, frees disk, minimal WAL)."""
    if CONFIRM != "cronfix": sys.exit("type cronfix in confirm")
    qs("select current_setting('default_transaction_read_only') ro, pg_is_in_recovery() rec, pg_database_size(current_database()) db_bytes", "pre-state", 120)
    qs(f"select jobid, jobname, schedule, active, {MASK} cmd from cron.job order by jobid", "pre-cronjobs")
    d = qs("select runid, jobid, status, left(return_message,200) return_message, start_time, end_time from cron.job_run_details order by runid desc limit 500", "backup-jrd-newest500", 300)
    if d is None or not isinstance(d, list) or len(d) == 0: sys.exit("lean backup of newest rows failed -> NOT truncating")
    qs("select max(runid) max_runid, pg_total_relation_size('cron.job_run_details') bytes from cron.job_run_details where runid >= (select max(runid) from cron.job_run_details)", "pre-jrd-size", 120)
    ok, r = wq("set lock_timeout = '20s'; truncate cron.job_run_details;", "truncate-jrd", 300)
    if not ok: sys.exit("truncate failed")
    qs("select pg_total_relation_size('cron.job_run_details') bytes, count(*) n from cron.job_run_details", "post-jrd")
    qs("select pg_database_size(current_database()) db_bytes", "post-dbsize")
    wq("notify pgrst, 'reload schema'", "pgrst-reload")

def wq_retry(sql, label, tries=8, gap=25, timeout=300):
    """retry ONLY when the connection never established (HTTP 544 'connection timeout' => statement not executed)."""
    for i in range(tries):
        ok, d = wq(sql, f"{label}-try{i}", timeout)
        if ok: return True, d
        if "connection timeout" not in str(d): return False, d
        time.sleep(gap)
    return False, d

def step_truncjrd():
    """t224u/t225u: lean backup already saved (run 45003721783 artifact, newest 500 rows). TRUNCATE cron.job_run_details with connect-retry."""
    if CONFIRM != "truncjrd": sys.exit("type truncjrd in confirm")
    ok, d = wq_retry("set lock_timeout = '20s'; truncate cron.job_run_details;", "truncate-jrd")
    if not ok: sys.exit("truncate failed")
    time.sleep(5)
    for i in range(3):
        if qs("select pg_total_relation_size('cron.job_run_details') jrd_bytes, (select count(*) from cron.job_run_details) n, pg_database_size(current_database()) db_bytes", f"post-size-{i}") is not None: break
        time.sleep(20)
    wq_retry("notify pgrst, 'reload schema'", "pgrst-reload", 4, 20)

def step_pgrst():
    """READ-ONLY: why PostgREST schema cache fails (PGRST002)."""
    qs("select left(regexp_replace(query,'\\s+',' ','g'),140) q, calls, round(total_exec_time/1000) total_s, round(mean_exec_time) mean_ms, shared_blks_read, temp_blks_written from extensions.pg_stat_statements order by total_exec_time desc limit 15", "pss-time")
    qs("select left(regexp_replace(query,'\\s+',' ','g'),140) q, calls, shared_blks_read, shared_blks_written, round(total_exec_time/1000) total_s from extensions.pg_stat_statements order by shared_blks_read+shared_blks_written desc limit 10", "pss-io")
    qs("select backend_type, object, context, reads, writes, extends, round(read_time) read_ms, round(write_time) write_ms, fsyncs from pg_stat_io where coalesce(reads,0)+coalesce(writes,0)>0 order by coalesce(read_time,0)+coalesce(write_time,0) desc limit 12", "pgstatio")
    qs("select count(*) filter (where relkind in ('r','v','m','p','f')) rels, (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','graphql_public')) funcs, (select count(*) from pg_attribute) atts from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public'", "catalog")
    qs("select pid, usename, application_name, state, now()-query_start dur, now()-backend_start age, wait_event_type, wait_event, left(query,200) q from pg_stat_activity where usename='authenticator' or application_name ilike '%postgrest%'", "pgrst-conns")
    qs("select schemaname, relname, n_live_tup, n_dead_tup, last_autovacuum, last_autoanalyze from pg_stat_sys_tables where relname in ('pg_class','pg_attribute','pg_proc','pg_depend','pg_type','pg_constraint','pg_statistic') order by n_dead_tup desc", "catalog-bloat")
    qs("select c.relname, pg_total_relation_size(c.oid) bytes from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='pg_catalog' and c.relkind='r' order by 2 desc limit 8", "catalog-sizes")
    start = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime(time.time()-600)); end = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
    import urllib.parse
    for label, sql in [("pg", "SELECT timestamp, log_attributes['parsed.sql_state_code'] AS code, log_attributes['parsed.user_name'] AS u, log_attributes['parsed.application_name'] AS app, event_message FROM logs WHERE source = 'postgres_logs' AND position(event_message, 'connection ') = 0 AND position(event_message, 'disconnection') = 0 ORDER BY timestamp DESC LIMIT 200"),
                       ("rest", "SELECT timestamp, event_message FROM logs WHERE source = 'postgrest_logs' ORDER BY timestamp DESC LIMIT 100")]:
        st, d = req("GET", "/analytics/endpoints/logs?" + urllib.parse.urlencode({"sql": sql, "iso_timestamp_start": start, "iso_timestamp_end": end}))
        rows = (d.get("result") if isinstance(d, dict) else None) or []
        log(f"LOGS[{label}] HTTP {st} rows={len(rows)} err={str(d.get('error') if isinstance(d, dict) else d)[:300]}"); save(f"logs-{label}.json", d)
        for r in rows[:80]: log("  L", r.get("timestamp"), r.get("code"), r.get("u"), r.get("app"), str(r.get("event_message"))[:300].replace("\n", " "))

def step_pgrstfix():
    """PGRST002 root: PostgREST schema-cache query exceeds authenticator statement_timeout=8s on the IO-starved DB.
    Minimal reversible fix: authenticator statement_timeout 8s -> 60s (anon 3s / authenticated 8s unchanged). Rollback: alter role authenticator set statement_timeout = '8s'."""
    if CONFIRM != "pgrstfix": sys.exit("type pgrstfix in confirm")
    ok, d = wq_retry("alter role authenticator set statement_timeout = '60s'", "authenticator-timeout")
    if not ok: sys.exit("alter role failed")
    qs("select rolname, rolconfig from pg_roles where rolname in ('authenticator','anon','authenticated')", "roles-after")
    wq_retry("notify pgrst, 'reload config'", "pgrst-reload-config", 4, 15); time.sleep(3)
    wq_retry("notify pgrst, 'reload schema'", "pgrst-reload-schema", 4, 15)

def alog(label, sql, minutes=15, show=60):
    import urllib.parse
    start = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime(time.time()-minutes*60)); end = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
    st, d = req("GET", "/analytics/endpoints/logs?" + urllib.parse.urlencode({"sql": sql, "iso_timestamp_start": start, "iso_timestamp_end": end}))
    rows = (d.get("result") if isinstance(d, dict) else None) or []
    log(f"LOGS[{label}] HTTP {st} rows={len(rows)} err={str(d.get('error') if isinstance(d, dict) else d)[:300]}"); save(f"logs-{label}.json", d)
    for r in rows[:show]: log("  L", json.dumps(r, ensure_ascii=False, default=str)[:400])
    return rows

def step_load():
    """READ-ONLY: who is loading the DB right now."""
    alog("edge-by-fn", "SELECT m.function_id AS fn, r.method AS method, count(*) AS n FROM function_edge_logs CROSS JOIN UNNEST(metadata) AS m CROSS JOIN UNNEST(m.request) AS r GROUP BY fn, method ORDER BY n DESC LIMIT 40")
    alog("edge-paths", "SELECT r.pathname AS path, resp.status_code AS code, count(*) AS n FROM function_edge_logs CROSS JOIN UNNEST(metadata) AS m CROSS JOIN UNNEST(m.request) AS r CROSS JOIN UNNEST(m.response) AS resp GROUP BY path, code ORDER BY n DESC LIMIT 40")
    alog("api-paths", "SELECT r.path AS path, r.method AS method, resp.status_code AS code, count(*) AS n FROM edge_logs CROSS JOIN UNNEST(metadata) AS m CROSS JOIN UNNEST(m.request) AS r CROSS JOIN UNNEST(m.response) AS resp GROUP BY path, method, code ORDER BY n DESC LIMIT 50")
    alog("api-ua", "SELECT h.user_agent AS ua, h.cf_connecting_ip AS ip, count(*) AS n FROM edge_logs CROSS JOIN UNNEST(metadata) AS m CROSS JOIN UNNEST(m.request) AS r CROSS JOIN UNNEST(r.headers) AS h GROUP BY ua, ip ORDER BY n DESC LIMIT 25")
    qs("select usename, application_name, state, wait_event_type, wait_event, count(*) n, max(now()-query_start) longest from pg_stat_activity where backend_type='client backend' group by 1,2,3,4,5 order by n desc", "act-now")
    qs("select pid, usename, application_name, now()-query_start dur, wait_event_type, wait_event, left(regexp_replace(query,'[[:space:]]+',' ','g'),180) q from pg_stat_activity where state='active' and pid<>pg_backend_pid() order by dur desc limit 15", "act-active")
    qs("select left(regexp_replace(query,'[[:space:]]+',' ','g'),140) q, calls, round(total_exec_time/1000) total_s, round(mean_exec_time) mean_ms, shared_blks_read from extensions.pg_stat_statements order by total_exec_time desc limit 20", "pss-time")

RED = "regexp_replace(regexp_replace(%s, '(eyJ[A-Za-z0-9._-]{20,}|sb_secret_[A-Za-z0-9_-]+|[Bb]earer [A-Za-z0-9._-]{12,})', '***', 'g'), '[[:space:]]+', ' ', 'g')"

def step_writeload():
    """READ-ONLY: job 9 real schedule/frequency, retention job, write-heavy table growth/bloat."""
    qs(f"select jobid, jobname, schedule, active, left({RED % 'command'},700) cmd from cron.job where jobid in (3,4,9,10,14,15,16,17) order by jobid", "jobs-detail")
    qs("select jobid, count(*) n, min(start_time) first, max(start_time) last, count(*) filter (where status='succeeded') ok from cron.job_run_details group by 1 order by 1", "jrd-now")
    qs(f"select p.proname, length(p.prosrc) len, left({RED % 'p.prosrc'},2500) src from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('aivault_learning_dispatch_tick')", "tick-src")
    qs("select relname, n_live_tup, n_dead_tup, n_tup_ins, n_tup_upd, n_tup_hot_upd, n_tup_del, last_autovacuum, autovacuum_count, pg_total_relation_size(relid) bytes from pg_stat_user_tables where relname in ('aivault_presence','aivault_darkstar_heartbeat_runs','agent_registry','aivault_compute_nodes','aivault_learning_dispatch','aivault_pool_agent_tasks','aivault_pool_agents','aivault_pool_agent_learning','aivault_private_pages','aivault_compute_tasks','aivault_gateway_quota_events','aivault_standing_order_log') order by n_tup_ins+n_tup_upd desc", "write-tables")
    qs("select relname, n_tup_ins+n_tup_upd+n_tup_del writes, n_dead_tup, pg_total_relation_size(relid) bytes from pg_stat_user_tables order by n_tup_ins+n_tup_upd+n_tup_del desc limit 15", "top-writers")
    qs("select status, count(*) n from public.aivault_learning_dispatch group by 1 order by 2 desc", "dispatch-status", 120)
    qs("select status, count(*) n from public.aivault_pool_agent_tasks group by 1 order by 2 desc", "tasks-status", 120)
    qs("select date_trunc('hour', created_at) h, count(*) from public.aivault_darkstar_heartbeat_runs where created_at > now()-interval '6 hours' group by 1 order by 1", "hb-rate", 120)
    qs("select slug, length(coalesce(html::text,'')) len, updated_at from public.aivault_private_pages order by slug", "private-pages", 120)
    qs("select stats_reset from pg_stat_database where datname='postgres'", "stats-reset")
    alog("alter-job", "SELECT timestamp, event_message FROM logs WHERE source = 'postgres_logs' AND (match(event_message, 'alter_job|cron.schedule|unschedule|job_run_details') ) ORDER BY timestamp ASC LIMIT 50", 1440, 50)

def step_bench():
    """READ-ONLY micro-benchmarks: server-side CPU time vs IO time (explain analyze)."""
    for i in range(3):
        qs("explain (analyze, timing off, format json) select count(*) from generate_series(1,1000000)", f"cpu-{i}", 120); time.sleep(5)
    qs("explain (analyze, buffers, format json) select count(*) from public.aivault_private_pages", "io-small", 120)
    qs("explain (analyze, buffers, format json) select count(*) from public.aivault_learning_dispatch", "io-30mb", 180)
    qs("select name, setting from pg_settings where name in ('track_io_timing','shared_buffers','effective_cache_size','work_mem','max_worker_processes','max_parallel_workers')", "settings2")

PAUSE_JOBS = (3, 4, 10, 13)  # learn10, place (ebook-ingest every 10 min), share_research (avg 34 s), cla_assign_new_agents (avg 99 s)

def step_throttle():
    """TEMPORARY, reversible IO throttle while disk IO is starved. Revert: step unthrottle (active := true). 暗星 jobs 14/15/16, dispatch 9 untouched."""
    if CONFIRM != "throttle": sys.exit("type throttle in confirm")
    for j in PAUSE_JOBS: wq_retry(f"select cron.alter_job({j}, active := false)", f"pause-{j}", 4, 15)
    qs("select jobid, jobname, schedule, active from cron.job order by jobid", "jobs-after")

def step_unthrottle():
    if CONFIRM != "unthrottle": sys.exit("type unthrottle in confirm")
    for j in PAUSE_JOBS: wq_retry(f"select cron.alter_job({j}, active := true)", f"resume-{j}", 4, 15)
    qs("select jobid, jobname, schedule, active from cron.job order by jobid", "jobs-after")

def step_inventory():
    """READ-ONLY ebook inventory (metadata only, no book text): per-book page bytes, category, jurisdiction hints. No deletions."""
    qs("""select b.id, b.title, b.author, b.language, b.status, b.created_at, b.total_pages,
      b.metadata->>'category' cat, b.metadata->>'subcategory' subcat, b.metadata->>'jurisdiction' juris, b.metadata->>'visibility' vis,
      coalesce(p.n,0) pages, coalesce(p.bytes,0) page_bytes
      from public.dark_star_ebooks b left join (select ebook_id, count(*) n, sum(pg_column_size(t.*)) bytes from public.dark_star_ebook_pages t group by 1) p on p.ebook_id=b.id
      order by b.created_at""", "ebooks", 300)
    qs("select bucket_id, count(*) n, sum((metadata->>'size')::bigint) bytes from storage.objects group by 1 order by 3 desc nulls last", "storage", 120)
    qs("select pg_database_size(current_database()) db_bytes", "dbsize", 60)
    qs("select n.nspname, c.relname, pg_total_relation_size(c.oid) total from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind in ('r','m','p') order by 3 desc limit 25", "toptables", 300)
    qs(f"select jobid, left({RED % 'command'},400) cmd from cron.job where jobid=17", "job17")

def step_accept():
    """READ-ONLY acceptance checks."""
    for i in range(5):
        qs("select 1 ok, now() at, pg_is_in_recovery() rec", f"sel-{i}", 60); time.sleep(8)
    qs("select agent_id, status, connection_status, last_heartbeat, now()-last_heartbeat age from public.agent_registry where agent_id in ('darkstar','technical-dark-star')", "agent-registry")
    qs("select slot, status, error_code, finished_at from public.aivault_darkstar_heartbeat_runs order by slot desc limit 12", "hb-latest", 120)
    qs("select count(*) n, max(updated_at) last from public.dark_star_learning_memory", "ds-memory", 120)
    qs("select id, title, status, total_pages from public.dark_star_ebooks where id::text like any(array['a14fa90b%','28b34c97%','e0bc8c57%','c8743d50%'])", "core-books", 120)
    qs("select (select count(*) from public.dark_star_ebooks) books, (select count(*) from public.aivault_novel_books) novels, (select count(*) from public.aivault_novel_chapters) chapters", "counts", 180)
    qs("select title from public.aivault_novel_books order by 1", "novels", 60)
    qs("select state, count(*) from public.aivault_learning_dispatch group by 1 order by 2 desc", "dispatch-state", 180)
    qs("select * from public.aivault_learning_dispatch_ticks order by tick_id desc limit 3", "dispatch-ticks", 60)
    qs("select status, count(*) from public.aivault_pool_agent_tasks group by 1", "pool-tasks", 180)
    qs("select id, node_name, status, last_heartbeat_at from public.aivault_compute_nodes order by last_heartbeat_at desc nulls last limit 5", "compute-nodes", 60)
    qs("select jobid, status, count(*) n, max(start_time) last from cron.job_run_details where start_time > now()-interval '40 minutes' group by 1,2 order by 1,2", "cron-recent", 60)
    qs("select pg_database_size(current_database()) db_bytes", "dbsize", 60)
    for path in ["/health?services=db,rest,auth,storage,realtime,pooler", "/config/disk", "/config/disk/util"]:
        st, d = req("GET", path); log(f"GET {path} -> {st} {json.dumps(d, ensure_ascii=False, default=str)[:1500]}"); save("api" + path.replace('/', '_').split('?')[0] + ".json", {"status": st, "body": d})

def qr(sql, label, timeout=120, tries=5):
    for i in range(tries):
        d = qs(sql, f"{label}" if i == 0 else f"{label}-r{i}", timeout)
        if d is not None: return d
        time.sleep(15)

def step_accept2():
    """READ-ONLY: retries connection timeouts; 暗星 heartbeat/memory/core books, novels."""
    qr("select agent_id, status, connection_status, current_action, last_heartbeat, now()-last_heartbeat age from public.agent_registry where agent_id in ('darkstar','technical-dark-star')", "agent-registry")
    qr("select slot, status, error_code, finished_at from public.aivault_darkstar_heartbeat_runs order by slot desc limit 15", "hb-latest")
    qr("select count(*) n, max(updated_at) last from public.dark_star_learning_memory", "ds-memory")
    qr("select id, title, status, total_pages from public.dark_star_ebooks where id::text like any(array['a14fa90b%','28b34c97%','e0bc8c57%','c8743d50%'])", "core-books")
    qr("select ebook_id, count(*) pages from public.dark_star_ebook_pages where ebook_id::text like any(array['a14fa90b%','28b34c97%','e0bc8c57%','c8743d50%']) group by 1", "core-pages", 180)
    qr("select title from public.aivault_novel_books order by 1", "novels")
    qr("select count(*) n, max(created_at) last from public.aivault_pool_agent_learning", "pool-learning", 180)
    qr("select count(*) n from public.aivault_pool_agents", "pool-agents", 180)

def step_final():
    """READ-ONLY: heartbeat success in last hour + recovery timeline."""
    qr("select status, count(*) n, max(slot) last_slot, max(finished_at) last_finished from public.aivault_darkstar_heartbeat_runs where slot >= to_char(now() at time zone 'utc' - interval '70 minutes','YYYY-MM-DD\"T\"HH24:MI') and slot not like 'work:%' group by 1", "hb-hour")
    qr("select agent_id, status, last_heartbeat, now()-last_heartbeat age from public.agent_registry where agent_id='darkstar'", "agent-now")
    for d0, d1, lab in [("2026-11-22T02:30:00Z", "2026-11-22T04:30:00Z", "recov"), ("2026-11-22T04:30:00Z", "2026-11-22T07:00:00Z", "recov2")]:
        alog(lab, "SELECT timestamp, event_message FROM logs WHERE source = 'postgres_logs' AND match(event_message, 'ready to accept|redo done|No space|shutting down|starting PostgreSQL|pg_cron scheduler') ORDER BY timestamp ASC LIMIT 100", 0, 100) if False else None
        import urllib.parse
        sql = "SELECT timestamp, event_message FROM logs WHERE source = 'postgres_logs' AND regexp_contains(event_message, 'ready to accept|redo done|No space|shutting down|starting PostgreSQL|pg_cron scheduler') ORDER BY timestamp ASC LIMIT 100"
        st, d = req("GET", "/analytics/endpoints/logs?" + urllib.parse.urlencode({"sql": sql, "iso_timestamp_start": d0, "iso_timestamp_end": d1}))
        rows = (d.get("result") if isinstance(d, dict) else None) or []
        log(f"LOGS[{lab}] {st} rows={len(rows)} err={str(d.get('error') if isinstance(d, dict) else d)[:200]}"); save(f"logs-{lab}.json", d)

def cols(t):
    return f"(select string_agg(column_name||':'||data_type, ', ' order by ordinal_position) from information_schema.columns where table_schema='public' and table_name='{t}')"

def step_p1():
    """READ-ONLY phase-1..5 diagnosis for t230u."""
    qr("select name, setting from pg_settings where name like 'cron.%' or name in ('max_connections','superuser_reserved_connections','idle_in_transaction_session_timeout')", "settings")
    qr("select usename, application_name, state, count(*) n from pg_stat_activity where backend_type='client backend' group by 1,2,3 order by 4 desc", "conns")
    for t in ["aivault_darkstar_heartbeat_runs","agent_registry","aivault_pool_agent_tasks","aivault_pool_agents","aivault_learning_dispatch","compute_mesh_nodes","compute_mesh_tasks","compute_mesh_assignments","compute_models","aivault_compute_nodes","aivault_compute_tasks","dark_star_study_books"]:
        qr(f"select '{t}' t, {cols(t)} c", f"cols-{t}")
    qr("select status, count(*) n, min(slot) first, max(slot) last from public.aivault_darkstar_heartbeat_runs where status='STARTED' group by 1", "hb-started")
    qr("select status, connection_status, count(*) n from public.agent_registry group by 1,2 order by 3 desc", "registry-status")
    qr("select agent_id, status, connection_status, current_action from public.agent_registry where status in ('BLOCKED') limit 10", "registry-blocked")
    qr("select c.relname, c.relrowsecurity rls, has_table_privilege('anon', c.oid, 'select') anon_sel, has_table_privilege('authenticated', c.oid, 'select') auth_sel, has_table_privilege('service_role', c.oid, 'select') sr_sel from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('dark_star_ebooks','dark_star_ebook_pages','dark_star_ebook_toc','dark_star_ebook_ingest_chunks','dark_star_study_books','aivault_private_pages','agent_registry')", "ebook-grants")
    qr("select tablename, policyname, roles, cmd, left(qual,200) qual from pg_policies where schemaname='public' and tablename in ('dark_star_ebooks','dark_star_ebook_pages','dark_star_study_books','dark_star_ebook_toc')", "ebook-policies")
    qr("select count(*) n from public.compute_mesh_nodes", "cm-nodes")
    qr("select status, count(*) from public.compute_mesh_tasks group by 1", "cm-tasks")
    qr("select status, count(*) from public.compute_mesh_assignments group by 1", "cm-assign")
    qr("select * from public.compute_models limit 3", "compute-models")
    qr("select id, status, left(coalesce(title,''),80) title, created_at, updated_at from public.aivault_pool_agent_tasks where status='queued' order by created_at desc limit 5", "pool-queued")
    alog("perm-denied", "SELECT timestamp, log_attributes['parsed.user_name'] AS u, log_attributes['parsed.application_name'] AS app, event_message FROM logs WHERE source = 'postgres_logs' AND position(event_message, 'permission denied') > 0 ORDER BY timestamp DESC LIMIT 100", 1440, 40)
    alog("rest-perm", "SELECT timestamp, event_message FROM logs WHERE source = 'postgrest_logs' AND position(event_message, 'dark_star_ebooks') > 0 ORDER BY timestamp DESC LIMIT 60", 1440, 30)

JOB16_OLD = "update public.agent_registry set status='OFFLINE',connection_status='not_connected',current_action='HEARTBEAT_STALE_OVER_180_SECONDS',updated_at=now() where agent_id in ('darkstar','technical-dark-star') and (last_heartbeat is null or last_heartbeat<now()-interval '3 minutes') and connection_status<>'not_connected';"
JOB16_NEW = JOB16_OLD + " update public.aivault_darkstar_heartbeat_runs set status='FAIL',finished_at=now(),error_code='STALE_STARTED_NO_FINISH' where slot >= to_char((now() at time zone 'utc') - interval '3 hours','YYYY-MM-DD\"T\"HH24:MI') and slot < 'work:' and status='STARTED' and started_at < now() - interval '5 minutes';"

def step_p2fix():
    """t230u phase 1/2: close stuck STARTED heartbeat runs honestly (FAIL, not PASS) + make job 16 watchdog do it going forward. Function inventory (read-only)."""
    if CONFIRM != "p2fix": sys.exit("type p2fix in confirm")
    st, d = req("GET", "/functions"); fns = d if isinstance(d, list) else []
    log(f"FUNCTIONS HTTP {st} count={len(fns)}"); save("functions.json", [{k: f.get(k) for k in ('slug','version','status','updated_at','verify_jwt','ezbr_sha256')} for f in fns])
    for f in fns:
        if f.get('slug') in ('aivault-compute-coordinator','technical-dark-star','dark-star-ebook-ingest','ai-gateway'): log("  FN", json.dumps({k: f.get(k) for k in ('slug','version','status','updated_at','ezbr_sha256')}))
    ok, r = wq_retry("update public.aivault_darkstar_heartbeat_runs set status='FAIL', finished_at=now(), error_code='STALE_STARTED_NO_FINISH' where slot >= '2026-11-21' and slot < 'work:' and status='STARTED' and started_at < now() - interval '10 minutes' returning slot", "close-stale-hb", 4, 20, 180)
    ok, r = wq_retry("update public.aivault_darkstar_heartbeat_runs set status='FAIL', finished_at=now(), error_code='STALE_STARTED_NO_FINISH' where slot >= 'work:' and status='STARTED' and started_at < now() - interval '30 minutes' returning slot", "close-stale-work", 4, 20, 180)
    qr("select command from cron.job where jobid=16", "job16-before-raw")
    sql = "select cron.alter_job(16, command := $cmd$" + JOB16_NEW + "$cmd$)"
    ok, r = wq_retry(sql, "job16-alter", 4, 20)
    qr("select jobid, schedule, active, command from cron.job where jobid=16", "job16-after")

def step_p6():
    """READ-ONLY: pool cycle outcome, heartbeat states after job16 change, compute evidence, light stability (5x select), sizes."""
    for i in range(5):
        qs("select 1 ok, now() at", f"sel-{i}", 60); time.sleep(6)
    qr("select id, agent_id, zone, kind, status, step_no, updated_at, left(coalesce(result,''),300) result, steps->0->>'model' model, steps->0->'usage' usage from public.aivault_pool_agent_tasks where source='floor' and updated_at > now() - interval '40 minutes' order by updated_at desc limit 5", "pool-recent", 180)
    qr("select status, count(*) n, max(slot) last from public.aivault_darkstar_heartbeat_runs where slot >= to_char((now() at time zone 'utc') - interval '90 minutes','YYYY-MM-DD\"T\"HH24:MI') and slot < 'work:' group by 1", "hb-90m")
    qr("select agent_id, status, connection_status, last_heartbeat, now()-last_heartbeat age from public.agent_registry where agent_id='darkstar'", "darkstar-now")
    qr("select t.task_id, t.type, t.status, a.status a_status, a.result->>'executed_on' on_, a.result->>'checksum' cs, a.updated_at from public.compute_mesh_tasks t join public.compute_mesh_assignments a using (task_id) where t.task_id like 'cpu-test-%' order by a.updated_at desc limit 3", "compute-evidence")
    qr("select jobid, status, count(*) n from cron.job_run_details where start_time > now()-interval '30 minutes' group by 1,2 order by 1,2", "cron-30m")
    qr("select pg_database_size(current_database()) db_bytes, pg_total_relation_size('cron.job_run_details') jrd_bytes", "sizes")
    st, d = req("GET", "/health?services=db,rest,auth,storage,realtime,pooler"); log("HEALTH", st, json.dumps(d)[:800]); save("api_health.json", {"status": st, "body": d})

def step_t234d():
    """READ-ONLY t234u diagnosis: IO/write consumers, dead tuples, autovacuum, cron frequency, log-like tables, memory-query indexes."""
    qs("select stats_reset from extensions.pg_stat_statements_info", "pss-reset")
    qs("select left(regexp_replace(query,'\\s+',' ','g'),160) q, calls, round(total_exec_time/1000) total_s, shared_blks_read r, shared_blks_dirtied d, shared_blks_written w, wal_bytes from extensions.pg_stat_statements order by shared_blks_read+shared_blks_dirtied desc limit 25", "pss-io")
    qs("select left(regexp_replace(query,'\\s+',' ','g'),160) q, calls, wal_bytes, shared_blks_dirtied d from extensions.pg_stat_statements order by wal_bytes desc limit 20", "pss-wal")
    qs("select left(regexp_replace(query,'\\s+',' ','g'),160) q, calls, round(total_exec_time/1000) total_s, round(mean_exec_time) mean_ms from extensions.pg_stat_statements order by calls desc limit 20", "pss-calls")
    qs("select schemaname s, relname, n_live_tup live, n_dead_tup dead, n_tup_ins ins, n_tup_upd upd, n_tup_hot_upd hot, n_tup_del del, seq_scan, seq_tup_read, idx_scan, last_autovacuum, last_autoanalyze, autovacuum_count, pg_total_relation_size(relid) bytes from pg_stat_all_tables where schemaname not in ('pg_catalog','information_schema','pg_toast') order by n_tup_ins+n_tup_upd+n_tup_del desc limit 30", "tbl-writes")
    qs("select schemaname s, relname, n_live_tup live, n_dead_tup dead, round(100.0*n_dead_tup/greatest(n_live_tup+n_dead_tup,1)) pct, last_autovacuum, pg_total_relation_size(relid) bytes from pg_stat_all_tables where schemaname not in ('pg_catalog','information_schema','pg_toast') and n_dead_tup>500 order by n_dead_tup desc limit 25", "tbl-dead")
    qs("select schemaname s, relname, seq_scan, seq_tup_read, idx_scan, n_live_tup, pg_total_relation_size(relid) bytes from pg_stat_all_tables where schemaname not in ('pg_catalog','information_schema','pg_toast') order by seq_tup_read desc limit 20", "tbl-seqscan")
    qs("select n.nspname, c.relname, c.reloptions from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.reloptions is not null and c.relkind='r'", "reloptions")
    qs("select name, setting from pg_settings where name like 'autovacuum%' or name in ('maintenance_work_mem','work_mem','shared_buffers','effective_cache_size','checkpoint_timeout','max_wal_size','wal_compression','track_io_timing')", "settings")
    qs(f"select jobid, jobname, schedule, active, left({MASK},200) cmd from cron.job order by jobid", "cronjobs")
    qs("select jobid, status, count(*) n, round(avg(extract(epoch from end_time-start_time))::numeric,2) avg_s, max(start_time) last from cron.job_run_details where start_time > now()-interval '60 minutes' group by 1,2 order by 1,2", "cron-60m")
    qs("select n.nspname, c.relname, pg_total_relation_size(c.oid) bytes, c.reltuples::bigint est from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind='r' and n.nspname='public' and c.relname ~ '(log|heartbeat|presence|tick|event|run|audit|ping|hist|metric|telemetry|snapshot|status|usage|queue|outbox|trace|beat|watch)' order by 3 desc limit 60", "loglike")
    qs("select table_name, string_agg(column_name||':'||data_type, ', ' order by ordinal_position) cols from information_schema.columns where table_schema='public' and table_name in (select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind='r' and n.nspname='public' and c.relname ~ '(log|heartbeat|presence|tick|event|run|audit|ping|hist|metric|telemetry|snapshot|status|usage|queue|outbox|trace|beat|watch)' and pg_total_relation_size(c.oid) > 1000000) group by 1", "loglike-cols")
    qs("select tablename, indexname, indexdef from pg_indexes where schemaname='public' and tablename in ('aivault_conversations','aivault_conversation_messages','aivault_pool_agent_tasks','aivault_pool_agents','aivault_pool_agent_memory','aivault_darkstar_heartbeat_runs','agent_registry')", "indexes")
    qs("select (select count(*) from public.aivault_conversations) convs, (select count(*) from public.aivault_conversation_messages) msgs, pg_total_relation_size('public.aivault_conversation_messages') msg_bytes, pg_total_relation_size('public.aivault_conversations') conv_bytes", "conv-counts")
    qs("select count(*) n, min(started_at) first, max(started_at) last, pg_total_relation_size('public.aivault_darkstar_heartbeat_runs') bytes from public.aivault_darkstar_heartbeat_runs", "hb-runs")
    qs("select blks_read, blks_hit, tup_inserted, tup_updated, tup_deleted, xact_commit, stats_reset from pg_stat_database where datname=current_database()", "dbstat")
    qs("select pg_database_size(current_database()) db_bytes", "dbsize")

JOB16_V2 = ("update public.agent_registry set status='OFFLINE',connection_status='not_connected',current_action='HEARTBEAT_STALE_OVER_300_SECONDS',updated_at=now() "
            "where agent_id in ('darkstar','technical-dark-star') and (last_heartbeat is null or last_heartbeat<now()-interval '5 minutes') and connection_status<>'not_connected'; "
            "update public.aivault_darkstar_heartbeat_runs set status='FAIL',finished_at=now(),error_code='STALE_STARTED_NO_FINISH' "
            "where slot >= to_char((now() at time zone 'utc') - interval '3 hours','YYYY-MM-DD\"T\"HH24:MI') and slot < 'work:' and status='STARTED' and started_at < now() - interval '5 minutes';")
# t234u: jobid -> (old, new) schedules. Heartbeat on odd minutes, everything else on even minutes / staggered.
SCHED = {14: ("* * * * *", "1-59/2 * * * *"), 16: ("*/2 * * * *", "*/4 * * * *"), 1: ("*/5 * * * *", "6,26,46 * * * *"),
         5: ("*/5 * * * *", "2-59/10 * * * *"), 6: ("*/5 * * * *", "8-59/10 * * * *"), 15: ("5,35 * * * *", "14,44 * * * *")}
RETENTION_FN = r"""
create or replace function public.aivault_log_retention(p_batch int default 5000) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $f$
-- t234u: small-batch purge of append-only LOG rows only. Never touches memory, learning, ebooks, pool agents or pool tasks.
declare hb int := 0; qe int := 0; v_cut text; v_hi text; v_qid bigint;
begin
  perform set_config('lock_timeout', '5s', true);
  -- 1) 暗星 minute heartbeat run log (slot 'YYYY-MM-DDTHH:MI'), keep 14 days; 'work:*' slots untouched
  -- range delete on the primary key (an IN-subquery could seq-scan the 57 MB table)
  v_cut := to_char((now() at time zone 'utc') - interval '14 days', 'YYYY-MM-DD"T"HH24:MI');
  select slot into v_hi from public.aivault_darkstar_heartbeat_runs where slot >= '2000' and slot < v_cut
    order by slot offset greatest(0, least(p_batch, 20000) - 1) limit 1;
  delete from public.aivault_darkstar_heartbeat_runs where slot >= '2000' and slot < v_cut and slot <= coalesce(v_hi, v_cut) and slot ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T';
  get diagnostics hb = row_count;
  -- 2) ai-gateway provider quota event log, keep 30 days (gateway only reads the current day window + latest rows)
  select max(id) into v_qid from (select id from public.aivault_gateway_quota_events where event_at < now() - interval '30 days' order by id limit greatest(1, least(p_batch, 20000))) q;
  delete from public.aivault_gateway_quota_events where id <= v_qid and event_at < now() - interval '30 days';
  get diagnostics qe = row_count;
  return jsonb_build_object('at', now(), 'heartbeat_runs_deleted', hb, 'gateway_quota_events_deleted', qe);
end $f$;
revoke all on function public.aivault_log_retention(int) from public, anon, authenticated;
"""
HEALTH_SQL = r"""
create table if not exists public.aivault_db_health_daily (
  day date primary key, taken_at timestamptz not null default now(), db_bytes bigint not null,
  top_tables jsonb not null, cron_24h jsonb, heartbeat_24h jsonb, warnings jsonb);
alter table public.aivault_db_health_daily enable row level security;
revoke all on public.aivault_db_health_daily from anon, authenticated;
create or replace function public.aivault_db_health_snapshot() returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $f$
-- t234u: lightweight daily health snapshot (catalog sizes + last-24h cron/heartbeat counts). Warns: DB > 5 GB, any table +200 MB/day.
declare v_db bigint; v_top jsonb; v_cron jsonb; v_hb jsonb; v_prev jsonb; v_w jsonb := '[]'::jsonb; r record;
begin
  perform set_config('statement_timeout', '60s', true);
  v_db := pg_database_size(current_database());
  select jsonb_object_agg(t, b) into v_top from (
    select n.nspname||'.'||c.relname t, pg_total_relation_size(c.oid) b from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where c.relkind in ('r','m','p') and n.nspname not in ('pg_catalog','information_schema') order by 2 desc limit 25) x;
  select coalesce(jsonb_object_agg(j, s), '{}'::jsonb) into v_cron from (
    select jobid::text j, jsonb_object_agg(status, n) s from (select jobid, status, count(*) n from cron.job_run_details where start_time > now()-interval '24 hours' group by 1,2) a group by 1) y;
  select coalesce(jsonb_object_agg(status, n), '{}'::jsonb) into v_hb from (select status, count(*) n from public.aivault_darkstar_heartbeat_runs
    where slot >= to_char((now() at time zone 'utc') - interval '24 hours','YYYY-MM-DD"T"HH24:MI') and slot < 'work:' group by 1) z;
  if v_db > 5368709120 then v_w := v_w || jsonb_build_array('DB_OVER_5GB:' || v_db); end if;
  select top_tables into v_prev from public.aivault_db_health_daily where day < current_date order by day desc limit 1;
  if v_prev is not null then
    for r in select key, value::bigint b from jsonb_each_text(v_top) loop
      if r.b - coalesce((v_prev->>r.key)::bigint, 0) > 209715200 then v_w := v_w || jsonb_build_array('TABLE_GROWTH_OVER_200MB:' || r.key || ':' || (r.b - coalesce((v_prev->>r.key)::bigint,0))); end if;
    end loop;
  end if;
  insert into public.aivault_db_health_daily(day, taken_at, db_bytes, top_tables, cron_24h, heartbeat_24h, warnings)
  values (current_date, now(), v_db, v_top, v_cron, v_hb, v_w)
  on conflict (day) do update set taken_at=excluded.taken_at, db_bytes=excluded.db_bytes, top_tables=excluded.top_tables, cron_24h=excluded.cron_24h, heartbeat_24h=excluded.heartbeat_24h, warnings=excluded.warnings;
  return jsonb_build_object('day', current_date, 'db_bytes', v_db, 'warnings', v_w, 'cron_24h', v_cron, 'heartbeat_24h', v_hb, 'top_tables', v_top);
end $f$;
revoke all on function public.aivault_db_health_snapshot() from public, anon, authenticated;
"""

def step_t234fix():
    """t234u (founder-approved, free, reversible): stagger/lower cron, job16 threshold 5 min, log retention fn+job, health snapshot fn+job, pool-agents index."""
    if CONFIRM != "t234fix": sys.exit("type t234fix in confirm")
    pre = qr("select jobid, jobname, schedule, active from cron.job order by jobid", "pre-cron")
    if not pre: sys.exit("cannot read cron.job")
    cur = {r["jobid"]: r["schedule"] for r in pre}
    for j, (old, new) in SCHED.items():
        if cur.get(j) != old: log(f"SKIP job {j}: schedule is {cur.get(j)!r}, expected {old!r}"); continue
        wq_retry(f"select cron.alter_job({j}, schedule := '{new}')", f"sched-{j}", 4, 20)
    wq_retry("select cron.alter_job(16, command := $c$" + JOB16_V2 + "$c$)", "job16-cmd", 4, 20)
    # retention: preview, function, first small batch (keys saved), daily job
    qr("select count(*) n, min(slot) first, max(slot) last from public.aivault_darkstar_heartbeat_runs where slot < to_char((now() at time zone 'utc') - interval '14 days','YYYY-MM-DD\"T\"HH24:MI') and slot ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T'", "preview-hb", 120)
    qr("select count(*) n, min(event_at) first, max(event_at) last from public.aivault_gateway_quota_events where event_at < now() - interval '30 days'", "preview-qe", 120)
    qr("select count(*) n, min(slot) first, max(slot) last, sum(case when slot<'work:' then 1 else 0 end) minute_slots from public.aivault_darkstar_heartbeat_runs", "hb-total", 120)
    wq_retry(RETENTION_FN, "retention-fn", 4, 20)
    wq_retry(HEALTH_SQL, "health-fn", 4, 20)
    qr("select public.aivault_log_retention(2000) r", "retention-first-batch", 120)
    have = {r["jobname"] for r in pre}
    if "aivault-log-retention-v1" not in have:
        wq_retry("select cron.schedule('aivault-log-retention-v1', '35 18 * * *', $c$select public.aivault_log_retention(5000)$c$)", "job-retention", 4, 20)
    if "aivault-db-health-daily-v1" not in have:
        wq_retry("select cron.schedule('aivault-db-health-daily-v1', '50 18 * * *', $c$select public.aivault_db_health_snapshot()$c$)", "job-health", 4, 20)
    qr("select public.aivault_db_health_snapshot() s", "health-first", 120)
    # pool agents: idle-agent lookup (floor enqueue) seq-scans 150 MB without this index
    qr("explain select id from public.aivault_pool_agents where (id < 'ag-1' or id >= 'ah') and zone='law' and status='idle' order by updated_at asc limit 1", "explain-idle-pre", 120)
    qr("select indexname from pg_indexes where schemaname='public' and tablename='aivault_pool_agents'", "agents-idx-pre", 60)
    wq("set statement_timeout = '15min'; set lock_timeout = '10s'; create index if not exists aivault_pool_agents_zone_status_upd on public.aivault_pool_agents (zone, status, updated_at)", "agents-index", 600)
    time.sleep(10)
    qr("select indexname, pg_relation_size(indexname::regclass) bytes from pg_indexes where schemaname='public' and tablename='aivault_pool_agents'", "agents-idx-post", 60)
    qr("explain select id from public.aivault_pool_agents where (id < 'ag-1' or id >= 'ah') and zone='law' and status='idle' order by updated_at asc limit 1", "explain-idle-post", 120)
    qr(f"select jobid, jobname, schedule, active, left({MASK},200) cmd from cron.job order by jobid", "post-cron")
    wq_retry("notify pgrst, 'reload schema'", "pgrst-reload", 3, 20)

def step_t234rollback():
    if CONFIRM != "t234rollback": sys.exit("type t234rollback in confirm")
    for j, (old, new) in SCHED.items(): wq_retry(f"select cron.alter_job({j}, schedule := '{old}')", f"sched-{j}", 4, 20)
    wq_retry("select cron.alter_job(16, command := $c$" + JOB16_NEW + "$c$)", "job16-cmd", 4, 20)
    wq_retry("select cron.unschedule('aivault-log-retention-v1'); select cron.unschedule('aivault-db-health-daily-v1');", "unschedule", 4, 20)

def step_daily():
    """READ-mostly daily health: runs public.aivault_db_health_snapshot() (upserts today's row) and prints WARN lines."""
    d = qr("select public.aivault_db_health_snapshot() s", "snapshot", 120)
    if not d: log("WARN SNAPSHOT_FAILED (DB unreachable or slow)"); sys.exit(2)
    s = d[0]["s"]; s = json.loads(s) if isinstance(s, str) else s
    log("DAY", s.get("day"), "DB_BYTES", s.get("db_bytes"), f"({int(s.get('db_bytes') or 0)/1e9:.2f} GB)")
    for k, v in sorted((s.get("top_tables") or {}).items(), key=lambda x: -int(x[1]))[:10]: log("  TABLE", k, v)
    log("CRON_24H", json.dumps(s.get("cron_24h"))); log("HEARTBEAT_24H", json.dumps(s.get("heartbeat_24h")))
    hb = s.get("heartbeat_24h") or {}; tot = sum(int(x) for x in hb.values()) or 1
    log(f"HEARTBEAT_SUCCESS_RATE {100*int(hb.get('PASS',0))/tot:.1f}%")
    for w in s.get("warnings") or []: log("WARN", w)
    h = qr("select day, db_bytes from public.aivault_db_health_daily order by day desc limit 7", "history", 60)
    for r in h or []: log("  HIST", r["day"], r["db_bytes"])
    if s.get("warnings"): sys.exit(1)

def step_t234chk():
    """READ-ONLY: did the timed-out retention batch / index build finish? what is running?"""
    qr("select pid, state, now()-query_start dur, wait_event_type, wait_event, left(query,120) q from pg_stat_activity where state<>'idle' and pid<>pg_backend_pid() order by dur desc nulls last limit 15", "active", 60)
    qr("select indexrelid::regclass idx, indisvalid, indisready, pg_relation_size(indexrelid) bytes from pg_index where indrelid='public.aivault_pool_agents'::regclass", "agents-idx", 60)
    qr("select count(*) n, min(slot) first from public.aivault_darkstar_heartbeat_runs where slot < to_char((now() at time zone 'utc') - interval '14 days','YYYY-MM-DD\"T\"HH24:MI') and slot ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T'", "hb-old", 120)
    qr("select count(*) n from public.aivault_gateway_quota_events where event_at < now() - interval '30 days'", "qe-old", 120)
    qr("select jobid, status, count(*) n from cron.job_run_details where start_time > now()-interval '20 minutes' group by 1,2 order by 1,2", "cron-20m", 60)

def step_t234fix2():
    """t234u: retention fn v2 (pkey range delete), drop the unneeded pool-agents index (explain showed pkey bitmap already), test one 500-row batch."""
    if CONFIRM != "t234fix2": sys.exit("type t234fix2 in confirm")
    qr("select status, left(return_message,90) m, count(*) n from cron.job_run_details where start_time > now()-interval '60 minutes' and status='failed' group by 1,2 order by 3 desc limit 10", "cron-fail-msgs", 60)
    qr("explain select slot from public.aivault_darkstar_heartbeat_runs where slot >= '2000' and slot < '2026-11-08T11:00' order by slot offset 499 limit 1", "explain-hi", 60)
    qr("explain delete from public.aivault_darkstar_heartbeat_runs where slot >= '2000' and slot < '2026-11-08T11:00' and slot <= '2026-10-23T09:00' and slot ~ '^[0-9]{4}'", "explain-del", 60)
    wq_retry(RETENTION_FN, "retention-fn-v2", 4, 20)
    wq_retry("set lock_timeout='10s'; drop index if exists public.aivault_pool_agents_zone_status_upd", "drop-agents-index", 4, 20)
    t0 = time.time(); d = qs("select public.aivault_log_retention(500) r", "retention-batch-500", 120); log(f"batch secs {time.time()-t0:.1f}")
    qr("select count(*) n, min(slot) first from public.aivault_darkstar_heartbeat_runs where slot >= '2000' and slot < to_char((now() at time zone 'utc') - interval '14 days','YYYY-MM-DD\"T\"HH24:MI')", "hb-old-after", 120)

def step_t234fix3():
    """t234u: retention job 50 -> hourly small batch (500 rows/table ~37s measured) instead of one 5000-row daily run."""
    if CONFIRM != "t234fix3": sys.exit("type t234fix3 in confirm")
    wq_retry("select cron.alter_job((select jobid from cron.job where jobname='aivault-log-retention-v1'), schedule := '57 * * * *', command := $c$select public.aivault_log_retention(500)$c$)", "job50", 6, 20)
    qr("select jobid, jobname, schedule, command, active from cron.job where jobname in ('aivault-log-retention-v1','aivault-db-health-daily-v1','aivault-cron-history-retention')", "jobs", 60)

def step_fnlogs():
    """READ-ONLY: recent edge/function/REST status lines (event_message only; query strings cut)."""
    alog("fn-edge", "SELECT timestamp, left(event_message, 160) AS e FROM logs WHERE source = 'function_edge_logs' ORDER BY timestamp DESC LIMIT 40", 30)
    alog("fn-console", "SELECT timestamp, left(event_message, 300) AS e FROM logs WHERE source = 'function_logs' AND match(event_message, '(?i)error|denied|owner|403|timeout|abort') ORDER BY timestamp DESC LIMIT 30", 30)
    alog("rest-agents", "SELECT timestamp, left(event_message, 160) AS e FROM logs WHERE source = 'edge_logs' AND position(event_message, 'aivault_pool_agents') > 0 ORDER BY timestamp DESC LIMIT 30", 30)

def step_pgrstchk():
    """READ-ONLY: why PGRST002 again."""
    qr("select rolname, rolconfig from pg_roles where rolname in ('authenticator','anon','authenticated','service_role','postgres')", "roles", 60)
    qr("select pid, usename, application_name, state, now()-query_start dur, wait_event_type, wait_event, left(query,80) q from pg_stat_activity where pid<>pg_backend_pid() and backend_type='client backend' order by dur desc nulls last limit 25", "activity", 60)
    qr("select count(*) total, count(*) filter (where state='active') active, count(*) filter (where usename='authenticator') pgrst from pg_stat_activity", "conns", 60)
    alog("pg-pgrst", "SELECT timestamp, left(event_message, 220) AS e FROM logs WHERE source = 'postgres_logs' AND match(event_message, '(?i)timeout|cancel|authenticator|terminat|fatal|too many') AND position(event_message, 'cron job') = 0 ORDER BY timestamp DESC LIMIT 40", 20)
    alog("pgrst-logs", "SELECT timestamp, left(event_message, 220) AS e FROM logs WHERE source = 'postgrest_logs' ORDER BY timestamp DESC LIMIT 30", 20)

def step_convlogs():
    """READ-ONLY: REST lines for the 暗星 memory tables + postgres slow/timeout lines (last 20 min)."""
    alog("rest-conv", "SELECT timestamp, left(event_message, 200) AS e FROM logs WHERE source = 'edge_logs' AND position(event_message, 'aivault_conversation') > 0 ORDER BY timestamp DESC LIMIT 30", 20)
    alog("pgrst-conv", "SELECT timestamp, left(event_message, 300) AS e FROM logs WHERE source = 'postgrest_logs' AND (position(event_message, 'conversation') > 0 OR match(event_message, '(?i)schema cache|timeout|error')) ORDER BY timestamp DESC LIMIT 30", 20)
    alog("pg-slow", "SELECT timestamp, left(event_message, 400) AS e FROM logs WHERE source = 'postgres_logs' AND (position(event_message, 'conversation') > 0 OR match(event_message, '(?i)statement timeout|lock timeout|deadlock')) ORDER BY timestamp DESC LIMIT 20", 20)

def step_convchk():
    """READ-ONLY: 暗星 memory tables: triggers, policies, the test topic row, locks."""
    qr("select tgrelid::regclass t, tgname, tgenabled, pg_get_triggerdef(oid) d from pg_trigger where not tgisinternal and tgrelid in ('public.aivault_conversations'::regclass,'public.aivault_conversation_messages'::regclass)", "triggers", 60)
    qr("select id, topic_id, agent_id, deleted_at, created_at, updated_at from public.aivault_conversations where topic_id like 'ops-acceptance-%' or topic_id like 'technical-dark-star%' order by updated_at desc limit 10", "test-topic", 60)
    qr("select agent_id, count(*) n, max(updated_at) last from public.aivault_conversations group by 1 order by 3 desc nulls last", "convs-by-agent", 60)
    qr("select l.relation::regclass rel, l.mode, l.granted, a.state, now()-a.xact_start age, left(a.query,80) q from pg_locks l join pg_stat_activity a using(pid) where l.relation in ('public.aivault_conversations'::regclass,'public.aivault_conversation_messages'::regclass)", "locks", 60)

def step_t234verify():
    """READ-ONLY state check after t234u changes + acceptance numbers."""
    qr(f"select jobid, jobname, schedule, active, left({MASK},120) cmd from cron.job order by jobid", "cron", 60)
    qr("select command from cron.job where jobid=16", "job16", 60)
    qr("select proname, prosecdef from pg_proc where proname in ('aivault_log_retention','aivault_db_health_snapshot')", "fns", 60)
    qr("select grantee, privilege_type from information_schema.routine_privileges where routine_name in ('aivault_log_retention','aivault_db_health_snapshot') and grantee in ('anon','authenticated','PUBLIC')", "fn-grants", 60)
    qr("select indexrelid::regclass idx from pg_index where indrelid='public.aivault_pool_agents'::regclass", "agents-idx", 60)
    qr("select relrowsecurity from pg_class where oid='public.aivault_db_health_daily'::regclass", "health-rls", 60)
    qr("select jobid, status, count(*) n from cron.job_run_details where start_time > now()-interval '30 minutes' group by 1,2 order by 1,2", "cron-30m", 60)
    qr("select status, count(*) n, max(slot) last from public.aivault_darkstar_heartbeat_runs where slot >= to_char((now() at time zone 'utc') - interval '60 minutes','YYYY-MM-DD\"T\"HH24:MI') and slot < 'work:' group by 1", "hb-60m", 60)
    qr("select status, count(*) n from public.aivault_pool_agent_tasks where source='floor' and updated_at > now()-interval '30 minutes' group by 1", "floor-30m", 60)
    qr("select count(*) n from public.aivault_darkstar_heartbeat_runs where slot >= '2000' and slot < to_char((now() at time zone 'utc') - interval '14 days','YYYY-MM-DD\"T\"HH24:MI')", "hb-old", 120)
    qr("select (select count(*) from public.dark_star_ebooks) ebooks, (select count(*) from public.aivault_pool_agents) pool_agents, (select count(*) from public.aivault_pool_agent_tasks where status='blocked') blocked", "integrity", 120)
    for i in range(3): qs("select 1", f"select1-{i}", 60)

def step_t235m():
    """READ-ONLY t235u measurement: IO/connection health now."""
    for i in range(3): qs("select 1", f"select1-{i}", 60)
    qr("select status, left(return_message,40) m, count(*) n from cron.job_run_details where start_time > now()-interval '30 minutes' group by 1,2 order by 3 desc", "cron-30m", 60)
    qr("select status, count(*) n, max(slot) last from public.aivault_darkstar_heartbeat_runs where slot >= to_char((now() at time zone 'utc') - interval '60 minutes','YYYY-MM-DD\"T\"HH24:MI') and slot < 'work:' group by 1", "hb-60m", 60)
    qr("select agent_id, status, connection_status, last_heartbeat, now()-last_heartbeat age from public.agent_registry where agent_id in ('darkstar','technical-dark-star')", "registry", 60)
    t0=time.time(); qs("select count(*) from pg_class", "catalog-read", 60); log(f"catalog-read {time.time()-t0:.1f}s")
    t0=time.time(); qs("select sum(length(slot)) from (select slot from public.aivault_darkstar_heartbeat_runs order by slot limit 3000) x", "heap-read-3000", 120); log(f"heap-read {time.time()-t0:.1f}s")
    alog("schema-cache", "SELECT timestamp, left(event_message,120) AS e FROM logs WHERE source = 'postgrest_logs' AND match(event_message, 'Schema cache (queried|loaded in)|PGRST00') ORDER BY timestamp DESC LIMIT 12", 40)
    alog("fn-edge", "SELECT timestamp, left(event_message, 140) AS e FROM logs WHERE source = 'function_edge_logs' ORDER BY timestamp DESC LIMIT 25", 30)

def step_t236rc():
    """READ-ONLY root cause for function TimeoutErrors: top statements, activity, lock waits, cron durations, host metrics (memory/swap/disk)."""
    qr("select left(regexp_replace(query,'\\s+',' ','g'),150) q, calls, round(total_exec_time/1000) total_s, round(mean_exec_time) mean_ms, round(max_exec_time) max_ms, shared_blks_read r from extensions.pg_stat_statements order by total_exec_time desc limit 20", "pss-total", 60)
    qr("select left(regexp_replace(query,'\\s+',' ','g'),150) q, calls, round(mean_exec_time) mean_ms, round(max_exec_time) max_ms, shared_blks_read r from extensions.pg_stat_statements where calls>=3 order by mean_exec_time desc limit 15", "pss-mean", 60)
    qr("select pid, usename, application_name, state, wait_event_type, wait_event, now()-query_start dur, left(query,100) q from pg_stat_activity where pid<>pg_backend_pid() and state<>'idle' order by dur desc nulls last", "activity", 60)
    qr("select a.pid, l.locktype, l.mode, l.relation::regclass rel, now()-a.query_start waiting, pg_blocking_pids(a.pid) blockers, left(a.query,100) q from pg_locks l join pg_stat_activity a using(pid) where not l.granted", "lock-waits", 60)
    qr("select j.jobid, j.jobname, d.status, count(*) n, round(avg(extract(epoch from d.end_time-d.start_time))::numeric,1) avg_s, round(max(extract(epoch from d.end_time-d.start_time))::numeric,1) max_s from cron.job_run_details d join cron.job j using(jobid) where d.start_time > now()-interval '3 hours' group by 1,2,3 order by 1,3", "cron-3h", 60)
    qr("select checkpoints_timed, checkpoints_req, buffers_alloc, buffers_backend from pg_stat_bgwriter", "bgwriter", 60)
    qr("select blks_read, blks_hit, round(100.0*blks_hit/greatest(blks_hit+blks_read,1),2) hit_pct, temp_bytes, deadlocks, stats_reset from pg_stat_database where datname=current_database()", "dbstat", 60)
    # host metrics (Supabase privileged metrics endpoint; key fetched inside the job, never printed)
    st, keys = req("GET", "/api-keys?reveal=true")
    sr = next((k.get("api_key") for k in keys if k.get("name") == "service_role"), None) if isinstance(keys, list) else None
    if not sr: log("METRICS: no key", st); return
    import base64
    r = urllib.request.Request(f"https://{REF}.supabase.co/customer/v1/privileged/metrics", headers={"Authorization": "Basic " + base64.b64encode(("service_role:" + sr).encode()).decode()})
    try:
        txt = urllib.request.urlopen(r, timeout=60).read().decode()
    except Exception as e:
        log("METRICS error", type(e).__name__, str(e)[:200]); return
    keep = ("node_memory_MemTotal_bytes", "node_memory_MemAvailable_bytes", "node_memory_SwapTotal_bytes", "node_memory_SwapFree_bytes", "node_memory_Cached_bytes",
            "node_vmstat_pswpin", "node_vmstat_pswpout", "node_disk_io_time_seconds_total", "node_disk_reads_completed_total", "node_disk_writes_completed_total",
            "node_disk_read_time_seconds_total", "node_disk_write_time_seconds_total", "node_load1", "node_load5", "node_cpu_seconds_total{cpu=\"0\",mode=\"iowait\"}",
            "node_cpu_seconds_total{cpu=\"0\",mode=\"idle\"}", "node_pressure_io", "node_pressure_memory", "node_filesystem_avail_bytes", "node_filesystem_size_bytes", "pg_up")
    lines = [l for l in txt.splitlines() if not l.startswith("#") and l.startswith(keep)]
    for l in lines[:80]: log("  M", l[:220])
    save("metrics-selected.json", lines)

def step_t236fix():
    """t236u: pause cron job 9 (learning_dispatch_tick: mean 26s, max 112-160s, seq-reads ~2.8M tuples/run, queued nothing since 10/31). Not DDL. Rollback: cron.alter_job(9, active := true)."""
    if CONFIRM != "t236fix": sys.exit("type t236fix in confirm")
    qr("select count(*) n, max(created_at) last from public.aivault_learning_dispatch_ticks", "ticks", 120)
    wq_retry("select cron.alter_job(9, active := false)", "pause-job9", 6, 20)
    qr("select jobid, jobname, schedule, active from cron.job where jobid=9", "job9", 60)

def step_taskchk():
    """READ-ONLY: one floor task's status (id in confirm) + background-cycle log lines."""
    tid = "".join(c for c in CONFIRM if c.isalnum() or c == "-")
    qr(f"select id, agent_id, zone, kind, status, review_status, left(order_text,60) task, length(result) result_chars, steps->0->>'model' model, steps->0->'usage'->>'total' tokens, steps->0->>'started_at' started, steps->0->>'finished_at' finished, updated_at from public.aivault_pool_agent_tasks where id='{tid}'", "task", 60)
    alog("bg", "SELECT timestamp, left(event_message, 400) AS e FROM logs WHERE source = 'function_logs' AND match(event_message, 'FLOOR_BG') ORDER BY timestamp DESC LIMIT 5", 30)

STEPS = {"taskchk": step_taskchk, "t236fix": step_t236fix, "t236rc": step_t236rc, "t235m": step_t235m, "t234verify": step_t234verify, "convchk": step_convchk, "convlogs": step_convlogs, "pgrstchk": step_pgrstchk, "fnlogs": step_fnlogs, "t234fix3": step_t234fix3, "t234fix2": step_t234fix2, "t234chk": step_t234chk, "t234fix": step_t234fix, "t234rollback": step_t234rollback, "daily": step_daily, "t234d": step_t234d, "p6": step_p6, "p2fix": step_p2fix, "p1": step_p1, "final": step_final, "accept2": step_accept2, "accept": step_accept, "inventory": step_inventory, "throttle": step_throttle, "unthrottle": step_unthrottle, "bench": step_bench, "writeload": step_writeload, "load": step_load, "pgrstfix": step_pgrstfix, "pgrst": step_pgrst, "truncjrd": step_truncjrd, "cronfix": step_cronfix, "measure": step_measure, "window": step_window, "crashlog": step_crashlog, "health": step_health, "diag": step_diag, "logs": step_logs}
if __name__ == "__main__":
    if not TOKEN: sys.exit("TOKEN missing")
    log(f"== step {STEP} @ {time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())}")
    STEPS[STEP]()
