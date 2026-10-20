# Worker-001: free-hosting gate (2026-10-20)

Do not assume Hugging Face CPU Basic is freely creatable: official Spaces documentation states new compute-backed Gradio/Docker Spaces require a paid subscription even though CPU Basic hardware lists zero hourly price.

AIVAULT policy:
- No paid hosting, API billing, or account upgrades without explicit approval.
- Do not run models on the user's iPhone.
- No real Worker activation without model weights, host identity, inference output, and usage evidence.
- ZeroGPU is quota-limited and not a guaranteed always-on CPU service.
- Prefer an already-authorized existing compute host if available; otherwise remain BLOCKED_NO_HOST.
- Never publish model bridge bearer tokens in GitHub Pages or repository files.

Official sources:
https://huggingface.co/docs/hub/spaces-overview
https://huggingface.co/docs/hub/main/en/spaces-gpus

Status: NOT DEPLOYED. This file is a guardrail, not a provisioned host.
