"""Classify queue stub for TronClass sync → dual-classify handoff.

Interface aligned with connectors/tronclass notify.enqueueClassify(materialMeta, stored):
  after private storage commit → enqueue; classify failure must NOT affect storage.
"""
from __future__ import annotations

import hashlib
import json
import traceback
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

from .format_detect import detect_format
from .override import apply_classification
from .subject_classify import classify_subject


@dataclass
class QueueItem:
    file_id: str
    sha256: str
    private_path: str
    file_name: str
    course_code: str = ""
    academic_year: str = ""
    semester: str = ""
    course_id: str = ""
    school: str = "SCU"
    status: str = "queued"  # queued|done|failed|deduped
    error: Optional[str] = None
    ebook_record_id: Optional[str] = None


@dataclass
class ClassifyQueue:
    """In-memory + optional JSONL persistence. Dedupes by file_id+sha256."""

    path: Optional[Path] = None
    items: List[QueueItem] = field(default_factory=list)
    seen: Dict[str, str] = field(default_factory=dict)  # key -> status
    on_classified: Optional[Callable[[dict], None]] = None

    def _key(self, file_id: str, sha256: str) -> str:
        return f"{file_id}:{sha256}"

    def enqueue_from_tronclass(
        self,
        material_meta: Dict[str, Any],
        stored: Dict[str, Any],
    ) -> QueueItem:
        """Stub consumer matching TS enqueueClassify(materialMeta, stored)."""
        file_id = str(material_meta.get("fileId") or stored.get("fileId") or "")
        sha256 = str(stored.get("sha256") or "")
        item = QueueItem(
            file_id=file_id,
            sha256=sha256,
            private_path=str(stored.get("privatePath") or ""),
            file_name=str(material_meta.get("fileName") or stored.get("fileName") or ""),
            course_code=str(material_meta.get("courseCode") or stored.get("courseCode") or ""),
            academic_year=str(material_meta.get("academicYear") or stored.get("academicYear") or ""),
            semester=str(material_meta.get("semester") or stored.get("semester") or ""),
            course_id=str(material_meta.get("courseId") or stored.get("courseId") or ""),
        )
        k = self._key(file_id, sha256)
        if k in self.seen and self.seen[k] in ("done", "queued", "deduped"):
            item.status = "deduped"
            self.items.append(item)
            self._persist(item)
            return item
        self.seen[k] = "queued"
        self.items.append(item)
        self._persist(item)
        return item

    def process_one(self, item: QueueItem, *, existing_record: Optional[dict] = None) -> dict:
        """Sniff + classify. Never raises to caller for storage safety — sets item.error."""
        record = dict(existing_record or {})
        record.setdefault("title", item.file_name)
        record.setdefault(
            "source_meta",
            {
                "school": item.school,
                "course_code": item.course_code,
                "course_id": item.course_id,
                "academic_year": item.academic_year,
                "semester": item.semester,
                "file_id": item.file_id,
                "sha256": item.sha256,
                "private_path": item.private_path,
                "file_name": item.file_name,
            },
        )
        try:
            path = Path(item.private_path) if item.private_path else None
            if path and path.is_file():
                fmt = detect_format(path, filename=item.file_name)
                text = _extract_text_best_effort(path, fmt.bucket)
            else:
                fmt = detect_format(b"", filename=item.file_name)
                text = ""
            subj = classify_subject(title=item.file_name, body=text)
            record = apply_classification(
                record,
                format_bucket=fmt.bucket,
                format_meta={
                    "mime": fmt.mime,
                    "confidence": fmt.confidence,
                    "rationale": fmt.rationale,
                    "sniff_matched": fmt.sniff_matched,
                },
                subject=subj,
            )
            item.status = "done"
            self.seen[self._key(item.file_id, item.sha256)] = "done"
            if self.on_classified:
                self.on_classified(record)
            self._persist(item)
            return record
        except Exception as e:
            item.status = "failed"
            item.error = f"{e}"
            self.seen[self._key(item.file_id, item.sha256)] = "failed"
            self._persist(item)
            # Do not re-raise — storage already committed upstream
            return record

    def _persist(self, item: QueueItem) -> None:
        if not self.path:
            return
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self.path.open("a", encoding="utf-8") as f:
            f.write(json.dumps(asdict(item), ensure_ascii=False) + "\n")


def enqueue_classify(
    material_meta: Dict[str, Any],
    stored: Dict[str, Any],
    queue: Optional[ClassifyQueue] = None,
) -> QueueItem:
    q = queue or ClassifyQueue()
    return q.enqueue_from_tronclass(material_meta, stored)


def _extract_text_best_effort(path: Path, bucket: str) -> str:
    if bucket != "pdf":
        return ""
    # Prefer pdftotext if available
    import shutil
    import subprocess

    if shutil.which("pdftotext"):
        try:
            out = subprocess.check_output(
                ["pdftotext", "-l", "5", "-enc", "UTF-8", str(path), "-"],
                stderr=subprocess.DEVNULL,
            )
            return out.decode("utf-8", "ignore")
        except Exception:
            pass
    # raw latin1 scrape of first bytes for keywords
    try:
        data = path.read_bytes()[:200000]
        return data.decode("latin-1", "ignore")
    except Exception:
        return ""


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()
