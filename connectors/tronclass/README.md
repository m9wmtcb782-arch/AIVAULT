# TronClass Connector（隔離骨架）

**唯一目標：** 在學校允許的授權方式下，自動、唯讀地同步課程教材至 AIVAULT **私人**儲存。

> ⚠️ **E2E 真實下載測試 = BLOCKED**  
> 在東吳／平台書面確認允許自動化存取，並以「一門真實課程、一份教師允許下載的教材」跑通之前，**不得宣稱已成功同步任何真實教材**。  
> 單元測試（去重／副檔名）≠ 真實同步。詳見 `E2E_ACCEPTANCE.md`、`SYNC_TEST_REPORT.md`。

## 目標（施工令）

1. 以**學校允許**的方式連接 TronClass（非破解）  
2. 每 **6 小時**由**背景排程**檢查（不依賴使用者在線／暗星對話）  
3. **動態**辨識每學期課程（禁止永久固定五門課清單）  
4. 自動下載新增／更新的 PDF、PPT、PPTX、DOC、DOCX（教師允許下載者）  
5. 依**學年度、學期、課程代碼／名稱**分類儲存  
6. 去重：file id + mtime + SHA-256  
7. 保留符合授權的歷年教材（不覆蓋、不與新課混淆）  
8. 失敗寫入同步紀錄，可停止／重試／撤銷授權  
9. 私人儲存，**禁止**公開至 GitHub Pages  
10. **唯讀** — 不修改 TronClass 任何資料  

## 非目標

- 自動學號密碼登入、驗證碼 OCR／繞過  
- 點名、繳交作業、寫入成績  
- 付費 API  
- 修改暗星正式頁面或既有正式服務  
- 將未審核 `tronclass-api` 投入正式環境  

## 授權政策（閘門）

| 條件 | 行為 |
|------|------|
| `schoolAuthorizationConfirmed !== true` 或 `SCHOOL_AUTH_CONFIRMED !== true` | **禁止**對 TronClass 發請求、禁止啟用排程抓取 |
| 密碼／學號明文 | **永不**寫入程式、設定、記憶體持久層 |
| 驗證碼 | **不**繞過；不內建 OCR 打正式登入 |
| 允許的形態（待學校確認） | opaque token／session handoff、正式 OAuth／API key 等 |

確認授權前流程建議：向東吳電算中心／教務或台灣智園取得「個人已授權教材之唯讀自動同步」書面或郵件允許，並釐清 token 形狀。

## 動態課程流程

```
discoverCourses → diff(學年/學期/課程代碼) → provision(新課目錄+索引) → sync materials
```

- `config.example.json` 的 `courses` 為 **空陣列**；清單來自授權介面動態發現。  
- 舊課教材依路徑 `{academicYear}/{semester}/{courseCode}/` 隔離保留。  

## 與暗星核心隔離

- 本套件位於 `connectors/tronclass/`，**不** import 暗星正式頁。  
- 解析／索引完成後僅透過 `notify.ts` **事件 stub** 通知知識庫更新（預設關閉）。
- 儲存成功後呼叫 `onMaterialStored → enqueueClassify(materialMeta)`（與 `feat/ebook-shelf-dual-classify-v1` 對齊）；**分類失敗不回滾、不阻擋**原始檔儲存；不修改 `dark-star-ebook.html`。  

## 排程

見 `../../.github/workflows/tronclass-sync-gated.yml`：預設 **disabled**，需 `SCHOOL_AUTH_CONFIRMED=true` 才可能執行；骨架內**不**呼叫 TronClass。

## 開發

```bash
cd connectors/tronclass
npm test   # 僅單元測試（假資料）
```

## 文件索引

| 文件 | 內容 |
|------|------|
| `RESEARCH.md` | 官方 API／東吳端點／ToS 調查 |
| `ARCHITECTURE.md` | 元件圖、資料流、威脅模型 |
| `SECURITY.md` | 禁止事項 |
| `THIRD_PARTY_EVAL.md` | tronclass-api 評估 |
| `E2E_ACCEPTANCE.md` | 端到端驗收清單（BLOCKED） |
| `SYNC_TEST_REPORT.md` | 真實同步報告（尚未執行） |
