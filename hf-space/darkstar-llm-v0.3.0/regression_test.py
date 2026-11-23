"""暗星 Space routing regression test. Usage: python regression_test.py [base_url]  (default http://127.0.0.1:7860)"""
import os, sys, json, time, urllib.request
BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:7860"
CASES = [  # (prompt, expected route, check for local answers: list of substrings any of which must appear, or None)
    ("你好，暗星，請用一句話自我介紹。", "local", ["暗星"]),
    ("早安！今天心情不錯，跟我打個招呼吧。", "local", ["早安","你好","早"]),
    ("暗星，你的真實路徑和 agent_id 是什麼？", "local", ["technical-dark-star"]),
    ("暗星記憶中關於電子書有什麼規定？", "local", ["電子書"]),
    ("請用一句話說明什麼是 AIVAULT 第一基地的數位人。", "local", ["數位人"]),
    ("甲比乙高，乙比丙高，誰最矮？", "escalate", None),
    ("如果下雨地會濕，現在地是濕的，那麼一定下過雨嗎？", "escalate", None),
    ("小明有 3 顆蘋果，又買了 5 顆，總共幾顆？", "escalate", None),
    ("12+35 等於多少？", "escalate", None),
    ("請比較民法債務不履行與侵權行為的要件。", "escalate", None),
    ("什麼是消滅時效？", "escalate", None),
    ("租屋押金房東不還怎麼辦？", "escalate", None),
    ("今天的新聞有什麼？", "escalate", None),
    ("一百減去三十七是多少？", "escalate", None),
    ("請推薦一種適合放鬆時聽的音樂類型。", "local", ["輕音樂","古典","爵士","鋼琴","自然","Lo-fi","lo-fi","民謠","冥想","氛圍"]),
]
ok = 0
for q, exp, chk in CASES:
    t = time.time()
    req = urllib.request.Request(BASE + "/infer", json.dumps({"text": q, "session_id": f"reg-{time.time()}"}).encode(), {"content-type": "application/json"})
    d = json.load(urllib.request.urlopen(req, timeout=120))
    good_route = d["route"] == exp
    ans_ok = None if d["route"] != "local" or not chk else any(c in (d.get("output") or "") for c in chk)
    passed = good_route and ans_ok is not False
    ok += passed
    print(json.dumps({"q": q, "expected": exp, "route": d["route"], "reason": d.get("reason"), "latency_ms": d.get("latency_ms"),
                      "answer_check": ans_ok, "pass": passed, "output": (d.get("output") or "")[:90]}, ensure_ascii=False))
    time.sleep(float(os.getenv("REG_SLEEP", "10.5")))  # stay under the 6/min rate limit
print(f"PASS {ok}/{len(CASES)}")
