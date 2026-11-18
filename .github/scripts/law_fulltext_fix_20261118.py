#!/usr/bin/env python3
"""法規電子書附表全文補正（2026-11-18）。
只動 ebook/law-fulltext-20261118/ 內列出的書：
- replace_*.json：保留原 ebook_id 與原頁（頁碼、TOC 不變），把只列下載連結的頁改為附表目錄／說明，書末追加附表全文頁。
- delete_empty.json：只刪除 0 頁、0 字、且同名完整版仍在的失敗匯入空殼。
先完整備份（backup/ 上傳為 artifact），再逐本以交易寫入；原頁內容 md5 與預期不符就停止，不覆寫。
"""
import json, os, sys, glob, hashlib, urllib.request, urllib.error
P = "https://api.supabase.com/v1/projects/clcddygkaaqqtsbswgdf/database/query"
D = "ebook/law-fulltext-20261118"
TAG = "law-attachment-fulltext-20261118"
def q(sql):
    r = urllib.request.Request(P, data=json.dumps({"query": sql}).encode(), headers={
        "Authorization": "Bearer " + os.environ["TOKEN"], "Content-Type": "application/json",
        "User-Agent": "aivault-law-fulltext-fix"})
    try:
        return json.load(urllib.request.urlopen(r, timeout=180))
    except urllib.error.HTTPError as e:
        print("ERR", e.code, e.read().decode()[:800]); raise
def lit(s):
    assert "$LFX$" not in s
    return "$LFX$" + s + "$LFX$"
def uid(s):
    import re
    assert re.fullmatch(r"[0-9a-f-]{36}", s), s
    return s
reps = [json.load(open(f, encoding="utf-8")) for f in sorted(glob.glob(D + "/replace_*.json"))]
dels = json.load(open(D + "/delete_empty.json", encoding="utf-8"))["items"]
os.makedirs("backup", exist_ok=True)
ids = [uid(r["ebook_id"]) for r in reps] + [uid(x["ebook_id"]) for x in dels] + [uid(x["keep_full_copy"]) for x in dels]
# ---- 1. 備份 ----
for i in ids:
    b = {
        "ebook": q(f"select to_jsonb(e) j from dark_star_ebooks e where id='{i}'"),
        "pages": q(f"select to_jsonb(p) j from dark_star_ebook_pages p where ebook_id='{i}' order by page_number"),
        "toc": q(f"select to_jsonb(t) j from dark_star_ebook_toc t where ebook_id='{i}' order by ordinal"),
        "jobs": q(f"select to_jsonb(j) j from dark_star_ebook_ingestion_jobs j where ebook_id='{i}'"),
        "progress_count": q(f"select count(*)::int n from dark_star_ebook_reading_progress where ebook_id='{i}'"),
        "study_count": q(f"select count(*)::int n from dark_star_study_books where ebook_id='{i}'"),
    }
    json.dump(b, open(f"backup/{i}.json", "w", encoding="utf-8"), ensure_ascii=False)
    print("BACKUP", i, "ebook", len(b["ebook"]), "pages", len(b["pages"]), "toc", len(b["toc"]))
