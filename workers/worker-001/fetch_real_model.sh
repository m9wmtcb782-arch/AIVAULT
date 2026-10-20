#!/usr/bin/env bash
# Worker-001 real GGUF fetch, Linux model host ONLY; not for iPhone.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
mkdir -p "$HERE/models"
URL="https://huggingface.co/bartowski/SmolLM2-135M-Instruct-GGUF/resolve/main/SmolLM2-135M-Instruct-Q4_K_M.gguf"
DEST="$HERE/models/model.gguf"
if [ -e "$DEST" ]; then echo "BLOCKED: model file already exists; inspect manually"; exit 2; fi
command -v curl >/dev/null || { echo "BLOCKED: curl required"; exit 2; }
curl --fail --location --retry 2 --connect-timeout 15 --max-time 600 --output "$DEST.part" "$URL" || { rm -f "$DEST.part"; exit 2; }
test -s "$DEST.part" || { rm -f "$DEST.part"; echo "BLOCKED: empty download"; exit 2; }
mv "$DEST.part" "$DEST"
sha256sum "$DEST"
echo "Downloaded but NOT verified. Compare SHA256 with trusted release metadata before setting AIVAULT_MODEL_SHA256. Do not mark Worker ACTIVE."
