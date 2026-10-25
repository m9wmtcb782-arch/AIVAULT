# 東吳 TronClass 教材同步 v1

入口：`aivault-tronclass.html`，電子書架有「TronClass 同步」連結。
後端：既有 `dark-star-ebook-ingest?feature=tronclass-sync`，不新增 Edge Function。

## 使用與驗收

1. 登入 AIVAULT 擁有者／管理者帳號。
2. 開啟同步頁，按「測試連線／載入登入驗證碼」。後端檢查完成才顯示學校帳密輸入。
3. 輸入東吳學號、密碼；學校要求驗證碼時顯示圖片並由使用者填入。
4. 登入必須由課程 API 的 JSON 回應確認，不把 200 HTML 或重新導向判作成功。
5. 首次選一門課同步，在書架驗收頁數與全文。通過後再同步所選學期全部課程。
6. 再同步相同教材應略過；內容變更時匯入新版本，保留舊版本與筆記在「TronClass／舊版本」。

## 邊界

- 第一版只匯入目前瀏覽器 IndexedDB；不會上傳教材到共用雲端書架，也不會新增雲端全文問答。
- 帳密、校方 Cookie、完整下載簽名網址不寫入資料庫、localStorage、URL 或應用程式日誌。
- 短期校方 Cookie 以 AES-GCM 加密、綁定伺服器驗證的 AIVAULT user ID，僅存頁面記憶體；15 分鐘未使用會過期。離開頁面即丟棄，清除按鈕不代表撤銷校方所有 session。
- 只向三個固定 HTTPS 校方主機連線，每次重新導向都檢查目的地，Cookie 由 tough-cookie 按網域與路徑隔離。校方另用 CDN 時會明確失敗，需核對來源後擴充名單。
- 密碼只提交一次，不自動重試、不辨識或繞過驗證碼。不處理點名、考試或作業繳交。
- 每次下載重新呼叫檔案網址 API；不快取下載簽名。不繞過伺服器下載權限。
- PDF、DOCX、PPTX、TXT/MD；舊 DOC/PPT 只嘗試平台提供的 PDF 預覽。單檔 15 MiB，超限明確失敗。影片、掃描檔 OCR、其他格式與背景排程尚未支援。
- 批次同步需保持本頁開啟；停止會等目前這份教材完成。瀏覽器清除網站資料會刪除本機教材。
- 教材活動、參照 ID 欄位和學期欄位仍須以使用者真實課程驗收。空清單不視為「課程確實沒有教材」。

## 驗證狀態（2026-10-26）

- CONFIRMED：19 項離線測試通過：憑證與身分隔離、登入判定、重新導向限制、重新取得網址、下載大小限制、前端匯入／去重／版本保留／失敗處理。
- CONFIRMED：連上東吳真實登入頁，讀到 CAS 表單；該次回應沒有驗證碼欄位，另以測試資料驗證有驗證碼的流程。
- CONFIRMED：後端已部署到既有入口（version 124）；原 `list` 仍回 200，新入口對 anon 金鑰回 401。
- NOT VERIFIED：真人帳號登入、真實課程清單、教材參照格式與下載、iPhone Safari 全文閱讀；需使用者在入口輸入帳密後驗收。
- NOT VERIFIED：真實瀏覽器視覺與操作測試；本環境未能下載 Chromium。DOM 行為測試已通過。

## 開發測試

Node.js 24：

```sh
cd integrations/tronclass
npm ci --ignore-scripts
npm test
```

有 Playwright 與 Chromium 的環境可額外執行 `node ui-check.cjs`。這是使用假課程回應的操作測試，不能代替真實帳號驗收。
部署時必須連同 `supabase/functions/dark-star-ebook-ingest/tronclass-sync.ts` 與 `integrations/tronclass/core.mjs` 上傳，保留既有入口與依賴檔案，不新增函式、不修改方案。
