# AIVAULT 電子書前台｜API 實測報告

入口：`POST https://clcddygkaaqqtsbswgdf.supabase.co/functions/v1/dark-star-ebook-ingest`

前端只使用公開 anon JWT，未放入 service_role / Gemini / Groq secret。

## 已確認存在的 action（2026-09-23 再測）

| action | 必要欄位 | 實測 |
|---|---|---|
| create | title | HTTP 200，回傳 ebook_id / source_id / job_id |
| append | job_id, sequence_no, content | job 存在時可寫入 |
| finalize | job_id | job 存在時可完結並建頁／目錄 |
| status | job_id | 查 `dark_star_ebook_ingestion_jobs` |
| book | ebook_id, page_number | HTTP 200，回傳 ebook + page.content |
| toc | ebook_id | HTTP 200，回傳 toc[] |
| context | ebook_id, page_number, radius | HTTP 200，回傳前後頁 |
| progress | ebook_id, reader_id（UUID） | GET 可空；save:true 可寫入 dark_star_ebook_reading_progress |

## 不存在的 action（HTTP 400 unknown action）

list / books / catalog / library / publish / archive / cover / update / metadata / search / bookmark / notes / help

因此學生端沒有官方書單 API。書架由本機 catalog + IndexedDB + 已知遠端教材組成，不偽造書目。

## 直連 REST

anon 對既有表仍是 permission denied（42501）。缺少：

- dark_star_ebook_bookmarks
- dark_star_ebook_notes

第一階段書籤／筆記／全文索引放 IndexedDB `aivault_flipbook_v1`。未 DROP、未 reset、未改 ai-gateway / technical-dark-star。

可選 ADD SQL：`ebook/supabase-ebook-extend.sql`

## 前台檔案

- `dark-star-ebook.html` 數位書架 + FlipBook 閱讀器
- `aivault-ebook-shelf.html` 書架捷徑
- `dark-star-ebook-classic.html` 原閱讀器（功能保留）
- `dark-star-ebook-editor.html` 管理員匯入（新增 PDF/Office/圖片，原文字流程保留）
- `ebook/aivault-ebook-lib.js` 共用 ingest + IndexedDB + 匯入
- `ebook/aivault-flipbook-app.js` 翻頁／工具列
- 暗星解說走既有 `ai-gateway`，請求帶 book_id、page_number、頁面原文、章節
