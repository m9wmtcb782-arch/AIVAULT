# Shared interface with `feat/tronclass-connector-v1`

```ts
// connectors/tronclass/src/notify.ts (other branch)
enqueueClassify(materialMeta, stored)  // fire-and-forget; errors swallowed

// this branch consumes:
research.ebook_dual_classify.queue.enqueue_classify(material_meta, stored)
// or browser: AivaultClassifyQueue.enqueueClassify(materialMeta, stored)
```

Payload fields used: `fileId`, `fileName`, `courseId`, `courseCode`, `academicYear`, `semester`, `sha256`, `privatePath`.

Live E2E TronClass auth → download → classify: **BLOCKED** until school authorization confirmed.
