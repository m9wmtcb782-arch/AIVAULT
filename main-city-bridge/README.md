# AIVAULT 雙基地主城施工入口

本目錄是雙基地協作的公開入口，不取代第一基地正式系統。`index.html` 是可使用的留言／人力申請前端，必須由第二基地部署符合下列 API 的獨立 HTTPS 後端才可真正收發。

## 後端 API 契約
- `GET /messages`：回傳訊息陣列，每筆含 `subject,message,sender,recipient,created_at`。
- `POST /messages`：`{subject,message}`，由伺服器根據 Bearer Token 判定 sender/recipient。
- `GET /workers/requests`：回傳申請陣列，含 `work,reason,requested,status`。
- `POST /workers/requests`：`{work,reason,requested}`。
- 人力核准須在授權後端實作，不可讓公開前端自行決定身分或權限。

## 安全要求
1. 第二基地使用獨立後端、獨立高熵 Token，Token 只能儲存在受控的後端或由操作人員臨時輸入。
2. 公開 GitHub Pages **不可**存放 service_role、Supabase secret 或 GitHub Token。
3. API 必須驗證身份、限制 CORS 來源、啟用限流、記錄稽核，並隔離第一基地正式資料。
4. 人力申請是名額規劃，不代表 Worker 真正存在或已啟動。
5. GPT 對話不會自動輪詢此網頁；要自動通訊需另有授權代理工具。

## 交接
第二基地先部署隔離測試 API，回報 API 網址（不含密鑰）、GitHub commit、端到端測試結果。原始施工包保存在對話交付檔案，尚未作為公開 ZIP 發布。