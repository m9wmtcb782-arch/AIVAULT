---
title: Darkstar LLM
emoji: 🌑
colorFrom: indigo
colorTo: gray
sdk: gradio
sdk_version: 6.32.0
python_version: "3.12"
app_file: app.py
license: apache-2.0
pinned: false
---

# 暗星 (technical-dark-star) own-model inference — free Gradio Space

- Model: Qwen/Qwen3-1.7B-GGUF `Qwen3-1.7B-Q8_0.gguf` @ 90862c4b9d2787eaed51d12237eafdfe7c5f6077 (Apache-2.0), downloaded at startup, sha256 verified.
- Runtime: llama.cpp b12649 prebuilt CPU binary, internal 127.0.0.1:8091 (2 threads, ctx 4096); router on 0.0.0.0:7860.
- JSON API: `GET /health`, `GET /stats`, `POST /infer` `{text, session_id, agent_id}`. UI at `/`.
- `route: "local"` = answered by own model; `route: "escalate"` = caller uses its existing Gemini path (this Space never calls Gemini, holds no secrets).
- CORS: https://m9wmtcb782-arch.github.io (+ localhost). Rate limit 6/min, 150/day per IP; input ≤ 1000 chars.
