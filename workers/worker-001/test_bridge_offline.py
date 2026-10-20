#!/usr/bin/env python3
"""Offline integration test for Worker-001 bridge. No paid APIs, no external network."""
import json, os, subprocess, sys, time, urllib.request, urllib.error
from pathlib import Path

HERE=Path(__file__).resolve().parent
TOKEN="local-test-token-only-not-for-production-123456"
stub=r'''
import json
from http.server import BaseHTTPRequestHandler, HTTPServer
class H(BaseHTTPRequestHandler):
 def do_POST(self):
  b=json.loads(self.rfile.read(int(self.headers["Content-Length"])))
  out={"model":"SmolLM2-135M-Instruct","choices":[{"message":{"content":"stub-only"}}],"usage":{"completion_tokens":2}}
  raw=json.dumps(out).encode();self.send_response(200);self.send_header("Content-Length",str(len(raw)));self.end_headers();self.wfile.write(raw)
HTTPServer(("127.0.0.1",18080),H).serve_forever()
'''
env=dict(os.environ,AIVAULT_WORKER_BRIDGE_TOKEN=TOKEN,AIVAULT_WORKER_UPSTREAM="http://127.0.0.1:18080/v1/chat/completions")
stub_process=subprocess.Popen([sys.executable,"-c",stub],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
bridge_process=subprocess.Popen([sys.executable,str(HERE/"model-bridge.py")],env=env,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
try:
 for _ in range(30):
  time.sleep(.1)
  try:
   req=urllib.request.Request("http://127.0.0.1:8765/worker-001/chat",data=b'{"message":"hello"}',headers={"Content-Type":"application/json","Authorization":"Bearer "+TOKEN})
   with urllib.request.urlopen(req,timeout=1) as resp: data=json.load(resp)
   assert data["answer"]=="stub-only"
   assert data["status"]=="MODEL_RESPONSE_RECEIVED_NOT_INDEPENDENTLY_VERIFIED"
   print("PASS bridge protocol with MOCK UPSTREAM ONLY; NOT real inference")
   break
  except (urllib.error.URLError,ConnectionError): continue
 else: raise RuntimeError("bridge did not start")
 try:
  urllib.request.urlopen(urllib.request.Request("http://127.0.0.1:8765/worker-001/chat",data=b'{"message":"hello"}',headers={"Authorization":"Bearer invalid"}),timeout=2)
  raise AssertionError("unauthorized request accepted")
 except urllib.error.HTTPError as e: assert e.code==401
 print("PASS unauthorized request rejected")
finally:
 bridge_process.terminate();stub_process.terminate()
 bridge_process.wait(timeout=3);stub_process.wait(timeout=3)
