# 從公開的 lab_public 取 GLB（只是資料）；沒指定就產生空檔讓 Blender 用內建測試場景。不印內容。
import json, os, base64, urllib.request
os.makedirs("out", exist_ok=True); lid = os.environ.get("LAB_ID", "").strip()
if not lid: open("out/model.glb", "wb").close(); print("no lab id -> test scene"); raise SystemExit
html = open("aivault-lab.html", encoding="utf-8").read(); anon = html.split("var ANON='")[1].split("'")[0]
fn = "https://clcddygkaaqqtsbswgdf.supabase.co/functions/v1/dark-star-ebook-ingest?feature=degree"
r = urllib.request.Request(fn, data=json.dumps({"action": "lab_public", "id": int(lid)}).encode(), headers={"apikey": anon, "Authorization": "Bearer " + anon, "Content-Type": "application/json"}, method="POST")
row = (json.load(urllib.request.urlopen(r, timeout=60)).get("rows") or [{}])[0]; d = str(row.get("demo_html") or "")
if not d.startswith("glb:"): raise SystemExit("lab %s has no glb artifact" % lid)
b = base64.b64decode(d[4:]); open("out/model.glb", "wb").write(b); print("glb bytes", len(b))
