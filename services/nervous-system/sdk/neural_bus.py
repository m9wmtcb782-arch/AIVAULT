"""AIVAULT 神經訊號匯流排（Python，GitHub Actions / 訓練腳本用）。NEURAL_BUS_ON != '1' → 不做任何事。"""
import os, json, urllib.request
def emit(program, organ, kind, outcome=None, payload=None):
    if os.environ.get("NEURAL_BUS_ON") != "1": return None
    url, key = os.environ.get("SUPABASE_URL"), os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    ev = {"v": 1, "base": os.environ.get("NEURAL_BASE", "base1"), "program": program, "organ": organ, "kind": kind, "outcome": outcome, "payload": payload or {}}
    if not (url and key): return ev
    try:
        r = urllib.request.Request(url + "/rest/v1/neural_events", data=json.dumps(ev).encode(), method="POST", headers={"apikey": key, "Authorization": "Bearer " + key, "Content-Type": "application/json", "Prefer": "return=minimal"})
        urllib.request.urlopen(r, timeout=5)
    except Exception: pass
    return ev
if __name__ == "__main__":
    import sys; a = sys.argv[1:] + [None] * 4; print(emit(a[0] or "cli", a[1] or "reflex", a[2] or "ci_run", a[3]))
