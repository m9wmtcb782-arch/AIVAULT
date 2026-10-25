import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT))

from research.ebook_dual_classify.queue import ClassifyQueue, enqueue_classify


def test_enqueue_dedupe_and_nonblocking_process():
    q = ClassifyQueue()
    meta = {
        "fileId": "f1",
        "fileName": "食品安全管理措施限制.pdf",
        "courseCode": "LAW101",
        "academicYear": "114",
        "semester": "1",
        "courseId": "c1",
        "downloadAllowed": True,
    }
    stored = {
        "fileId": "f1",
        "sha256": "abc",
        "privatePath": str(ROOT / "fixtures" / "ebook-classify" / "minimal.pdf"),
        "fileName": "食品安全管理措施限制.pdf",
        "courseCode": "LAW101",
        "academicYear": "114",
        "semester": "1",
        "courseId": "c1",
    }
    a = enqueue_classify(meta, stored, q)
    assert a.status == "queued"
    b = enqueue_classify(meta, stored, q)
    assert b.status == "deduped"
    rec = q.process_one(a)
    assert a.status == "done"
    assert rec["classify"]["format_bucket"] == "pdf"
    assert "source_meta" in rec


def test_process_missing_file_does_not_raise():
    q = ClassifyQueue()
    item = q.enqueue_from_tronclass(
        {"fileId": "x", "fileName": "憲法概論.docx"},
        {"fileId": "x", "sha256": "z", "privatePath": "/no/such/file.docx", "fileName": "憲法概論.docx"},
    )
    rec = q.process_one(item)
    assert item.status == "done"  # extension/title path still classifies
    assert "classify" in rec

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
