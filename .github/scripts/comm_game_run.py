# cm2：6 代理小遊戲驗收執行器。代理推理在 edge（Groq 免費額度）；測試只在無網路 docker 跑。公開日誌只印數字與 id，不印對話或程式。
import json, os, subprocess, tempfile, urllib.request, re, time
REF="clcddygkaaqqtsbswgdf"; TOKEN=os.environ["TOKEN"]
def mgmt(path):
    r=urllib.request.Request("https://api.supabase.com/v1/projects/%s/%s"%(REF,path),headers={"Authorization":"Bearer "+TOKEN,"User-Agent":"comm"});return json.load(urllib.request.urlopen(r))
SR=[k["api_key"] for k in mgmt("api-keys?reveal=true") if k.get("name")=="service_role"][0]; print("::add-mask::"+SR)
FN="https://%s.supabase.co/functions/v1/dark-star-ebook-ingest?feature=degree"%REF
def call(body):
    r=urllib.request.Request(FN,data=json.dumps(body).encode(),headers={"Authorization":"Bearer "+SR,"apikey":SR,"Content-Type":"application/json"},method="POST")
    try: return json.load(urllib.request.urlopen(r,timeout=400))
    except urllib.error.HTTPError as e: return {"ok":False,"error":"HTTP %d %s"%(e.code,e.read()[:160])}
subprocess.run(["docker","pull","-q","node:20-alpine"],check=True,stdout=subprocess.DEVNULL)
def run(files):
    d=tempfile.mkdtemp()
    for k,v in files.items():
        if "/" in k or k.startswith("."): continue
        open(os.path.join(d,k),"w").write(v)
    os.chmod(d,0o755)
    if "test.js" not in files: return 1,"no test.js yet",{"tests":0,"pass":0,"fail":0}
    cmd=["docker","run","--rm","--network","none","--read-only","--tmpfs","/tmp:size=16m","--memory","256m","--cpus","1","--pids-limit","64","--security-opt","no-new-privileges","--cap-drop","ALL","--user","1000:1000","-v",d+":/w:ro","-w","/w","node:20-alpine","timeout","20","node","--test","--test-reporter=tap","test.js"]
    try: p=subprocess.run(cmd,capture_output=True,text=True,timeout=60); out=p.stdout+"\n"+p.stderr; code=p.returncode
    except subprocess.TimeoutExpired: out="TIMEOUT"; code=124
    m=lambda k: int((re.search(r"^# %s (\d+)"%k,out,re.M) or [0,0])[1]); return code,out[-6000:],{"pass":m("pass"),"fail":m("fail"),"tests":m("tests")}
P=os.environ.get("PROJECT","").strip()
if not P:
    s=call({"action":"comm_game_start"}); print("START",{k:s.get(k) for k in ["ok","project","error"]},[t["role"]+"="+t["agent"] for t in s.get("team",[])]); P=s.get("project")
    if not P: raise SystemExit(1)
R=int(os.environ.get("ROUNDS","6") or 6); tot=0
for i in range(R):
    t=call({"action":"comm_game_turn","project":P}); tot+=t.get("tokens") or 0
    for a in t.get("agents",[]): print("TURN %d %s"%(i+1,a.get("role")),{k:(len(v) if isinstance(v,list) else v) for k,v in a.items() if k in ("skipped","error","leased","read","sent","tokens","errors")}, "saved=v%s"%((a.get("saved") or {}).get("version")) if a.get("saved") else "", "proposed" if a.get("proposed") else "", [ (d.get("merge"),d.get("status") or d.get("error")) for d in a.get("decisions",[])] if a.get("decisions") else "")
    if not t.get("ok"): print("TURN ERR",t.get("error")); break
    for j in call({"action":"comm_pending_tests","project":P}).get("jobs",[]):
        if j.get("path","").endswith(".md"):
            c=j["files"].get(j["path"],""); ok=len(c.strip())>=200; code,out,ts=(0 if ok else 1),"doc-check: %d chars (plan docs are checked for content, not unit-tested)"%len(c),{"tests":1,"pass":int(ok),"fail":int(not ok)}
        elif "test.js" not in j["files"]:
            print("TEST merge#%s waiting: no test.js yet"%j["merge_id"]); continue
        else:
            code,out,ts=run(j["files"]); ok=code==0 and ts["tests"]>0 and ts["fail"]==0
        print("TEST merge#%s exit=%s tests=%s fail=%s -> %s"%(j["merge_id"],code,ts["tests"],ts["fail"],"PASS" if ok else "FAIL")); call({"action":"comm_test_result","merge_id":j["merge_id"],"pass":ok,"exit":code,"output":out,"tests":ts})
    print("ROUND %d main=%s complete=%s tokens_total=%d"%(i+1,t.get("main"),t.get("complete"),tot))
    if t.get("complete"): break
    if any("429" in str(a.get("error","")) for a in t.get("agents",[])): print("quota hit, stopping"); break
print("PROJECT",P,"tokens",tot)
