#!/usr/bin/env python3
"""AIVAULT Worker-001 local model bridge. No provider API or fake fallback.
Requires an operator-hosted llama.cpp server bound to 127.0.0.1:8080.
This service binds to localhost only; use an authenticated reverse proxy separately.
"""
import json, os, secrets, urllib.request, urllib.error
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

MODEL = "SmolLM2-135M-Instruct"
UPSTREAM = "http://127.0.0.1:8080/v1/chat/completions"
KEY = os.environ.get("AIVAULT_WORKER_BRIDGE_TOKEN", "")
if len(KEY) < 32:
    raise SystemExit("BLOCKED: set a random AIVAULT_WORKER_BRIDGE_TOKEN (32+ chars)")
class Handler(BaseHTTPRequestHandler):
    def do_POST(self):
        if self.path != "/worker-001/chat":
            self.send_error(404); return
        token = self.headers.get("Authorization", "").removeprefix("Bearer ")
        if not secrets.compare_digest(token, KEY):
            self.send_error(401); return
        try:
            size = int(self.headers.get("Content-Length", "0"))
            if not 0 < size <= 8192: raise ValueError("invalid request size")
            body = json.loads(self.rfile.read(size))
            prompt = body.get("message", "")
            if not isinstance(prompt, str) or not 0 < len(prompt) <= 2000:
                raise ValueError("message must be 1..2000 characters")
            req = urllib.request.Request(UPSTREAM, data=json.dumps({
                "model": MODEL, "stream": False, "temperature": 0.2, "max_tokens": 160,
                "messages": [{"role": "system", "content": "You are Worker-001. If unsure, say so. Do not claim external tools or sources."},
                             {"role": "user", "content": prompt}]
            }).encode(), headers={"Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=90) as r:
                data = json.load(r)
            answer = data["choices"][0]["message"]["content"]
            if not isinstance(answer, str) or not answer.strip():
                raise ValueError("empty model answer")
            self.reply(200, {"status":"MODEL_RESPONSE_UNVERIFIED", "model":MODEL, "answer":answer,
                             "usage":data.get("usage"), "source":"local-llama-cpp"})
        except Exception as e:
            self.reply(503, {"status":"MODEL_UNAVAILABLE", "error":str(e)[:200]})
    def reply(self, status, payload):
        raw=json.dumps(payload,ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header("Content-Type","application/json; charset=utf-8")
        self.send_header("Cache-Control","no-store")
        self.send_header("Content-Length",str(len(raw)))
        self.end_headers();self.wfile.write(raw)
if __name__=="__main__":
    print("Worker-001 bridge listening on localhost:8765 (not public)")
    ThreadingHTTPServer(("127.0.0.1",8765),Handler).serve_forever()
