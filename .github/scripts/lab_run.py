# lb1：實驗工廠執行器。AI 寫的程式只在 docker 容器裡跑：--network none、唯讀檔案系統、256MB 記憶體、1 CPU、64 個行程、20 秒逾時，容器內沒有任何密鑰。
# 公開日誌只印實驗 id、第幾次、通過與否、測試數，不印程式內容。
import json, os, subprocess, tempfile, urllib.request, re, sys
REF="clcddygkaaqqtsbswgdf"; TOKEN=os.environ["TOKEN"]
def mgmt(path):
    r=urllib.request.Request("https://api.supabase.com/v1/projects/%s/%s"%(REF,path),headers={"Authorization":"Bearer "+TOKEN,"User-Agent":"lab"});return json.load(urllib.request.urlopen(r))
SR=[k["api_key"] for k in mgmt("api-keys?reveal=true") if k.get("name")=="service_role"][0]
print("::add-mask::"+SR)
FN="https://%s.supabase.co/functions/v1/dark-star-ebook-ingest?feature=degree"%REF
def call(body):
    r=urllib.request.Request(FN,data=json.dumps(body).encode(),headers={"Authorization":"Bearer "+SR,"apikey":SR,"Content-Type":"application/json"},method="POST")
    try: return json.load(urllib.request.urlopen(r,timeout=150))
    except urllib.error.HTTPError as e: return {"ok":False,"error":"HTTP %d %s"%(e.code,e.read()[:200])}
subprocess.run(["docker","pull","-q","node:20-alpine"],check=True,stdout=subprocess.DEVNULL)
def run(files):
    d=tempfile.mkdtemp()
    for k,v in files.items(): open(os.path.join(d,k),"w").write(v)
    os.chmod(d,0o755)
    cmd=["docker","run","--rm","--network","none","--read-only","--tmpfs","/tmp:size=16m","--memory","256m","--cpus","1","--pids-limit","64","--security-opt","no-new-privileges","--cap-drop","ALL","--user","1000:1000","-v",d+":/w:ro","-w","/w","node:20-alpine","timeout","20","node","--test","--test-reporter=tap","test.js"]
    try: p=subprocess.run(cmd,capture_output=True,text=True,timeout=60); out=(p.stdout+"\n"+p.stderr); code=p.returncode
    except subprocess.TimeoutExpired: out="TIMEOUT (60s)"; code=124
    m=lambda k: int((re.search(r"^# %s (\d+)"%k,out,re.M) or [0,0])[1])
    return code, out[-6000:], {"pass":m("pass"),"fail":m("fail"),"tests":m("tests")}
N=int(os.environ.get("N","1") or 1); BRIEF=os.environ.get("BRIEF","")
for i in range(N):
    body={"action":"lab_start"}
    if BRIEF!="": body["brief"]=int(BRIEF)+i
    if os.environ.get("FORCE")=="1": body["force"]=True
    s=call(body); print("START",{k:s.get(k) for k in ["ok","id","iter","from_learning","error","cap_hit","off"]})
    while s.get("ok") and s.get("files"):
        code,out,t=run(s["files"]); ok=code==0 and t["tests"]>0 and t["fail"]==0
        print("RUN id=%s iter=%s exit=%s tests=%s pass=%s fail=%s -> %s"%(s.get("id"),s.get("iter"),code,t["tests"],t["pass"],t["fail"],"PASS" if ok else "FAIL"))
        r=call({"action":"lab_report","id":s["id"],"pass":ok,"exit":code,"output":out,"tests":t}); print("REPORT",{k:r.get(k) for k in ["ok","status","iter","error"]})
        if r.get("done") or not r.get("ok"): break
        s=dict(r,ok=True)
