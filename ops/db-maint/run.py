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
    st, d = req("GET", "/health?services=db,rest,auth,storage,realtime&timeout_ms=10000"); log("HEALTH", st, json.dumps(d, ensure_ascii=False)[:2000])
    # ONE lightweight connectivity check
    st, d = req("POST", "/database/query", {"query": "select 1 as ok, now() as at, pg_is_in_recovery() as recovery"}, 60)
    log("SELECT1", st, str(d)[:1500])

def logs(sql, hours=24, label=""):
    import urllib.parse
    end = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()); start = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime(time.time() - hours * 3600))
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
    rows = logs("SELECT * FROM logs ORDER BY timestamp DESC LIMIT 3", 24, "schema-probe")
    for r in rows: log("  ROW", json.dumps(r, ensure_ascii=False, default=str)[:1500])
    import os as _o
    if _o.environ.get("CONFIRM") == "probe": return
    rows = logs("SELECT timestamp, event_message FROM logs WHERE source_name = 'postgres_logs' ORDER BY timestamp DESC LIMIT 400", 24, "postgres-24h")
    for r in rows[:150]: log("  PG", r.get("timestamp"), str(r.get("event_message"))[:300])
    for h in (24, 168):
        rows = logs("SELECT timestamp, event_message FROM logs WHERE source_name = 'postgres_logs' AND match(event_message, '53100|57P03|No space|xlogtemp|PANIC|could not write|redo|database system|checkpoint') ORDER BY timestamp ASC LIMIT 300", h, f"postgres-errors-{h}h")
        for r in rows[:100]: log("  ERR", r.get("timestamp"), str(r.get("event_message"))[:300])
    rows = logs("SELECT source_name, count() AS n FROM logs GROUP BY source_name ORDER BY n DESC", 24, "sources-24h")
    for r in rows: log("  SRC", r)

STEPS = {"health": step_health, "diag": step_diag, "logs": step_logs}
if __name__ == "__main__":
    if not TOKEN: sys.exit("TOKEN missing")
    log(f"== step {STEP} @ {time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())}")
    STEPS[STEP]()
