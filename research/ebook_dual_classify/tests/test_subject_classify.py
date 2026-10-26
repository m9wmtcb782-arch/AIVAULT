import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT))

from research.ebook_dual_classify.subject_classify import classify_subject
from research.ebook_dual_classify.override import apply_classification, set_manual_override


def test_food_safety_example_multi_tags():
    # Construction order example: 食品安全管理措施限制 → 食品與藥物管制法 + 行政法 + 食品安全
    r = classify_subject(
        title="食品安全管理措施限制食品業者基本權利之正當性探討——德國司法實務之觀察",
        body="本文探討食品安全管理措施限制食品業者基本權利之正當性，兼及行政法與德國司法實務。",
    )
    assert not r.pending
    tags = set(([r.primary] if r.primary else []) + list(r.secondary))
    assert "食品與藥物管制法" in tags
    assert "行政法" in tags
    assert "食品安全" in tags


def test_constitution_chapter():
    r = classify_subject(title="第八章　国家机构体系", body="宪法学讲义 国家机构")
    assert r.primary == "憲法" or (r.pending is False and "憲法" in (r.tags or []))


def test_zhongyao_private_body_if_present():
    p = ROOT / "private" / "ebooks" / "zhongyao-food-bundle.json"
    if not p.is_file():
        return
    d = json.loads(p.read_text(encoding="utf-8"))
    body = "\n".join((row.get("content") or "") for row in (d.get("rows") or [])[:8])
    r = classify_subject(title=d.get("title") or "", body=body)
    assert not r.pending
    assert r.primary == "食品與藥物管制法" or "食品與藥物管制法" in r.secondary


def test_low_confidence_pending():
    r = classify_subject(title="無關鍵字的空白講義xyz", body="hello world")
    assert r.pending
    assert r.primary is None


def test_manual_override_not_overwritten():
    rec = {"ebook_id": "x", "title": "t"}
    locked = set_manual_override(rec, primary="民法", secondary=["契約"])
    assert locked["classify"]["manual_locked"] is True
    from research.ebook_dual_classify.subject_classify import classify_subject as cs

    auto = cs(title="食品安全衛生管理法", body="食安 行政法")
    merged = apply_classification(locked, format_bucket="pdf", subject=auto)
    assert merged["classify"]["primary_subject"] == "民法"
    assert merged["classify"].get("skipped_auto_subject") is True

import unittest

def load_tests(loader, tests, pattern):
    suite = unittest.TestSuite()
    g = globals()
    for name, obj in list(g.items()):
        if name.startswith("test_") and callable(obj):
            suite.addTest(unittest.FunctionTestCase(obj))
    return suite

if __name__ == "__main__":
    unittest.main()
