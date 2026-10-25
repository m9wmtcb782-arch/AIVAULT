"""Content-based format detection (magic bytes). Extension is a hint only."""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import BinaryIO, Optional, Union

PathLike = Union[str, Path]


@dataclass
class FormatResult:
    bucket: str  # pdf | powerpoint | word | other
    label: str
    mime: str
    confidence: float
    rationale: str
    extension_hint: Optional[str] = None
    sniff_matched: bool = False


_LABELS = {
    "pdf": "PDF",
    "powerpoint": "PowerPoint",
    "word": "Word",
    "other": "其他檔案",
}


def _ext(path: Optional[PathLike]) -> Optional[str]:
    if not path:
        return None
    return Path(path).suffix.lower() or None


def _read_head(source: Union[PathLike, bytes, BinaryIO], n: int = 16) -> bytes:
    if isinstance(source, (bytes, bytearray)):
        return bytes(source[:n])
    if hasattr(source, "read"):
        pos = None
        try:
            pos = source.tell()
        except Exception:
            pos = None
        data = source.read(n)
        if pos is not None:
            try:
                source.seek(pos)
            except Exception:
                pass
        return data or b""
    with open(source, "rb") as f:
        return f.read(n)


def _is_ole(head: bytes) -> bool:
    return head.startswith(b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1")


def _is_zip(head: bytes) -> bool:
    return head.startswith(b"PK\x03\x04") or head.startswith(b"PK\x05\x06") or head.startswith(b"PK\x07\x08")


def _zip_has_entry(path: PathLike, needle: bytes) -> bool:
    """Scan central directory names without full extract (small files OK)."""
    try:
        import zipfile

        with zipfile.ZipFile(path) as zf:
            names = "\n".join(zf.namelist()).encode("utf-8", "ignore")
            return needle in names
    except Exception:
        return False


def detect_format(
    source: Union[PathLike, bytes, BinaryIO],
    *,
    filename: Optional[str] = None,
) -> FormatResult:
    path: Optional[Path] = None
    if isinstance(source, (str, Path)):
        path = Path(source)
        filename = filename or path.name
    head = _read_head(source if path is None else path, 16)
    ext = _ext(filename)

    if head.startswith(b"%PDF"):
        return FormatResult(
            bucket="pdf",
            label=_LABELS["pdf"],
            mime="application/pdf",
            confidence=0.99,
            rationale="magic:%PDF",
            extension_hint=ext,
            sniff_matched=True,
        )

    if _is_zip(head) and path is not None:
        if _zip_has_entry(path, b"word/"):
            return FormatResult(
                bucket="word",
                label=_LABELS["word"],
                mime="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                confidence=0.97,
                rationale="OOXML ZIP contains word/",
                extension_hint=ext,
                sniff_matched=True,
            )
        if _zip_has_entry(path, b"ppt/") or _zip_has_entry(path, b"presentation"):
            return FormatResult(
                bucket="powerpoint",
                label=_LABELS["powerpoint"],
                mime="application/vnd.openxmlformats-officedocument.presentationml.presentation",
                confidence=0.97,
                rationale="OOXML ZIP contains ppt/ or presentation",
                extension_hint=ext,
                sniff_matched=True,
            )
        # zip but unknown → other (could be xlsx etc.)
        return FormatResult(
            bucket="other",
            label=_LABELS["other"],
            mime="application/zip",
            confidence=0.7,
            rationale="ZIP container without word/ppt markers",
            extension_hint=ext,
            sniff_matched=True,
        )

    if _is_zip(head) and path is None:
        # bytes-only ZIP: cannot inspect entries deeply without temp; mark other/zip
        return FormatResult(
            bucket="other",
            label=_LABELS["other"],
            mime="application/zip",
            confidence=0.55,
            rationale="ZIP magic without path to inspect entries",
            extension_hint=ext,
            sniff_matched=True,
        )

    if _is_ole(head):
        # OLE: .doc / .ppt / .xls — prefer extension as weak hint only after sniff
        if ext in (".ppt", ".pps"):
            bucket, mime, why = "powerpoint", "application/vnd.ms-powerpoint", "OLE + .ppt hint"
            conf = 0.75
        elif ext in (".doc",):
            bucket, mime, why = "word", "application/msword", "OLE + .doc hint"
            conf = 0.75
        else:
            # Without compound stream parse, stay Other rather than force
            bucket, mime, why = "other", "application/x-ole-storage", "OLE compound storage (doc/ppt/xls undifferentiated without stream parse)"
            conf = 0.5
        return FormatResult(
            bucket=bucket,
            label=_LABELS[bucket],
            mime=mime,
            confidence=conf,
            rationale=why,
            extension_hint=ext,
            sniff_matched=True,
        )

    # Fallback: extension hint only, low confidence, still never delete
    if ext == ".pdf":
        return FormatResult("pdf", _LABELS["pdf"], "application/pdf", 0.35, "extension-only:.pdf (no %PDF magic)", ext, False)
    if ext in (".pptx", ".ppt"):
        return FormatResult("powerpoint", _LABELS["powerpoint"], "application/vnd.ms-powerpoint", 0.35, f"extension-only:{ext}", ext, False)
    if ext in (".docx", ".doc"):
        return FormatResult("word", _LABELS["word"], "application/msword", 0.35, f"extension-only:{ext}", ext, False)
    return FormatResult("other", _LABELS["other"], "application/octet-stream", 0.9, "no known magic; bucket=other (never delete)", ext, False)
