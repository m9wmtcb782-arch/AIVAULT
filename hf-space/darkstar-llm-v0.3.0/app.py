"""暗星 (technical-dark-star) own-model router for a FREE Gradio-SDK HF Space (CPU basic).
On startup: download llama.cpp b12649 prebuilt CPU binary + Qwen3-1.7B Q8_0 (pinned revision, sha256-verified), run llama-server on 127.0.0.1:8091.
Own model answers (route=local) or returns route=escalate so the caller uses its existing Gemini path.
This service never calls Gemini or any paid API and holds no secrets."""
import os, json, time, uuid, math, re, threading, subprocess, collections, hmac
import hashlib, tarfile, shutil, sys
import httpx, psutil
import spaces  # ZeroGPU runtime requires >=1 @spaces.GPU function; no-op off HF
import gradio as gr
from huggingface_hub import hf_hub_download
from fastapi import APIRouter, HTTPException, Request
from starlette.middleware import Middleware
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from opencc import OpenCC

APP = os.getenv("APP_DIR", os.path.dirname(os.path.abspath(__file__)))
WORK = os.getenv("WORK_DIR", "/tmp/darkstar")
LLAMA_TAG = "b12649"
LLAMA_URL = f"https://github.com/ggml-org/llama.cpp/releases/download/{LLAMA_TAG}/llama-{LLAMA_TAG}-bin-ubuntu-x64.tar.gz"
MODEL_REPO, MODEL_FILE = "Qwen/Qwen3-1.7B-GGUF", "Qwen3-1.7B-Q8_0.gguf"
MODEL_REV = "90862c4b9d2787eaed51d12237eafdfe7c5f6077"
MODEL_SHA = "061b54daade076b5d3362dac252678d17da8c68f07560be70818cace6590cb1a"
BIN = os.getenv("LLAMA_BIN", f"{WORK}/llama-{LLAMA_TAG}")
MODEL = os.getenv("MODEL_PATH", "")
THREADS, CTX = os.getenv("THREADS", "2"), int(os.getenv("CTX", "4096"))
MANIFEST = json.load(open(f"{APP}/manifest.json", encoding="utf-8"))
MEMORY = json.load(open(f"{APP}/memory.json", encoding="utf-8"))
AGENT_ID, ALIASES, NAMESPACE = "technical-dark-star", {"technical-dark-star", "darkstar"}, "agent-memory-darkstar"
LLAMA = "http://127.0.0.1:8091"
MAX_INPUT_CHARS, MAX_TOKENS_CAP, REPLY_BUDGET = 1000, 768, 768
RATE_PER_MIN, RATE_PER_DAY = int(os.getenv("RATE_PER_MIN", "6")), int(os.getenv("RATE_PER_DAY", "150"))
CONF_THRESHOLD = 0.55
SYSTEM = ("你的名字是暗星（Technical Dark Star），AIVAULT 第一基地的數位人；被問到你是誰或請你自我介紹時，一定要說「我是暗星」。一律使用繁體中文回答，語氣冷靜、精準、簡潔。"
          "只有在你確實不知道答案、需要最新資訊或需要引用具體法條／判決字號時，才在最後一行單獨輸出 [ESCALATE]；一般問題不要輸出這個標記。")
cc = OpenCC("s2tw")   # character-level only; s2twp rewrote words (類型→型別)
router = APIRouter()   # JSON routes are injected into Gradio's own FastAPI app (registered before Gradio's routes)
CORS = Middleware(CORSMiddleware, allow_origins=["https://m9wmtcb782-arch.github.io"],
                  allow_origin_regex=r"http://(localhost|127\.0\.0\.1)(:\d+)?", allow_methods=["GET", "POST"], allow_headers=["content-type"])
state = {"restarts": 0, "started": time.time(), "want": True, "phase": "starting", "error": None}
gen_lock = threading.Semaphore(1)       # one generation at a time on 2 vCPU
sessions = collections.OrderedDict()
hits = collections.defaultdict(collections.deque)

def alive():
    try: return httpx.get(f"{LLAMA}/health", timeout=2).status_code == 200
    except Exception: return False

