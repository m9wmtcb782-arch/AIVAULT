# 公開學習管線 ↔ 電子書架分類介面

對齊 `ebook/classify/tronclass-iface.md`／`connectors/tronclass/docs/tronclass-iface.md` 的 enqueue 欄位，並多帶 provenance。

```ts
enqueueClassify({
  fileId,       // catalog id 或穩定公開稿 id
  fileName,
  courseId,     // 公開稿可空字串
  courseCode,
  academicYear,
  semester,
  sha256,
  privatePath,
  provenanceSource: 'public_source',
})
```

- 分類失敗**不**阻擋 ingest stub／私人路徑紀錄  
- 不得因公開稿成功而設定 `tronclassE2eSuccess=true`  
- 人工鎖定分類（#36）不得被本管線下次 run 覆蓋  

暗星學習事件：

```ts
learnNotify({
  type: 'darkstar.public_material.learn',
  provenance: 'public_source',
  tronclassE2eSuccess: false,
  title, sha256, sourceUrl, citeAs, chunksIndexed: 0,
})
```

正式 chunk 寫入 KB／書架：接既有 `dark-star-ebook-ingest` 或 `import-public-ebook-json`（owner 流程）；本骨架僅 stub。
