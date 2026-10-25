# 東吳 TronClass 調查報告（2026-10-25）

> 本文件僅記錄公開可查資料。未經驗證的端點標為 **UNKNOWN**，不當作正式契約。

## 1. 官方 API 狀態：**未找到公開學生端 API 規格**

| 項目 | 結果 | 來源 |
|------|------|------|
| 公開 REST／GraphQL 開發者文件 | **未找到** | 搜尋 support.tronclass.com、tronclass.com.tw、WisdomGarden 官網 |
| 產品文案提及「Open API」 | 僅出現在教師快速指引功能列表（Teaching & Learning Analytics），**無端點／鑑權規格** | https://support.tronclass.com/quickguidance_teacher/WGTCQuickGuidance_en(teachers).pdf |
| 企業功能「Campus system integration / API」 | 產品行銷頁提及成績等資料整合，**非公開學生教材 API 文件** | https://www.tronclass.com.cn/features?account_type=enterprise |
| 教師／學生操作手冊 | 僅 UI 操作，無 API | https://support.tronclass.com/tw/application-guide/manual 、 https://tronclass.com.tw/public-manual/manual-teacher.html |

**結論：** 官方公開「學生教材列表／下載」API 文件 = **NOT FOUND**。自動化存取須先向東吳／台灣智園確認允許的授權方式（OAuth、學校核發 token、LTI、正式 Open API 合約等）。

## 2. 東吳大學部署（公開資訊）

| 主機 | 用途（公開描述） | 來源 |
|------|------------------|------|
| https://tronclass.scu.edu.tw/ | 東吳 TronClass 學習平台入口（109-2 上線） | https://web-ch.scu.edu.tw/system/web_page/15519 |
| https://tcmedia.scu.edu.tw/ | 媒體／檔案下載主機（使用者曾提供簽名下載 URL；官方未公開參數規格） | 觀測／使用者連結；**參數語意 UNKNOWN（無官方文件）** |

登入方式（學校系統組公開說明）：

- 帳號：學號或人事代碼
- 密碼：電子化校園密碼
- 來源：https://web-ch.scu.edu.tw/system/web_page/15519

學校政策意涵：自動化若模擬學號密碼登入，屬高風險；本 connector **禁止明文密碼儲存與未授權自動登入**。

## 3. 授權方式（公開可推論 vs UNKNOWN）

| 方式 | 公開狀態 | 本專案立場 |
|------|----------|------------|
| 學號+校園密碼 + session cookie | 學校手冊描述人類登入 | **禁止**自動密碼登入／驗證碼 OCR 繞過，除非學校書面允許且改為安全交接 |
| Keycloak／CAS SSO | 第三方套件描述多校流程；東吳是否同一套 **未由官方文件確認** | 僅在學校允許的 handoff 後使用 opaque session／token |
| OAuth／API token／LTI | **UNKNOWN**（無公開學生端文件） | 優先向學校／智園詢問 |
| 簽名下載 URL（timestamp/nonce/token） | 使用者連結型態可見；**官方未文件化** | 不得偽造；僅使用使用者已獲權且教師允許下載的 URL |

## 4. 服務條款／可接受使用

- WisdomGarden 網站 Terms of Use（2026-06-18）：禁止未授權存取系統、干擾運作、**未經授權使用自動化工具 scrape／擷取網站內容**。  
  來源：https://www.wisdomgarden.com/TermsOfService.html  
  註：該頁主要規範「官網」；產品／雲端服務另有個別合約。仍顯示供應商對未授權自動化持否定態度。
- 中國站使用者協議（CDN 公開稿）亦禁止未授權存取、掃描弱點、繞過限制等（參考，管轄與東吳租戶合約可能不同）。  
  例：https://cdn.jsdelivr.net/npm/@wisdomgarden/mobile-assets@0.0.80/user-agreement-zh-CN.md

**本專案閘門：** 未確認東吳／智園允許的自動存取方式前，**不啟用自動登入或背景抓取**。

## 5. 簽名下載 URL（tcmedia）

使用者曾出現類似：

`https://tcmedia.scu.edu.tw/download/file/<id>?timestamp=...&nonce=...&token=...&name=...`

公開官方文件中 **未找到** 參數演算法說明。第三方／漏洞報告顯示部分租戶曾有「預覽 URL 可被複製下載」類 IDOR，且已有修補紀錄（例 HITCON ZD-2024-01282）——本專案 **禁止** 繞過教師「不可下載」設定。

## 6. 第三方（摘要，詳見 THIRD_PARTY_EVAL.md）

- npm `tronclass-api`（https://github.com/seven-317/Tronclass-API）：非官方；含驗證碼 OCR、密碼登入、點名暴力嘗試等 — **不得未審核投入正式環境**。
- 其他：tronclass-cli、userscript、rollcall 工具等 — 多涉及自動化登入或繞過，**不 vendor**。

## 7. 調查結論 → 架構約束

1. 唯一目標：在學校允許前提下，**唯讀**自動同步教材。  
2. 端點契約 = UNKNOWN → client 僅 stub + TODO。  
3. E2E 真實下載 = **BLOCKED** 至學校授權確認。  
4. 不付費 API；不影響既有正式頁面／服務。
