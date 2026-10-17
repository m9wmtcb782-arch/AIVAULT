# 匯入私人電子書（內文加密存在 private/ebooks/*.gpg，僅寫入 Supabase；不印任何密鑰）
import json,os,subprocess,urllib.request
P="https://api.supabase.com/v1/projects/clcddygkaaqqtsbswgdf/database/query"
def q(sql):
    r=urllib.request.Request(P,data=json.dumps({"query":sql}).encode(),headers={"Authorization":"Bearer "+os.environ["TOKEN"],"Content-Type":"application/json","User-Agent":"aivault-ebook-import"})
    try: return json.load(urllib.request.urlopen(r,timeout=120))
    except urllib.error.HTTPError as e: print("ERR",e.read().decode()[:400]); raise
def lit(s): return "$J$"+s.replace("$J$","")+"$J$"
raw=subprocess.run(["gpg","-q","--batch","--pinentry-mode","loopback","--passphrase-fd","0","-d",os.environ["SRC"]],input=os.environ["KEY"].encode(),capture_output=True,check=True).stdout
d=json.loads(raw); eid=d["ebook_id"]; tpl=os.environ["TEMPLATE"]
rows=d["rows"]; tc=sum(r["word_count"] for r in rows)
patch={"id":eid,"title":d["title"],"author":d["author"],"description":d["description"],"language":"zh-Hans","category":d["category"],"metadata":d["metadata"],"cover_url":d.get("cover_url"),"total_pages":len(rows),"total_characters":tc}
if not q(f"select 1 from dark_star_ebooks where id='{eid}'"):
    q(f"insert into dark_star_ebooks select (jsonb_populate_record(null::dark_star_ebooks, to_jsonb(e) || {lit(json.dumps(patch,ensure_ascii=False))}::jsonb || jsonb_build_object('created_at',now(),'updated_at',now()))).* from dark_star_ebooks e where id='{tpl}'")
q(f"delete from dark_star_ebook_pages where ebook_id='{eid}'")
for i in range(0,len(rows),25):
    q(f"insert into dark_star_ebook_pages (ebook_id,page_number,content,word_count,metadata) select '{eid}',x.page_number,x.content,x.word_count,x.metadata from jsonb_to_recordset({lit(json.dumps(rows[i:i+25],ensure_ascii=False))}::jsonb) as x(page_number int,content text,word_count int,metadata jsonb)")
q(f"update dark_star_ebooks set total_pages={len(rows)},total_characters={tc},updated_at=now() where id='{eid}'")
print("VERIFY",q(f"select count(*)::int n,min(page_number) a,max(page_number) b,sum(word_count)::int c from dark_star_ebook_pages where ebook_id='{eid}'"))
print("BOOK",q(f"select id,title,author,total_pages,total_characters,metadata->>'private' priv from dark_star_ebooks where id='{eid}'"))
print("TPL",q(f"select title,metadata from dark_star_ebooks where id='{tpl}'"))
