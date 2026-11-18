#!/usr/bin/env python3
"""唯讀：盤點非公開電子書（visibility<>public 或 metadata.private/visibility）是否有「只有連結」頁。
不寫入資料庫。log 只印數量；明細（書名、指標、被標記頁原文）只寫入 out/，由 workflow 以收件者公鑰加密後上傳。"""
import json, os, re, urllib.request, urllib.error
P = "https://api.supabase.com/v1/projects/clcddygkaaqqtsbswgdf/database/query"
def q(sql):
    r = urllib.request.Request(P, data=json.dumps({"query": sql}).encode(), headers={
        "Authorization": "Bearer " + os.environ["TOKEN"], "Content-Type": "application/json", "User-Agent": "aivault-private-audit"})
    return json.load(urllib.request.urlopen(r, timeout=180))
URL = re.compile(r"https?://\S+")
books = q("""select id,title,total_pages,total_characters,visibility,status,created_at,
  (metadata->>'private') mp,(metadata->>'visibility') mv from dark_star_ebooks
  where coalesce(visibility,'public')<>'public' or metadata->>'private'='true' or coalesce(metadata->>'visibility','public')<>'public'
  order by created_at""")
os.makedirs("out", exist_ok=True)
allb = q("select count(*)::int n, count(*) filter (where coalesce(visibility,'public')='public' and coalesce(metadata->>'private','false')<>'true' and coalesce(metadata->>'visibility','public')='public')::int pub from dark_star_ebooks")
res = []
for b in books:
    pages = q(f"select page_number, content from dark_star_ebook_pages where ebook_id='{b['id']}' order by page_number")
    text = "".join(p["content"] or "" for p in pages)
    tl = len(text); ul = sum(len(u) for u in URL.findall(text))
    heavy = []
    for p in pages:
        c = p["content"] or ""
        u = sum(len(x) for x in URL.findall(c))
        if len(c) > 40 and u / len(c) > 0.35: heavy.append(p["page_number"])
    flagged = {str(p["page_number"]): p["content"] for p in pages if p["page_number"] in heavy or "LawGetFile" in (p["content"] or "")}
    res.append(dict(b, pages_in_db=len(pages), text_length=tl, url_ratio=round(ul / tl, 4) if tl else 0,
                    url_count=len(URL.findall(text)), lawgetfile=text.count("LawGetFile"), url_heavy_pages=heavy,
                    empty_pages=sum(1 for p in pages if not (p["content"] or "").strip()),
                    first_page=(pages[0]["content"][:600] if pages else ""), flagged_pages=flagged))
json.dump({"totals": allb, "books": res}, open("out/private_audit.json", "w", encoding="utf-8"), ensure_ascii=False, default=str)
print("TOTAL", allb, "NONPUBLIC", len(res), "WITH_URL_HEAVY", sum(1 for r in res if r["url_heavy_pages"]),
      "WITH_LAWGETFILE", sum(1 for r in res if r["lawgetfile"]), "EMPTY", sum(1 for r in res if r["pages_in_db"] == 0))
