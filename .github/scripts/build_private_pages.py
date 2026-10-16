# 由指定 git ref（舊的公開版本）組出機密頁完整 HTML；只在 Actions／本機使用，輸出不進 repo。
import base64, json, re, subprocess, sys
REF = sys.argv[1]; OUT = sys.argv[2]
def g(p): return subprocess.check_output(["git", "show", "%s:%s" % (REF, p)]).decode("utf-8")
GATE = re.compile(r"<script>\s*/\* 機密頁：未登入直接導向登入頁.*?</script>\s*", re.S)
def safe(js): return js.replace("</script", "<\\/script")
def collab():
    h = GATE.sub("", g("aivault-agent-collaboration.html"), 1)
    h = re.sub(r'<script>\s*\(function\(\)\{var ok=false;.*?</script>', "", h, count=1, flags=re.S)
    tag = '<script src="aivault-collab-v0.2/app.js"></script>'; assert tag in h
    return h.replace(tag, "<script>\n" + safe(g("aivault-collab-v0.2/app.js")) + "\n</script>", 1)
def mesh():
    h = GATE.sub("", g("aivault-compute-mesh.html"), 1)
    h = re.sub(r'<script>\s*\(function\(\)\{var ok=false;.*?</script>', "", h, count=1, flags=re.S)
    css = re.search(r'<link rel="stylesheet" href="assets/compute-pool/aquarium.css[^"]*"\s*/?>', h); assert css
    h = h.replace(css.group(0), "<style>\n" + g("assets/compute-pool/aquarium.css") + "\n</style>", 1)
    pv = "data:text/javascript;base64," + base64.b64encode(g("assets/compute-pool/pool-view.mjs").encode()).decode()
    imap = '<script type="importmap">' + json.dumps({"imports": {"./assets/compute-pool/pool-view.mjs?v=android-status-v9": pv, "./pool-view.mjs?v=android-status-v9": pv}}) + "</script>\n"
    first = True
    for name in ("auto-provider", "aquarium", "pipeline-panel"):
        m = re.search(r'<script type="module" src="assets/compute-pool/%s\.mjs[^"]*"></script>' % name, h); assert m, name
        js = g("assets/compute-pool/%s.mjs" % name).replace("'./pool-view.mjs?v=android-status-v9'", "'./assets/compute-pool/pool-view.mjs?v=android-status-v9'")
        h = h.replace(m.group(0), (imap if first else "") + '<script type="module">\n' + safe(js) + "\n</script>", 1); first = False
    return h
pages = {"agent-collaboration": collab(), "compute-mesh": mesh()}
for k, v in pages.items(): assert "機密頁：未登入" not in v and "var ok=false" not in v, k
json.dump(pages, open(OUT, "w"), ensure_ascii=False)
print({k: len(v) for k, v in pages.items()})
