#!/usr/bin/env python3
"""Worker-001 readiness gate. Never activates workers on metadata alone.
Run on the intended model host; uses localhost and no paid provider APIs.
"""
import json, os, sys, urllib.request, urllib.error

url=os.environ.get("AIVAULT_WORKER_BRIDGE_URL","http://127.0.0.1:8765/worker-001/chat")
token=os.environ.get("AIVAULT_WORKER_BRIDGE_TOKEN","")
if not url.startswith("http://127.0.0.1:") and not url.startswith("http://localhost:"):
    sys.exit("BLOCKED: readiness probe must target local bridge")
if len(token)<32:
    sys.exit("BLOCKED: bridge token missing")
req=urllib.request.Request(url,data=json.dumps({"message":"請用繁體中文回答：你是什麼模型？"}).encode(),headers={"Content-Type":"application/json","Authorization":"Bearer "+token})
try:
    with urllib.request.urlopen(req,timeout=100) as r:
        payload=json.load(r)
except (urllib.error.URLError,ValueError) as e:
    sys.exit("BLOCKED: bridge unreachable or invalid response: "+str(e))
if payload.get("status")!="MODEL_RESPONSE_RECEIVED_NOT_INDEPENDENTLY_VERIFIED":
    sys.exit("BLOCKED: no model response")
if payload.get("model")!="SmolLM2-135M-Instruct" or not isinstance(payload.get("answer"),str) or not payload["answer"].strip():
    sys.exit("BLOCKED: missing expected model identity or answer")
print(json.dumps({"worker":"Worker-001","result":"BRIDGE_RESPONDED_ONLY","model":payload["model"],"answer":payload["answer"],"inference_verified":False,"production_ready":False},ensure_ascii=False))
print("REQUIRES TEST: check model-host logs, weights SHA256, actual token generation and host identity before activating any worker.")
