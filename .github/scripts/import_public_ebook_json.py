#!/usr/bin/env python3
import json, os, urllib.request, urllib.error
P = "https://api.supabase.com/v1/projects/clcddygkaaqqtsbswgdf/database/query"

def q(sql):
    r = urllib.request.Request(
        P,
        data=json.dumps({"query": sql}).encode(),
        headers={
            "Authorization": "Bearer " + os.environ["TOKEN"],
            "Content-Type": "application/json",
            "User-Agent": "aivault-ebook-import",
        },
    )
    try:
        return json.load(urllib.request.urlopen(r, timeout=180))
    except urllib.error.HTTPError as e:
        print("ERR", e.code, e.read().decode()[:500])
        raise

def lit(s):
    return "$J$" + s.replace("$J$", "") + "$J$"

src = os.environ["SRC"]
tpl = os.environ.get("TEMPLATE", "c22c6a4a-4339-4143-a1e9-e48a430ce823")
d = json.load(open(src, encoding="utf-8"))
eid = d["ebook_id"]
rows = d["rows"]
tc = sum(int(r.get("word_count") or 0) for r in rows)
patch = {
    "id": eid,
    "title": d["title"],
    "author": d["author"],
    "description": d["description"],
    "language": "zh-Hant",
    "category": d.get("category") or "法規",
    "metadata": d.get("metadata") or {},
    "cover_url": d.get("cover_url"),
    "total_pages": len(rows),
    "total_characters": tc,
}
exists = q(f"select id from dark_star_ebooks where id='{eid}'")
if not exists:
    q(
        f"insert into dark_star_ebooks select (jsonb_populate_record(null::dark_star_ebooks, to_jsonb(e) || {lit(json.dumps(patch, ensure_ascii=False))}::jsonb || jsonb_build_object('created_at',now(),'updated_at',now()))).* from dark_star_ebooks e where id='{tpl}'"
    )
else:
    q(
        f"update dark_star_ebooks set title={lit(json.dumps(d['title'], ensure_ascii=False))}::jsonb#>>'{{}}', author={lit(json.dumps(d['author'], ensure_ascii=False))}::jsonb#>>'{{}}', description={lit(json.dumps(d['description'], ensure_ascii=False))}::jsonb#>>'{{}}', category={lit(json.dumps(d.get('category') or '法規', ensure_ascii=False))}::jsonb#>>'{{}}', language='zh-Hant', total_pages={len(rows)}, total_characters={tc}, metadata=coalesce(metadata,'{{}}'::jsonb)||{lit(json.dumps(d.get('metadata') or {}, ensure_ascii=False))}::jsonb, updated_at=now() where id='{eid}'"
    )
q(f"delete from dark_star_ebook_pages where ebook_id='{eid}'")
for i in range(0, len(rows), 20):
    chunk = [
        {
            "page_number": int(r["page_number"]),
            "content": r["content"],
            "word_count": int(r.get("word_count") or 0),
            "metadata": r.get("metadata") or {},
        }
        for r in rows[i : i + 20]
    ]
    q(
        f"insert into dark_star_ebook_pages (ebook_id,page_number,content,word_count,metadata) select '{eid}',x.page_number,x.content,x.word_count,x.metadata from jsonb_to_recordset({lit(json.dumps(chunk, ensure_ascii=False))}::jsonb) as x(page_number int,content text,word_count int,metadata jsonb)"
    )
print("VERIFY", q(f"select count(*)::int n,min(page_number) a,max(page_number) b,sum(word_count)::int c from dark_star_ebook_pages where ebook_id='{eid}'"))
print("BOOK", q(f"select id,title,author,total_pages,total_characters from dark_star_ebooks where id='{eid}'"))
