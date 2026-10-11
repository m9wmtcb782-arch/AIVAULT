# Unified GPU Fabric：雙層小模型與 Dense 運算 v0.1

範圍：僅 `research/unified-gpu-fabric-v0.1`；不部署正式環境，不呼叫付費模型 API。

## 本階段行為

原有 scalar 測試保留。新增固定權重的單一向量 Dense 層：
`h = ReLU(W1 x + b1)`，`y = W2 h + b2`，維度為 3 → 4 → 2。
這是同一個模型的兩個相依計算節點，不是兩個互不相干的工作。

- 權重以 output × input 的 row-major Float32 矩陣儲存；bias 每個輸出一個。
- 權重、bias、啟用函數與尺寸由可信控制端預先配置，執行階段取配置快照；傳入張量不提供模型參數或 shader。
- 啟用函數僅允許 `relu`、`identity`。每一維 1–4096，最多 1,048,576 個權重；預先檢查有限 Float32、矩陣尺寸與 adapter 記憶體額度。
- Metal 的 `executeDense` 執行實際 kernel；每一執行緒計算一個輸出。關閉 fast math，拒絕非有限輸出，包括 ReLU 前溢位。
- Planned stage 支援輸入、輸出維度不同；輸入 grant、前驅輸出、下游輸入與路由 grant 的尺寸必須相符。
- 中間張量 `h` 經既有 TLS、SHA-256、job/op/tensor/peer 綁定及 durable replay ledger 傳輸；先保留再執行，失敗維持 consumed，須新 job 才能重新執行。
- 收據驗證只表示對方處理回呼成功，不代表實體 GPU 身分或完整工作持久化。

測試權重固定，`x=[1,2,-1]` 得到 `h=[2,2,0,0.5]`、`y=[6.5,-1.5]`。
其他輸入涵蓋 ReLU 正負邊界，對照獨立代數單機基準及 Float32 CPU reference。

## 驗證狀態

- **CONFIRMED**：本地與 GitHub CI 76 項 Node 測試通過，兩個獨立 CPU 程序在同一主機以真實 loopback TLS 接續兩層，輸出與單機基準相符；重播拒絕。
- **CONFIRMED**：來源提交 `147ce53d9883a5183638a8755a0554c7855cfdbf` 的 iOS Simulator 建置、原生 Metal Dense 與 TLS 接續均通過，日誌顯示 `Apple Paravirtual device`，非實體雙設備。五組輸入對照單機代數與 Float32 reference，維度、NaN／Infinity、未允許啟用函數及 ReLU 前溢位均有拒絕測試。
- **REQUIRES TEST**：編譯選項的 API 棄用提示已改為新 OS 使用 `mathMode = .safe` 與 `.precise`；舊 OS 保留關閉 fast math 的相容分支，修正後 CI 尚待確認。
- **NOT VERIFIED**：兩台實體 GPU／iPhone 共同執行；目前所有多程序測試均在同一主機。CPU 測試不是 GPU 證據。
- **NOT VERIFIED**：大型模型、batch、Transformer／attention、量化或吞吐收益；目前是固定權重的小型 Dense 模型。
- **REQUIRES TEST**：前景 App 加入／停止整合、憑證配置、簽署安裝與實體雙設備網路測試；本次不將 listener 或 Dense 自動接入 WebBridge。

## 限制與後續接續

控制端可信配置與憑證發行尚未形成完整端到端產品流程。Native TLS receiver 已有獨立測試，本次 Dense TLS handoff 使用 Node HTTPS 與原生 Metal CLI，不能稱為 iPhone 原生 listener 的兩層模型實機測試。

研究執行器仍限定線性單輸入／單輸出圖，每節點一個融合 Dense＋activation 運算。尚無 fan-out、動態形狀、跨層權重串流、自動故障復原或多 GPU 身分驗證。持久化 ledger 防重複執行，並不保存完整推論結果或保證失敗後恰好一次交付。

## CI 證據

- [協定與雙 CPU 程序模型測試：76 項通過](https://github.com/m9wmtcb782-arch/AIVAULT/actions/runs/38128993565)
- [iOS 建置與 Metal Dense 模型／TLS：通過](https://github.com/m9wmtcb782-arch/AIVAULT/actions/runs/38128993558)
- Metal 編譯選項依 [Apple mathMode 文件](https://developer.apple.com/documentation/metal/mtlcompileoptions/mathmode) 選用保留非有限值的安全算術設定。

上述結果僅適用於 GPU Fabric 的兩個 workflow；暗星既有 workflow 的失敗未於本階段修改。
