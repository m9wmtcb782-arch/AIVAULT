# 把機密頁內容（由舊公開 commit 組出）寫入 Supabase；不輸出內容或金鑰。
import json, os, subprocess, sys, urllib.request, urllib.error
REF = "clcddygkaaqqtsbswgdf"; TOKEN = os.environ["TOKEN"]; SRC = os.environ.get("SRC_REF", "d641049")
def sql(q):
    r = urllib.request.Request("https://api.supabase.com/v1/projects/%s/database/query" % REF, json.dumps({"query": q}).encode(), {"Authorization": "Bearer " + TOKEN, "Content-Type": "application/json", "User-Agent": "aivault-pp"}, method="POST")
    try:
        with urllib.request.urlopen(r, timeout=120) as f: return json.loads(f.read() or b"null")
    except urllib.error.HTTPError as e: sys.exit("sql error %s %s" % (e.code, e.read()[:300]))
sql(open("supabase/migrations/20261016190000_aivault_private_pages.sql").read()); print("migration ok")
subprocess.check_call([sys.executable, ".github/scripts/build_private_pages.py", SRC, "/tmp/pp.json"])
for slug, html in json.load(open("/tmp/pp.json")).items():
    tag = "$aivpp$"; assert tag not in html
    sql("insert into public.aivault_private_pages(slug,html,updated_at) values ('%s',%s%s%s,now()) on conflict (slug) do update set html=excluded.html, updated_at=now()" % (slug, tag, html, tag))
print("rows", sql("select slug, length(html) n, updated_at from public.aivault_private_pages order by slug"))
print("policies", sql("select policyname, roles, cmd from pg_policies where tablename='aivault_private_pages'"))
print("anon can select:", sql("select has_table_privilege('anon','public.aivault_private_pages','select') a, has_table_privilege('authenticated','public.aivault_private_pages','select') b"))
print("as authenticated rows:", sql("begin; set local role authenticated; select count(*) n from public.aivault_private_pages; commit;"))
