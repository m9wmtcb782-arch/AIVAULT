# AIVAULT 電子書前台｜API 實測報告

入口：`POST https://clcddygkaaqqtsbswgdf.supabase.co/functions/v1/dark-star-ebook-ingest`

前端只使用公開 anon JWT，未放入 service_role / Gemini / Groq secret。

## 已確認存在的 action

| action | 必要欄位 | 實測 |
|---|---|---|
| create | title | HTTP 400 `title required`；補 title 後 HTTP 500 `permission denied for table dark_star_legal_sources` |
| append | job_id, sequence_no, content | HTTP 400 缺欄位；欄位齊但 job 不存在時 HTTP 404 `job not found` |
| finalize | job_id | HTTP 400 `job_id required`；job 不存在 HTTP 404 `job not found` |
| status | job_id（不是 ebook_id） | 有 job_id 時查 `dark_star_ebook_ingestion_jobs`，anon 權限不足 HTTP 404/500 |
| book | ebook_id, page_number | HTTP 404 `permission denied for table dark_star_ebooks` |
| toc | ebook_id | HTTP 500 `permission denied for table dark_star_ebook_toc` |
| context | ebook_id, page_number, radius | HTTP 500 `permission denied for table dark_star_ebook_pages` |
| progress | ebook_id, reader_id（UUID） | HTTP 400 `ebook_id required`；reader_id 非 UUID 會炸；有 UUID 時 HTTP 500 `permission denied for table dark_star_ebook_reading_progress` |

## 不存在的 action（HTTP 400 unknown action）

list / books / catalog / library / publish / archive / cover / update / metadata / help 等。

因此學生端沒有「官方書單 API」。前台只用本機成功匯入紀錄 + 手動輸入 ebook_id，沒有偽造書目。

## 根因（前端無法修復）

Edge Function 以呼叫者 JWT（anon）存取：

- dark_star_legal_sources
- dark_star_ebooks
- dark_star_ebook_pages
- dark_star_ebook_toc
- dark_star_ebook_ingestion_jobs
- dark_star_ebook_reading_progress

這些表未 GRANT 給 anon。依規格不修改後端、不重建資料庫。

## 前台檔案

- `dark-star-ebook.html` 學生閱讀器
- `dark-star-ebook-editor.html` 管理員匯入
- 暗星解說走既有 `ai-gateway`
