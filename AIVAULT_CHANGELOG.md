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
