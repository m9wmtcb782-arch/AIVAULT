"""Independent full-chapter reader for AIVAULT Dark Star.
Fetches all pages of a specified chapter sequentially and outputs continuous full text.
Does not modify formal Dark Star pages or formal DB schema.
Uses existing ebook API contract: toc + book actions.
"""
import json
from typing import List, Dict, Any, Optional

class FullChapterReader:
    def __init__(self, fetch_fn):
        """
        fetch_fn(action, payload) -> dict
        Expected actions:
          - toc: {ebook_id} -> {toc: [{title, start_page, end_page?} ...]}
          - book: {ebook_id, page_number} -> {page: {content}}
        """
        self.fetch = fetch_fn

    def get_toc(self, ebook_id: str) -> List[Dict[str, Any]]:
        resp = self.fetch("toc", {"ebook_id": ebook_id})
        return resp.get("toc") or []

    def find_chapter(self, toc: List[Dict[str, Any]], chapter_index: int) -> Optional[Dict[str, Any]]:
        """chapter_index is 1-based."""
        if not toc or chapter_index < 1 or chapter_index > len(toc):
            return None
        return toc[chapter_index - 1]

    def page_range(self, toc: List[Dict[str, Any]], chapter: Dict[str, Any], chapter_index: int) -> range:
        start = int(chapter.get("start_page") or chapter.get("page") or 1)
        # end_page if present, else next chapter start - 1, else single page
        if "end_page" in chapter and chapter["end_page"]:
            end = int(chapter["end_page"])
        elif chapter_index < len(toc):
            next_start = int(toc[chapter_index].get("start_page") or toc[chapter_index].get("page") or start + 1)
            end = max(start, next_start - 1)
        else:
            end = start
        return range(start, end + 1)

    def fetch_page_content(self, ebook_id: str, page_number: int) -> str:
        resp = self.fetch("book", {"ebook_id": ebook_id, "page_number": page_number})
        page = resp.get("page") or {}
        return page.get("content") or ""

    def read_chapter_full(self, ebook_id: str, chapter_index: int) -> Dict[str, Any]:
        toc = self.get_toc(ebook_id)
        chapter = self.find_chapter(toc, chapter_index)
        if not chapter:
            return {"ok": False, "error": "chapter_not_found", "chapter_index": chapter_index}

        pages = list(self.page_range(toc, chapter, chapter_index))
        contents = []
        for p in pages:
            text = self.fetch_page_content(ebook_id, p)
            contents.append(text)

        full_text = "\n\n".join(c for c in contents if c)
        return {
            "ok": True,
            "ebook_id": ebook_id,
            "chapter_index": chapter_index,
            "chapter_title": chapter.get("title"),
            "page_start": pages[0] if pages else None,
            "page_end": pages[-1] if pages else None,
            "page_count": len(pages),
            "full_text": full_text,
            "char_count": len(full_text)
        }

if __name__ == "__main__":
    # Minimal mock for isolation demonstration (not live API)
    def mock_fetch(action, payload):
        if action == "toc":
            return {"toc": [
                {"title": "第一章", "start_page": 1},
                {"title": "第二章", "start_page": 5}
            ]}
        if action == "book":
            p = payload["page_number"]
            return {"page": {"content": f"[第{p}頁全文內容示例]"}}
        return {}

    reader = FullChapterReader(mock_fetch)
    result = reader.read_chapter_full("demo-ebook", 1)
    print(json.dumps(result, ensure_ascii=False, indent=2))
