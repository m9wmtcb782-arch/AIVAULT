"""盤點＋接線工具：python3 inventory.py <repo_root> <base1|base2> [--wire]
每個程式：類型、角色（首行註解/標題）、輸入/輸出（啟發式）、器官（sensory/motor/memory/reflex/cortex）、接線狀態與原因。
--wire：只在目前分支上修改檔案（插入 flag-off 的 SDK 掛勾），不碰任何線上系統。"""
import os, re, sys, json, subprocess, shutil
root, base = sys.argv[1], sys.argv[2]; WIRE = "--wire" in sys.argv
SDK = os.path.join(os.path.dirname(__file__), "..", "sdk")
files = subprocess.check_output(["git", "-C", root, "ls-files"], text=True).splitlines()
PROG_EXT = (".html", ".htm", ".js", ".mjs", ".ts", ".tsx", ".py", ".sql", ".onnx", ".sh")
def excluded(p):
    l = p.lower()
    if "node_modules/" in l: return "vendored dependency"
    if l.startswith("vendor/") or "/vendor/" in l or l.endswith(".min.js"): return "vendored third-party code"
    if l.startswith("backups/") or "/backups/" in l or "/backup" in l: return "backup copy, not live"
    if l.startswith("neural/") or "services/nervous-system/" in l or l.endswith("_shared/neural-bus.ts"): return "nervous-system SDK itself"
    return None
def is_prog(p): return p.endswith(PROG_EXT) or (p.startswith(".github/workflows/") and p.endswith((".yml", ".yaml")))
def read(p):
    try: return open(os.path.join(root, p), encoding="utf-8", errors="ignore").read()
    except Exception: return ""
def kind(p):
    if p.startswith(".github/workflows/"): return "workflow"
    if p.endswith(".sql"): return "migration/sql"
    if p.endswith(".onnx"): return "onnx_model"
    if "supabase/functions/" in p and p.endswith(".ts"): return "edge_entry" if p.endswith("/index.ts") else "edge_module"
    if p.endswith((".html", ".htm")): return "frontend_page"
    if p.startswith("services/") or "/services/" in p: return "service"
    if p.endswith((".js", ".mjs")): return "frontend_js" if not p.startswith((".github/", "scripts/", "tools/", "tests/")) else "script"
    if p.endswith(".py"): return "script/py"
    return "script"
def role(p, s):
    m = re.search(r"<title>(.*?)</title>", s, re.S | re.I)
    if m and m.group(1).strip(): return m.group(1).strip()[:80]
    m = re.search(r"^\s*name:\s*(.+)$", s, re.M) if p.endswith((".yml", ".yaml")) else None
    if m: return m.group(1).strip()[:80]
    for line in s.splitlines()[:6]:
        t = re.sub(r"^\s*(//+|#+|--+|/\*+|\*+|<!--)\s*", "", line).strip()
        if len(t) > 6 and not t.startswith(("import", "export", "<!DOCTYPE", "<html", "use ", '"use', "!")): return t[:80]
    return os.path.basename(p)
def io(s):
    ins, outs = [], []
    if re.search(r"<input|<textarea|addEventListener\(['\"](click|submit|keydown|input)", s): ins.append("user_input")
    if "getUserMedia" in s: ins.append("mic/camera")
    if re.search(r"Deno\.serve|serve\(", s): ins.append("http_request")
    if re.search(r"on:\s*\n|schedule:|workflow_dispatch|cron", s): ins.append("trigger/cron")
    for m in set(re.findall(r"functions/v1/([a-z0-9\-_]+)", s)): outs.append("edge:" + m)
    tabs = set(re.findall(r"\.from\(['\"]([a-z0-9_]+)['\"]\)", s)) | set(re.findall(r"rest/v1/([a-z0-9_]+)", s))
    for t in list(tabs)[:8]: outs.append("table:" + t)
    for m in set(re.findall(r"rpc\(['\"]([a-z0-9_]+)['\"]", s)): outs.append("rpc:" + m)
    if re.search(r"api\.groq\.com|generativelanguage|openai|anthropic|x\.ai", s): outs.append("llm_api")
    if re.search(r"create table", s, re.I): outs.append("ddl")
    if re.search(r"innerHTML|appendChild|textContent|canvas", s): outs.append("ui_render")
    return ins, outs
