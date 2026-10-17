# 把電子書頁面圖搬到私有 storage bucket（只限登入會員讀），並把內文 [[img:]] 改成 [[pimg:]]；不印任何密鑰
import json,os,glob,urllib.request
REF="clcddygkaaqqtsbswgdf";API=f"https://api.supabase.com/v1/projects/{REF}";EID=os.environ["EID"];B="ebook-private"
def req(url,data=None,h=None,method=None):
    r=urllib.request.Request(url,data=data,headers=h or {},method=method)
    try: return urllib.request.urlopen(r,timeout=120).read()
    except urllib.error.HTTPError as e: return ("HTTP%d "%e.code+e.read().decode()[:200]).encode()
MH={"Authorization":"Bearer "+os.environ["TOKEN"],"Content-Type":"application/json","User-Agent":"aivault"}
def q(sql): return json.loads(req(API+"/database/query",json.dumps({"query":sql}).encode(),MH))
q(f"insert into storage.buckets (id,name,public) values ('{B}','{B}',false) on conflict (id) do update set public=false")
q(f"""do $$ begin if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='ebook_private_read_auth') then
create policy ebook_private_read_auth on storage.objects for select to authenticated using (bucket_id='{B}'); end if; end $$""")
keys=json.loads(req(API+"/api-keys?reveal=true",h=MH));SR=[k["api_key"] for k in keys if k.get("name")=="service_role"][0]
n=0
for f in sorted(glob.glob(f"ebooks/{EID}/img/p*.jpg")):
    r=req(f"https://{REF}.supabase.co/storage/v1/object/{B}/{EID}/{os.path.basename(f)}",open(f,"rb").read(),{"Authorization":"Bearer "+SR,"apikey":SR,"Content-Type":"image/jpeg","x-upsert":"true"},"POST")
    print(os.path.basename(f),r[:60]);n+=1
print("UPLOADED",n)
q(f"update dark_star_ebook_pages set content=regexp_replace(content,'\\[\\[img:(p[0-9]+)\\]\\]','[[pimg:\\1]]','g') where ebook_id='{EID}'")
q(f"update dark_star_ebooks set cover_url=null where id='{EID}'")
print("REFS",q(f"select count(*) filter (where content ~ '\\[\\[pimg:') p, count(*) filter (where content ~ '\\[\\[img:') i from dark_star_ebook_pages where ebook_id='{EID}'"))
print("OBJS",q(f"select count(*)::int n from storage.objects where bucket_id='{B}' and name like '{EID}/%'"))
print("BUCKET",q(f"select public from storage.buckets where id='{B}'"))
print("ANON_PUBLIC",req(f"https://{REF}.supabase.co/storage/v1/object/public/{B}/{EID}/p69.jpg")[:80])
print("NOAUTH",req(f"https://{REF}.supabase.co/storage/v1/object/authenticated/{B}/{EID}/p69.jpg")[:80])
