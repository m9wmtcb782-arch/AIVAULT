# 完整後端備份（僅在 GitHub Actions 內執行）：用 SUPABASE_ACCESS_TOKEN 經 Management API 取得 service key（不輸出），
# 匯出 schema 目錄、所有 public 資料表、auth 使用者、Storage 檔案、Edge Function 原始碼。結果以公鑰加密後才上傳。
import json, os, urllib.request, urllib.parse, subprocess, sys, time
REF = "clcddygkaaqqtsbswgdf"; BASE = "https://%s.supabase.co" % REF; TOKEN = os.environ["TOKEN"]
OUT = "backup"; os.makedirs(OUT, exist_ok=True)
def http(url, data=None, headers=None, method=None, raw=False):
    r = urllib.request.Request(url, data=data, headers=headers or {}, method=method)
    with urllib.request.urlopen(r, timeout=120) as f: b = f.read()
    return b if raw else json.loads(b or b"null")
def mgmt(path, data=None, method=None):
    h = {"Authorization": "Bearer " + TOKEN, "Content-Type": "application/json", "User-Agent": "aivault-backup"}
    return http("https://api.supabase.com/v1/projects/" + REF + path, json.dumps(data).encode() if data is not None else None, h, method)
def sql(q): return mgmt("/database/query", {"query": q}, "POST")
report = {}
# 1) schema catalog (all non-system schemas)
S = "('pg_catalog','information_schema','pg_toast')"
cat = {}
for k, q in {
  "schemas": "select nspname from pg_namespace where nspname not like 'pg_%' and nspname<>'information_schema' order by 1",
  "columns": "select table_schema,table_name,column_name,data_type,udt_name,is_nullable,column_default from information_schema.columns where table_schema not in " + S + " order by 1,2,ordinal_position",
  "constraints": "select n.nspname, conrelid::regclass::text tbl, conname, pg_get_constraintdef(c.oid) def from pg_constraint c join pg_namespace n on n.oid=c.connamespace where n.nspname not in " + S + " order by 1,2,3",
  "indexes": "select schemaname,tablename,indexname,indexdef from pg_indexes where schemaname not in " + S + " order by 1,2,3",
  "rls": "select n.nspname,c.relname,c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind='r' and n.nspname not in " + S + " order by 1,2",
  "policies": "select * from pg_policies order by schemaname,tablename,policyname",
  "functions": "select n.nspname, p.proname, pg_get_functiondef(p.oid) def from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public') and p.prokind in ('f','p') order by 1,2",
  "triggers": "select event_object_schema, event_object_table, trigger_name, action_timing, event_manipulation, action_statement from information_schema.triggers order by 1,2,3",
  "views": "select schemaname, viewname, definition from pg_views where schemaname='public'",
  "grants": "select grantee,table_schema,table_name,privilege_type from information_schema.role_table_grants where table_schema='public' order by 2,3,1,4",
  "extensions": "select extname, extversion from pg_extension",
  "migrations": "select * from supabase_migrations.schema_migrations order by version",
}.items():
    try: cat[k] = sql(q)
    except Exception as e: cat[k] = {"error": str(e)[:300]}
json.dump(cat, open(OUT + "/schema-catalog.json", "w"), ensure_ascii=False, indent=1)
# 2) service key (never printed)
keys = mgmt("/api-keys?reveal=true")
SR = next((k.get("api_key") for k in keys if k.get("name") == "service_role"), None)
if not SR: sys.exit("no service_role key")
print("::add-mask::" + SR)
H = {"apikey": SR, "Authorization": "Bearer " + SR}
# 3) public tables via PostgREST, paged
tables = [r["relname"] for r in sql("select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p') order by 1")]
os.makedirs(OUT + "/data", exist_ok=True); counts = {}
for t in tables:
    rows, off, step = [], 0, 1000
    try:
        while True:
            h = dict(H, Range="%d-%d" % (off, off + step - 1))
            b = http(BASE + "/rest/v1/" + urllib.parse.quote(t) + "?select=*", headers=h)
            rows += b
            if len(b) < step: break
            off += step
        with open(OUT + "/data/" + t + ".json", "w") as f: json.dump(rows, f, ensure_ascii=False)
        counts[t] = len(rows)
    except Exception as e:
        # service_role 沒有 GRANT 的表 → 改用 Management API SQL（postgres 身分）分頁匯出
        try:
            rows, off = [], 0
            while True:
                b = sql('select coalesce(json_agg(t), \'[]\'::json) as j from (select * from public."%s" offset %d limit 500) t' % (t.replace('"', '""'), off))
                part = b[0]["j"] if b else []
                if isinstance(part, str): part = json.loads(part)
                rows += part
                if len(part) < 500: break
                off += 500
            with open(OUT + "/data/" + t + ".json", "w") as f: json.dump(rows, f, ensure_ascii=False)
            counts[t] = len(rows)
        except Exception as e2: counts[t] = "ERROR " + str(e)[:100] + " / sql " + str(e2)[:150]
report["tables"] = counts
# 4) auth users (admin API)
users, page = [], 1
try:
    while True:
        b = http(BASE + "/auth/v1/admin/users?per_page=1000&page=%d" % page, headers=H)
        u = b.get("users", []); users += u
        if len(u) < 1000: break
        page += 1
    json.dump(users, open(OUT + "/auth-users.json", "w"), ensure_ascii=False, indent=1); report["auth_users"] = len(users)
except Exception as e: report["auth_users"] = "ERROR " + str(e)[:200]
# 5) storage
st = {}
try:
    buckets = http(BASE + "/storage/v1/bucket", headers=H)
    json.dump(buckets, open(OUT + "/storage-buckets.json", "w"), indent=1)
    def walk(bk, prefix):
        out, off = [], 0
        while True:
            items = http(BASE + "/storage/v1/object/list/" + bk, json.dumps({"prefix": prefix, "limit": 1000, "offset": off}).encode(), dict(H, **{"Content-Type": "application/json"}), "POST")
            for it in items:
                p = (prefix + "/" if prefix else "") + it["name"]
                if it.get("id") is None: out += walk(bk, p)
                else: out.append(p)
            if len(items) < 1000: break
            off += 1000
        return out
    for b in buckets:
        files = walk(b["id"], ""); n = 0
        for p in files:
            try:
                data = http(BASE + "/storage/v1/object/" + b["id"] + "/" + urllib.parse.quote(p), headers=H, raw=True)
                dst = os.path.join(OUT, "storage", b["id"], p); os.makedirs(os.path.dirname(dst), exist_ok=True); open(dst, "wb").write(data); n += 1
            except Exception as e: pass
        st[b["id"]] = "%d/%d files" % (n, len(files))
except Exception as e: st = "ERROR " + str(e)[:200]
report["storage"] = st
# 6) edge functions (deployed source)
fn = {}
try:
    lst = mgmt("/functions"); json.dump(lst, open(OUT + "/functions-list.json", "w"), indent=1)
    os.makedirs(OUT + "/functions", exist_ok=True)
    for f in lst:
        r = subprocess.run(["npx", "-y", "supabase@latest", "functions", "download", f["slug"], "--project-ref", REF, "--use-api"], cwd=OUT + "/functions", capture_output=True, text=True)
        fn[f["slug"]] = "ok" if r.returncode == 0 else ("ERR " + (r.stderr or r.stdout)[-150:])
except Exception as e: fn = "ERROR " + str(e)[:200]
report["functions"] = fn
json.dump(report, open(OUT + "/REPORT.json", "w"), ensure_ascii=False, indent=1)
print(json.dumps({k: (len(v) if isinstance(v, dict) else v) for k, v in report.items()}))