def organ(k, ins, outs, s):
    if k == "migration/sql": return "memory"
    if k == "workflow": return "reflex"
    if k == "onnx_model": return "cortex" if "eot" not in s else "reflex"
    if "llm_api" in outs or re.search(r"callModel|orchestrat|router|dispatch|coordinator", s): return "cortex"
    if k.startswith("edge") and any(o.startswith("table:") for o in outs): return "memory" if not ins else "cortex"
    if "user_input" in ins or "mic/camera" in ins: return "sensory"
    if "ui_render" in outs or k == "frontend_page": return "motor"
    if re.search(r"guard|quota|cooldown|retry|kill|LAB_OFF|_OFF", s): return "reflex"
    return "motor"
rows = []; wired_pages = set()
def rel_sdk(p): d = os.path.dirname(p); return (os.path.relpath("neural/neural-bus.js", d) if d else "neural/neural-bus.js").replace(os.sep, "/")
for p in files:
    if not is_prog(p): continue
    ex = excluded(p); k = kind(p); s = read(p) if not p.endswith(".onnx") else ""
    ins, outs = io(s); r = {"path": p, "type": k, "role": role(p, s) if s else os.path.basename(p), "inputs": ins, "outputs": outs, "organ": organ(k, ins, outs, s + p.lower()), "wired": False, "how": "", "why_not": ""}
    if ex: r.update(why_not="excluded: " + ex, organ="—"); rows.append(r); continue
    if k == "frontend_page":
        if "data-neural-program" in s: r.update(wired=True, how="script tag (already)")
        elif re.search(r"</head>", s, re.I):
            r.update(wired=True, how="flag-off <script neural-bus.js> before </head>")
            if WIRE:
                tag = f'\n<script src="{rel_sdk(p)}" data-neural-program="{base}:{p}"></script>'
                raw = open(os.path.join(root, p), "rb").read(); i = raw.lower().find(b"</head>")
                open(os.path.join(root, p), "wb").write(raw[:i] + tag.lstrip("\n").encode() + raw[i:])  # 只插入，不改其他位元組
        else: r["why_not"] = "no </head> tag (fragment/partial page)"
        if r["wired"]: wired_pages.add(p)
    elif k == "edge_entry":
        if re.search(r"Deno\.serve\s*\(", s):
            r.update(wired=True, how="flag-off import ../_shared/neural-bus.ts (wraps Deno.serve)")
            if WIRE and "_shared/neural-bus.ts" not in s:
                depth = p.split("supabase/functions/")[1].count("/")
                imp = 'import "' + "../" * depth + '_shared/neural-bus.ts"; // neural bus (NEURAL_BUS_ON, default off)\n'
                raw = open(os.path.join(root, p), "rb").read(); pre = b""
                if raw.startswith(b'import "jsr:@supabase/functions-js'): j = raw.index(b"\n") + 1; pre, raw = raw[:j], raw[j:]
                open(os.path.join(root, p), "wb").write(pre + imp.encode() + raw)  # 只插入一行
        elif re.search(r"\bserve\s*\(", s): r["why_not"] = "uses std/http serve() not Deno.serve — needs manual wrap"
        else: r["why_not"] = "no HTTP entry found"
    elif k == "workflow":
        r.update(wired=True, how="observed by neural-bus-ci.yml (workflow_run, flag-off)")
    rows.append(r)
