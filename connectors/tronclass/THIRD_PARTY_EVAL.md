# 第三方 tronclass-api 評估

**建議：先 vendor／安全審查，再考慮任何 import；本 PR 不將上游程式碼併入正式環境。**

## 套件

| 欄位 | 內容 |
|------|------|
| 名稱 | `tronclass-api` |
| 來源 | https://github.com/seven-317/Tronclass-API 、 https://www.npmjs.com/package/tronclass-api |
| 授權 | MIT |
| 維護 | 個人專案；npm 週下載量極低（觀測約個位數）；多校設定有限 |
| 版本參考 | 4.1.0（2026-06 更新） |

## 能力（README 宣稱）

- 課程列表、教材 `getCourseMaterials`、`downloadFile`
- Keycloak／CAS 自動登入 + **Tesseract.js 驗證碼 OCR**
- 明文環境變數 `TRON_USER` / `TRON_PASS`
- 點名 `bruteForceNumberRollcall`（高併發嘗試 PIN）— 與「唯讀教材同步」目標無關且高風險

## 安全／合規風險

1. **驗證碼自動辨識** = 繞過登入保護態樣 → 違反本施工令。  
2. **明文密碼** 設定模式 → 禁止。  
3. **未審核逆向 API** 直接進 prod → 禁止。  
4. 點名暴力邏輯可能觸發鎖定／違規 → 本 connector **永不引用**。  
5. 作者免責：僅供學習、不保證合法性。

## 其他相關專案（不採用）

- HowyoungZhou/tronclass-cli（PyPI）— 下載教材但屬非官方自動化  
- 各校 auto-rollcall 工具 — 明確非唯讀、非本目標  
- GreasyFork Tronclass Downloader userscript — 瀏覽器輔助，非正式服務元件  
- qbu11/Tronclass-skill — 宣稱呼叫 REST；端點清單非官方文件

## 本 repo 政策

- `research/vendor-eval/` 僅放「DO NOT USE IN PROD」標示。  
- **不** clone 上游原始碼進 AIVAULT。  
- 若未來學校核發正式 API，應自寫唯讀 client，或經法務／資安審查後再評估是否參考型別定義（不含 auth/OCR/rollcall）。
