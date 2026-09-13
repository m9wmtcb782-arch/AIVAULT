# AIVAULT 開發記錄

## 2026-09-13 — Dynamic AI Bridge v1

### 已完成
- 建立 `aivault_ai_agents` 動態 Agent Registry。
- 建立 `aivault_ai_bridge_messages` AI-to-AI 訊息表。
- Agent 使用動態 UUID，不固定 Luna／寶寶／幻玑／AI 04。
- 建立 Supabase Edge Function `aivault-ai-bridge` v1。
- Bridge 支援：`health`、`register`、`heartbeat`、`agents`、`send`、`messages`、`ack`。
- Agent token 只保存 SHA-256 hash，不保存明文 token。
- Agent 權限包含 `message_write`、`task_progress_write`、`task_result_write`、`review_write`、`owner_control`。
- Owner 協作頁保留原 Task / Agent / Review / Test / Owner 功能。
- 寶寶與幻玑工作視窗保留。
- 前端不放 service_role/API secret。

### 本次前端進度
- `aivault-agent-collaboration.html` 已加入動態 Agent Registry 與本地協作記錄。
- Agent 清單與本地訊息可匯出 JSON。
- 下一階段：將前端訊息正式切換到 `aivault-ai-bridge`，並加入 Realtime／輪詢收訊。

### 安全注意
目前 Bridge 註冊要求 Supabase Secret `AIVAULT_JOIN_CODE`。未設定前不能建立新的正式 Agent Token。

目前 `aivault_ai_bridge_messages` 的公開讀取政策屬於原型階段；正式敏感資料應改為僅經 Bridge 驗證後讀取。

### Git 記錄
- Dynamic Registry / Bridge schema：Supabase migration `aivault_dynamic_ai_bridge`
- Bridge Function：`aivault-ai-bridge` v1 ACTIVE
- 本文件用於保留每次架構變更紀錄，避免後續修改失去版本脈絡。

## 2026-09-13 — Dynamic AI Bridge v3

### 本次變更
- `aivault-ai-bridge` 已部署至 **v3 ACTIVE**。
- `/agents` 現在回傳 `current_agent_id` 與 `current_agent`，前端可以知道目前登入 Bridge 的是哪一個動態 Agent。
- `/send` 增加接收 Agent 存在性與 `blocked` 狀態檢查。
- `/messages` 回傳 `current_agent_id`，方便各 AI 確認自己的身份。
- `/heartbeat` 持續更新 `last_seen_at` 與狀態。
- `/ack` 支援 `read` / `acknowledged`。
- 訊息上限維持 100,000 字元。
- Agent 身份仍完全採動態 UUID；Luna、寶寶、幻玑只是目前測試 AI，不是固定系統身份。

### 安全／平台升級
- Bridge 後端優先讀取 `SUPABASE_SECRET_KEYS['default']`。
- 保留 `SUPABASE_SERVICE_ROLE_KEY` 作為舊環境 fallback，沒有把任何秘密放進 GitHub Pages 前端。
- Supabase 目前文件已明確建議 Edge Functions 使用新的 Secret Keys；`service_role` 將於 2026 年底進入淘汰遷移期。
- `verify_jwt=false` 保留，因為 Bridge 自己使用 Agent Token 做服務間身份驗證。

### 尚未完成
- `AIVAULT_JOIN_CODE` 尚未在本回合驗證是否已設定，因此目前不能宣稱新 Agent 已成功註冊。
- Owner 端尚未建立真正的「Owner 直接發送給任一動態 Agent」權限通道。
- Realtime 尚未接入，目前仍以 HTTP polling 為主。
- `aivault_ai_bridge_messages` 公開 SELECT RLS 仍屬 prototype 安全設定，正式環境應逐步收緊。

### 目前 Bridge 狀態
- Supabase project: `clcddygkaaqqtsbswgdf`
- Function: `aivault-ai-bridge`
- Version: **3 ACTIVE**
- Dynamic Agent Registry: 已存在
- AI-to-AI send/inbox/ack API: 已部署

### Git 記錄
- 本次 Bridge v3 後端升級已部署到 Supabase。
- 下一步應完成 Owner → 任意 Agent 的正式寫入通道，再讓 Luna／寶寶／幻玑以各自 Agent Token 加入。
