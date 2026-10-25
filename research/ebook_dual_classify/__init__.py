"""AIVAULT ebook dual-layer classification: format sniff + subject tags (local rules only)."""
from .format_detect import detect_format
from .subject_classify import classify_subject
from .override import apply_classification, set_manual_override
from .queue import enqueue_classify, ClassifyQueue

__all__ = [
    "detect_format",
    "classify_subject",
    "apply_classification",
    "set_manual_override",
    "enqueue_classify",
    "ClassifyQueue",
]