print("BACKUP_DONE", len(ids))
# ---- 2. 補正（每本一個交易）----
for r in reps:
    eid = uid(r["ebook_id"])
    cur = q(f"select page_number, md5(content) m from dark_star_ebook_pages where ebook_id='{eid}' order by page_number")
    got = {str(x["page_number"]): x["m"] for x in cur}
    already = all(got.get(str(p["page_number"])) == hashlib.md5(p["content"].encode()).hexdigest() for p in r["pages"])
    if already:
        print("SKIP_ALREADY_APPLIED", eid, r["title"]); continue
    if got != r["orig_md5"]:
        print("ABORT_CHANGED", eid, r["title"], "db pages", len(got), "expected", len(r["orig_md5"])); sys.exit(2)
    pages = [{"page_number": p["page_number"], "content": p["content"], "word_count": p["word_count"], "metadata": p["metadata"]} for p in r["pages"]]
    toc = [{"ordinal": t["ordinal"], "level": t["level"], "title": t["title"], "page_number": t["page_number"], "metadata": t["metadata"]} for t in r["toc_add"]]
    fix = {"tag": TAG, "old_pages": r["old_pages"], "new_pages": len(pages), "note": "附表／附件全文已轉錄收錄於書末，取代僅列下載連結之頁面"}
    PJ, TJ = lit(json.dumps(pages, ensure_ascii=False)), lit(json.dumps(toc, ensure_ascii=False))
    sql = f"""begin;
update dark_star_ebook_pages p set content=x.content, word_count=x.word_count, metadata=coalesce(p.metadata,'{{}}'::jsonb)||x.metadata
  from jsonb_populate_recordset(null::dark_star_ebook_pages, {PJ}::jsonb) as x
  where p.ebook_id='{eid}' and p.page_number=x.page_number and p.content is distinct from x.content;
insert into dark_star_ebook_pages (ebook_id,page_number,content,word_count,metadata)
  select '{eid}',x.page_number,x.content,x.word_count,x.metadata
  from jsonb_populate_recordset(null::dark_star_ebook_pages, {PJ}::jsonb) as x
  where not exists (select 1 from dark_star_ebook_pages p where p.ebook_id='{eid}' and p.page_number=x.page_number);
delete from dark_star_ebook_toc where ebook_id='{eid}' and metadata->>'fix'='{TAG}';
insert into dark_star_ebook_toc (ebook_id,ordinal,level,title,page_number,metadata)
  select '{eid}',x.ordinal,x.level,x.title,x.page_number,x.metadata
  from jsonb_populate_recordset(null::dark_star_ebook_toc, {TJ}::jsonb) as x;
update dark_star_ebooks set total_pages={len(pages)}, total_characters={r['total_characters']}, updated_at=now(),
  metadata=coalesce(metadata,'{{}}'::jsonb)||jsonb_build_object('fulltext_fix',{lit(json.dumps(fix, ensure_ascii=False))}::jsonb)
  where id='{eid}';
commit;"""
    q(sql)
    v = q(f"select (select count(*)::int from dark_star_ebook_pages where ebook_id='{eid}') n, (select total_pages from dark_star_ebooks where id='{eid}') tp, (select count(*)::int from dark_star_ebook_pages where ebook_id='{eid}' and content like '%LawGetFile%') links, (select count(*)::int from dark_star_ebook_toc where ebook_id='{eid}') toc")
    print("APPLIED", eid, r["title"], r["old_pages"], "->", v)
# ---- 3. 刪除空殼（0 頁、無頁面、同名完整版仍在）----
for x in dels:
    i, k = uid(x["ebook_id"]), uid(x["keep_full_copy"])
    c = q(f"select (select total_pages from dark_star_ebooks where id='{i}') tp, (select coalesce(total_characters,0) from dark_star_ebooks where id='{i}') tc, (select count(*)::int from dark_star_ebook_pages where ebook_id='{i}') n, (select count(*)::int from dark_star_ebook_pages where ebook_id='{k}') kn, (select title from dark_star_ebooks where id='{i}') t1, (select title from dark_star_ebooks where id='{k}') t2")[0]
    if c["tp"] is None:
        print("SKIP_ALREADY_DELETED", i); continue
    if not (c["tp"] == 0 and c["tc"] == 0 and c["n"] == 0 and c["kn"] > 0 and c["t1"] == c["t2"]):
        print("SKIP_NOT_EMPTY_OR_NO_COPY", i, c); continue
    q(f"""begin;
delete from dark_star_study_books where ebook_id='{i}';
delete from dark_star_ebook_toc where ebook_id='{i}';
delete from dark_star_ebook_reading_progress where ebook_id='{i}';
delete from dark_star_ebook_ingest_chunks where job_id in (select id from dark_star_ebook_ingestion_jobs where ebook_id='{i}');
delete from dark_star_ebook_ingestion_jobs where ebook_id='{i}';
delete from dark_star_ebooks where id='{i}' and total_pages=0;
commit;""")
    print("DELETED_EMPTY", i, x["title"], "kept", k, c["kn"], "pages")
print("DONE")