# 第二輪：間接涵蓋
page_text = {p: read(p) for p in wired_pages}
for r in rows:
    if r["wired"] or r["why_not"]: continue
    p, k, b = r["path"], r["type"], os.path.basename(r["path"])
    if k in ("frontend_js", "onnx_model") or (k == "script" and p.endswith((".js", ".mjs"))):
        hit = next((q for q, t in page_text.items() if b in t), None)
        if hit: r.update(wired=True, how=f"via page {hit}")
        else: r["why_not"] = "not referenced by any wired page (loaded dynamically, unused, or Node-side)"
    elif k == "edge_module":
        d = p.rsplit("/", 1)[0] + "/index.ts"; e = next((x for x in rows if x["path"] == d), None)
        if e and e["wired"]: r.update(wired=True, how="via entry " + d)
        else: r["why_not"] = "parent function entry not wired" if e else "shared module (_shared) — used by wired entries" if "/_shared/" in p else "no entry"
        if "/_shared/" in p and not r["wired"]: r.update(wired=True, how="shared module loaded by wired entries", why_not="")
    elif k == "migration/sql": r["why_not"] = "memory organ: attachable via neural_attach(table) — needs founder approval (would add DB triggers)"
    elif k in ("script/py", "script") and p.startswith(".github/"): r.update(wired=True, how="via workflow (neural-bus-ci.yml + neural_bus.py)")
    elif k == "service": r["why_not"] = "Node service: SDK neural-bus-node.mjs available; not imported (no live caller)"
    else: r["why_not"] = "offline/dev script (not part of live runtime)"
# workflow observer + SDK copies
if WIRE:
    os.makedirs(os.path.join(root, "neural"), exist_ok=True); shutil.copy(os.path.join(SDK, "neural-bus.js"), os.path.join(root, "neural/neural-bus.js"))
    if any(r["type"] == "edge_entry" and r["wired"] for r in rows):
        os.makedirs(os.path.join(root, "supabase/functions/_shared"), exist_ok=True); shutil.copy(os.path.join(SDK, "neural-bus.ts"), os.path.join(root, "supabase/functions/_shared/neural-bus.ts"))
    shutil.copy(os.path.join(SDK, "neural_bus.py"), os.path.join(root, "neural/neural_bus.py")); shutil.copy(os.path.join(SDK, "neural_events.sql"), os.path.join(root, "neural/neural_events.sql"))
    names = []
    for r in rows:
        if r["type"] == "workflow" and not r["why_not"]:
            m = re.search(r"^name:\s*(.+)$", read(r["path"]), re.M); names.append((m.group(1).strip().strip('"\'') if m else os.path.basename(r["path"])))
    if names:
        y = "name: neural-bus CI observer (flag-off)\non:\n  workflow_run:\n    workflows: " + json.dumps(sorted(set(names)), ensure_ascii=False) + "\n    types: [completed]\npermissions: { contents: read }\njobs:\n  emit:\n    if: vars.NEURAL_BUS_ON == '1'\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - env:\n          NEURAL_BUS_ON: ${{ vars.NEURAL_BUS_ON }}\n          NEURAL_BASE: " + base + "\n          SUPABASE_URL: ${{ secrets.NEURAL_SUPABASE_URL }}\n          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.NEURAL_SERVICE_ROLE_KEY }}\n        run: python3 neural/neural_bus.py \"${{ github.event.workflow_run.name }}\" reflex ci_run \"${{ github.event.workflow_run.conclusion == 'success' && 'pass' || 'fail' }}\"\n"
        open(os.path.join(root, ".github/workflows/neural-bus-ci.yml"), "w").write(y)
live = [r for r in rows if not r["why_not"].startswith("excluded")]
summ = {"base": base, "programs_total": len(rows), "excluded": len(rows) - len(live), "in_scope": len(live), "mapped": len(live), "wired": sum(r["wired"] for r in live),
  "by_type": {}, "by_organ": {}}
for r in live:
    t = summ["by_type"].setdefault(r["type"], {"n": 0, "wired": 0}); t["n"] += 1; t["wired"] += r["wired"]
    summ["by_organ"][r["organ"]] = summ["by_organ"].get(r["organ"], 0) + 1
summ["wired_pct"] = round(100 * summ["wired"] / max(1, summ["in_scope"]), 1)
out = sys.argv[sys.argv.index("--out") + 1] if "--out" in sys.argv else None
if out: json.dump({"summary": summ, "programs": rows}, open(out, "w"), ensure_ascii=False, indent=1)
print(json.dumps(summ, ensure_ascii=False, indent=1))
