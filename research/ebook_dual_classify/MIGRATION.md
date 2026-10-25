# Dual-classify migration (additive only)

## What is added
- Virtual tags in `localStorage` key `aivault_ebook_classify_tags` (browser) and optional `classify` object on records.
- Fields (all optional / additive):
  - `format_bucket`, `format_meta`
  - `primary_subject`, `secondary_tags`, `group_ids`, `tags`
  - `confidence`, `rationale`, `pending`
  - `manual_locked`, `user_override`, `override_at`
  - `source_meta` (school, course, semester, file meta)
- SQL (future, not applied in this PR): `ALTER` / JSON column add only — never DROP.

## What is NOT done
- No file moves/renames for taxonomy
- No deletes of shelved ebooks
- No changes to `?ebook_id=` URL contract
- No overwrite of original private binaries
- Pages formal deploy deferred until backup + green tests

## Rollback
- Remove `ebook/classify/*.js` script tags from `dark-star-ebook.html` or set `?dualClassify=0`
- Reader filter hook no-ops when `AivaultDualClassify` absent
- Clear `aivault_ebook_classify_tags` in localStorage if needed

## Backup note
Before Pages deploy of shelf UI: snapshot `dark-star-ebook.html`, `ebook/aivault-reader-20261013.js`, and current Pages artifact. Prefer draft PR merge after review.
