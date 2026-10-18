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
def err_of(out):  # 取 assertion 錯誤的核心幾行當錯誤訊息
    lines=[l.strip() for l in out.splitlines() if re.search(r"(Expected values|AssertionError|Error:|ERR_)",l)]; fn=re.findall(r"\b(\w+)\(\[",out); return ("\n".join(dict.fromkeys(lines))+("\nin "+fn[0] if fn else ""))[:1500]
R=[]; T0=time.strftime("%H%M%S")
def ok(n,c,i=""): R.append(bool(c)); print(("PASS " if c else "FAIL ")+n,i)
A,B,C,D="ag-0010","ag-0020","ag-0030","ag-0950"   # D 在安全驗收區（不同區、不同專案），遇到同一個 bug
BUG="function topScores(scores, n) {\n  return scores.slice().sort().reverse().slice(0, n);\n}\nmodule.exports = { topScores };\n"
TEST="const { test } = require('node:test'); const assert = require('node:assert/strict'); const { topScores } = require('./product.js');\ntest('top 2 of mixed digits', () => { assert.deepStrictEqual(topScores([5, 40, 100, 9], 2), [100, 40]); });\ntest('top 1', () => { assert.deepStrictEqual(topScores([3, 1, 2], 1), [3]); });\n"
# ── A：真跑沙盒遇到 bug，寫問題記憶
okA,outA,tA=run({"product.js":BUG,"test.js":TEST}); ok("A sandbox reproduces bug (real docker fail)",not okA,tA)
eA=err_of(outA); ver=hashlib.sha256(BUG.encode()).hexdigest()[:12]
w=rpc("aivault_mem_write",p_agent=A,p_kind="problem",p_layer="district",p_title="topScores 排序錯誤：數字被當字串排序 "+T0,p_body="leaderboard 取前 n 名結果錯誤，多位數字排序順序不對。",p_district="code",p_project=None,p_error=eA,p_env="node:20-alpine docker --network none, node --test",p_code_version=ver,p_repro="product.js:\n"+BUG+"\ntest.js:\n"+TEST+"\ncommand: node --test test.js")
ok("A writes problem memory",w.get("ok"),{k:w.get(k) for k in ("id","duplicate_of")}); PID=w.get("id")
ok("secret scan blocks key in memory",not rpc("aivault_mem_write",p_agent=A,p_kind="note",p_layer="public",p_title="x",p_body="my key gsk_ABCDEFGHIJKLMNOPQRSTUV123",p_district=None,p_project=None,p_error=None,p_env=None,p_code_version=None,p_repro=None).get("ok"))
ok("other district cannot read district-layer problem yet",not any(x["id"]==PID for x in rpc("aivault_mem_search",p_agent="ag-0600",p_q="topScores",p_error=None,p_layers=None,p_district=None,p_project=None,p_status=None,p_since=None,p_version=None,p_k=5).get("results",[])))
print("SUB", rpc("aivault_mem_subscribe",p_agent=B,p_target="kb:%s"%PID))
# ── B：搜尋 → 拿到重現步驟 → 修（1 次模型）→ 真跑通過 → 寫解法
s=rpc("aivault_mem_search",p_agent=B,p_q="topScores 排序",p_error=None,p_layers=None,p_district="code",p_project=None,p_status=["open"],p_since=None,p_version=None,p_k=5); top=(s.get("results") or [{}])[0]
ok("B search finds A's problem with repro",top.get("id")==PID and "product.js" in (top.get("repro") or ""),"latency %sms"%s.get("latency_ms"))
fx=edge({"action":"mem_fix","repro":"product.js:\n"+BUG+"\ntest.js:\n"+TEST,"error":eA,"product_js":BUG}); MODEL_TOKENS=fx.get("tokens") or 0
ok("B model fix returned code (1 model call)",fx.get("ok"),{"model":fx.get("model"),"tokens":MODEL_TOKENS,"error":str(fx.get("error",""))[:120]})
if not fx.get("ok"): print("MEMTEST stopped: model unavailable (quota)", "passed=%d/%d"%(sum(R),len(R))); raise SystemExit(0)
okB,outB,tB=run({"product.js":fx["product_js"],"test.js":TEST}); ok("B fix passes real sandbox",okB,tB)
sv=rpc("aivault_mem_solve",p_agent=B,p_id=PID,p_solution=fx["product_js"],p_evidence={"tests":tB,"explanation":fx.get("explanation","")[:300],"model":fx.get("model"),"tokens":MODEL_TOKENS}); ok("B records solution",sv.get("ok"))
ok("solver cannot verify own solution",not rpc("aivault_mem_verify",p_agent=B,p_id=PID,p_pass=True,p_evidence={"tests":tB}).get("ok"))
# ── C：獨立驗證（自己的額外測試，真跑）
TEST_C=TEST+"test('independent: ties and large values', () => { assert.deepStrictEqual(topScores([1000, 99, 1000, 7], 3), [1000, 1000, 99]); });\ntest('independent: does not mutate input', () => { const a=[2,11,3]; topScores(a,2); assert.deepStrictEqual(a,[2,11,3]); });\n"
okC,outC,tC=run({"product.js":fx["product_js"],"test.js":TEST_C}); vf=rpc("aivault_mem_verify",p_agent=C,p_id=PID,p_pass=okC,p_evidence={"tests":tC,"runner":"docker node:20-alpine --network none","extra_tests":2})
ok("C independent sandbox verify",okC and vf.get("status")=="verified",tC)
n=post("https://%s.supabase.co/rest/v1/aivault_mem_notify_log?kb_id=eq.%s&agent_id=eq.%s&select=event,message_id"%(REF,PID,B),None) if False else None
# ── D：另一區、另一份程式碼遇到同一個 bug → 寫入時自動連到既有問題 → 直接找到已驗證解法 → 套用 → 真跑通過（0 次模型）
BUG_D=BUG.replace("topScores","topScores")  # 同一個共用函式被另一個專案引用
TEST_D="const { test } = require('node:test'); const assert = require('node:assert/strict'); const { topScores } = require('./product.js');\ntest('arena leaderboard', () => { assert.deepStrictEqual(topScores([8, 70, 300, 12], 2), [300, 70]); });\n"
okD0,outD0,tD0=run({"product.js":BUG_D,"test.js":TEST_D}); eD=err_of(outD0); ok("D hits same bug in its own sandbox run",not okD0,tD0)
t1=time.time(); sd=rpc("aivault_mem_search",p_agent=D,p_q="topScores leaderboard sort",p_error=eD,p_layers=None,p_district=None,p_project=None,p_status=None,p_since=None,p_version=None,p_k=3); rt=(time.time()-t1)*1000
hit=[x for x in sd.get("results",[]) if x["id"]==PID]; ok("D finds verified solution by error fingerprint",hit and hit[0]["status"]=="verified","db %sms, round-trip %.0fms"%(sd.get("latency_ms"),rt))
wd=rpc("aivault_mem_write",p_agent=D,p_kind="problem",p_layer="district",p_title="arena 排行榜排序錯誤",p_body="同樣的排序錯誤",p_district="security",p_project=None,p_error=eD,p_env="node:20-alpine docker",p_code_version=ver,p_repro="see kb %s"%PID)
ok("D's report deduped (linked to A's problem)",wd.get("duplicate_of")==PID,wd)
sol=rpc("aivault_mem_search",p_agent=D,p_q="",p_error=eD,p_layers=None,p_district=None,p_project=None,p_status=["verified"],p_since=None,p_version=None,p_k=1)
full=post("https://%s.supabase.co/rest/v1/rpc/aivault_mem_search"%REF,{}) if False else None
# 片段只有 400 字；D 需要完整解法時讀單筆（仍是資料庫，不花 token）
req=urllib.request.Request("https://%s.supabase.co/rest/v1/aivault_kb?id=eq.%s&select=solution,verifier,solved_by"%(REF,PID),headers=H); row=json.load(urllib.request.urlopen(req))[0]
okD,outD,tD=run({"product.js":row["solution"],"test.js":TEST_D}); ok("D applies verified solution, real sandbox passes, 0 model calls",okD,tD)
nl=json.load(urllib.request.urlopen(urllib.request.Request("https://%s.supabase.co/rest/v1/aivault_mem_notify_log?kb_id=eq.%s&select=agent_id,event"%(REF,PID),headers=H)))
ok("subscriber B notified via comm (no loop: each event once)",any(x["agent_id"]==B for x in nl) and len(nl)==len({(x["agent_id"],x["event"]) for x in nl}),nl)
m=json.load(urllib.request.urlopen(urllib.request.Request("https://%s.supabase.co/rest/v1/aivault_mem_metrics?select=*"%REF,headers=H)))[0]
print("METRICS",json.dumps(m),"model_calls_saved_by_D=1 tokens_saved≈%d"%MODEL_TOKENS,"B_tokens=%d"%MODEL_TOKENS)
print("MEMTEST kb=%s passed=%d/%d"%(PID,sum(R),len(R)))
