# 給暗星：檔案做成電子書上架（禁止叫人貼全文）

暗星：主人說「把檔案製作成電子書放上書架」時，**先讀本檔**。不准把《電子法律教材使用說明》第 3～4 頁的「把 PDF 全文複製貼進正文輸入區」當成你給主人的標準作業。

## 一句話

優先：**檔案／公開網址 → 查重 → 匯入管線 → 回報 ebook_id 與閱讀連結**。  
禁止：叫主人把整本 PDF 文字貼進聊天或 `dark-star-ebook-editor.html` 正文框當主要做法。

## 已知書目（先查重，勿重複上架）

| 書名 | ebook_id | 狀態（2026-10-26 實測） |
|---|---|---|
| 當行政遇上科學：從風險評估談起——以美國法為例（宮文祥） | `2837c534-3cc4-4e3d-bc12-4b770c196b30` | 遠端已有，38 頁，可讀 |
| 中藥材食品原料法規彙編｜認定基準草案＋37項品項表 | `8a7104ed-c1b2-4781-8b34-835ec61c8d97` | 遠端已有，40 頁 |
| 食品安全管理措施限制食品業者基本權利之正當性探討——德國司法實務之觀察（林昱梅） | `9a3a2a12-66c6-4864-9ee3-753c1b1a329a` | 遠端已有 |
| 第八章　国家机构体系 | `65d955cf-9dce-402c-a938-5a762acafdf1` | 遠端已有 |

查重方式（擇一即可）：

1. 用 ingest `action=book` + `ebook_id` + `page_number=1`；`ok` 且有 `total_pages` → 已上架。
2. 對照本表書名／作者；標題近似（破折號全形／半形差異）視為同一本。
3. **幽靈 id 勿用**：`88b895c3-c7c9-49b8-aac2-d57edc9bae20` 會回 `BOOK_NOT_FOUND`，不是正式書。

若已在書架：直接回繁中短句＋連結，**不要再匯入**：

> 這本已在書架。ebook_id=`2837c534-…`。打開：  
> https://m9wmtcb782-arch.github.io/AIVAULT/dark-star-ebook.html?ebook_id=2837c534-3cc4-4e3d-bc12-4b770c196b30

## 兩條真實路徑（分清人／代理）

### A. 人類在工作中心（有檔案時）

1. 開 `dark-star-ebook-editor.html`。
2. 填書名、作者、版本、說明。
3. **用「文件匯入」選 PDF／Word／PPT 等檔案**（頁面已支援；pdf.js 抽文字＋本機 FlipBook）。
4. 再按「開始匯入」→ 前端呼叫 `create → append → finalize`。
5. **不要**把整本 PDF 複製貼進「正文輸入區」當預設教法；文字貼上只是後備，不是檔案流程。

### B. 代理／暗星／Grok Bot（檔案上架）

後端入口：

`POST https://clcddygkaaqqtsbswgdf.supabase.co/functions/v1/dark-star-ebook-ingest`

動作：`create`（title 必填）→ 多次 `append`（job_id、sequence_no、content）→ `finalize`（job_id）。  
讀取：`book` / `toc` / `context` / `status`。  
公開 JSON 批次（Actions，需 secret）：`.github/workflows/import-public-ebook-json.yml` + `.github/scripts/import_public_ebook_json.py`。

前端共用函式：`ebook/aivault-ebook-lib.js` 的 `importFile`、`pushTextToIngest`、`ingest`。

**聊天室現況缺口（要誠實講）：**

- `technical-dark-star.html` 收到 PDF 時，附件內容只有 `"[PDF] " + 檔名`，**沒有**把 PDF 位元組或全文交給你，也**沒有**從聊天直接呼叫 create/append/finalize 的一鍵按鈕。
- 因此你**不能**假裝「已把剛傳的 PDF 做成電子書」。
- 正確回覆擇一：
  1. 若書已在書架（見上表）→ 給連結與 id。
  2. 若是新書且你拿不到檔案內容 → 請主人把 **PDF 檔或公開網址** 交給 **Grok Bot**（或本人到編輯頁用檔案選取上傳），你不要叫他貼全文。
  3. 若有合法公開 PDF（例如衛福部公開稿）→ 可請 Grok Bot 走公開匯入管線；標 `public_source`；禁付費 OCR／禁自動亂註冊。

## 成功／失敗怎麼說

成功（有真實 ebook_id，且 `book` 讀得到頁）：

> 已上架。《書名》。ebook_id=…。閱讀：https://m9wmtcb782-arch.github.io/AIVAULT/dark-star-ebook.html?ebook_id=…

失敗／缺口：

> 聊天裡我讀不到 PDF 內文，無法直接上架。請把檔案或公開網址交給 Grok Bot，或到 dark-star-ebook-editor.html 用「文件匯入」選檔。不要貼整本文字。

## 禁止

- 假成功、假 commit、假「已加入書目」。
- 叫主人把整本 PDF 貼進正文框或聊天當主要流程。
- 付費 OCR／付費 API。
- 刪除或覆寫既有遠端書（保護 `2837c534-…` 等正式 id）。
- 用幽靈 id `88b895c3-…` 當已上架證據。

## 相關檔

- 說話與抽全文：`ebook/LETTER-TO-DARK-STAR-EBOOK-AND-SPEECH.md`
- GitHub 推檔權限：`ebook/LETTER-TO-DARK-STAR-GITHUB-PERMISSION.md`
- API 盤點：`EBOOK_FRONTEND_API_REPORT.md`
- 編輯頁：`dark-star-ebook-editor.html`
- 閱讀／書架：`dark-star-ebook.html`、`aivault-ebook-shelf.html`
