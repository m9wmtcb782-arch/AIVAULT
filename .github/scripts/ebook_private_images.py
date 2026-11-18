# 電子書頁面圖搬到私有 storage，並把內文圖片標記改成私有版；不印任何密鑰
#
# MODE=members（預設，舊行為）：ebooks/{EID}/img/p*.jpg → bucket ebook-private/{EID}/（登入會員可讀），[[img:]]→[[pimg:]]
# MODE=owner（只限本人）：圖片來源必須是加密封存檔 IMG_ARCHIVE（*.tar.gpg，用 AIVAULT_PRIVATE_PAGES_KEY 解密），
#   不讀 repo 的 ebooks/ 目錄（那裡會被 GitHub Pages 公開）→ bucket ebook-owner/{OWNER_ID}/{EID}/（只有本人或 owner/admin 可讀），
#   [[img:]]/[[pimg:]]→[[oimg:]]。為避免把公開書改成私人，只處理資料庫裡 visibility 已經是 'owner' 且 owner_id=OWNER_ID 的書。
#   bucket 與 policy 由 migration 20261118090000_ebook_owner_visibility.sql 建立；本腳本 owner 模式不做 DDL。
import json,os,glob,re,subprocess,tempfile,urllib.request
REF="clcddygkaaqqtsbswgdf";API=f"https://api.supabase.com/v1/projects/{REF}";EID=os.environ["EID"];MODE=os.environ.get("MODE","members")
UUID=re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",re.I)
if not UUID.match(EID): raise SystemExit("EID 格式錯誤")
def req(url,data=None,h=None,method=None):
    r=urllib.request.Request(url,data=data,headers=h or {},method=method)
    try: return urllib.request.urlopen(r,timeout=120).read()
    except urllib.error.HTTPError as e: return ("HTTP%d "%e.code+e.read().decode()[:200]).encode()
MH={"Authorization":"Bearer "+os.environ["TOKEN"],"Content-Type":"application/json","User-Agent":"aivault"}
def q(sql): return json.loads(req(API+"/database/query",json.dumps({"query":sql}).encode(),MH))
def service_key():
    keys=json.loads(req(API+"/api-keys?reveal=true",h=MH));return [k["api_key"] for k in keys if k.get("name")=="service_role"][0]
def upload(bucket,path,f,SR):
    return req(f"https://{REF}.supabase.co/storage/v1/object/{bucket}/{path}",open(f,"rb").read(),{"Authorization":"Bearer "+SR,"apikey":SR,"Content-Type":"image/jpeg","x-upsert":"true"},"POST")

if MODE=="owner":
    OWNER=os.environ["OWNER_ID"];ARCH=os.environ["IMG_ARCHIVE"]
    if not UUID.match(OWNER): raise SystemExit("OWNER_ID 格式錯誤")
    if os.path.abspath(ARCH).startswith(os.path.abspath("ebooks")+os.sep) or not ARCH.endswith(".gpg"):
        raise SystemExit("owner 模式只接受加密封存檔（*.gpg），且不得放在 ebooks/（會被 Pages 公開）")
    row=q(f"select visibility,owner_id::text o from public.dark_star_ebooks where id='{EID}'")
    if not row or row[0].get("visibility")!="owner" or row[0].get("o")!=OWNER:
        raise SystemExit("拒絕：這本書在資料庫不是 visibility='owner' 且 owner_id=OWNER_ID（本腳本不會把公開書改成私人）")
    if not q("select 1 from storage.buckets where id='ebook-owner' and public=false"):
        raise SystemExit("ebook-owner bucket 不存在，請先套用 migration 20261118090000")
    tmp=tempfile.mkdtemp()
    raw=subprocess.run(["gpg","-q","--batch","--pinentry-mode","loopback","--passphrase-fd","0","-d",ARCH],input=os.environ["KEY"].encode(),capture_output=True,check=True).stdout
    tar=os.path.join(tmp,"img.tar");open(tar,"wb").write(raw);subprocess.run(["tar","-xf",tar,"-C",tmp],check=True);os.remove(tar)
    SR=service_key();n=0
    for f in sorted(glob.glob(os.path.join(tmp,"**","*.jpg"),recursive=True)):
        r=upload("ebook-owner",f"{OWNER}/{EID}/{os.path.basename(f)}",f,SR);print(os.path.basename(f),r[:60]);n+=1
    print("UPLOADED",n)
    q(f"update dark_star_ebook_pages set content=regexp_replace(content,'\\[\\[p?img:([A-Za-z0-9_-]+)\\]\\]','[[oimg:\\1]]','g') where ebook_id='{EID}'")
    q(f"update dark_star_ebooks set cover_url=null where id='{EID}' and visibility='owner'")
    print("REFS",q(f"select count(*) filter (where content ~ '\\[\\[oimg:') o, count(*) filter (where content ~ '\\[\\[p?img:') other from dark_star_ebook_pages where ebook_id='{EID}'"))
    print("OBJS",q(f"select count(*)::int n from storage.objects where bucket_id='ebook-owner' and name like '{OWNER}/{EID}/%'"))
    print("ANON_PUBLIC",req(f"https://{REF}.supabase.co/storage/v1/object/public/ebook-owner/{OWNER}/{EID}/x.jpg")[:80])
    raise SystemExit(0)

# ---- MODE=members：舊行為（保留不變）----
B="ebook-private"
q(f"insert into storage.buckets (id,name,public) values ('{B}','{B}',false) on conflict (id) do update set public=false")
q(f"""do $$ begin if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='ebook_private_read_auth') then
create policy ebook_private_read_auth on storage.objects for select to authenticated using (bucket_id='{B}'); end if; end $$""")
SR=service_key()
n=0
for f in sorted(glob.glob(f"ebooks/{EID}/img/p*.jpg")):
    r=upload(B,f"{EID}/{os.path.basename(f)}",f,SR)
    print(os.path.basename(f),r[:60]);n+=1
print("UPLOADED",n)
q(f"update dark_star_ebook_pages set content=regexp_replace(content,'\\[\\[img:(p[0-9]+)\\]\\]','[[pimg:\\1]]','g') where ebook_id='{EID}'")
q(f"update dark_star_ebooks set cover_url=null where id='{EID}'")
print("REFS",q(f"select count(*) filter (where content ~ '\\[\\[pimg:') p, count(*) filter (where content ~ '\\[\\[img:') i from dark_star_ebook_pages where ebook_id='{EID}'"))
print("OBJS",q(f"select count(*)::int n from storage.objects where bucket_id='{B}' and name like '{EID}/%'"))
print("BUCKET",q(f"select public from storage.buckets where id='{B}'"))
print("ANON_PUBLIC",req(f"https://{REF}.supabase.co/storage/v1/object/public/{B}/{EID}/p69.jpg")[:80])
print("NOAUTH",req(f"https://{REF}.supabase.co/storage/v1/object/authenticated/{B}/{EID}/p69.jpg")[:80])
