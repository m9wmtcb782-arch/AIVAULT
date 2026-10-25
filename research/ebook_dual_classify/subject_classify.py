"""Keyword / rule subject classifier. Optional local model hook (Ollama) is stubbed."""
from __future__ import annotations

import json
import re
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Any, Dict, List, Optional

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_TAXONOMY = ROOT / "ebook" / "classify" / "taxonomy.json"


@dataclass
class SubjectResult:
    primary: Optional[str]
    secondary: List[str]
    group_ids: List[str]
    confidence: float
    rationale: List[str]
    pending: bool
    tags: List[str] = field(default_factory=list)
    model_hook: str = "rules_keywords_v1"

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


def load_taxonomy(path: Optional[Path] = None) -> dict:
    p = path or DEFAULT_TAXONOMY
    return json.loads(p.read_text(encoding="utf-8"))


def _score_text(text: str, keywords: List[str]) -> tuple[int, List[str]]:
    hits = []
    score = 0
    for kw in keywords:
        if not kw:
            continue
        if kw in text:
            hits.append(kw)
            # longer keywords weigh more
            score += max(1, len(kw) // 2)
    return score, hits


def classify_subject(
    *,
    title: str = "",
    toc: str = "",
    chapters: str = "",
    body: str = "",
    taxonomy: Optional[dict] = None,
    use_local_model: bool = False,
) -> SubjectResult:
    tax = taxonomy or load_taxonomy()
    # Prefer title/TOC/chapters then body (truncate body for speed)
    body_use = (body or "")[:12000]
    parts = [
        ("title", title or "", 3.0),
        ("toc", toc or "", 2.0),
        ("chapters", chapters or "", 1.5),
        ("body", body_use, 1.0),
    ]
    best = []  # (score, subject_id, group_id, hits, where)
    rationale: List[str] = []

    for gid, group in (tax.get("subject_groups") or {}).items():
        for sub in group.get("subjects") or []:
            sid = sub["id"]
            kws = sub.get("keywords") or []
            total = 0.0
            all_hits = []
            wheres = []
            for where, text, weight in parts:
                sc, hits = _score_text(text, kws)
                if sc:
                    total += sc * weight
                    all_hits.extend(hits)
                    wheres.append(where)
            if total > 0:
                best.append((total, sid, gid, sorted(set(all_hits)), wheres))

    best.sort(key=lambda x: (-x[0], x[1]))
    min_accept = float((tax.get("confidence") or {}).get("min_accept", 0.45))

    secondary_tags: List[str] = []
    blob = "\n".join([title, toc, chapters, body_use])
    for lex in tax.get("secondary_tag_lexicon") or []:
        sc, hits = _score_text(blob, lex.get("keywords") or [])
        if sc:
            secondary_tags.append(lex["tag"])
            rationale.append(f"secondary:{lex['tag']}←{','.join(hits[:4])}")

    if not best:
        return SubjectResult(
            primary=None,
            secondary=secondary_tags,
            group_ids=[],
            confidence=0.0,
            rationale=["no keyword hits → 待確認"] + rationale,
            pending=True,
            tags=secondary_tags,
            model_hook="rules_keywords_v1" + ("+ollama_stub_unused" if use_local_model else ""),
        )

    # Normalize confidence: map raw score to 0..1 softly
    top_score = best[0][0]
    conf = min(0.99, top_score / (top_score + 8.0))
    # boost if title hit
    if "title" in best[0][4]:
        conf = min(0.99, conf + 0.12)
        rationale.append("title_keyword_boost")

    primary = best[0][1]
    group_ids = [best[0][2]]
    rationale.append(
        f"primary:{primary} score={top_score:.1f} hits={','.join(best[0][3][:6])} in={','.join(best[0][4])}"
    )

    secondaries = []
    for sc, sid, gid, hits, wheres in best[1:6]:
        # keep strong runners-up OR any title hit with meaningful score (multi-label law texts)
        title_hit = "title" in wheres and sc >= 3.0
        strong = sc >= max(3.0, top_score * 0.25)
        if strong or title_hit:
            secondaries.append(sid)
            if gid not in group_ids:
                group_ids.append(gid)
            rationale.append(f"secondary_subject:{sid} score={sc:.1f} hits={','.join(hits[:4])}")

    # merge lexicon tags into secondary list (string tags, not necessarily subject ids)
    for t in secondary_tags:
        if t not in secondaries and t != primary:
            secondaries.append(t)

    pending = conf < min_accept
    if pending:
        rationale.append(f"confidence {conf:.2f} < min_accept {min_accept} → 待確認")
        return SubjectResult(
            primary=None,
            secondary=secondaries,
            group_ids=group_ids,
            confidence=conf,
            rationale=rationale,
            pending=True,
            tags=secondaries,
            model_hook="rules_keywords_v1",
        )

    tags = [primary] + [s for s in secondaries if s != primary]
    return SubjectResult(
        primary=primary,
        secondary=secondaries,
        group_ids=group_ids,
        confidence=conf,
        rationale=rationale,
        pending=False,
        tags=tags,
        model_hook="rules_keywords_v1",
    )


def local_model_classify_stub(text: str) -> Optional[SubjectResult]:
    """Hook for Ollama/local small model — not wired; no paid APIs."""
    return None
