# Stage (c) — 協作池調度 micro-MLP 推論（無 LLM）

- 授權：使用者「繼續」(pt82u) after Stage (b) WebGPU PASS
- 日期：2026-10-24 Asia/Taipei
- **不是** Qwen／跨設備／Stage (d)–(e)。**不是** Groq／Gemini／ai-gateway。

## 做了什麼

1. 任務類型 `nn-infer` / `micro-mlp-infer`，模型白名單 `owned-micro-mlp-v1`（Stage b 已驗證）。
2. **未新增** Edge Function（免費額度已滿／本環境無 deploy token）。改動落在既有 `aivault-compute-coordinator` 原始碼。
3. 同源 **local bus**（`nn-dispatch-bus.js`）可在兩分頁完成調度→推論→校驗，立即證明無 LLM。
4. 頁面：
   - Dispatch（協作池 Worker）：`aivault-compute-nn-dispatch.html`
   - Node（算力池）：`aivault-compute-nn-node.html`
5. Additive migration：`20261024130000_compute_nn_infer_stage_c.sql`（audit log + 盡力註冊模型）。

## Off switch

`?COMPUTE_NN_DISPATCH_OFF=1` 或 `localStorage.COMPUTE_NN_DISPATCH_OFF=1`

## Rollback

`4d8091b8434a100a2e1c39bc330b0d6d20cc8d09`

## 怎麼 demo（推薦 local，今日即可）

1. 桌面開：`.../aivault-compute-nn-dispatch.html`（通道選 **local bus**）
2. 手機或第二分頁開：`.../aivault-compute-nn-node.html`（同樣 **local bus**）→ 按「開始節點」
3. 回 dispatch 按「建立 nn-infer 任務」
4. 看兩邊 `LLM: ZERO`、`executed_on: WebGPU`（手機）、maxAbs ≤ 1e-4
5. 可開飛航（頁面與 `models/micro-mlp/*` 已快取後）

## Live coordinator（可選）

需部署更新後的 `aivault-compute-coordinator`（本環境 **無** `SUPABASE_ACCESS_TOKEN`，未部署）。部署後：

1. 兩頁都選 **live coordinator**
2. Node 會 `node.register`（`supported_task_types` 含 `nn-infer`）並 `task.request`
3. Dispatch `task.create` 後用 `mesh.evidence` 輪詢

## 無 LLM 證據

- 頁面 fetch 守衛拒絕 groq／openai／gemini／ai-gateway
- local 模式只允許 `location.origin`
- 單元測試：`tests/nn-dispatch-stage-c.test.mjs` 模擬 enqueue→claim→CPU infer→`verifyNnInferResult`，且 provider=groq 的任務被拒
- 結果強制 `llm_called:false` / `external_api:false`

## 伺服器校驗

`nn-infer-verify.ts`：比對 Stage (b) 打包的 weights／logits／top1 SHA-256 常數 + maxAbs≤1e-4 + top1 100%。不在邊緣重跑 MLP（權重由節點同源載入）。

## Blockers

- **Coordinator 未在本回合部署** → live 路徑需持有人跑 `deploy-compute-coordinator` workflow。
- Migration 需套用後 audit log 才會存在（local bus 不依賴它）。
- Box 無 WebGPU；headless 測試走 **CPU** + `allow_cpu`。
