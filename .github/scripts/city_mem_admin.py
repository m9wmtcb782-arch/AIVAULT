# sm2：暗星／曙光真實對話驗收。走它們網頁用的同一個 ai-gateway 文字對話入口（免費 Gemini），證明檢索發生在對話呼叫內、回覆引用 mem#id。
# 公開日誌只印 id、狀態、是否引用；不印對話全文。
import json, os, subprocess, tempfile, urllib.request, re, time, uuid
REF="clcddygkaaqqtsbswgdf"; TOKEN=os.environ["TOKEN"]
def mgmt(path):
    r=urllib.request.Request("https://api.supabase.com/v1/projects/%s/%s"%(REF,path),headers={"Authorization":"Bearer "+TOKEN,"User-Agent":"mem"});return json.load(urllib.request.urlopen(r))
keys={k.get("name"):k["api_key"] for k in mgmt("api-keys?reveal=true")}; SR=keys["service_role"]; AN=keys["anon"]; print("::add-mask::"+SR)
H={"Authorization":"Bearer "+SR,"apikey":SR,"Content-Type":"application/json"}
def post(url,body,h=H,t=180):
    r=urllib.request.Request(url,data=json.dumps(body).encode(),headers=h,method="POST")
    try: return json.load(urllib.request.urlopen(r,timeout=t))
    except urllib.error.HTTPError as e: return {"ok":False,"error":"HTTP %d %s"%(e.code,e.read()[:200])}
def rpc(f,**a): return post("https://%s.supabase.co/rest/v1/rpc/%s"%(REF,f),a)
def get(path): return json.load(urllib.request.urlopen(urllib.request.Request("https://%s.supabase.co/rest/v1/%s"%(REF,path),headers=H)))
def chat(agent,msg,topic):  # 與 technical-dark-star.html 相同的欄位
    return post("https://%s.supabase.co/functions/v1/ai-gateway"%REF,{"engine":agent,"message":msg,"conversation_id":None,"topic_id":topic,"agent_id":agent,"source":agent+"-web","provider":"gemini","model":"gemini-3.6-flash","files":[],"stream":False},{"Authorization":"Bearer "+AN,"apikey":AN,"Content-Type":"application/json"},240)
def text_of(r): 
    for k in ("answer","text","reply","content","output","message"):
        v=r.get(k) if isinstance(r,dict) else None
        if isinstance(v,str) and v.strip(): return v
    return json.dumps(r,ensure_ascii=False)
subprocess.run(["docker","pull","-q","node:20-alpine"],check=True,stdout=subprocess.DEVNULL)
def run(files):
    d=tempfile.mkdtemp()
    for k,v in files.items(): open(os.path.join(d,k),"w").write(v)
    os.chmod(d,0o755)
    p=subprocess.run(["docker","run","--rm","--network","none","--read-only","--memory","256m","--cpus","1","--pids-limit","64","--cap-drop","ALL","--user","1000:1000","-v",d+":/w:ro","-w","/w","node:20-alpine","timeout","20","node","--test","--test-reporter=tap","test.js"],capture_output=True,text=True,timeout=60)
    out=p.stdout+"\n"+p.stderr; m=lambda k:int((re.search(r"^# %s (\d+)"%k,out,re.M) or [0,0])[1]); return p.returncode==0 and m("fail")==0 and m("tests")>0,out,{"tests":m("tests"),"pass":m("pass"),"fail":m("fail")}
