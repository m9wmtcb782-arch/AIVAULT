# AIVAULT 開發記錄

## 2026-09-13 — Dynamic AI Bridge v1

### 已完成
- 建立 `aivault_ai_agents` 動態 Agent Registry。
- 建立 `aivault_ai_bridge_messages` AI-to-AI 訊息表。
- Agent 使用動態 UUID，不固定 Luna／寶寶／幻玑／AI 04。
- 建立 Supabase Edge Function `aivault-ai-bridge`。
- Bridge 支援：`health`、`register`、`heartbeat`、`agents`、`send`、`messages`、`ack`。
- Agent token 只保存 SHA-256 hash，不保存明文 token。
- Agent 權限包含 `message_write`、`task_progress_write`、`task_result_write`、`review_write`、`owner_control`。
- Owner 協作頁保留原 Task / Agent / Review / Test / Owner 功能。
- 寶寶與幻玑工作視窗保留。
- 前端不放 service_role/API secret。

## 2026-09-13 — Dynamic AI Bridge v3

### 已完成
- `aivault-ai-bridge` 部署至 v3 ACTIVE。
- `/agents` 回傳目前連線 Agent 身分與動態 Agent Registry。
- `/send` 增加接收方檢查與 blocked Agent 防護。
- `/messages`、`/heartbeat`、`/ack` 完整支援 Agent 身分與訊息生命週期。
- Bridge 保持動態 Agent 架構，不把 Luna／寶寶／幻玑視為永久固定身份。

## 2026-09-13 — Technical Dark Star Self-Learning Closed Loop v1.5.0

### 核心目標
暗星不只是「保存答案」，而是形成可驗證的學習閉環：

`Observe → Evaluate → Candidate → Validate → Promote → Retrieve → Reuse → Measure → Observe`

### 新增資料結構
- `dark_star_learning_events`
  - 保存任務觀察、輸入、結果、分數、回饋與證據。
- `dark_star_learning_candidates`
  - 保存尚未正式採用的學習候選。
  - 必須經過驗證才可升級成正式學習記憶。
- `dark_star_learning_runs`
  - 保存每次學習循環的執行紀錄與升級數量。

### 暗星 API
- `POST /learning/observe`：把任務結果／錯誤／修正／教訓寫入觀察層並建立候選。
- `POST /learning/feedback`：對候選進行成功／失敗驗證。
- `POST /learning/cycle`：挑選達到驗證門檻的候選，正式升級到 `dark_star_learning_memory`。
- `POST /learning/retrieve`：在新任務開始前取回既有學習記憶。
- `GET /learning`：查看學習記憶。

### 防止錯誤學習
正式升級條件：
- candidate 必須至少完成 2 次 validation。
- confidence >= 0.85。
- 成功驗證次數不得少於失敗驗證次數。
- 未達條件只停留在 candidate，不污染正式 memory。

### Pipeline
目前暗星完整流程包含：
`Research → Understanding → Implementation → Implementation Execution → Runtime Testing → Evaluation → Sandbox Verification → Capability Promotion → Learning`

注意：`Capability Promotion` 不等於「自我學習」；本版真正的 Learning 是獨立閉環。

### 重要技術界線
本版建立的是「可持續、可驗證、可回饋的記憶／策略學習閉環」，不是直接修改大模型 neural weights 的訓練。
模型權重訓練仍需要專門訓練環境、資料集、GPU/算力與模型訓練流程；不能假裝資料庫寫入就是重新訓練模型。

### 部署
- Supabase Function：`technical-dark-star` v3 ACTIVE。
- Function 版本標記：`1.5.0`。
- 新 migration：`dark_star_self_learning_loop_v1`。

### Git 記錄
- Dynamic Bridge UI / Registry / Bridge：已保留先前版本紀錄。
- 本次 Self-Learning Loop schema + Function：本紀錄對應 commit。
- 所有後續重大變更應繼續追加到本文件，避免失去架構脈絡。
