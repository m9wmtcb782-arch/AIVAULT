#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
if ! command -v deno >/dev/null 2>&1; then
  echo "BLOCKED: Deno 2 is required; no tests were executed." >&2
  exit 127
fi
echo "Checking autonomous runtime types..."
deno check --no-config agent-runtime-v0.2.ts guarded-runtime-factory-v0.1.ts trusted-tool-catalog-v0.1.ts
echo "Running local-only autonomous agent tests..."
deno test --no-config --no-prompt --deny-net --deny-env --deny-read --deny-write --deny-run agent-runtime-v0.1.test.ts agent-runtime-v0.2.test.ts guarded-runtime-factory-v0.1.test.ts
echo "PASS: all offline checks completed"
