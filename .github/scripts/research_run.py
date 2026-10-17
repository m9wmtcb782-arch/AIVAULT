# rs1：手機小型模型研發＋四大模組升級設計任務。公開日誌只印數量與狀態；全文以公鑰加密成 artifact。
import json, os, time, subprocess, urllib.request, urllib.error
REF="clcddygkaaqqtsbswgdf"; BASE="https://%s.supabase.co"%REF; TOKEN=os.environ["TOKEN"]
def http(url,data=None,headers=None,method=None,timeout=300):
    r=urllib.request.Request(url,data=json.dumps(data).encode() if data is not None else None,headers=dict({"Content-Type":"application/json","User-Agent":"rs1"},**(headers or {})),method=method)
    try:
        with urllib.request.urlopen(r,timeout=timeout) as f: b=f.read(); return f.status,(json.loads(b) if b else None)
    except urllib.error.HTTPError as e:
        b=e.read()
        try: return e.code,json.loads(b)
        except Exception: return e.code,b[:300].decode("utf-8","replace")
_,keys=http("https://api.supabase.com/v1/projects/%s/api-keys?reveal=true"%REF,headers={"Authorization":"Bearer "+TOKEN})
SR=next(k["api_key"] for k in keys if k.get("name")=="service_role"); print("::add-mask::"+SR)
def y(body): return http(BASE+"/functions/v1/dark-star-ebook-ingest?feature=research",body,{"apikey":SR,"Authorization":"Bearer "+SR},"POST")
s,b=y({"action":"seed"}); print("SEED",s,[(m.get("k"),m.get("rank"),m.get("skipped")) for m in (b.get("made") or [])] if isinstance(b,dict) else b)
end=time.time()+60*float(os.environ.get("MINUTES","6"))
while time.time()<end:
    s,b=y({"action":"run","n":2}); ok=isinstance(b,dict)
    print("RUN",s,[(x.get("k"),x.get("ok"),x.get("chars"),x.get("usage"),(x.get("error") or "")[:80]) for x in (b.get("res") or [])] if ok else str(b)[:200],"left",b.get("left") if ok else None)
    if not ok or s!=200 or b.get("rate_limited") or not b.get("res") or b.get("left")==0: break
    time.sleep(15)
s,b=y({"action":"status"}); print("STATUS",[(t["k"],t["status"],t["review"],t["rank"]) for t in (b.get("tasks") or [])] if isinstance(b,dict) else b)
if os.environ.get("DUMP")=="1":
    q="select t.id,t.order_text,t.status,t.review_status,t.result,t.plan,t.steps,a.name from public.aivault_pool_agent_tasks t join public.aivault_pool_agents a on a.id=t.agent_id where t.source='floor' and t.kind='research' order by t.created_at"
    s,rows=http("https://api.supabase.com/v1/projects/%s/database/query"%REF,{"query":q},{"Authorization":"Bearer "+TOKEN},"POST")
    open("/tmp/r.json","w").write(json.dumps(rows,ensure_ascii=False,default=str))
    subprocess.check_call(["gpg","--batch","--import",".github/scripts/research-dump.pub.asc"])
    subprocess.check_call(["gpg","--batch","--yes","--trust-model","always","-e","-r","aivault-research-dump","-o","research-dump.json.gpg","/tmp/r.json"]); print("dump ok")
