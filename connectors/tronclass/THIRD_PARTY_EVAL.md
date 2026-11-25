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

---

## 隔離實測紀錄（2026-10-25 Asia/Taipei）— seven-317/Tronclass-API

| 欄位 | 內容 |
|------|------|
| 來源 | https://github.com/seven-317/Tronclass-API （clone 僅在 box `/workspace/vendor-eval/Tronclass-API`，**未**併入 AIVAULT） |
| 觀測 commit | `4138ac9`（tag／版本宣稱 `4.1.0`） |
| npm | `tronclass-api@4.1.0`（與 GitHub 同源） |
| 授權 | MIT；作者免責：僅供學習、不保證合法性／穩定性 |
| 離線測試 | `npm test`（vitest）**5 passed**；僅 mock 作業分頁，**無**真實登入／網路打校務 |
| 東吳真實登入 | **未執行**（施工令禁止；學校授權仍未確認） |

### 套件能做什麼（程式碼觀測）

- 非官方 LMS client：課程、學期／學年、教材活動列表、檔案下載、作業、成績、公告、待辦、點名。
- 內建 Discord／LINE bot formatter（與唯讀教材同步無關）。
- `downloadFile(fileUrl)`：以已登入 cookie session GET 任意相對／絕對 URL。

### 登入方式（與施工令衝突）

1. **學號／密碼** `LoginOptions.username` + `password`；示例環境變數 `TRON_USER` / `TRON_PASS`（明文）。
2. 走 `{baseUrl}/login?next=/user/index`，自動跟隨 redirect；偵測 Keycloak 或傳統 CAS。
3. 若頁面有驗證碼：呼叫呼叫端提供的 `ocrFunction`；內建 **`solveCaptcha` = Tesseract.js OCR**（`src/utils/captcha-ocr.ts` + `canvas` 前處理）。
4. Keycloak 另打 `{keycloak}/auth/realms/{realm}/captcha/code`；CAS 另打 `/cas/captcha.jpg`。
5. 失敗最多重試 5 次；成功後以 `tough-cookie` 持久化 session，並**保存明文憑證**供 `reAuthenticate()`。

→ **自動密碼登入 + OCR 驗證碼 = 繞過登入保護態樣 → 本基地禁止採用。**

### 內建學校設定（是否含東吳）

`src/config/schools.ts` **僅**：

| key | 名稱 | baseUrl | hasCaptcha |
|-----|------|---------|------------|
| `ASIA_UNIVERSITY` | 亞洲大學 | `https://tronclass.asia.edu.tw` | true |
| `SHIH_CHIEN_UNIVERSITY` | 實踐大學 | `https://tronclass.usc.edu.tw` | false |

- **沒有**東吳／`tronclass.scu.edu.tw`／SCU／soochow 字樣（全 repo 字串搜尋為空）。
- 可用 `createSchoolConfig({ baseUrl })` 自訂 URL，但**不代表**東吳允許或已驗證。

### 額外高風險能力（永不引用）

- `bruteForceNumberRollcall`：對點名 PIN `0000`–`9999` 高併發嘗試（README 自承可能觸發鎖定／違規；**尚未在真實環境驗證**）。
- `submitHomework`：寫入提交 — 違反「不修改 TronClass 任何資料」／唯讀原則。

### 原始碼中出現的路徑形狀（**UNVERIFIED／非官方文件**）

僅從該套件原始碼摘錄字串，**未**對東吳或任何校務主機驗證是否存在、權限或契約；標示為研究參考，**不得**當作已授權 API。

**認證相關**

- `GET {base}/login?next=/user/index`
- Keycloak captcha：`GET {keycloakBase}/auth/realms/{realm}/captcha/code`
- CAS captcha：`GET {casBase}/cas/captcha.jpg?{ts}`

**唯讀／列表類（研究形狀）**

- `GET /api/my-courses`（可帶 `?conditions=` JSON）
- `GET /api/user/recently-visited-courses`
- `GET /api/courses/{courseId}`
- `GET /api/courses/{courseId}/modules`
- `GET /api/my-semesters`
- `GET /api/my-academic-years`
- `GET /api/courses/{courseId}/activities?sub_course_id=0` ← 教材／活動列表
- `GET /api/todos`
- `GET /api/courses/{courseId}/homework-activities?page=&page_size=`
- `GET /api/courses/{courseId}/homework-activities/{activityId}`（404 時 fallback `GET /api/activities/{activityId}`）
- `GET /api/courses/{courseId}/exam-scores`、`.../exam-list`
- `GET /api/org-bulletin/bulletins`、`.../classifications`、`GET /api/bulletins/latest`
- `GET /api/courses/{courseId}/bulletins`
- `GET /api/alert/messages`
- `GET /api/course/{courseId}/rollcalls`、`.../students_rollcalls`
- `GET /api/training/activities?course_id=`

**寫入／點名（本 connector 永不呼叫）**

- `POST /api/courses/{courseId}/homework-activities/{activityId}/submissions`
- `…/api/rollcall/{rollcallId}/answer_number_rollcall`（含暴力 PIN）

### 與 AIVAULT 施工令對照

| 要求 | 本套件 | 結論 |
|------|--------|------|
| 學校允許的授權方式 | 密碼＋OCR 非官方自動化 | 衝突 |
| 不繞過驗證碼／登入保護 | 內建 OCR | 衝突 |
| 不明文存學號密碼 | `.env` TRON_USER/PASS；runtime 保存憑證 | 衝突 |
| 唯讀、不改 TronClass | 含 submit／bruteForce 點名 | 衝突 |
| 東吳 out-of-box | 無 SCU 設定 | 不支援 |
| 未審核程式進正式環境 | npm／GitHub 直接依賴 | 禁止 |

### 判決（2026-10-25）

**research-only／DO NOT USE IN PROD（自動登入路徑）。**

- **不採用**為正式 TronClass Connector 依賴。
- **不** vendor 原始碼進 AIVAULT runtime。
- **僅可**在文件中參考上述 **UNVERIFIED** 端點路徑形狀，供未來「學校核發正式 API 或允許 session handoff」時自行實作唯讀 client 對照；auth／OCR／rollcall／submit **一律不抄**。
- 真實一課一檔 E2E 對東吳仍 **BLOCKED**（`SCHOOL_AUTH_CONFIRMED` 未確認）。
- 隔離 clone 僅存 box `/workspace/vendor-eval/`，**禁止** commit 上游 tree 至本倉庫。
