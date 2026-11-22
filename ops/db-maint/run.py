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

STEPS = {"load": step_load, "pgrstfix": step_pgrstfix, "pgrst": step_pgrst, "truncjrd": step_truncjrd, "cronfix": step_cronfix, "measure": step_measure, "window": step_window, "crashlog": step_crashlog, "health": step_health, "diag": step_diag, "logs": step_logs}
if __name__ == "__main__":
    if not TOKEN: sys.exit("TOKEN missing")
    log(f"== step {STEP} @ {time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())}")
    STEPS[STEP]()
