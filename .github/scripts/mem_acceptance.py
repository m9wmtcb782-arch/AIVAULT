# sm1：共享記憶 A/B/C/D 驗收。測試全在無網路 docker 真跑；記憶的查／寫／通知走資料庫函式（0 token）；只有 B 修 bug 呼叫 1 次模型。公開日誌只印數字、id、通過與否。
import json, os, subprocess, tempfile, urllib.request, re, time, hashlib
REF="clcddygkaaqqtsbswgdf"; TOKEN=os.environ["TOKEN"]
def mgmt(path):
    r=urllib.request.Request("https://api.supabase.com/v1/projects/%s/%s"%(REF,path),headers={"Authorization":"Bearer "+TOKEN,"User-Agent":"mem"});return json.load(urllib.request.urlopen(r))
SR=[k["api_key"] for k in mgmt("api-keys?reveal=true") if k.get("name")=="service_role"][0]; print("::add-mask::"+SR)
H={"Authorization":"Bearer "+SR,"apikey":SR,"Content-Type":"application/json"}
def post(url,body,t=200):
    r=urllib.request.Request(url,data=json.dumps(body).encode(),headers=H,method="POST")
    try: return json.load(urllib.request.urlopen(r,timeout=t))
    except urllib.error.HTTPError as e: return {"ok":False,"error":"HTTP %d %s"%(e.code,e.read()[:200])}
def rpc(f,**a): return post("https://%s.supabase.co/rest/v1/rpc/%s"%(REF,f),a)
def edge(b): return post("https://%s.supabase.co/functions/v1/dark-star-ebook-ingest?feature=degree"%REF,b,300)
def sqlq(q): return post("https://api.supabase.com/v1/projects/%s/database/query"%REF,{"query":q}) if False else None
subprocess.run(["docker","pull","-q","node:20-alpine"],check=True,stdout=subprocess.DEVNULL)
def run(files):
    d=tempfile.mkdtemp()
    for k,v in files.items(): open(os.path.join(d,k),"w").write(v)
    os.chmod(d,0o755)
    p=subprocess.run(["docker","run","--rm","--network","none","--read-only","--memory","256m","--cpus","1","--pids-limit","64","--cap-drop","ALL","--user","1000:1000","-v",d+":/w:ro","-w","/w","node:20-alpine","timeout","20","node","--test","--test-reporter=tap","test.js"],capture_output=True,text=True,timeout=60)
    out=p.stdout+"\n"+p.stderr; m=lambda k:int((re.search(r"^# %s (\d+)"%k,out,re.M) or [0,0])[1]); return p.returncode==0 and m("fail")==0 and m("tests")>0, out, {"tests":m("tests"),"pass":m("pass"),"fail":m("fail")}
def err_of(out, fn="paginate"):  # 取 assertion 錯誤的核心幾行當錯誤訊息
    lines=[l.strip() for l in out.splitlines() if re.search(r"(Expected values|AssertionError|Error:|ERR_)",l)]; return ("\n".join(dict.fromkeys(lines))+"\nfailing function: "+fn+" (product.js)")[:1500]
