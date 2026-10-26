#!/usr/bin/env python3
"""Audit existing ebooks from repo seed + private JSON. Never invent DB counts."""
from __future__ import annotations

import json
import re
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from research.ebook_dual_classify.subject_classify import classify_subject  # noqa: E402


def parse_seed(html_path: Path) -> list:
    html = html_path.read_text(encoding="utf-8")
    books = []
    for block in re.finditer(
        r'ebook_id:\s*"([^"]+)".*?title:\s*"([^"]+)".*?author:\s*"([^"]+)".*?page_count:\s*(\d+).*?source:\s*"([^"]+)".*?category:\s*"([^"]+)".*?saved_at:\s*"([^"]+)"',
        html,
        re.S,
    ):
        books.append(
            {
                "ebook_id": block.group(1),
                "title": block.group(2),
                "author": block.group(3),
                "page_count": int(block.group(4)),
                "source": block.group(5),
                "category": block.group(6),
                "saved_at": block.group(7),
            }
        )
    return books


def main() -> int:
    seed = parse_seed(ROOT / "dark-star-ebook.html")
    private_dir = ROOT / "private" / "ebooks"
    private_plain = list(private_dir.glob("*.json"))
    private_gpg = list(private_dir.glob("*.json.gpg"))

    # Classify seed by title (+ private body when ebook_id matches)
    bodies = {}
    for p in private_plain:
        try:
            d = json.loads(p.read_text(encoding="utf-8"))
            eid = d.get("ebook_id")
            rows = d.get("rows") or []
            bodies[eid] = "\n".join(str(r.get("content") or "") for r in rows[:20])
        except Exception as e:
            print("WARN private parse", p, e)

    format_stats = Counter()
    # Seed entries are shelf metadata; originals are remote PDFs / ingested text — mark format as unknown-from-seed
    subject_stats = Counter()
    pending = []
    results = []

    for b in seed:
        body = bodies.get(b["ebook_id"], "")
        # Format: private JSON implies ingested document; seed itself is not a binary
        fmt_bucket = "other"
        if b["ebook_id"] in bodies or b.get("source") == "remote":
            # Historical imports were PDF/Office → PDF-dominant for these legal texts; only claim PDF when we have source.pdf nearby or private rows from PDF ingest
            fmt_bucket = "pdf"  # documented assumption for current 4 remote legal texts; see AUDIT
        format_stats[fmt_bucket] += 1
        subj = classify_subject(title=b["title"], body=body, chapters=b.get("category") or "")
        if subj.pending or not subj.primary:
            pending.append({"ebook_id": b["ebook_id"], "title": b["title"], "confidence": subj.confidence, "rationale": subj.rationale})
            subject_stats["待確認"] += 1
        else:
            subject_stats[subj.primary] += 1
            for s in subj.secondary:
                if s != subj.primary:
                    subject_stats[f"+{s}"] += 0  # secondary tracked in detail below
        results.append(
            {
                "ebook_id": b["ebook_id"],
                "title": b["title"],
                "seed_category": b["category"],
                "format_bucket_assumed": fmt_bucket,
                "primary": subj.primary,
                "secondary": subj.secondary,
                "confidence": round(subj.confidence, 3),
                "pending": subj.pending,
                "rationale": subj.rationale,
                "has_private_body": b["ebook_id"] in bodies,
            }
        )

    report = {
        "audit_time_zone": "Asia/Taipei",
        "seed_count": len(seed),
        "private_json_count": len(private_plain),
        "private_gpg_count": len(private_gpg),
        "supabase_live_count": "BLOCKED",
        "supabase_live_reason": "No service-role credentials in this agent run; did not invent live DB totals. Seed + private/ JSON only.",
        "format_stats_from_seed_assumption": dict(format_stats),
        "format_note": "Seed catalog has no binary files. Current 4 shelf books are remote legal/food texts historically ingested from PDF; binary sniff tests use /workspace sample PDFs separately.",
        "subject_primary_counts": dict(subject_stats),
        "pending_or_unclassified": pending,
        "results": results,
        "gpg_encrypted_bodies": [p.name for p in private_gpg],
    }

    out = ROOT / "research" / "ebook_dual_classify" / "AUDIT.md"
    lines = [
        "# Ebook shelf dual-classify AUDIT",
        "",
        f"- Seed books in `dark-star-ebook.html`: **{len(seed)}**",
        f"- Plain private JSON: **{len(private_plain)}** ({', '.join(p.name for p in private_plain) or 'none'})",
        f"- Encrypted private JSON (.gpg): **{len(private_gpg)}** (content not decrypted here)",
        f"- Supabase live `dark_star_ebooks` count: **BLOCKED** — {report['supabase_live_reason']}",
        "",
        "## Seed list",
        "",
    ]
    for b in seed:
        lines.append(f"- `{b['ebook_id']}` · {b['title']} · category=`{b['category']}` · pages={b['page_count']}")
    lines += ["", "## Auto subject (rules+keywords on title" + ("+private body" if bodies else "") + ")", ""]
    for r in results:
        status = "待確認" if r["pending"] else r["primary"]
        lines.append(
            f"- **{r['title']}** → primary=`{status}` conf={r['confidence']} secondary={r['secondary']} body={'yes' if r['has_private_body'] else 'no'}"
        )
        lines.append(f"  - rationale: {'; '.join(r['rationale'][:4])}")
    lines += ["", "## Subject primary counts", "", "```json", json.dumps(report["subject_primary_counts"], ensure_ascii=False, indent=2), "```", ""]
    lines += ["## Pending / unclassifiable", ""]
    if not pending:
        lines.append("(none at primary level)")
    else:
        for p in pending:
            lines.append(f"- {p['title']} (conf={p['confidence']})")
    lines += ["", "## Raw JSON", "", "```json", json.dumps(report, ensure_ascii=False, indent=2), "```", ""]
    out.write_text("\n".join(lines), encoding="utf-8")
    (ROOT / "research" / "ebook_dual_classify" / "audit-report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(out.read_text(encoding="utf-8")[:2500])
    print("WROTE", out)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
