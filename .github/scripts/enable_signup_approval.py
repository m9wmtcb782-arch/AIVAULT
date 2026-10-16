# 啟用註冊核准（一次性，GitHub Actions 內執行，不輸出任何金鑰）
import json, os, sys, time, uuid, urllib.request, urllib.error
REF = "clcddygkaaqqtsbswgdf"; BASE = "https://%s.supabase.co" % REF; TOKEN = os.environ["TOKEN"]
OWNER = "n_950143@hotmail.com"; STEP = os.environ.get("STEP", "all")
def http(url, data=None, headers=None, method=None):
    r = urllib.request.Request(url, data=json.dumps(data).encode() if data is not None else None, headers=dict({"Content-Type": "application/json", "User-Agent": "aivault-approval"}, **(headers or {})), method=method)
    try:
        with urllib.request.urlopen(r, timeout=60) as f: b = f.read(); return f.status, (json.loads(b) if b else None)
    except urllib.error.HTTPError as e:
        b = e.read()
        try: return e.code, json.loads(b)
        except Exception: return e.code, b[:200].decode("utf-8", "replace")
def mgmt(path, data=None, method=None): return http("https://api.supabase.com/v1/projects/" + REF + path, data, {"Authorization": "Bearer " + TOKEN}, method)
def sql(q): s, b = mgmt("/database/query", {"query": q}, "POST"); assert s < 300, (s, b); return b
if STEP == "fix":
    print("infinity rows before", sql("select count(*) n from auth.users where banned_until = 'infinity'"))
    sql(open("supabase/migrations/20261016170000_signup_owner_approval.sql").read())
    sql("update auth.users set banned_until = '2999-12-31 00:00:00+00' where banned_until = 'infinity'")
    print("pending rows", sql("select count(*) n, bool_or(raw_app_meta_data ? 'approved') has_flag from auth.users where banned_until > now()"))
    print("non-pending banned", sql("select count(*) n from auth.users where banned_until > now() and email not like 'aivault-approval-test-%'"))
    sys.exit(0)
_, keys = mgmt("/api-keys?reveal=true")
SR = next(k["api_key"] for k in keys if k.get("name") == "service_role"); ANON = next(k["api_key"] for k in keys if k.get("name") == "anon")
print("::add-mask::" + SR); print("::add-mask::" + ANON)
H = {"apikey": SR, "Authorization": "Bearer " + SR}
def users():
    s, b = http(BASE + "/auth/v1/admin/users?per_page=1000", headers=H); return b["users"]
us = users(); owner = [u for u in us if (u.get("email") or "").lower() == OWNER]
if len(owner) != 1: sys.exit("owner email not found exactly once: %d" % len(owner))
oid = owner[0]["id"]; print("users", len(us), "owner found")
if STEP in ("all", "owner"):
    s, b = http(BASE + "/auth/v1/admin/users/" + oid, {"app_metadata": {"role": "owner", "approved": True}}, H, "PUT"); print("set owner role", s, (b or {}).get("app_metadata", {}).get("role") if isinstance(b, dict) else b)
if STEP in ("all", "migrate"):
    before = sql("select count(*) n from auth.users where banned_until is not null and banned_until > now()")
    sql(open("supabase/migrations/20261016170000_signup_owner_approval.sql").read())
    after = sql("select count(*) n from auth.users where banned_until is not null and banned_until > now()")
    trg = sql("select tgname from pg_trigger where tgname='aivault_signup_pending'")
    print("migration applied; banned before", before, "after", after, "trigger", trg)
if STEP in ("all", "test"):
    # 1) 試用註冊（admin 建立，不寄信）→ 應被暫停
    em = "aivault-approval-test-%s@example.com" % uuid.uuid4().hex[:8]
    s, b = http(BASE + "/auth/v1/admin/users", {"email": em, "password": uuid.uuid4().hex, "email_confirm": True}, H, "POST")
    tid = b.get("id") if isinstance(b, dict) else None
    print("test user created", s, "banned_until", (b or {}).get("banned_until"), "approved", (b or {}).get("app_metadata", {}).get("approved"))
    # 2) 擁有者身分呼叫核准 API（magic link token 只在此 job 內使用，不寄信）
    s, gl = http(BASE + "/auth/v1/admin/generate_link", {"type": "magiclink", "email": owner[0]["email"]}, H, "POST")
    th = (gl or {}).get("hashed_token") or ((gl or {}).get("properties") or {}).get("hashed_token")
    s, sess = http(BASE + "/auth/v1/verify", {"type": "magiclink", "token_hash": th}, {"apikey": ANON}, "POST")
    at = (sess or {}).get("access_token") if isinstance(sess, dict) else None
    if at: print("::add-mask::" + at)
    print("owner session", bool(at), "role in token", ((sess or {}).get("user") or {}).get("app_metadata", {}).get("role") if isinstance(sess, dict) else None)
    fn = BASE + "/functions/v1/dark-star-ebook-ingest?feature=signup-approval"
    s, b = http(fn, {"action": "list"}, {"apikey": ANON, "Authorization": "Bearer " + (at or ANON)}, "POST")
    print("owner list", s, "pending includes test", any(p.get("id") == tid for p in (b or {}).get("pending", [])) if isinstance(b, dict) else b)
    s, b = http(fn, {"action": "list"}, {"apikey": ANON, "Authorization": "Bearer " + ANON}, "POST"); print("anon list (expect 403)", s)
    # 3) 刪除試用帳號
    if tid: s, _ = http(BASE + "/auth/v1/admin/users/" + tid, None, H, "DELETE"); print("test user deleted", s)
    # 其他功能仍在
    for f in ["photo-solve", "bot-pr"]:
        s, b = http(BASE + "/functions/v1/dark-star-ebook-ingest?feature=" + f, {}, {"apikey": ANON, "Authorization": "Bearer " + ANON}, "POST"); print("feature", f, "status", s)
    s, b = http(BASE + "/functions/v1/dark-star-ebook-ingest?feature=web-search", {"q": "台北 天氣"}, {"apikey": ANON, "Authorization": "Bearer " + ANON}, "POST"); print("feature web-search", s)
    us = users(); print("banned users now:", [(u["email"].split("@")[0][:3] + "…", u.get("banned_until")) for u in us if u.get("banned_until")], "owner banned:", any(u["id"] == oid and u.get("banned_until") for u in us))
if STEP in ("all", "confirm"):
    s, c = mgmt("/config/auth"); print("mailer_autoconfirm before", (c or {}).get("mailer_autoconfirm"))
    s, c = mgmt("/config/auth", {"mailer_autoconfirm": False}, "PATCH"); print("patch", s, "mailer_autoconfirm after", (c or {}).get("mailer_autoconfirm") if isinstance(c, dict) else c)
