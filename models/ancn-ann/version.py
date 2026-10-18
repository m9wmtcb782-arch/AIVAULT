"""Model version, SHA-256 integrity and acceptance status.
Only ACCEPTED models may be used for formal suggestions.
"""
import hashlib
import json
from pathlib import Path

def sha256_file(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()

def write_meta(path: str, meta: dict):
    Path(path).write_text(json.dumps(meta, indent=2, ensure_ascii=False))

def load_meta(path: str) -> dict:
    return json.loads(Path(path).read_text())
