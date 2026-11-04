#!/usr/bin/env bash
# AIVAULT local drawing environment bootstrap; requires explicit execution on owner's computer.
set -euo pipefail
if [[ "${1:-}" != "--install" ]]; then
  echo "Preview only. Run: bash comic-studio/install_local_drawing.sh --install"
  echo "This creates .aivault-drawing-venv and installs ComfyUI dependencies from official GitHub."
  echo "Model weights must be downloaded separately after reviewing their licenses."
  exit 0
fi
command -v git >/dev/null || { echo "git missing"; exit 1; }
command -v python3 >/dev/null || { echo "python3 missing"; exit 1; }
if [[ ! -d ComfyUI ]]; then git clone https://github.com/Comfy-Org/ComfyUI.git ComfyUI; fi
python3 -m venv .aivault-drawing-venv
source .aivault-drawing-venv/bin/activate
python -m pip install --upgrade pip
echo "Installing PyTorch/ComfyUI dependencies; review hardware-specific PyTorch setup if install fails."
python -m pip install -r ComfyUI/requirements.txt
echo "Installed dependencies. Place a licensed SDXL-compatible checkpoint in ComfyUI/models/checkpoints/"
echo "Start locally with: source .aivault-drawing-venv/bin/activate && cd ComfyUI && python main.py --listen 127.0.0.1"
