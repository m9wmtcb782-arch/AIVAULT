# 暗星「公開同源比對提取」學習管線設計

> 基地：`m9wmtcb782-arch/AIVAULT`  
> 分支：`feat/dark-star-public-material-learn-v1`  
> 狀態：設計＋可跑骨架（離線 fixture）— **未**宣稱暗星已學會真實課件  
> 與 TronClass：**嚴格分離**（替代／並行管線，**不是**帳密登入同步）

## 1. 問題與答案

**使用者意圖：** 不要靠學校「未確認」的 TronClass 自動登入；只要「相同教材」時，用公開來源比對提取（先前衛福部 PDF 做法），並讓暗星可學習。

**答案：YES。** 本文件定義管線；實作骨架在 `connectors/public-material-learn/`。

## 2. 管線總覽

```
Input(清單／檔名／name=)
    → Normalize + Match(公開 catalog / allowlist 搜尋)
        → [信心不足] → Human「待確認」
        → [信心足夠] → Fetch(僅 allowlist 公開 URL)
            → Provenance(source=public_source, tronclassE2eSuccess=false)
            → Ingest(私人 ebook／知識片段 hook)
            → enqueueClassify(#36 分類佇列)
            → learnNotify(暗星 KB 更新 stub)
```

**Provenance 鐵律：** 公開稿成功 ≠ TronClass E2E 成功。任何 `public_source` 紀錄的 `tronclassE2eSuccess` 必須為 `false`。

## 3. Input（輸入）

接受（皆**非密碼**）：

| 欄位 | 說明 | 例 |
|------|------|-----|
| `courseTitle` | 課名（可選） | 食品與藥物管制法 |
| `fileName` | 教材檔名 | 參考資料：新可同時提供食品使用之中藥材品項1070123.pdf |
| `tronclassNameParam` | 過期／簽名 URL 的 `name=` 解碼字串 | 同上 |
| `hints` | 關鍵字、發佈機關、日期 | 衛福部、1070123、認定基準草案 |
| `listItems[]` | 使用者貼的多筆清單 | JSON／純文字一行一檔 |

**明確拒絕：** 學號、密碼、session cookie、CAPTCHA 解答、tcmedia 簽名 token 續命請求。

解析 `name=`：URL decode → 去掉查詢殘渣 → 作為 `fileName` 候選。

## 4. Match（比對）

### 4.1 標題正規化 `normalizeTitle`

1. Unicode NFKC  
2. 全形→半形、大小寫折叠  
3. 去除副檔名（.pdf/.ppt/.pptx/.doc/.docx）  
4. 去除常見前綴：「參考資料：」「附件」「講義」「（草案）」可保留關鍵但去掉括號噪音可配置  
5. 空白／底線／連字號壓縮  
6. 去除無意義標點

### 4.2 分數 `matchScore`（0–1）

| 訊號 | 權重（預設） |
|------|-------------|
| 正規化標題完全相等 | 0.55 |
| Token Jaccard／包含關係 | 0.25 |
| 關鍵字命中（機關、文號、品項表） | 0.15 |
| 可選：頁數／摘要指紋／SHA-256（若兩邊都有） | 0.05–0.20 |

門檻（config）：

- `autoAccept >= 0.82` → 自動進入 Fetch  
- `0.55 <= score < 0.82` → **待確認**  
- `< 0.55` → 放棄該候選（可記「僅 TronClass／待手動上傳」）

人工鎖定：`humanLock=true` 的分類／來源選擇，**下次同步不得覆蓋**（與 #36 覆寫鎖定一致）。

### 4.3 公開來源 Catalog

離線／骨架階段：內建 fixture catalog（中藥材、食安公開稿）。  
上線後：可擴充 crawler／手動登錄 URL，仍須過 allowlist。

## 5. Fetch（抓取）

- **只**對 `PublicSourceRegistry` allowlist 的 host 發請求  
- 預設**不**在單元測試發網；注入 `fetchImpl` 或 `fromBytes`  
- **拒絕** `tronclass.scu.edu.tw`、`tcmedia.scu.edu.tw` 及任何需登入的媒體簽名 URL  
- 記錄：最終 URL、HTTP 狀態、SHA-256、抓取時間、allowlist 規則 id

## 6. Allowlist（可擴充，預設類型）

預設允許的**類型**（域名見 `config.example.json`，可擴充）：

