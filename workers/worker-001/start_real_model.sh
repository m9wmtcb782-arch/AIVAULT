#!/usr/bin/env bash
# Worker-001: start a REAL local GGUF model with llama.cpp (not a mock).
# Requirements: Linux host, llama-server installed, model weights supplied by operator.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
MODEL_FILE="${AIVAULT_MODEL_FILE:-$HERE/models/model.gguf}"
SERVER_BIN="${AIVAULT_LLAMA_SERVER_BIN:-llama-server}"
if ! command -v "$SERVER_BIN" >/dev/null 2>&1; then
  echo "BLOCKED: llama-server not installed" >&2
  exit 2
fi
if [ ! -s "$MODEL_FILE" ]; then
  echo "BLOCKED: no real GGUF weights at $MODEL_FILE" >&2
  exit 2
fi
echo "MODEL_SHA256: $(sha256sum "$MODEL_FILE" | cut -d' ' -f1)"
echo "Launching local-only CPU model server. No paid API calls."
exec "$SERVER_BIN" --model "$MODEL_FILE" --alias SmolLM2-135M-Instruct --host 127.0.0.1 --port 8080 --ctx-size 1024 --parallel 1
