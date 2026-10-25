import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT))

from research.ebook_dual_classify.format_detect import detect_format

FIX = ROOT / "fixtures" / "ebook-classify"
REAL_PDF = Path("/workspace/ebooks/zhongyao-criteria/source.pdf")
REAL_DOCX = Path("/workspace/sample.docx")
REAL_PPTX = Path("/workspace/sample.pptx")


def test_minimal_pdf_magic():
    r = detect_format(FIX / "minimal.pdf")
    assert r.bucket == "pdf" and r.sniff_matched


def test_pdf_wrong_extension():
    r = detect_format(FIX / "actually-pdf.docx", filename="actually-pdf.docx")
    assert r.bucket == "pdf" and r.sniff_matched
    assert r.extension_hint == ".docx"


def test_minimal_docx_ooxml():
    r = detect_format(FIX / "minimal.docx")
    assert r.bucket == "word" and r.sniff_matched


def test_minimal_pptx_ooxml():
    r = detect_format(FIX / "minimal.pptx")
    assert r.bucket == "powerpoint" and r.sniff_matched


def test_ole_doc_hint():
    r = detect_format(FIX / "ole-as.doc")
    assert r.bucket == "word"


def test_ole_undifferentiated():
    r = detect_format(FIX / "ole-header.bin", filename="mystery.bin")
    assert r.bucket == "other"


def test_real_zhongyao_pdf_if_present():
    if not REAL_PDF.is_file():
        return
    r = detect_format(REAL_PDF)
    assert r.bucket == "pdf" and r.confidence >= 0.9


def test_real_sample_docx_if_present():
    if not REAL_DOCX.is_file():
        return
    r = detect_format(REAL_DOCX)
    assert r.bucket == "word"


def test_real_sample_pptx_if_present():
    if not REAL_PPTX.is_file():
        return
    r = detect_format(REAL_PPTX)
    assert r.bucket == "powerpoint"

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
