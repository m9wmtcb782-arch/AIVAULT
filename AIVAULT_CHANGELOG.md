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

## 2026-09-13 — Technical Dark Star Model Training Loop v1.6.0

### 核心目標
把「記憶／策略學習」正式接到「模型訓練」層，形成第二個可驗證閉環：

`Observe → Training Example → Quality/Compliance Gate → Dataset Version → Compute Training → Candidate Model → Benchmark Evaluation → Sandbox → Owner Approval → Production Promotion → Monitor/Rollback`

### 新增資料結構
- `dark_star_training_examples`
  - 保存訓練輸入、目標、來源任務、品質分數、合規狀態。
  - 未通過品質與合規 Gate 的資料不得進入訓練資料集。
- `dark_star_datasets`
  - Dataset 版本、狀態與 train/validation/test 數量。
- `dark_star_dataset_items`
  - Dataset 與訓練範例的版本化關聯及 provenance。
- `dark_star_training_runs`
  - 真正的訓練工作、Compute Task、模型基線、候選版本、進度與結果。
- `dark_star_model_versions`
  - candidate / evaluating / approved / production / rejected / rolled_back 模型生命週期。
- `dark_star_evaluations`
  - candidate 與 baseline 的 benchmark、分數、回歸與安全評測。
- `dark_star_model_promotions`
  - Sandbox、合規、Owner approval 與 production promotion Gate。

### 暗星 Model Training API
- `POST /training/example`：建立訓練範例。
- `POST /training/dataset/build`：從通過品質／合規 Gate 的範例建立 Dataset version。
- `POST /training/start`：把 Dataset 交給 AIVAULT Compute Coordinator 執行真實模型訓練。
- `GET /training/status/:id`：查詢 Training Run。
- `POST /training/result`：接收真實 Compute 訓練結果。
- `POST /training/evaluate`：執行 candidate vs baseline 評測 Gate。
- `POST /training/promote`：通過所有 Gate 後才允許 production promotion。
- `POST /training/rollback`：候選模型出現回歸時可回滾。
- `GET /training/health`：查看訓練閉環狀態。

### 強制 Gate
Production 模型不得只因「訓練完成」就自動上線。

必須同時通過：
- Quality Gate
- Compliance Gate
- Evaluation Gate
- Safety Gate
- Sandbox Gate
- Owner Approval Gate
- Promotion Gate

### 重要技術界線
- v1.5.0 是記憶／策略學習閉環。
- v1.6.0 是模型資料集與模型權重訓練閉環。
- `/training/start` 只負責建立真實 Compute Coordinator 訓練任務，不假造 GPU 訓練進度。
- 只有 Compute Mesh 回傳真實訓練結果後，才會進入模型評測。
- Production model promotion 保留 Owner approval，不允許暗星自行取代正式模型。
- Model rollback 保留，以避免候選模型造成能力退化。

### 部署
- Supabase Function：`technical-dark-star` v4 ACTIVE。
- Function 版本標記：`1.6.0`。
- 新 migration：`dark_star_model_training_loop_v1`。
- Function deployment SHA：`4d7ae63c223ee14645f905ee373884948c845dc79e78a103653821cc4c3a747c`。

### 安全備註
Supabase 官方目前建議 Edge Functions 使用 secret key／`@supabase/server` 的後端模式，secret key 不得進入瀏覽器；legacy `service_role` 將在 2026 年底前逐步淘汰。AIVAULT 前端仍不得放任何 secret/service_role key。

### 後續
下一階段不是再做「假訓練」，而是讓 Compute Mesh 真正接受 `model.train` 任務、回傳 progress/result，然後暗星執行 benchmark、Sandbox 與 Owner approval。

### Git 記錄
- Dynamic Bridge UI / Registry / Bridge：已保留先前版本紀錄。
- Self-Learning Loop v1.5.0：已保留。
- Model Training Loop v1.6.0：本紀錄新增。
- 所有後續重大變更應繼續追加到本文件，避免失去架構脈絡。
