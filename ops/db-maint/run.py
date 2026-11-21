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

STEPS = {"health": step_health}
if __name__ == "__main__":
    if not TOKEN: sys.exit("TOKEN missing")
    log(f"== step {STEP} @ {time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())}")
    STEPS[STEP]()
