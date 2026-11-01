#!/usr/bin/env bash
# 10 個身分經同一個 OpenClaw 閘道（127.0.0.1）跑任務。前置：core/server.mjs 與 openclaw gateway run 已啟動。
OC=${OC:-openclaw}; OUT=${1:-/tmp/aivault-e2e.jsonl}; : > "$OUT"
run(){ local id=$1 task=$2; local r; r=$($OC agent --agent aivault --session-key "agent:aivault:aivault-id-${id,,}" --message "TASK: $task" --json 2>/dev/null | python3 -c 'import sys,json;d=json.load(sys.stdin);p=d.get("payloads") or d.get("result",{}).get("payloads") or [];print(p[0]["text"] if p else json.dumps(d)[:300])' 2>&1); printf '{"identity":"%s","task":"%s","reply":%s}\n' "$id" "$task" "$(python3 -c 'import json,sys;print(json.dumps(sys.argv[1]))' "$r")" | tee -a "$OUT"; }
run Worker-001 "js 字串轉整數"
for i in 002 003 004 005 006 007 008 009 010; do run Worker-$i "js 字串轉整數"; done
run Worker-004 "國慶日是幾月幾日"
run Worker-009 "國慶日是幾月幾日"
