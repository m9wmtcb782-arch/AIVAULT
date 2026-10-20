# Worker-001 operator setup (NOT DEPLOYED)

This is a real-model deployment plan, not a simulated worker. Requires a separate Linux machine with Docker and adequate RAM. No external paid inference API.

1. Obtain an appropriately licensed SmolLM2-135M-Instruct GGUF Q4 file and independently verify its hash and license. Place it at `workers/worker-001/models/model.gguf`. This file is not currently in the repository.
2. Start a local llama.cpp HTTP server with that file and model alias `SmolLM2-135M-Instruct`, listening only on 127.0.0.1:8080. Use a supported llama.cpp server release and its documented flags.
3. Generate a random 32+ character token and set `AIVAULT_WORKER_BRIDGE_TOKEN` in the host environment. Never commit or expose the token to GitHub Pages.
4. Run `python3 workers/worker-001/model-bridge.py` on the same machine. It listens on 127.0.0.1:8765 and forwards to the model server.
5. From the host, send an authenticated POST to `http://127.0.0.1:8765/worker-001/chat` with JSON `{"message":"What is 2 + 2?"}`. Check actual upstream model logs, token usage and response before marking inference verified.

**Blocked until steps 1–5 are executed and evidenced.** The current iPhone must not download model weights. Do not expose the bridge port or token to browsers. Connecting the cooperation-pool UI requires an authenticated backend gateway with per-user authorization, rate limits, and verified ownership.

Status: model registered as PLANNED; no weights, live model host, inference proof, or 1004-agent rollout. Do not report as ACTIVE.
