# PR #35 Gap Analysis（Issue #38）

審計基準：`feat/tronclass-connector-v1` @ `4b34e233`（施工前）  
審計時間：2026-10-25（Asia/Taipei）  
倉庫：`m9wmtcb782-arch/AIVAULT`（第一基地）

## 缺口與處置

| ID | 缺口 | 嚴重度 | 本輪處置 |
|----|------|--------|----------|
| G1 | `AuthProvider` 僅 Stub；缺 browser-handoff／school-token 抽象；session 失效無暫停 | 高 | `AuthSessionProvider` + `BrowserHandoffAuthProvider` + `SchoolTokenAuthProvider`；`SessionInvalidError`／`needsRelogin` |
| G2 | 無增量 `MaterialQueue`；`storage.readIndex` 恒回空 → 去重失效 | 高 | `material-queue.ts`；`readIndex` 讀取 `meta/*.json` |
| G3 | 缺 Provenance（school／sourceFileId／retrieved_at） | 中 | `provenance.ts` + `StoredFileRecord.provenance` |
| G4 | 缺 retry／revokeAuth；stop 僅 flag | 中 | `controls.ts`：`withRetry`／`stopSync`／`revokeAuth`／`ErrorLog` |
| G5 | 無 `PublicSourceAdapter`；公開 PDF 成功可能被誤標 TronClass E2E | 高 | `public-source.ts`；`SyncRunResult.tronclassE2eSuccess` 恒 false（mock／public） |
| G6 | 無官方頁自行登入 session handoff 設計文件 | 高 | `SESSION_HANDOFF_DESIGN.md` |
| G7 | gated workflow 僅在 `/tmp` backup | 中 | `.github/workflows/tronclass-sync-gated.yml` |
| G8 | 分類 hook 契約在 #37，本分支缺文件 | 低 | `docs/tronclass-iface.md`（契約複製，不 merge #37） |
| G9 | 單元測試自複製邏輯，未跑真實模組 | 中 | `tsc` → `dist/`；offline mock 整合測 |
| G10 | 真實一課一檔 E2E | **BLOCKED** | 待學校書面授權；**不以公開來源冒充** |

## 刻意不關閉的項目

- Live HTTP 至 `tronclass.scu.edu.tw`／`tcmedia.scu.edu.tw`
- 密碼／CAPTCHA OCR（社群 `tronclass-api`）
- `SCHOOL_AUTH_CONFIRMED` 預設開啟
- Merge 至 `main`／正式部署