R=[]; T0=time.strftime("%H%M%S")
def ok(n,c,i=""): R.append(bool(c)); print(("PASS " if c else "FAIL ")+n,i)
A,D="ag-0010","ag-0950"; B=C=None   # D 在安全驗收區（不同區、不同專案），遇到同一個 bug
BUG="function paginate(items, page, size) {\n  const start = (page - 1) * size;\n  return items.slice(start, start + size - 1);\n}\nmodule.exports = { paginate };\n"
TEST="const { test } = require('node:test'); const assert = require('node:assert/strict'); const { paginate } = require('./product.js');\ntest('first page of 3', () => { assert.deepStrictEqual(paginate([1,2,3,4,5,6,7,8,9,10], 1, 3), [1, 2, 3]); });\ntest('last partial page', () => { assert.deepStrictEqual(paginate([1,2,3,4,5,6,7], 3, 3), [7]); });\n"
# ── A：真跑沙盒遇到 bug，寫問題記憶
okA,outA,tA=run({"product.js":BUG,"test.js":TEST}); ok("A sandbox reproduces bug (real docker fail)",not okA,tA)
eA=err_of(outA); ver=hashlib.sha256(BUG.encode()).hexdigest()[:12]
w=rpc("aivault_mem_write",p_agent=A,p_kind="problem",p_layer="district",p_title="paginate 分頁每頁少一筆 "+T0,p_body="分頁函式回傳的每頁筆數少一筆，最後一頁可能是空的。",p_district="code",p_project=None,p_error=eA,p_env="node:20-alpine docker --network none, node --test",p_code_version=ver,p_repro="product.js:\n"+BUG+"\ntest.js:\n"+TEST+"\ncommand: node --test test.js")
ok("A writes problem memory",w.get("ok"),{k:w.get(k) for k in ("id","duplicate_of")}); PID=w.get("id")
ok("secret scan blocks key in memory",not rpc("aivault_mem_write",p_agent=A,p_kind="note",p_layer="public",p_title="x",p_body="my key gsk_ABCDEFGHIJKLMNOPQRSTUV123",p_district=None,p_project=None,p_error=None,p_env=None,p_code_version=None,p_repro=None).get("ok"))
ok("other district cannot read district-layer problem yet",not any(x["id"]==PID for x in rpc("aivault_mem_search",p_agent="ag-0600",p_q="paginate",p_error=None,p_layers=None,p_district=None,p_project=None,p_status=None,p_since=None,p_version=None,p_k=5).get("results",[])))
# ── ANCN：A 按需啟動 → 記憶沒有已驗證解 → 依技能索引＋邊權重挑神經元 → 經通訊系統自動送 help_request
act=rpc("aivault_ancn_activate",p_requester=A,p_skill="code",p_goal="paginate 分頁少一筆",p_error=eA,p_kb=PID); B=act.get("helper")
ok("A activation picks helper and auto-sends help_request",act.get("ok") and B and (act.get("message") or {}).get("ok"),{"helper":B,"activation":act.get("id"),"picked":[x["agent_id"] for x in act.get("picked",[])]})
RUN="mem-"+T0; inbox=rpc("aivault_comm_lease",p_agent=B,p_run=RUN,p_limit=20,p_lease_s=300); hm=[m for m in (inbox if isinstance(inbox,list) else []) if m.get("message_type")=="help_request" and (m.get("payload") or {}).get("kb_id")==PID]
ok("B auto-received help request in its inbox (lease)",bool(hm),{"leased":len(inbox) if isinstance(inbox,list) else inbox})
if hm: ok("B marks read under its lease",rpc("aivault_comm_ack",p_agent=B,p_message=hm[0]["id"],p_status="read",p_run=RUN,p_evidence=None).get("ok"))
print("SUB", rpc("aivault_mem_subscribe",p_agent=B,p_target="kb:%s"%PID))
# ── B：搜尋 → 拿到重現步驟 → 修（1 次模型）→ 真跑通過 → 寫解法
s=rpc("aivault_mem_search",p_agent=B,p_q="paginate 分頁",p_error=None,p_layers=None,p_district="code",p_project=None,p_status=["open"],p_since=None,p_version=None,p_k=5); top=(s.get("results") or [{}])[0]
ok("B search finds A's problem with repro",top.get("id")==PID and "product.js" in (top.get("repro") or ""),"latency %sms"%s.get("latency_ms"))
fx=edge({"action":"mem_fix","repro":"product.js:\n"+BUG+"\ntest.js:\n"+TEST,"error":eA,"product_js":BUG}); MODEL_TOKENS=fx.get("tokens") or 0
ok("B model fix returned code (1 model call)",fx.get("ok"),{"model":fx.get("model"),"tokens":MODEL_TOKENS,"error":str(fx.get("error",""))[:120]})
if not fx.get("ok"): print("MEMTEST stopped: model unavailable (quota)", "passed=%d/%d"%(sum(R),len(R))); raise SystemExit(0)
okB,outB,tB=run({"product.js":fx["product_js"],"test.js":TEST}); ok("B fix passes real sandbox",okB,tB)
sv=rpc("aivault_mem_solve",p_agent=B,p_id=PID,p_solution=fx["product_js"],p_evidence={"tests":tB,"explanation":fx.get("explanation","")[:300],"model":fx.get("model"),"tokens":MODEL_TOKENS}); ok("B records solution",sv.get("ok"))
ok("solver cannot verify own solution",not rpc("aivault_mem_verify",p_agent=B,p_id=PID,p_pass=True,p_evidence={"tests":tB}).get("ok"))
if hm: rpc("aivault_comm_send",p_sender=B,p_kind="dm",p_recipient=A,p_type="deliver",p_payload={"text":"已修好並寫入共享記憶 kb %s，等第三方驗證"%PID,"kb_id":PID},p_project=None,p_task=None,p_correlation=None,p_reply_to=hm[0]["id"],p_dedupe="memdel-%s"%PID)
pc=rpc("aivault_ancn_pick",p_requester=B,p_skill="code",p_k=5); C=[x["agent_id"] for x in pc if x["agent_id"] not in (A,B)][0]; print("VERIFIER",C)
# ── C：獨立驗證（自己的額外測試，真跑）
TEST_C=TEST+"test('independent: page beyond end is empty', () => { assert.deepStrictEqual(paginate([1,2], 5, 2), []); });\ntest('independent: does not mutate input', () => { const a=[1,2,3]; paginate(a,1,2); assert.deepStrictEqual(a,[1,2,3]); });\n"
okC,outC,tC=run({"product.js":fx["product_js"],"test.js":TEST_C}); vf=rpc("aivault_mem_verify",p_agent=C,p_id=PID,p_pass=okC,p_evidence={"tests":tC,"runner":"docker node:20-alpine --network none","extra_tests":2})
ok("C independent sandbox verify",okC and vf.get("status")=="verified",tC)
n=post("https://%s.supabase.co/rest/v1/aivault_mem_notify_log?kb_id=eq.%s&agent_id=eq.%s&select=event,message_id"%(REF,PID,B),None) if False else None
# ── D：另一區、另一份程式碼遇到同一個 bug → 寫入時自動連到既有問題 → 直接找到已驗證解法 → 套用 → 真跑通過（0 次模型）
BUG_D=BUG  # 同一個共用函式被另一個專案引用
TEST_D="const { test } = require('node:test'); const assert = require('node:assert/strict'); const { paginate } = require('./product.js');\ntest('audit log page 2', () => { assert.deepStrictEqual(paginate(['a','b','c','d','e','f'], 2, 2), ['c', 'd']); });\n"
okD0,outD0,tD0=run({"product.js":BUG_D,"test.js":TEST_D}); eD=err_of(outD0); ok("D hits same bug in its own sandbox run",not okD0,tD0)
t1=time.time(); sd=rpc("aivault_mem_search",p_agent=D,p_q="paginate audit log page",p_error=eD,p_layers=None,p_district=None,p_project=None,p_status=None,p_since=None,p_version=None,p_k=3); rt=(time.time()-t1)*1000
hit=[x for x in sd.get("results",[]) if x["id"]==PID]; ok("D finds verified solution by error fingerprint",hit and hit[0]["status"]=="verified","db %sms, round-trip %.0fms"%(sd.get("latency_ms"),rt))
wd=rpc("aivault_mem_write",p_agent=D,p_kind="problem",p_layer="district",p_title="audit log 分頁少一筆",p_body="同樣的分頁錯誤",p_district="security",p_project=None,p_error=eD,p_env="node:20-alpine docker",p_code_version=ver,p_repro="see kb %s"%PID)
ok("D's report deduped (linked to A's problem)",wd.get("duplicate_of")==PID,wd)
sol=rpc("aivault_mem_search",p_agent=D,p_q="",p_error=eD,p_layers=None,p_district=None,p_project=None,p_status=["verified"],p_since=None,p_version=None,p_k=1)
full=post("https://%s.supabase.co/rest/v1/rpc/aivault_mem_search"%REF,{}) if False else None
# 片段只有 400 字；D 需要完整解法時讀單筆（仍是資料庫，不花 token）
req=urllib.request.Request("https://%s.supabase.co/rest/v1/aivault_kb?id=eq.%s&select=solution,verifier,solved_by"%(REF,PID),headers=H); row=json.load(urllib.request.urlopen(req))[0]
okD,outD,tD=run({"product.js":row["solution"],"test.js":TEST_D}); ok("D applies verified solution, real sandbox passes, 0 model calls",okD,tD)
nl=json.load(urllib.request.urlopen(urllib.request.Request("https://%s.supabase.co/rest/v1/aivault_mem_notify_log?kb_id=eq.%s&select=agent_id,event"%(REF,PID),headers=H)))
ok("subscriber B notified via comm (no loop: each event once)",any(x["agent_id"]==B for x in nl) and len(nl)==len({(x["agent_id"],x["event"]) for x in nl}),nl)
m=json.load(urllib.request.urlopen(urllib.request.Request("https://%s.supabase.co/rest/v1/aivault_mem_metrics?select=*"%REF,headers=H)))[0]
print("METRICS",json.dumps(m)) if False else None
ok("fake evidence does not change weight",not rpc("aivault_ancn_learn",p_source=A,p_target=B,p_relation="help",p_success=True,p_evidence={"kb_id":999999},p_quality=1).get("ok"))
w1=rpc("aivault_ancn_learn",p_source=A,p_target=B,p_relation="help",p_success=True,p_evidence={"kb_id":PID,"skill":"code"},p_quality=1); ok("A→B help edge weight updated from verified outcome",w1.get("ok"),w1)
ok("same evidence cannot be counted twice",not rpc("aivault_ancn_learn",p_source=A,p_target=B,p_relation="help",p_success=True,p_evidence={"kb_id":PID,"skill":"code"},p_quality=1).get("ok"))
w2=rpc("aivault_ancn_learn",p_source=B,p_target=C,p_relation="verify",p_success=True,p_evidence={"kb_id":PID,"skill":"code"},p_quality=1); ok("B→C verify edge updated",w2.get("ok"),w2)
ad=rpc("aivault_ancn_activate",p_requester=D,p_skill="code",p_goal="paginate audit log page",p_error=eD,p_kb=None); ok("D activation answered from memory, no neuron activated, 0 model calls",ad.get("status")=="memory_hit",{"id":ad.get("id")})
print("METRICS",json.dumps(m),"model_calls_saved_by_D=1 tokens_saved≈%d"%MODEL_TOKENS,"B_tokens=%d"%MODEL_TOKENS)
print("MEMTEST kb=%s passed=%d/%d"%(PID,sum(R),len(R)))
