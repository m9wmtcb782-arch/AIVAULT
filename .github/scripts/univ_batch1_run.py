#!/usr/bin/env python3
"""University Batch-1 (Base1 only): roster verify, enqueue 20 free-only tasks, learn n=8, floor n=3.
Stops cleanly on Groq 429. No paid APIs. No dual-city transfer.
"""
import json, os, sys, time, urllib.request, urllib.error
from datetime import datetime, timezone, timedelta

REF = "clcddygkaaqqtsbswgdf"
BASE = f"https://{REF}.supabase.co"
TOKEN = os.environ["TOKEN"]
N_LEARN = int(os.environ.get("N_LEARN", "8") or 8)
N_FLOOR = int(os.environ.get("N_FLOOR", "3") or 3)
REPORT = os.environ.get("REPORT_DIR", "univ-batch1-out")
os.makedirs(REPORT, exist_ok=True)
TZ8 = timezone(timedelta(hours=8))
log = []

def L(msg):
    line = f"[{datetime.now(TZ8).strftime('%Y-%m-%d %H:%M:%S')} Asia/Taipei] {msg}"
    print(line, flush=True); log.append(line)

def http(url, data=None, headers=None, method=None):
    body = None if data is None else (data if isinstance(data, (bytes, bytearray)) else json.dumps(data).encode())
    req = urllib.request.Request(url, data=body, headers=dict({"Content-Type": "application/json", "User-Agent": "univ-batch1"}, **(headers or {})), method=method or ("POST" if body is not None else "GET"))
    try:
        with urllib.request.urlopen(req, timeout=180) as r:
            t = r.read().decode()
            return r.status, (json.loads(t) if t else None)
    except urllib.error.HTTPError as e:
        t = e.read().decode(errors="replace")
        try: j = json.loads(t)
        except Exception: j = t[:500]
        return e.code, j

def sql(q):
    # management API SQL
    s, b = http(f"https://api.supabase.com/v1/projects/{REF}/database/query", {"query": q}, {"Authorization": "Bearer " + TOKEN}, "POST")
    if s >= 400: raise RuntimeError(f"SQL {s} {b}")
    return b

_, keys = http(f"https://api.supabase.com/v1/projects/{REF}/api-keys?reveal=true", headers={"Authorization": "Bearer " + TOKEN})
SR = next(k["api_key"] for k in keys if k.get("name") == "service_role")
print("::add-mask::" + SR)
SRH = {"apikey": SR, "Authorization": "Bearer " + SR}

def floor(body):
    return http(BASE + "/functions/v1/dark-star-ebook-ingest?feature=floor", body, SRH, "POST")

def degree(body):
    return http(BASE + "/functions/v1/dark-star-ebook-ingest?feature=degree", body, SRH, "POST")

# --- Load roster from committed report or rebuild from DB ---
roster_path = "reports/university-batch1/roster-100.json"
if not os.path.exists(roster_path):
    roster_path = os.path.join(REPORT, "roster-100.json")

# Prefer live SQL selection matching plan
edu = sql("select id, domain, name, specialty, zone, status from public.aivault_pool_agents where domain='education' and not spawned order by id asc limit 60")
fill_q = """
with ranked as (
  select id, domain, name, specialty, zone, status,
    row_number() over (partition by domain order by id) rn
  from public.aivault_pool_agents
  where not spawned and domain in ('research','coding','writing','data','voice')
)
select id, domain, name, specialty, zone, status from ranked
where (domain='research' and rn<=12) or (domain='coding' and rn<=12)
   or (domain='writing' and rn<=8) or (domain='data' and rn<=4) or (domain='voice' and rn<=4)
order by domain, id
"""
fill = sql(fill_q)
members_db = list(edu) + list(fill)
# dedup
seen=set(); members=[]
for r in members_db:
    if r["id"] in seen: continue
    seen.add(r["id"]); members.append(r)
    if len(members)>=100: break
L(f"roster_live education={len(edu)} fill={len(fill)} selected={len(members)}")