| 類型 | 例 |
|------|-----|
| 衛福部／食藥署相關 | `mohw.gov.tw`、`fda.gov.tw` |
| 其他中央政府公開資料 | `gov.tw` 子域經審核後加入 |
| 司法院／法規公開查詢 | 經審核後加入（例：`judicial.gov.tw`、全國法規資料庫） |
| 教師／機關**明確公開**教材站 | 須人工審核列入，禁止寬鬆 `*.edu.tw` 全開 |

**禁止預設：** 付費資料庫 API、需登入 LMS、任意網頁爬蟲。

## 7. Provenance（來源追溯）

```ts
source: 'public_source' | 'tronclass_private' | 'manual'
tronclassE2eSuccess: false  // 公開管線永遠 false
```

- `public_source`：本管線  
- `tronclass_private`：僅 TronClass connector（#35／#38）在**學校允許**後使用  
- 公開成功**不得**寫成 `tronclass_private`，也不得把 `tronclassE2eSuccess` 設 true

## 8. Ingest（匯入）

優先順序：

1. 文件化 hook → 既有 `dark-star-ebook-ingest`／`import-public-ebook-json` workflow（owner 匯入）  
2. 私人儲存路徑記錄（不進 GitHub Pages）  
3. 呼叫 `enqueueClassify`（#36 雙層分類佇列契約）— **分類失敗不阻擋**原始檔保留

本骨架提供 `ingestStub`：寫入記憶體／暫存 provenance 紀錄，不改正式暗星頁。

## 9. Learn（暗星學習通知）

`learnNotify` stub 事件（例）：

```json
{
  "type": "darkstar.public_material.learn",
  "provenance": "public_source",
  "tronclassE2eSuccess": false,
  "title": "...",
  "sha256": "...",
  "sourceUrl": "https://...",
  "chunksIndexed": 0,
  "citeAs": "衛福部公開稿（公開同源比對）"
}
```

- 正式 KB chunk 寫入：待接 ingest；骨架只保證 stub **被呼叫**且旗標正確  
- **禁止**用公開稿成功宣稱「TronClass E2E 通過」或「暗星已學會該課私有講義」

## 10. Human（人工）

- 低信心 → 佇列 `pending_review`  
- 使用者可：接受候選 URL、改選、或標記「無公開同源→改手動上傳」  
- `humanLock` 後 matcher／classifier 不得覆蓋

## 11. 與 TronClass Connector 關係

| | 公開同源學習（本管線） | TronClass Connector（#35／#38） |
|--|--|--|
| 授權 | 公開網頁即可（allowlist） | 需學校允許的 session／token |
| 帳密 | **永不** | **永不**存明文；官方頁自行登 |
| 目標 | 相同內容的公開稿 | 私有課件原檔 |
| E2E 旗標 | `tronclassE2eSuccess=false` | 真實一課一檔前亦 false |
| 關係 | **替代／並行** | 不是本管線的登入後端 |

詳見：`connectors/public-material-learn/docs/RELATION_TO_TRONCLASS.md`  
對接分類：`docs/public-learn-iface.md`（對齊 `ebook/classify/tronclass-iface.md` 欄位）

## 12. NON-GOALS（明確不做）

1. 學號／密碼自動登入  
2. CAPTCHA 繞過／OCR  
3. tcmedia 簽名 URL 續命或破解  
4. 未授權 scrape TronClass  
5. 付費 API  
6. 修改正式 `dark-star-ebook.html` 行為為必上線  
7. 以模擬資料宣稱暗星已學會真實課件

## 13. 如何餵清單給暗星學習

1. 準備 JSON（見 `fixtures/sample-material-list.json`）或一行一檔名的文字  
2. 呼叫 `PublicLearnPipeline.runList(items)`（CLI／測試／未來 workflow）  
3. 高信心自動 fetch（allowlist）→ ingest stub → classify enqueue → learnNotify  
4. 低信心輸出待確認表，人工點選後再跑  
5. Owner 可再觸發既有公開 ebook 匯入 workflow 寫入書架

## 14. 驗收（本 PR）

- [x] DESIGN.md（本文件）  
- [x] TS 骨架＋離線測試：中藥材／食安標題 → match → provenance=public → learnNotify 呼叫且 `tronclassE2eSuccess=false`  
- [x] config.example allowlist  
- [x] 對接文件＋ Issue #36／#38 進度留言  
- [ ] 真實 ingest 進暗星 KB／書架 = 另工（最多 stub）  
- [ ] TronClass 私有課件 = 仍 BLOCKED（學校授權未確認）

## 15. 實作路徑

- 設計：`research/dark_star_public_learn/DESIGN.md`  
- 程式：`connectors/public-material-learn/`  
- 測試：`connectors/public-material-learn/tests/*.test.mjs`
