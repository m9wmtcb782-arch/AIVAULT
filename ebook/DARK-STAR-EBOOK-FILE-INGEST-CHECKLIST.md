# 暗星／Grok：檔案上架檢查清單（實作備忘）

對齊 `ebook/LETTER-TO-DARK-STAR-EBOOK-FILE-INGEST.md`。

1. **意圖**：主人要「檔案→電子書→書架」，不是研究問答。
1b. **檔類型**：**PDF** → 走匯入／查重提醒（不拒絕）。**PPT／PPTX／DOC／DOCX** → **先問**「要不要做成同一份的電子書上架？」；要→再匯入；不要→幫原格式，不強迫。
2. **查重**：書名／作者／已知 id；`POST dark-star-ebook-ingest` `action=book`。
3. **已存在**：**只提醒**「書架上已有這本」＋ id + `dark-star-ebook.html?ebook_id=`；**不准拒絕**。繼續問：打開／解說／重做／改 metadata／分類／學習？主人堅持重做就幫。
4. **有公開 URL**：Grok Bot 下載（僅合法公開來源）→ 抽全文 → create/append/finalize 或 `import-public-ebook-json`；metadata 標 `public_source`。
5. **僅聊天附件 PDF**：前端目前只傳檔名；說明缺口並改走編輯頁「文件匯入」或把檔交給 Grok Bot；**禁止**教貼全文；勿把缺口說成「拒絕」。
6. **人類編輯頁**：`dark-star-ebook-editor.html` → 選檔 → 開始匯入。
7. **成功條件**：遠端 `book` 讀得到頁；有 ebook_id；未擅自刪舊書。
8. **部署**：本教戰規則進 `ai-gateway` 的 `DARK_STAR_STARTUP_FILES` 後，需合併 main 並部署 gateway 才會注入正式暗星開場；未部署前以庫內文件為準。

已知例：《當行政遇上科學》→ `2837c534-3cc4-4e3d-bc12-4b770c196b30`  
https://m9wmtcb782-arch.github.io/AIVAULT/dark-star-ebook.html?ebook_id=2837c534-3cc4-4e3d-bc12-4b770c196b30