squads=["U-A","U-B","U-C","U-D","U-E"]
roles=["research","code_read","test_log","zh_report","coord"]
roster=[]
for i,r in enumerate(members[:100]):
    roster.append({
        "agent_id": r["id"], "domain": r["domain"], "name": r.get("name"),
        "specialty": r.get("specialty"), "zone": r.get("zone"), "status": r.get("status"),
        "squad_id": squads[i//20], "role": roles[i%5],
    })

# quota check before spend
qs = sql("select k,v from public.aivault_floor_state where k in ('quota:sleep','quota:off','learnround:lock')")
L(f"floor_state {qs}")
sleeping = False
for row in qs or []:
    if row.get("k")=="quota:sleep":
        until = (row.get("v") or {}).get("until")
        if until:
            try:
                from datetime import datetime as dt
                u = dt.fromisoformat(until.replace("Z","+00:00"))
                if u.timestamp() > time.time():
                    sleeping = True; L(f"QUOTA_SLEEP until {until} — stop before enqueue")
            except Exception as e:
                L(f"quota parse {e}")

open(os.path.join(REPORT,"roster-100.live.json"),"w").write(json.dumps({"count":len(roster),"members":roster,"quota_sleeping":sleeping,"at":datetime.now(TZ8).isoformat()},ensure_ascii=False,indent=2))

TASKS = [
  ("research","🎓 大學班 U-A-01 [univ_batch=1]：整理開源即時語音管線（Pipecat／LiveKit／sherpa-onnx）對照表：延遲、授權、能否不上 Gemini Live。只依公開文件，標 CONFIRMED／NOT VERIFIED／BLOCKED。禁止建議付費 API。"),
  ("voice","🎓 大學班 U-A-02 [univ_batch=1]：摘錄 CosyVoice／F5-TTS／Piper 的本地或瀏覽器可行條件與大致檔案大小。禁止建議付費聲線 API。繁中條列。"),
  ("research","🎓 大學班 U-A-03 [univ_batch=1]：寫 barge-in／VAD／EOT 實作檢查清單；註明主城 EOT v1 只判斷講完沒講完、不是對話模型。"),
  ("research","🎓 大學班 U-A-04 [univ_batch=1]：做一頁「停講→首包音訊」延遲預算表；無實機數字就標 REQUIRES TEST，不得捏造毫秒。"),
  ("research","🎓 大學班 U-B-01 [univ_batch=1]：Qwen3-0.6B／1.7B／4B 授權（Apache-2.0）與記憶體需求摘要；標記 SELF_HOSTED_OPEN_WEIGHT／PLANNED，不得寫 AVAILABLE。"),
  ("code","🎓 大學班 U-B-02 [univ_batch=1]：依公開說明列出 Worker 何時才能不用 Groq 的缺口（自有模型／統一推論介面）。只讀已知結論，不呼叫付費 API。"),
  ("code","🎓 大學班 U-B-03 [univ_batch=1]：行動裝置 WebGPU／WASM 推論阻礙清單；iPhone Safari 未測就標未實測。"),
  ("code","🎓 大學班 U-B-04 [univ_batch=1]：草擬統一推論介面（Worker→registry→node）文件大綱，只文件不部署。"),
  ("guard","🎓 大學班 U-C-01 [univ_batch=1]：重述付費閘門：預設禁止、無自動備援、額度不足必須回報。給大學班記憶用的短條文。"),
  ("guard","🎓 大學班 U-C-02 [univ_batch=1]：列出仍可能是 EXTERNAL_API 的功能類別（文字即可），不呼叫任何付費端點。"),
  ("research","🎓 大學班 U-C-03 [univ_batch=1]：撰寫「Groq 429 時大學班應 SLEEPING」操作說明（誰停、誰回報、禁止改付費）。"),
  ("market","🎓 大學班 U-C-04 [univ_batch=1]：寫 Base2 轉影片 key「已接好但禁止花錢」紀律條文，供曙光城施工單引用。"),
  ("research","🎓 大學班 U-D-01 [univ_batch=1]：填一份 handoff 六欄範本（目標／範圍／禁止／限制／成功標準／回報格式）主題＝語音模組交接。"),
  ("code","🎓 大學班 U-D-02 [univ_batch=1]：多代理避免迴圈／重試筆記（公開最佳實務），對照 AIVAULT 可用做法。"),
  ("research","🎓 大學班 U-D-03 [univ_batch=1]：定義大學班 Definition of Done：須有 URL+sha256 或明確 BLOCKED，禁止空話。"),
  ("market","🎓 大學班 U-D-04 [univ_batch=1]：提案 Grok Bot 如何從 pending review 抽 3 份合併成給主人的一頁繁中簡報。"),
  ("research","🎓 大學班 U-E-01 [univ_batch=1]：把語音自建模組學習編成「曙光語音週報」大綱（繁中）。"),
  ("medicine","🎓 大學班 U-E-02 [univ_batch=1]：出 5 題小考題目（即時語音／付費閘門／自有模型），附建議答案要點，不需真的開考。"),
  ("research","🎓 大學班 U-E-03 [univ_batch=1]：整理「100 人心跳看板」欄位：last_success／last_attempt／task_id／SLEEPING 定義。"),
  ("guard","🎓 大學班 U-E-04 [univ_batch=1]：風險說明：為何不能宣稱 100 個獨立 AI（共用 Groq、無自有推論、工具差距）。"),
]

enqueue_results = []
if sleeping:
    L("SKIP enqueue due to quota sleep")
else:
    for zone, text in TASKS:
        # Prefer idle agent from roster in matching domains when possible — floor enqueue picks zone idle
        s, b = floor({"action": "enqueue", "zone": zone, "text": text})
        ok = isinstance(b, dict) and b.get("ok")
        tid = (b.get("task") or {}).get("id") if isinstance(b, dict) else None
        aid = (b.get("task") or {}).get("agent_id") if isinstance(b, dict) else None
        enqueue_results.append({"zone": zone, "http": s, "ok": ok, "task_id": tid, "agent_id": aid, "error": None if ok else str(b)[:300], "title": text[:40]})
        L(f"ENQUEUE {zone} http={s} ok={ok} task={tid} agent={aid}")
        if s == 429 or (isinstance(b, dict) and "429" in str(b)):
            L("STOP enqueue on 429"); break
        time.sleep(0.4)

open(os.path.join(REPORT,"enqueue.json"),"w").write(json.dumps(enqueue_results,ensure_ascii=False,indent=2))

# Learn round n=8 (voice/selfdev curriculum already free-only)
learn_out = {}
if not sleeping:
    # first: force_selfdev for own-model topics
    s, b = degree({"action": "learn_round", "n": min(4, N_LEARN), "force_selfdev": True})
    learn_out["selfdev"] = {"http": s, "summary": {k: (b or {}).get(k) for k in ("ok","used","budget","budget_hit","rate_limited","skipped_locked","off","holiday_rest","skipped_round")} if isinstance(b, dict) else str(b)[:300],
                            "results": [{"district": r.get("district"), "agent": r.get("agent"), "topic": r.get("topic"), "usage_total": (r.get("usage") or {}).get("total"), "error": (r.get("error") or "")[:120], "pages": [p.get("src") for p in (r.get("pages") or [])]} for r in ((b or {}).get("results") or [])] if isinstance(b, dict) else []}
    L(f"LEARN selfdev http={s} {learn_out['selfdev']['summary']}")
    rl = bool(isinstance(b, dict) and (b.get("rate_limited") or "429" in str(b)))
    if rl:
        L("STOP learn on rate_limit after selfdev")
    else:
        s2, b2 = degree({"action": "learn_round", "n": max(0, N_LEARN - 4)})
        learn_out["voiceish"] = {"http": s2, "summary": {k: (b2 or {}).get(k) for k in ("ok","used","budget","budget_hit","rate_limited","skipped_locked","off","holiday_rest","skipped_round")} if isinstance(b2, dict) else str(b2)[:300],
                                 "results": [{"district": r.get("district"), "agent": r.get("agent"), "topic": r.get("topic"), "usage_total": (r.get("usage") or {}).get("total"), "error": (r.get("error") or "")[:120], "pages": [p.get("src") for p in (r.get("pages") or [])]} for r in ((b2 or {}).get("results") or [])] if isinstance(b2, dict) else []}
        L(f"LEARN general http={s2} {learn_out['voiceish']['summary']}")
        if isinstance(b2, dict) and b2.get("rate_limited"):
            L("STOP learn on rate_limit after general")
else:
    learn_out = {"skipped": "quota_sleep"}

open(os.path.join(REPORT,"learn.json"),"w").write(json.dumps(learn_out,ensure_ascii=False,indent=2))

# Floor cycle n=3 (will prefer owner/command and queued univ tasks by created_at; command priority if plan.command — our enqueue has no command so FIFO)
floor_cycles = []
if not sleeping:
    for k in range(1, 2):  # one cycle wave with n=N_FLOOR
        s, b = floor({"action": "cycle", "n": N_FLOOR})
        ok = isinstance(b, dict)
        entry = {"k": k, "http": s, "done": b.get("done") if ok else None, "rate_limited": b.get("rate_limited") if ok else None,
                 "results": [{"agent": r.get("agent"), "zone": r.get("zone"), "model": r.get("model"), "usage_total": (r.get("usage") or {}).get("total"), "error": (r.get("error") or "")[:200]} for r in (b.get("results") or [])] if ok else str(b)[:400]}
        floor_cycles.append(entry)
        L(f"FLOOR cycle http={s} done={entry['done']} rl={entry['rate_limited']} results={len(entry['results']) if isinstance(entry['results'], list) else entry['results']}")
        if not ok or s != 200:
            break
        if entry.get("rate_limited"):
            errs = " ".join(str(r.get("error")) for r in (entry["results"] if isinstance(entry["results"], list) else []))
            L(f"STOP floor on rate_limit {errs[:300]}")
            break
else:
    floor_cycles = [{"skipped": "quota_sleep"}]

open(os.path.join(REPORT,"floor.json"),"w").write(json.dumps(floor_cycles,ensure_ascii=False,indent=2))

# Snapshot queued univ tasks + recent learning by roster
ids = ",".join("'"+m["agent_id"]+"'" for m in roster)
univ_tasks = sql(f"select id, agent_id, zone, status, review_status, left(order_text,80) title, updated_at from public.aivault_pool_agent_tasks where source='floor' and order_text like '%univ_batch=1%' order by created_at desc limit 40")
recent_learn = sql(f"select agent_id, topic, http_status, left(url,120) url, model, usage, created_at from public.aivault_pool_agent_learning where created_at > now()-interval '2 hours' order by created_at desc limit 30")
quota2 = sql("select k,v from public.aivault_floor_state where k like 'quota:%'")
open(os.path.join(REPORT,"snapshot.json"),"w").write(json.dumps({"univ_tasks":univ_tasks,"recent_learn":recent_learn,"quota":quota2},ensure_ascii=False,indent=2,default=str))

summary = {
    "batch": "university-batch1",
    "base_id": "base-001",
    "at_taipei": datetime.now(TZ8).isoformat(),
    "roster_count": len(roster),
    "enqueued_ok": sum(1 for x in enqueue_results if x.get("ok")),
    "enqueued_total": len(enqueue_results),
    "quota_sleeping_at_start": sleeping,
    "learn": {k: v.get("summary") if isinstance(v, dict) else v for k,v in learn_out.items()},
    "floor_cycles": [{"http": c.get("http"), "done": c.get("done"), "rate_limited": c.get("rate_limited"), "n_results": len(c["results"]) if isinstance(c.get("results"), list) else 0} for c in floor_cycles],
    "univ_tasks_in_db": len(univ_tasks or []),
    "dual_city_transfer": False,
    "paid_api": False,
}
open(os.path.join(REPORT,"summary.json"),"w").write(json.dumps(summary,ensure_ascii=False,indent=2))
open(os.path.join(REPORT,"run.log"),"w").write("\n".join(log)+"\n")
L(f"SUMMARY {json.dumps(summary,ensure_ascii=False)}")
print("UNIV_BATCH1_DONE", summary["enqueued_ok"], "/", summary["enqueued_total"], "univ_tasks", summary["univ_tasks_in_db"])
