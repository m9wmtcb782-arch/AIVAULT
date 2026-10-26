# Ebook dual-layer auto-classification

1. **Format** — magic-byte sniff (`pdf` / `powerpoint` / `word` / `other`). Extension is hint only; wrong extension still classified by content. Other is never deleted.
2. **Subject** — expandable `ebook/classify/taxonomy.json` + keyword/rule classifier; low confidence → `待確認`. Manual override (`manual_locked`) is never overwritten on sync.
3. **Shelf UI** — additive format + subject filters (combinable). `?dualClassify=0` disables.
4. **TronClass** — `queue.enqueue_from_tronclass(materialMeta, stored)` matches connector `enqueueClassify` stub. Classify failure does not block private storage.

No paid APIs. Optional Ollama hook is stubbed only.
