# Acceptance report — ebook shelf dual-layer classify v1

Time zone: Asia/Taipei (UTC+8). No paid APIs. No mock catalog claiming success.

## 1. Existing ebook count & format stats (REAL)

| Source | Count | Notes |
|--------|------:|-------|
| Seed in `dark-star-ebook.html` | **4** | All remote shelf entries |
| `private/ebooks/*.json` (plain) | **1** | `zhongyao-food-bundle.json` |
| `private/ebooks/*.json.gpg` | **1** | Encrypted; body not audited |
| Supabase live table count | **BLOCKED** | No service-role credentials this run; not invented |

Format stats from binaries sniffed this run:
| Sample | Result |
|--------|--------|
| `/workspace/ebooks/zhongyao-criteria/source.pdf` | PDF (magic `%PDF`) |
| `/workspace/sample.docx` | Word (OOXML `word/`) |
| `/workspace/sample.pptx` | PowerPoint (OOXML `ppt/`) |
| `fixtures/ebook-classify/actually-pdf.docx` | PDF despite `.docx` extension |

Seed books themselves are catalog metadata (no binaries in repo for all four). Assumed historical ingest format for the four remote legal/food texts: PDF (documented in AUDIT.md; not claimed from live DB).

## 2. Subject distribution (after classifying seed)

See `AUDIT.md`. Primary counts:
- 食品與藥物管制法: 2
- 行政法: 1
- 憲法: 1
- 待確認: 0 (seed)

## 3. Unclassifiable / pending

None at primary level for current seed. Low-confidence path verified in unit test (`test_low_confidence_pending`). Encrypted `c8743d50.json.gpg` body **not** classified (cannot decrypt here).

## 4. Format + subject tests

| Case | Status |
|------|--------|
| Real PDF sniff + zhongyao subject | **PASS** |
| Real PPTX sniff (`/workspace/sample.pptx`) | **PASS** (format) |
| Real DOCX sniff (`/workspace/sample.docx`) | **PASS** (format) |
| PPT/DOC **subject** E2E on TronClass course decks | **BLOCKED** — no real course PPT/DOC textbooks in shelf; only format sniff + minimal OOXML fixtures |
| Example multi-tag 食安法教材 | **PASS** → 食品與藥物管制法 + 行政法 + 食品安全 |

Unit tests: **16 passed** (`python3 -m unittest research.ebook_dual_classify.tests...`).

## 5. Shelf UI filters

Additive `#dualFilterBar` via `ebook/classify/shelf-filters.js`, wired in `dark-star-ebook.html`. Reader hook in `aivault-reader-20261013.js` calls `AivaultDualClassify.filterBooks` when present. Combinable format × subject. `?dualClassify=0` disables. Existing `?ebook_id=` URLs untouched. Formal Pages deploy: **not done** this PR (draft; backup note in MIGRATION.md).

Manual UI browser click-through: not automated in CI; code path + progressive degrade verified by hook presence.

## 6. TronClass → classify E2E

**BLOCKED** until school authorization / `feat/tronclass-connector-v1` live auth. Queue interface test: **PASS** (`test_queue.py` enqueue/dedupe/process; failures non-blocking). Shared contract: `ebook/classify/tronclass-iface.md`.

## Manual override preservation

`manual_locked` / `user_override` on classify record / `aivault_ebook_classify_tags`. `apply_classification` skips subject overwrite when locked (`test_manual_override_not_overwritten`).

## Protection checklist

- [x] No delete of shelved ebooks
- [x] No `ebook_id` URL break
- [x] No overwrite of original binaries
- [x] Virtual tags only
- [x] No paid APIs
- [x] Draft PR preferred for UI touch
