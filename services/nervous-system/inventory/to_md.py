import json, sys, collections
for f in sys.argv[1:]:
    d = json.load(open(f)); s = d["summary"]; print(f"\n## {s['base']}：{s['wired']}/{s['in_scope']} 接線（{s['wired_pct']}%），{s['mapped']} 已對應，排除 {s['excluded']}")
    print("| 類型 | 數量 | 已接線 |\n|---|---|---|"); [print(f"| {k} | {v['n']} | {v['wired']} |") for k, v in sorted(s["by_type"].items())]
    print("\n器官分布：" + "、".join(f"{k} {v}" for k, v in s["by_organ"].items()))
    why = collections.Counter(r["why_not"] for r in d["programs"] if not r["wired"]); print("\n未接線原因："); [print(f"- {n} × {w}") for w, n in why.most_common()]
