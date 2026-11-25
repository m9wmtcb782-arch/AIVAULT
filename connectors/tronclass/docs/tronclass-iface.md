# Shared interface with `feat/ebook-shelf-dual-classify-v1`

Copied onto `feat/tronclass-connector-v1` for Issue #38 — **do not merge #37** from this branch.

```ts
// connectors/tronclass/src/notify.ts
enqueueClassify(materialMeta, stored)  // fire-and-forget; errors swallowed

// classify branch consumes:
research.ebook_dual_classify.queue.enqueue_classify(material_meta, stored)
// or browser: AivaultClassifyQueue.enqueueClassify(materialMeta, stored)
```

Payload fields used: `fileId`, `fileName`, `courseId`, `courseCode`, `academicYear`, `semester`, `sha256`, `privatePath`.

Live E2E TronClass auth → download → classify: **BLOCKED** until school authorization confirmed.
