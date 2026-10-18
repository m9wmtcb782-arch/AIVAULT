# Dark Star Full Chapter Reader (Independent)

Independent module. Does not modify formal Dark Star pages, formal DB, or main branch.

## Purpose
Retrieve all pages of a specified chapter sequentially and output the continuous full text.

## Contract
Uses existing ebook API actions:
- `toc` → list of chapters with start_page
- `book` → page.content for a given page_number

## Usage
```python
from reader import FullChapterReader

def fetch(action, payload):
    # Call dark-star-ebook-ingest or equivalent
    ...

reader = FullChapterReader(fetch)
result = reader.read_chapter_full(ebook_id="...", chapter_index=1)  # 1-based
print(result["full_text"])
```

## Status
IMPLEMENTED (code). Live integration NOT TESTED in this step.
Does not claim formal Dark Star already has verbatim full-chapter reading.
