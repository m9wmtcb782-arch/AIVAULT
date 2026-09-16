# AIVAULT Mini AI v0.1

手機端微型 AI 模組的第一個基礎層。

## 目標

讓手機同時具備兩種角色：

1. **Mini AI Consumer**：小型任務在手機本地推理。
2. **Mini AI Provider**：使用者明確同意後，手機可向 AIVAULT 回報可提供的本地 AI 能力。

## Runtime 策略

- **LiteRT**：Android 優先，後續接 CPU / GPU / NPU。
- **ONNX Runtime Mobile**：跨平台模型執行路徑。
- **Adapter**：AIVAULT 不把模型 Runtime 寫死；模型與 Runtime 是可替換模組。

## 安全與容量原則

- 不保存任何 Provider API Key。
- 不自動下載大型模型。
- 不在未取得使用者同意時做背景運算。
- 不把模型或推理結果寫進 Supabase。
- Supabase 只負責節點／任務 metadata；真正模型檔案不進資料庫。
- 沒有本地 Runtime 時，模組必須明確回報 `NO_LOCAL_MODEL_RUNTIME`，不得假裝有 AI。

## v0.1 已完成

- Node ID 本機生成與保存
- CPU / WebGPU / WebNN 能力偵測
- LiteRT / ONNX Runtime adapter 介面
- 任務類型契約：classify / embed / summarize / vision / text / custom
- 本地推理狀態與統計
- Provider node report
- 明確的 consent-required / background-compute=false 標記

## 下一階段

1. Android LiteRT 真實模型 adapter
2. ONNX Runtime Mobile adapter
3. 小型模型 profile（依手機 RAM / NPU / GPU 選擇）
4. 接 AIVAULT Compute Coordinator
5. 實際手機端 benchmark
6. 用「有效完成的 AI Compute Units」而不是單純秒數計價
