# NCL 驗收執行報告 — 2026-11-27

## 執行方式
以隔離 JavaScript V8 執行環境載入分支上的核心原始碼，並以最小 DOM stub 觸發各測試頁的實際測試函式。這是程式邏輯執行，不等同 Safari／Chrome 真實瀏覽器、iPhone 裝置或 GPU 驗證。

## 結果

| 版本 | 測試項目 | 結果 |
|---|---:|---:|
| v0.3 Runtime | 16 | 16 PASS / 0 FAIL |
| v0.4 Tensor | 18 | 18 PASS / 0 FAIL |
| v0.5 Neural | 12 | 12 PASS / 0 FAIL |
| v0.6 Model | 10 | 10 PASS / 0 FAIL |
| v0.7 Activation／Adam | 13 | 13 PASS / 0 FAIL |
| v0.8 Tokenizer／Embedding | 12 | 12 PASS / 0 FAIL |
| **合計** | **81** | **81 PASS / 0 FAIL** |

## CONFIRMED
- 六套測試頁的測試函式均在 V8 harness 實際執行。
- v0.7 XOR 小型資料訓練測試通過（只證明該固定小型測試案例能降低 MSE）。
- v0.8 字元 Tokenizer encode/decode、UNK、Embedding forward/backward、重複 token 梯度累積、SGD 更新、存檔載入測試通過。

## 尚未驗證
- 真實 Safari／Chrome DOM 與頁面載入。
- iPhone Safari 記憶體、速度、長時間穩定性。
- Apple Metal、GPU 加速、原生裝置執行。
- 大型語料 tokenizer 品質及大模型訓練。
- Attention／Transformer Block 尚未實作。

## 結論
目前可以確認的是 CPU JavaScript 參考實作的 81 項自動測試通過。不能推論 NCL 已能執行 70B 模型，也不能將 V8 harness 結果描述為 iPhone 真機測試。