def start_llama():
    subprocess.Popen([f"{BIN}/llama-server", "-m", MODEL, "--host", "127.0.0.1", "--port", "8091", "-c", str(CTX),
                      "-t", THREADS, "-np", "1", "--jinja", "-a", MANIFEST["model_key"]],
                     env=dict(os.environ, LD_LIBRARY_PATH=BIN), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for _ in range(240):
        if alive(): return True
        time.sleep(0.5)
    return False

def prepare():
    global MODEL
    os.makedirs(WORK, exist_ok=True)
    if not os.path.exists(f"{BIN}/llama-server"):
        state["phase"] = "downloading llama.cpp"; tgz = f"{WORK}/llama.tgz"
        with httpx.stream("GET", LLAMA_URL, follow_redirects=True, timeout=300) as r, open(tgz, "wb") as f:
            r.raise_for_status(); [f.write(c) for c in r.iter_bytes(1 << 20)]
        with tarfile.open(tgz) as t: t.extractall(WORK)
        os.remove(tgz)
    if not MODEL:
        state["phase"] = "downloading model"
        MODEL = hf_hub_download(MODEL_REPO, MODEL_FILE, revision=MODEL_REV)
    state["phase"] = "verifying sha256"; h = hashlib.sha256()
    with open(MODEL, "rb") as f:
        for c in iter(lambda: f.read(1 << 24), b""): h.update(c)
    if h.hexdigest() != MODEL_SHA: raise RuntimeError("model sha256 mismatch")
    state["phase"] = "loading"

def watchdog():
    try: prepare()
    except Exception as e:
        state["phase"], state["error"] = "failed", f"{type(e).__name__}: {e}"[:300]; state["want"] = False; return
    if not start_llama():
        state["error"] = "llama-server did not become healthy (binary/glibc issue?)"
    state["phase"] = "ready" if alive() else "degraded"
    while True:
        time.sleep(10)
        if state["want"] and not alive():
            state["restarts"] += 1; start_llama()
threading.Thread(target=watchdog, daemon=True).start()

def grams(s): s = re.sub(r"\s+", "", s); return {s[i:i+2] for i in range(len(s)-1)}
def memory_search(q, k=3):
    qg, out = grams(q), []
    for m in MEMORY:
        if m.get("namespace") != NAMESPACE or m.get("agent_id") not in ALIASES or not m.get("active", True): continue
        out.append((len(qg & grams(m["content"])) / (len(qg) + 1e-9) + 0.1*m.get("importance", 0), m))
    return [m for s, m in sorted(out, key=lambda x: -x[0])[:k] if s > 0.15]

LEGAL = ["法", "條", "契約", "侵權", "刑", "民", "憲", "訴訟", "責任", "要件", "管轄", "判決"]
REASONING = re.compile(
    r"(比.{0,8}(高|矮|大|小|多|少|快|慢|重|輕|長|短|早|晚|老|年輕|強|弱|貴|便宜)|誰最|哪.{0,3}最|最(高|矮|大|小|多|少)的是"
    r"|推理|推論|推斷|如果.{0,40}(那麼|則|會|呢)|假如|假設|若.{0,20}則|因此|所以.{0,10}(是否|嗎)"
    r"|幾(個|隻|人|天|次|歲|元|塊|本|題|種)|多少|計算|算一下|算出|等於|總共|合計|平均|機率|百分之|比例|倍"
    r"|[0-9０-９零一二兩三四五六七八九十百千萬]+\s*(加|減|乘|除|[-+*/×÷=^％%])\s*[0-9０-９零一二兩三四五六七八九十百千萬]"
    r"|因果|原因.{0,6}結果|比較|對比|差異|異同|證明|判斷|為什麼|邏輯|是否一定|一定.{0,6}嗎|矛盾|排序|順序)")
LEGAL_TOPIC = re.compile(r"(法律|法條|法規|民法|刑法|憲法|商法|公司法|勞基法|勞動|契約|合約|侵權|債務|債權|時效|訴訟|判決|判例|起訴|告訴|賠償|罰|違法|合法|權利|義務|請求權|繼承|遺囑|離婚|監護|租賃|借貸|著作權|專利|商標|押金|租屋|房東|房客|欠款|欠錢|討債|法院|律師|警察|罰單|糾紛|退費|退款|理賠|詐騙|違約)")
FRESH = re.compile(r"(跨國|多國|國際私法|最新|即時|新聞|股價|匯率|天氣|比賽結果|現在幾點|(今天|今日|明天|昨天)(是)?(幾號|幾月|星期|禮拜|日期|發生)|第.{1,5}條)")

def pre_route(q):
    """Decide BEFORE generating whether this needs the advisor. The free CPU cannot run thinking mode within the
    front-end 20 s budget, and logprob confidence proved unreliable (live bug: '甲比乙高，乙比丙高，誰最矮？' -> '甲最矮', conf 0.983)."""
    if FRESH.search(q): return "needs_fresh_or_citation"
    if LEGAL_TOPIC.search(q) or sum(q.count(w) for w in LEGAL) >= 3: return "legal_review"
    if REASONING.search(q): return "reasoning_or_math"
    return None

def rate_ok(ip):
    now, d = time.time(), hits[ip]
    while d and now - d[0] > 86400: d.popleft()
    if len(d) >= RATE_PER_DAY or sum(1 for t in d if now - t < 60) >= RATE_PER_MIN: return False
    d.append(now); return True

class InferIn(BaseModel):
    text: str
    session_id: str = "web"
    agent_id: str = AGENT_ID
    max_tokens: int = 512

@router.get("/health")
def health():
    return {"service": "ok", "model_loaded": alive(), "model": MANIFEST["model_key"], "version": MANIFEST["version"],
            "agent_id": AGENT_ID, "pool_mode": bool(POOL_KEY), "queue_waiting": queue["waiting"], "phase": state["phase"], "error": state["error"], "restarts": state["restarts"], "uptime_s": int(time.time() - state["started"])}

@router.get("/stats")
def stats():
    vm = psutil.virtual_memory(); d = {"cpu_percent": psutil.cpu_percent(0.3), "ram_used_mb": (vm.total - vm.available)//2**20, "ram_total_mb": vm.total//2**20}
    for p in psutil.process_iter(["name", "memory_info"]):
        if p.info["name"] == "llama-server" and p.info["memory_info"]: d["llama_rss_mb"] = max(d.get("llama_rss_mb", 0), p.info["memory_info"].rss//2**20)
    return d

@router.post("/infer")
def infer(inp: InferIn, request: Request):
    ip = (request.headers.get("x-forwarded-for") or (request.client.host if request.client else "?")).split(",")[0].strip()
    if inp.agent_id not in ALIASES: raise HTTPException(403, "this service serves 暗星 only")
    text = (inp.text or "").strip()
    if not text: raise HTTPException(400, "empty input")
    if len(text) > MAX_INPUT_CHARS: raise HTTPException(413, f"input over {MAX_INPUT_CHARS} chars")
    if not rate_ok(ip): raise HTTPException(429, "rate limited")
    rid, t0 = str(uuid.uuid4()), time.time()
    rec = {"id": rid, "agent_id": AGENT_ID, "model_key": MANIFEST["model_key"], "version": MANIFEST["version"], "weights_sha256": MANIFEST["weights_sha256"]}
    why = pre_route(text)
    if why: return {**rec, "route": "escalate", "reason": why, "output": None, "latency_ms": int((time.time()-t0)*1000), "cost_usd": 0}
    if not alive(): return {**rec, "route": "escalate", "reason": "model_unavailable", "output": None, "latency_ms": 0, "cost_usd": 0}
    if not gen_lock.acquire(timeout=1): return {**rec, "route": "escalate", "reason": "busy", "output": None, "latency_ms": 0, "cost_usd": 0}
    try:
        mems = memory_search(text)
        sid = inp.session_id[:64]; hist = sessions.setdefault(sid, []); sessions.move_to_end(sid)
        while len(sessions) > 200: sessions.popitem(last=False)
        sys = SYSTEM + ("\n暗星記憶（" + NAMESPACE + "）：\n" + "\n".join("- " + m["content"] for m in mems) if mems else "")
        budget, kept = (CTX - REPLY_BUDGET - len(sys) - len(text)), []      # chars ≈ tokens upper bound for CJK
        for m in reversed(hist):
            if budget - len(m["content"]) < 0: break
            budget -= len(m["content"]); kept.insert(0, m)
        think = False   # reasoning-type questions are escalated before generation (CPU too slow for thinking mode)
        body = {"messages": [{"role": "system", "content": sys}] + kept + [{"role": "user", "content": text}],
                "max_tokens": max(64, min(inp.max_tokens, MAX_TOKENS_CAP)), "temperature": 0.6, "logprobs": True, "top_logprobs": 1,
                "chat_template_kwargs": {"enable_thinking": think}}
        j = httpx.post(f"{LLAMA}/v1/chat/completions", json=body, timeout=120).json()
        ch = j["choices"][0]
        out = cc.convert(re.sub(r"<think>.*?</think>", "", ch["message"].get("content") or "", flags=re.S).strip())
        lp = [c["logprob"] for c in ((ch.get("logprobs") or {}).get("content") or [])]
        conf = round(math.exp(sum(lp)/len(lp)), 3) if lp else None
        esc = "[ESCALATE]" in out; out = out.replace("[ESCALATE]", "").strip()
        route, reason = "local", None
        if esc: route, reason = "escalate", "model_unsure"
        elif not out: route, reason = "escalate", "empty_output"
        elif conf is not None and conf < CONF_THRESHOLD: route, reason = "escalate", f"low_confidence:{conf}"
        if route == "local": hist += [{"role": "user", "content": text}, {"role": "assistant", "content": out}]
        return {**rec, "route": route, "reason": reason, "output": out if route == "local" else None, "draft": out if route != "local" else None,
                "confidence": conf, "thinking": think, "memory_ids": [m["id"] for m in mems], "usage": j.get("usage", {}),
                "latency_ms": int((time.time()-t0)*1000), "cost_usd": 0}
    except Exception as e:
        return {**rec, "route": "escalate", "reason": f"error:{type(e).__name__}", "output": None, "latency_ms": int((time.time()-t0)*1000), "cost_usd": 0}
    finally:
        gen_lock.release()



# ---------------- v0.3.0 pool mode (backend pool bots only; 暗星 must NOT use this) ----------------
POOL_KEY = os.getenv("DARKSTAR_POOL_KEY", "")          # HF Space secret; same value as Supabase function secret
QUEUE_CAP = int(os.getenv("QUEUE_CAP", "4"))            # global cap on waiting pool requests
queue = {"waiting": 0}; qlock = threading.Lock()
POOL_AGENT = re.compile(r"^[A-Za-z0-9:_.-]{1,64}$")
POOL_SYSTEM = "你是 AIVAULT 協作池的後台代理，一律使用繁體中文，簡潔、具體、不編造。不知道就說不知道。"
TASKS = {"answer", "summarize", "draft_post", "draft_sentence", "rewrite", "json", "chunk_digest", "review_sentence"}

class TaskIn(BaseModel):
    task: str
    agent_id: str
    text: str = ""
    system: str | None = None
    sources: list | None = None
    max_tokens: int = 400
    meta: dict | None = None

def pool_ok(request):
    k = request.headers.get("x-darkstar-pool-key", "")
    return bool(POOL_KEY) and bool(k) and hmac.compare_digest(k.encode(), POOL_KEY.encode())

def _gen(messages, max_tokens, schema=None):
    body = {"messages": messages, "max_tokens": max(32, min(max_tokens, 1024)), "temperature": 0.4,
            "chat_template_kwargs": {"enable_thinking": False}}
    if schema is not None: body["response_format"] = {"type": "json_object", "schema": schema}
    j = httpx.post(f"{LLAMA}/v1/chat/completions", json=body, timeout=150).json()
    txt = re.sub(r"<think>.*?</think>", "", j["choices"][0]["message"].get("content") or "", flags=re.S).strip()
    return txt, j.get("usage", {})

def _src(sources):
    out = []
    for s in (sources or [])[:8]:
        if not isinstance(s, dict): continue
        u = str(s.get("url") or "")
        if not re.match(r"^https?://", u): continue
        out.append({"title": str(s.get("title") or "")[:160], "url": u[:500], "snippet": str(s.get("snippet") or "")[:400]})
    return out

@router.post("/task")
def task(inp: TaskIn, request: Request):
    if not pool_ok(request): raise HTTPException(403, "pool key required")
    if inp.task not in TASKS: raise HTTPException(400, "unknown task")
    if not POOL_AGENT.match(inp.agent_id or "") or inp.agent_id in ALIASES: raise HTTPException(403, "pool agents only (暗星 does not use the small model)")
    text = (inp.text or "").strip()
    if len(text) > 6000: raise HTTPException(413, "input over 6000 chars")
    t0 = time.time()
    rec = {"id": str(uuid.uuid4()), "task": inp.task, "agent_id": inp.agent_id, "model_key": MANIFEST["model_key"], "version": MANIFEST["version"], "cost_usd": 0}
    if inp.task == "answer":
        why = pre_route(text)
        if why: return {**rec, "ok": False, "route": "escalate", "reason": why, "latency_ms": 0}
    if not alive(): return {**rec, "ok": False, "route": "escalate", "reason": "model_unavailable", "latency_ms": 0}
    with qlock:
        if queue["waiting"] >= QUEUE_CAP: return {**rec, "ok": False, "route": "escalate", "reason": "queue_full", "latency_ms": 0}
        queue["waiting"] += 1
    got = False
    try:
        got = gen_lock.acquire(timeout=90)
        if not got: return {**rec, "ok": False, "route": "escalate", "reason": "busy", "latency_ms": int((time.time()-t0)*1000)}
        src = _src(inp.sources); res = {}
        if inp.task == "answer":
            out, usage = _gen([{"role": "system", "content": POOL_SYSTEM + "回答限 150 字內。"}, {"role": "user", "content": text}], min(inp.max_tokens, 300))
            res = {"output": cc.convert(out)}
        elif inp.task == "rewrite":
            out, usage = _gen([{"role": "system", "content": (inp.system or POOL_SYSTEM) + "只輸出改寫後的文字。"}, {"role": "user", "content": text}], min(inp.max_tokens, 700))
            res = {"output": cc.convert(out)}
        elif inp.task == "draft_sentence":   # t283：一句話留言，短輸出（約 40 tokens）
            ctx = "\n".join(f"- {s['title']}：{s['snippet'][:120]}" for s in src[:3])
            sysm = POOL_SYSTEM + "寫一句留言板短評（繁體中文，一句話，40 字內，不含網址、不含個人資料、不誇大、不做法律或醫療建議）。只輸出那一句。"
            out, usage = _gen([{"role": "system", "content": sysm}, {"role": "user", "content": f"主題：{text}" + (f"\n參考：\n{ctx}" if ctx else "")}], min(max(inp.max_tokens, 24), 48))
            one = re.split(r"(?<=[。！？!?])", cc.convert(out).strip().strip('「」"'))[0].strip()
            res = {"output": one[:80], "sources": src[:3]}
        elif inp.task in ("summarize", "draft_post"):
            if not src: raise HTTPException(400, "sources required")
            ctx = "\n".join(f"[{i+1}] {s['title']}：{s['snippet']}" for i, s in enumerate(src))
            if inp.task == "summarize":
                schema = {"type": "object", "properties": {"summary": {"type": "string"}, "used": {"type": "array", "items": {"type": "integer"}}}, "required": ["summary", "used"]}
                sysm = POOL_SYSTEM + "只根據使用者提供的來源寫摘要（200 字內），句尾用 [編號] 標註出處；來源沒寫的內容不要寫。輸出 JSON。"
            else:
                schema = {"type": "object", "properties": {"post": {"type": "string"}, "used": {"type": "array", "items": {"type": "integer"}}}, "required": ["post", "used"]}
                sysm = POOL_SYSTEM + "根據來源寫一則留言板貼文（繁體中文，最多 200 字，不含網址、不含個人資料、不誇大、不做法律或醫療建議），並列出用到的來源編號。輸出 JSON。"
            out, usage = _gen([{"role": "system", "content": sysm}, {"role": "user", "content": f"主題：{text}\n來源：\n{ctx}"}], min(inp.max_tokens, 600), schema)
            v = json.loads(out)
            used = [i for i in (v.get("used") or []) if isinstance(i, int) and 1 <= i <= len(src)] or list(range(1, len(src)+1))
            key = "summary" if inp.task == "summarize" else "post"
            body = cc.convert(str(v.get(key) or "")).strip()
            if inp.task == "draft_post": body = body[:280]
            res = {"output": body, "sources": [src[i-1] for i in sorted(set(used))]}   # URLs come from the input, never from the model
        elif inp.task == "chunk_digest":   # t295：長章節切塊摘要（只根據原文）
            sysm = POOL_SYSTEM + "用 2 句話（80 字內）摘要這段小說原文的事件與人物，只根據原文，不評論、不編造。只輸出摘要。"
            out, usage = _gen([{"role": "system", "content": sysm}, {"role": "user", "content": text}], min(max(inp.max_tokens, 60), 160))
            res = {"output": cc.convert(out).strip()[:200]}
        elif inp.task == "review_sentence":   # t295：讀完章節（或指定片段）後寫一句書評，並引用原文片段證明讀過
            m = inp.meta or {}
            schema = {"type": "object", "properties": {"review": {"type": "string"}, "quote": {"type": "string"}}, "required": ["review", "quote"]}
            sysm = POOL_SYSTEM + ("你是讀者，剛讀完下面的小說原文。寫一句書評（繁體中文，一句話，50 字內，具體提到內容，"
                    "不劇透結局、不人身攻擊、不含網址與個人資料），並從原文逐字摘出一小段（8 到 30 字）作為引用。輸出 JSON：{\"review\":…,\"quote\":…}")
            head = f"書名：《{str(m.get('title',''))[:60]}》第 {int(m.get('ch') or 0)} 章\n評論角度：{str(m.get('angle',''))[:40]}"
            if m.get("digest"): head += f"\n全章摘要：{str(m['digest'])[:600]}"
            out, usage = _gen([{"role": "system", "content": sysm}, {"role": "user", "content": head + "\n原文：\n" + text}], min(max(inp.max_tokens, 80), 200), schema)
            v = json.loads(out)
            rv = re.split(r"(?<=[。！？!?])", cc.convert(str(v.get("review") or "")).strip().strip('「」"'))[0].strip()[:90]
            qt = cc.convert(str(v.get("quote") or "")).strip().strip('「」"')[:60]
            nz = lambda x: re.sub(r"[\s，。、！？!?,.：:；;「」『』“”\"]", "", x)
            res = {"output": rv, "quote": qt, "quote_found": bool(qt) and nz(qt) in nz(text)}
        else:  # json: generic JSON completion for simple backend steps
            out, usage = _gen([{"role": "system", "content": (inp.system or POOL_SYSTEM)}, {"role": "user", "content": text}], inp.max_tokens, {"type": "object"})
            v = json.loads(out)
            res = {"json": json.loads(cc.convert(json.dumps(v, ensure_ascii=False)))}
        if not (res.get("output") or res.get("json")): return {**rec, "ok": False, "route": "escalate", "reason": "empty_output", "latency_ms": int((time.time()-t0)*1000)}
        return {**rec, "ok": True, "route": "local", **res, "usage": usage, "latency_ms": int((time.time()-t0)*1000)}
    except HTTPException: raise
    except Exception as e:
        return {**rec, "ok": False, "route": "escalate", "reason": f"error:{type(e).__name__}", "latency_ms": int((time.time()-t0)*1000)}
    finally:
        if got: gen_lock.release()
        with qlock: queue["waiting"] -= 1

def ui_ask(msg):
    if not msg or not msg.strip(): return "請輸入問題。"
    class R:  # minimal stand-in so the UI shares the same rate limit bucket "ui"
        headers = {}; client = None
    try: d = infer(InferIn(text=msg), R())
    except HTTPException as e: return f"錯誤：{e.detail}"
    if d["route"] == "local": return f"{d['output']}\n\n—— 暗星自有模型 {d['model_key']} {d['version']}｜{d['latency_ms']} ms"
    return f"（此題升級給 Gemini 處理：{d.get('reason')}。本 Space 不呼叫 Gemini。）"

@spaces.GPU(duration=10)
def gpu_probe(x):
    """Registered for ZeroGPU startup check only. The model itself runs on CPU via llama-server."""
    return x

with gr.Blocks(title="暗星自有模型") as demo:
    gr.Markdown("# 🌑 暗星（technical-dark-star）自有模型\nQwen3-1.7B Q8_0 · llama.cpp CPU · JSON API：`GET /health`、`POST /infer`")
    q = gr.Textbox(label="問題", lines=3); a = gr.Textbox(label="回答", lines=8)
    gr.Button("送出").click(ui_ask, q, a)
    with gr.Row(visible=False):
        _pi = gr.Textbox(); _po = gr.Textbox(); _pb = gr.Button("probe")
    _pb.click(gpu_probe, _pi, _po)

if __name__ == "__main__":
    # Gradio's own CORS middleware sits outermost and answers preflights itself (allowing only localhost/same host).
    # It defers when the app already configures Starlette CORSMiddleware; tell it so, so our allow-list (github.io) governs.
    from gradio import route_utils
    route_utils.CustomCORSMiddleware.parent_configures_cors = lambda self: True
    demo.launch(server_name="0.0.0.0", ssr_mode=False, app_kwargs={"routes": list(router.routes), "middleware": [CORS]})
