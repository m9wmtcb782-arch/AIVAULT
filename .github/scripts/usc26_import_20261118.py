#!/usr/bin/env python3
"""美國法典第26編（release point 119-142）全文匯入，分 11 冊。
第1冊沿用既有空殼 ebook_id eabac26d-…（原 0 頁）；第2–11冊以第1冊為範本新增（uuid5 固定 id，可重跑）。
流程：備份 → 逐冊：已完整則略過；否則（僅限 total_pages=0 的冊）清掉殘頁、分批寫頁、寫目錄，最後才設定 total_pages（書架以 total_pages>0 才顯示，故未完成前不會出現半本）。"""
import json, os, sys, glob, gzip, hashlib, urllib.request, urllib.error, time, re
P = "https://api.supabase.com/v1/projects/clcddygkaaqqtsbswgdf/database/query"
D = "ebook/usc26-119-142"
TPL = "eabac26d-1725-4284-a754-871f72910fdc"
def q(sql, tries=4):
    for t in range(tries):
        r = urllib.request.Request(P, data=json.dumps({"query": sql}).encode(), headers={
            "Authorization": "Bearer " + os.environ["TOKEN"], "Content-Type": "application/json", "User-Agent": "aivault-usc26-import"})
        try:
            return json.load(urllib.request.urlopen(r, timeout=300))
        except urllib.error.HTTPError as e:
            body = e.read().decode()[:600]
            print("ERR", e.code, body)
            if e.code in (429, 500, 502, 503, 504) and t < tries - 1: time.sleep(5 * (t + 1)); continue
            raise
def lit(s):
    assert "$UXC$" not in s
    return "$UXC$" + s + "$UXC$"
def uid(s):
    assert re.fullmatch(r"[0-9a-f-]{36}", s), s
    return s
vols = []
for f in sorted(glob.glob(D + "/usc26_vol*.json.gz")):
    with gzip.open(f, "rt", encoding="utf-8") as fh: vols.append(json.load(fh))
for v in vols:
    assert hashlib.md5("".join(r["content"] for r in v["pages"]).encode()).hexdigest() == v["content_md5"]
print("VOLUMES", len(vols), "PAGES", sum(v["total_pages"] for v in vols))
os.makedirs("backup", exist_ok=True)
b = {v["ebook_id"]: {"ebook": q(f"select to_jsonb(e) j from dark_star_ebooks e where id='{uid(v['ebook_id'])}'"),
     "pages": q(f"select count(*)::int n from dark_star_ebook_pages where ebook_id='{v['ebook_id']}'"),
     "toc": q(f"select to_jsonb(t) j from dark_star_ebook_toc t where ebook_id='{v['ebook_id']}'")} for v in vols}
json.dump(b, open("backup/usc26_before.json", "w", encoding="utf-8"), ensure_ascii=False)
print("BACKUP_DONE")
if not b[TPL]["ebook"]:
    print("ABORT template missing"); sys.exit(2)
for v in vols:
    eid = uid(v["ebook_id"])
    row = q(f"select total_pages, (select count(*)::int from dark_star_ebook_pages where ebook_id='{eid}') n, (select md5(string_agg(content,'' order by page_number)) from dark_star_ebook_pages where ebook_id='{eid}') m from dark_star_ebooks where id='{eid}'")
    if row and row[0]["total_pages"] == v["total_pages"] and row[0]["n"] == v["total_pages"] and row[0]["m"] == v["content_md5"]:
        print("SKIP_COMPLETE", v["volume"], eid); continue
    if row and (row[0]["total_pages"] or 0) > 0:
        print("ABORT_NONEMPTY_DIFFERENT", v["volume"], eid, row); sys.exit(3)
    if not row:
        patch = {"id": eid, "title": v["title"], "description": v["description"], "total_pages": 0, "total_characters": 0}
        q(f"insert into dark_star_ebooks select (jsonb_populate_record(null::dark_star_ebooks, to_jsonb(e) || {lit(json.dumps(patch, ensure_ascii=False))}::jsonb || jsonb_build_object('created_at',now(),'updated_at',now()))).* from dark_star_ebooks e where id='{TPL}'")
    q(f"delete from dark_star_ebook_pages where ebook_id='{eid}' and (select total_pages from dark_star_ebooks where id='{eid}')=0")
    q(f"delete from dark_star_ebook_toc where ebook_id='{eid}' and (select total_pages from dark_star_ebooks where id='{eid}')=0")
    pages = v["pages"]
    for i in range(0, len(pages), 120):
        chunk = [{"page_number": r["page_number"], "content": r["content"], "word_count": r["word_count"], "metadata": {"parser_version": "uslm-usc26-1", "source": "OLRC xml_usc26@119-142"}} for r in pages[i:i + 120]]
        q(f"insert into dark_star_ebook_pages (ebook_id,page_number,content,word_count,metadata) select '{eid}',x.page_number,x.content,x.word_count,x.metadata from jsonb_populate_recordset(null::dark_star_ebook_pages, {lit(json.dumps(chunk, ensure_ascii=False))}::jsonb) as x")
    toc = [{"ordinal": t["ordinal"], "level": t["level"], "title": t["title"], "page_number": t["page_number"], "metadata": {"source": "usc26-119-142"}} for t in v["toc"]]
    for i in range(0, len(toc), 400):
        q(f"insert into dark_star_ebook_toc (ebook_id,ordinal,level,title,page_number,metadata) select '{eid}',x.ordinal,x.level,x.title,x.page_number,x.metadata from jsonb_populate_recordset(null::dark_star_ebook_toc, {lit(json.dumps(toc[i:i+400], ensure_ascii=False))}::jsonb) as x")
    chk = q(f"select count(*)::int n, md5(string_agg(content,'' order by page_number)) m from dark_star_ebook_pages where ebook_id='{eid}'")[0]
    if chk["n"] != v["total_pages"] or chk["m"] != v["content_md5"]:
        print("ABORT_VERIFY", v["volume"], chk); sys.exit(4)
    meta = {"usc26": {"release": "119-142", "volume": v["volume"], "volumes": len(vols), "sections": v["sections"]}}
    q(f"update dark_star_ebooks set title={lit(v['title'])}, description={lit(v['description'])}, edition='Release point 119-142（current through PL 119-142, 2026-11-10）', total_pages={v['total_pages']}, total_characters={v['total_characters']}, updated_at=now(), metadata=coalesce(metadata,'{{}}'::jsonb)||{lit(json.dumps(meta, ensure_ascii=False))}::jsonb where id='{eid}'")
    print("IMPORTED", v["volume"], eid, v["total_pages"], "pages", len(toc), "toc")
print("DONE")