R=[]; T0=time.strftime("%H%M%S")
def ok(n,c,i=""): R.append(bool(c)); print(("PASS " if c else "FAIL ")+n,i)
A,C,D="ag-0011","ag-0941","ag-0123"
BUG="function chunk(arr, size) {\n  const out = [];\n  for (let i = 0; i < arr.length - size; i += size) out.push(arr.slice(i, i + size));\n  return out;\n}\nmodule.exports = { chunk };\n"
TEST="const { test } = require('node:test'); const assert = require('node:assert/strict'); const { chunk } = require('./product.js');\ntest('even split', () => { assert.deepStrictEqual(chunk([1,2,3,4], 2), [[1,2],[3,4]]); });\ntest('remainder kept', () => { assert.deepStrictEqual(chunk([1,2,3,4,5], 2), [[1,2],[3,4],[5]]); });\n"
okA,outA,tA=run({"product.js":BUG,"test.js":TEST}); ok("A real sandbox reproduces bug",not okA,tA)
err="\n".join(l.strip() for l in outA.splitlines() if re.search(r"(Expected values|AssertionError|ERR_)",l))[:800]+"\nfailing function: chunk (product.js)"
w=rpc("aivault_mem_write",p_agent=A,p_kind="problem",p_layer="public",p_title="chunk() 漏掉最後一組 "+T0,p_body="把陣列分組時最後一組（或剛好整除時的最後一組）不見了。",p_district="code",p_project=None,p_error=err,p_env="node:20-alpine docker --network none",p_code_version="chunk-v1",p_repro="product.js:\n"+BUG+"\ntest.js:\n"+TEST)
PID=w.get("id"); ok("A writes problem memory",w.get("ok"),PID)
rpc("aivault_mem_subscribe",p_agent=A,p_target="kb:%s"%PID)
topic=str(uuid.uuid4())
r1=chat("technical-dark-star","請看城市共享記憶 mem#%d 的問題，說明原因並給出修好的完整 product.js（放在 ```js 程式碼區塊），回答要引用 mem#%d。"%(PID,PID),topic); t1=text_of(r1)
ok("暗星 real chat call returned",len(t1)>40 and not str(r1.get("error","")).strip(),{"chars":len(t1),"err":str(r1.get("error",""))[:120]})
ok("暗星 reply cites mem#%d"%PID,("mem#%d"%PID) in t1)
time.sleep(3)
au=get("aivault_audit_events?actor=eq.darkstar&action=in.(mem_retrieval_in_chat,mem_cited_in_reply,mem_written_from_chat)&created_at=gte.%s&select=action,target,detail,created_at&order=id"%time.strftime("%Y-%m-%dT%H:%M:%S",time.gmtime(time.time()-600)))
ok("server log: retrieval happened inside 暗星 chat call",any(a["action"]=="mem_retrieval_in_chat" and PID in a["detail"].get("ids",[]) for a in au),[(a["action"],a["detail"].get("ids") or a["detail"].get("cited")) for a in au][-3:])
ok("server log: reply cited the retrieved id",any(a["action"]=="mem_cited_in_reply" and PID in a["detail"].get("cited",[]) for a in au))
code=(re.findall(r"```(?:js|javascript)?\s*\n([\s\S]*?)```",t1) or [""])[0]
if "module.exports" not in code and code: code+="\nmodule.exports = { chunk };\n"
okF,outF,tF=run({"product.js":code,"test.js":TEST}) if code else (False,"no code",{})
ok("暗星's proposed fix passes real sandbox",okF,tF)
if okF: print("SOLVE",rpc("aivault_mem_solve",p_agent="darkstar",p_id=PID,p_solution=code,p_evidence={"tests":tF,"source":"ai-gateway chat topic "+topic[:8]}))
r2=chat("dawn-light","我是擁有者。請看 mem#%d（暗星已提出修法），從可視化／教學角度補充一個說明圖的建議，回答要引用 mem#%d。"%(PID,PID),str(uuid.uuid4())); t2=text_of(r2)
ok("曙光 real chat call returned and cites mem#%d"%PID,("mem#%d"%PID) in t2,{"chars":len(t2),"err":str(r2.get("error",""))[:120]})
time.sleep(3)
au2=get("aivault_audit_events?actor=eq.dawn-light&action=in.(mem_retrieval_in_chat,mem_cited_in_reply,mem_written_from_chat)&created_at=gte.%s&select=action,detail&order=id"%time.strftime("%Y-%m-%dT%H:%M:%S",time.gmtime(time.time()-600)))
ok("server log: 曙光 retrieval inside chat + citation",any(a["action"]=="mem_retrieval_in_chat" and PID in a["detail"].get("ids",[]) for a in au2) and any(a["action"]=="mem_cited_in_reply" for a in au2),[a["action"] for a in au2][-3:])
if okF:
    TEST_C=TEST+"test('independent: size larger than array', () => { assert.deepStrictEqual(chunk([1,2], 5), [[1,2]]); });\ntest('independent: empty', () => { assert.deepStrictEqual(chunk([], 3), []); });\n"
    okC,outC,tC=run({"product.js":code,"test.js":TEST_C}); v=rpc("aivault_mem_verify",p_agent=C,p_id=PID,p_pass=okC,p_evidence={"tests":tC,"runner":"docker node:20-alpine --network none"}); ok("agent C independently verifies 暗星's fix",okC and v.get("status")=="verified",tC)
    s=rpc("aivault_mem_search",p_agent=D,p_q="chunk 分組",p_error=err,p_layers=None,p_district=None,p_project=None,p_status=["verified"],p_since=None,p_version=None,p_k=3); top=(s.get("results") or [{}])[0]
    ok("agent D retrieves verified final solution",top.get("id")==PID and top.get("verifier")==C and top.get("solved_by")=="darkstar","latency %sms"%s.get("latency_ms"))
notes=get("aivault_kb?repro=eq.ref%%20mem%%23%d&select=id,agent_id,layer,code_version"%PID); ok("暗星/曙光 input written back with provenance (admin layer)",len(notes)>=1,notes)
nl=get("aivault_mem_notify_log?kb_id=eq.%d&select=agent_id,event"%PID); print("NOTIFY",nl)
print("ADMINMEM kb=%s passed=%d/%d"%(PID,sum(R),len(R)))
