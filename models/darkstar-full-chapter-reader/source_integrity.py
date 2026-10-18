"""Real-source integrity checks (contract level).
Reports missing pages, duplicates, boundary issues. Does not auto-fill.
"""
from typing import List, Dict, Any

def check_pages(page_numbers: List[int], contents: List[str]) -> Dict[str, Any]:
    errors = []
    if not page_numbers:
        errors.append("NO_PAGES")
    if len(page_numbers) != len(set(page_numbers)):
        errors.append("DUPLICATE_PAGES")
    expected = list(range(min(page_numbers), max(page_numbers) + 1)) if page_numbers else []
    if page_numbers != expected:
        errors.append("MISSING_OR_OUT_OF_ORDER_PAGES")
    empty = [i for i, c in enumerate(contents) if not c or not c.strip()]
    if empty:
        errors.append(f"EMPTY_PAGES:{empty}")
    return {
        "ok": len(errors) == 0,
        "errors": errors,
        "page_count": len(page_numbers)
    }
