#!/usr/bin/env python3
"""Export PUBLIC ebooks to static plain-text files for GitHub Pages (ebook-text/).

Why: external AIs (Grok / GPT) fetch URLs without running JavaScript, and the
reader page (dark-star-ebook.html) renders book text only via JS + POST API.

Safety:
  * Reads ONLY through the existing anonymous ingest API (actions list/context);
    the server's canRead() returns text for visibility=public books only, so
    members/private books can never be exported by this script.
  * Additionally restricted to an author allowlist of official / public-domain
    sources (statutes, court decisions, government documents, AIVAULT-own
    material). Commercial textbooks by individual authors are NOT exported.
Usage:
  AIVAULT_ANON_KEY=... python3 tools/export-public-ebook-text.py [--only ID ...] [--out ebook-text]
  (the anon key is the public key already shipped in the site's JS)
"""
import json, os, re, sys, time, urllib.request, concurrent.futures as cf

INGEST = "https://clcddygkaaqqtsbswgdf.supabase.co/functions/v1/dark-star-ebook-ingest"
SITE = "https://m9wmtcb782-arch.github.io/AIVAULT"
ALLOW = re.compile(r"^(中華民國|Office of the Law Revision|Bundesministerium|司法院|憲法法庭|財政部|衛生福利部|NIST|AIVAULT)")
PART_CHARS = 12000  # external fetchers often truncate long pages; keep parts small
KEY = os.environ.get("AIVAULT_ANON_KEY", "")

def post(body, tries=4):
    for i in range(tries):
        try:
            req = urllib.request.Request(INGEST, data=json.dumps(body).encode(), method="POST",
                headers={"Content-Type": "application/json", "apikey": KEY, "Authorization": "Bearer " + KEY})
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.loads(r.read())
        except Exception as e:
            if i == tries - 1: raise
            time.sleep(2 * (i + 1))

def list_books():
    out, off = [], 0
    while True:
        d = post({"action": "list", "limit": 100, "offset": off})
        out += d.get("books") or []
        if not d.get("has_more"): return out
        off = d.get("next_offset") or off + 100

def pages_of(b):
    n, got, p = int(b.get("total_pages") or b.get("page_count") or 0), {}, 11
    while p - 10 <= n:
        d = post({"action": "context", "ebook_id": b["id"], "page_number": p, "radius": 10})
        if d.get("error"): raise RuntimeError(d["error"])
        for x in d.get("pages") or []: got[int(x["page_number"])] = x.get("content") or ""
        p += 21
    return [(k, got[k]) for k in sorted(got)]

def official_url(text):
    m = re.search(r"官方來源[：:]\s*[^\s]*?\s*(https?://\S+)", text[:3000]) or re.search(r"(https?://(?:law\.moj\.gov\.tw|www\.gesetze-im-internet\.de|uscode\.house\.gov|www\.govinfo\.gov|cons\.judicial\.gov\.tw|nvlpubs\.nist\.gov)\S*)", text[:3000])
    return m.group(1).rstrip("）)。，,") if m else ""

def export(b, outdir):
    pages = pages_of(b)
    parts, cur, cur_len = [], [], 0
    for no, txt in pages:
        if cur and cur_len + len(txt) > PART_CHARS:
            parts.append(cur); cur, cur_len = [], 0
        cur.append((no, txt)); cur_len += len(txt)
    if cur: parts.append(cur)
    bid, base = b["id"], f"{SITE}/ebook-text/{b['id']}"
    d = os.path.join(outdir, bid); os.makedirs(d, exist_ok=True)
    title, author = b.get("title") or "", b.get("author") or ""
    src = official_url(pages[0][1]) if pages else ""
    reader = f"{SITE}/dark-star-ebook.html?book={bid}"
    n = len(parts)
    for i, part in enumerate(parts, 1):
        nav = [f"目錄：{base}/index.txt"]
        if i > 1: nav.append(f"上一部分：{base}/part-{i-1:03d}.txt")
        if i < n: nav.append(f"下一部分：{base}/part-{i+1:03d}.txt")
        head = [f"《{title}》" + (f"｜{author}" if author else ""),
                f"AIVAULT 皇家電子圖書館 公開書籍純文字版：第 {i}/{n} 部分（原書第 {part[0][0]}–{part[-1][0]} 頁）",
                *nav, f"閱讀器：{reader}"] + ([f"官方來源：{src}"] if src else []) + ["=" * 40, ""]
        body = "\n\n".join(f"［第 {no} 頁］\n{txt.strip()}" for no, txt in part)
        open(os.path.join(d, f"part-{i:03d}.txt"), "w", encoding="utf-8").write("\n".join(head) + body + "\n")
    idx = [f"《{title}》" + (f"｜{author}" if author else ""), "AIVAULT 皇家電子圖書館 公開書籍純文字版（目錄）",
           f"共 {len(pages)} 頁，分 {n} 個部分；每部分約 {PART_CHARS} 字以內，請依需要開啟。", f"閱讀器：{reader}"] + \
          ([f"官方來源：{src}"] if src else []) + ["=" * 40] + \
          [f"第 {i} 部分（原書第 {p[0][0]}–{p[-1][0]} 頁）：{base}/part-{i:03d}.txt　開頭：{re.sub(r'\s+', ' ', p[0][1])[:60]}" for i, p in enumerate(parts, 1)]
    open(os.path.join(d, "index.txt"), "w", encoding="utf-8").write("\n".join(idx) + "\n")
    return {"t": title, "a": author, "src": src, "parts": [[p[0][0], p[-1][0]] for p in parts]}

def main():
    if not KEY: sys.exit("AIVAULT_ANON_KEY missing")
    args = sys.argv[1:]; outdir = "ebook-text"; only = []
    if "--out" in args: outdir = args[args.index("--out") + 1]
    if "--only" in args: only = args[args.index("--only") + 1:]
    books = [b for b in list_books() if b.get("visibility") == "public" and ALLOW.match(b.get("author") or "")]
    if only: books = [b for b in books if b["id"] in only]
    os.makedirs(outdir, exist_ok=True)
    mpath = os.path.join(outdir, "manifest.json")
    manifest = json.load(open(mpath, encoding="utf-8")) if os.path.exists(mpath) else {"books": {}}
    with cf.ThreadPoolExecutor(4) as ex:
        futs = {ex.submit(export, b, outdir): b for b in books}
        for f in cf.as_completed(futs):
            b = futs[f]
            try: manifest["books"][b["id"]] = f.result(); print("ok", b["id"], len(manifest["books"][b["id"]]["parts"]), flush=True)
            except Exception as e: print("FAIL", b["id"], e, flush=True)
    manifest.update({"site": SITE, "part_chars": PART_CHARS, "generated": time.strftime("%Y-%m-%dT%H:%M:%S%z")})
    json.dump(manifest, open(mpath, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
main()
