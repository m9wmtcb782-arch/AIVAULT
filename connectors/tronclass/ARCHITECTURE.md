# TronClass Connector 架構

## 唯一目標

自動、唯讀同步課程教材 → 私人儲存（動態學期／課程）。

## 元件圖

```mermaid
flowchart TB
  subgraph sched [背景排程 gated]
    GHA["GitHub Actions cron\n或獨立 worker\nenabled=false 預設"]
  end

  subgraph connector [connectors/tronclass 隔離區]
    Auth["auth.ts\n學校允許 handoff\nrevoke()"]
    Client["client.ts\n唯讀 stub\n端點 UNKNOWN"]
    Sync["sync.ts\ndiscover → diff → provision → sync"]
    Store["storage.ts\n私人路徑\n學年/學期/課碼"]
    Dedup["dedup.ts\nfileId+mtime+SHA-256"]
    Allow["allowlist.ts\npdf/ppt/pptx/doc/docx"]
    Log["sync log / retry / stop"]
    Notify["notify.ts\nDark Star stub\nonMaterialStored→enqueueClassify"]
  end

  subgraph private [私人儲存 非 Pages]
    FS["/{year}/{semester}/{courseCode}/raw|meta"]
    DB["課程紀錄 DB\n動態 upsert"]
  end

  subgraph darkstar [暗星核心 — 本 PR 不修改]
    KB["法律知識庫\n僅收事件"]
  end

  TC[(東吳 TronClass\ntronclass.scu.edu.tw\ntcmedia.scu.edu.tw)]

  GHA -->|SCHOOL_AUTH_CONFIRMED| Sync
  Auth -->|opaque token| Client
  Client -->|GET 唯讀| TC
  Sync --> Client
  Sync --> Dedup
  Sync --> Allow
  Sync --> Store
  Sync --> Log
  Store --> FS
  Sync --> DB
  Sync -.->|event stub| Notify
  Notify -.-> KB
```

## 資料流

1. **排程觸發**（6h）— 不依賴 UI／對話。  
2. **授權檢查** — 學校閘門 + opaque session；失敗則中止並記 log。  
3. **discoverCourses** — 取得目前學期課程清單（動態）。  
4. **diff** — 比對 DB 之學年度、學期、課程代碼（及 courseId）。  
5. **provision** — 新課：建立紀錄、私人目錄、索引槽；僅在 `accessAuthorized` 時啟用教材同步。  
6. **sync materials** — 列表 → allowlist → 教師允許下載 → 下載 → SHA-256 去重 → 寫入私人路徑。  
7. **notify** — 可選 stub 事件給暗星知識庫（預設關）。
7b. **enqueueClassify(materialMeta)** — 儲存成功後非阻塞 stub；分類 UI／邏輯由雙層分類分支負責；失敗不回滾檔案。  
8. **歷年教材** — 不刪、不混路徑；非本學期課可 `syncEnabled=false` 但仍保留檔案。

## 威脅模型（摘要）

| 威脅 | 緩解 |
|------|------|
| 憑證外洩 | 無明文密碼；revoke()；不寫入 git |
| 未授權自動化 | schoolAuthorizationConfirmed + env 雙閘 |
| 下載不可下載檔 | `downloadAllowed` 檢查；禁止繞過預覽 |
| 公開外洩教材 | 私人 root；禁止 Pages 路徑；本 PR 不部署公開產物 |
| 寫入 TronClass | client 僅設計 GET／下載；不實作突變 API |
| 供應鏈 | 不引入未審核 tronclass-api |
| 固定課表過期 | 動態 discover，禁止永久五門清單 |

## 隔離邊界

- 不修改 `dark-star-ebook.html`、正式首頁、既有 Actions 產線行為（僅新增 gated workflow）。  
- 暗星通知為介面 stub，無直接 DB 寫入正式知識庫。
