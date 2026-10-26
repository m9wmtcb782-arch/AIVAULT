# E2E 驗收清單 — 一課、一檔

## 狀態：**BLOCKED**（待學校授權確認）

在下列全部勾選前，**不得**啟用自動登入、背景抓取，也**不得**宣稱真實同步成功。

### 前置（學校／平台）

- [ ] 取得東吳或台灣智園對「已授權帳號之教材唯讀自動同步」的允許（郵件／公文）  
- [ ] 確認允許的授權方式（例：核發 API token、OAuth、人工 session handoff 形狀）  
- [ ] 確認不得使用付費 API；費用為零或校內既有授權  
- [ ] 將 `schoolAuthorizationConfirmed=true` 與 secrets `SCHOOL_AUTH_CONFIRMED=true` 僅在書面允許後設定  

### 技術驗收（真實環境 — 尚未執行）

- [ ] 以學校允許方式取得授權（**非**明文學號密碼寫入設定）  
- [ ] `discoverCourses` 回傳當前學期真實課程（動態，非寫死五門）  
- [ ] 選定**一門**課、**一份**教師允許下載的 PDF／Office 教材  
- [ ] 下載成功並寫入私人路徑 `{year}/{semester}/{courseCode}/`  
- [ ] 計算 SHA-256；第二次同步同一檔被去重略過  
- [ ] 同步 log 可見成功紀錄  
- [ ] 解析／索引後可對暗星發出 notify stub（可選）  
- [ ] `stop`／`revoke` 可停止後續請求  
- [ ] 確認未對 TronClass 寫入任何資料  
- [ ] 確認檔案未出現在 GitHub Pages  

### 單元測試（假資料 — 可於授權前執行）

- [x] 副檔名 allowlist  
- [x] SHA-256 去重鍵  
- [x] 動態課程 diff  

```bash
cd connectors/tronclass && npm test
```
