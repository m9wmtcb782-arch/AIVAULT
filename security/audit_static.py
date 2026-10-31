#!/usr/bin/env python3
"""AIVAULT static security audit. Read-only; no network, no secrets, no deployment."""
from pathlib import Path
import re, sys
root = Path(__file__).resolve().parents[1]
findings = []
for path in root.rglob("*"):
    if not path.is_file() or ".git" in path.parts or path.stat().st_size > 2_000_000:
        continue
    if path.suffix.lower() not in {".html", ".js", ".ts", ".yml", ".yaml"}:
        continue
    text = path.read_text(encoding="utf-8", errors="replace")
    rel = path.relative_to(root)
    if re.search(r"service_role|SUPABASE_SERVICE_ROLE_KEY", text, re.I):
        findings.append((str(rel), "REVIEW", "Service-role identifier: check that no secret value is in client code"))
    if re.search(r"pull_request_target\s*:", text) and re.search(r"actions/checkout", text):
        findings.append((str(rel), "REVIEW", "Privileged PR workflow: verify no untrusted checkout"))
    if path.name == "aivault-home.html" and "localStorage.getItem" in text and "av-authed" in text:
        findings.append((str(rel), "INFO", "Client-only auth display state: do not treat as authorization"))
print("AIVAULT Security Shield static review (heuristic; not a vulnerability proof)")
for file, severity, msg in findings:
    print(f"{severity}: {file}: {msg}")
print(f"Findings: {len(findings)}; no files modified")
