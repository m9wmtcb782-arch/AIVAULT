"""Manual override policy: user locks must not be overwritten by sync/classify."""
from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from .subject_classify import SubjectResult


def _now() -> str:
    return datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")


def set_manual_override(
    record: Dict[str, Any],
    *,
    primary: Optional[str],
    secondary: Optional[list] = None,
    format_bucket: Optional[str] = None,
) -> Dict[str, Any]:
    out = deepcopy(record)
    classify = dict(out.get("classify") or {})
    if primary is not None:
        classify["primary_subject"] = primary
        classify["pending"] = primary == "待確認" or primary is None
    if secondary is not None:
        classify["secondary_tags"] = list(secondary)
    if format_bucket is not None:
        classify["format_bucket"] = format_bucket
    classify["manual_locked"] = True
    classify["user_override"] = True
    classify["override_at"] = _now()
    classify["rationale"] = list(classify.get("rationale") or []) + ["manual_override"]
    out["classify"] = classify
    return out


def apply_classification(
    record: Dict[str, Any],
    *,
    format_bucket: str,
    format_meta: Optional[Dict[str, Any]] = None,
    subject: Optional[SubjectResult] = None,
    force: bool = False,
) -> Dict[str, Any]:
    """Merge auto classification into ebook record. Respects manual_locked unless force."""
    out = deepcopy(record)
    classify = dict(out.get("classify") or {})
    locked = bool(classify.get("manual_locked") or classify.get("user_override"))
    if locked and not force:
        # Still allow format sniff update only if never set; never touch subject fields
        if not classify.get("format_bucket") and format_bucket:
            classify["format_bucket"] = format_bucket
            if format_meta:
                classify["format_meta"] = format_meta
            classify["format_updated_at"] = _now()
            classify["rationale"] = list(classify.get("rationale") or []) + [
                "format_sniff_while_subject_locked"
            ]
        classify["skipped_auto_subject"] = True
        out["classify"] = classify
        return out

    classify["format_bucket"] = format_bucket
    if format_meta:
        classify["format_meta"] = format_meta
    if subject is not None:
        classify["primary_subject"] = subject.primary
        classify["secondary_tags"] = list(subject.secondary)
        classify["group_ids"] = list(subject.group_ids)
        classify["confidence"] = subject.confidence
        classify["rationale"] = list(subject.rationale)
        classify["pending"] = subject.pending
        classify["tags"] = list(subject.tags)
        classify["model_hook"] = subject.model_hook
    classify["manual_locked"] = False
    classify["user_override"] = False
    classify["classified_at"] = _now()
    classify["skipped_auto_subject"] = False
    out["classify"] = classify
    return out
