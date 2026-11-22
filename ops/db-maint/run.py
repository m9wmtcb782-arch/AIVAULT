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

STEPS = {"measure": step_measure, "window": step_window, "crashlog": step_crashlog, "health": step_health, "diag": step_diag, "logs": step_logs}
if __name__ == "__main__":
    if not TOKEN: sys.exit("TOKEN missing")
    log(f"== step {STEP} @ {time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())}")
    STEPS[STEP]()
