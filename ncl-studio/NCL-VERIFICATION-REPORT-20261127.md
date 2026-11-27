# NCL 驗收執行報告 — 2026-11-27（更新至 v1.1-alpha.1）

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
| v0.9 Positional Encoding／Causal Attention | 11 | 11 PASS / 0 FAIL |
| v1.0-alpha.1 Transformer 整合 | 10 | 10 PASS / 0 FAIL |
| v1.1-alpha.1 Multi-Head Attention | 10 | 10 PASS / 0 FAIL |
| **合計** | **112** | **112 PASS / 0 FAIL** |

## CONFIRMED
- 九套測試頁的測試函式均在 V8 harness 實際執行。
- v0.7 XOR 小型資料訓練測試通過（只證明該固定小型測試案例能降低 MSE）。
- v0.8 字元 Tokenizer encode/decode、UNK、Embedding forward/backward、重複 token 梯度累積、SGD 更新、存檔載入測試通過。

## 尚未驗證
- 真實 Safari／Chrome DOM 與頁面載入。
- iPhone Safari 記憶體、速度、長時間穩定性。
- Apple Metal、GPU 加速、原生裝置執行。
- 大型語料 tokenizer 品質及大模型訓練。
- v0.9 已加入單頭 causal attention 與 Q/K/V 手動反向梯度；Q/K/V 中心差分數值梯度檢查最大誤差約 8.7e-11。
- v1.0-alpha.1 已整合 Token ID → Embedding → Positional Encoding → 單頭 Causal Attention；反向梯度可回傳至 Embedding，並可更新 Embedding 權重；固定權重模式及存檔／載入一致性測試通過。
- v1.0-alpha.1 整合 Embedding → Positional Encoding → 單頭 Causal Attention；僅 Embedding 權重可訓練。
- v1.1-alpha.1 新增可訓練多頭 Causal Attention、Q/K/V/O 投影矩陣與手動反向傳播；10/10 測試通過。Q/K/V/O 權重梯度與輸入梯度中心差分最大誤差分別約 5.9e-11、4.5e-11。

## 結論
目前可以確認的是 CPU JavaScript 參考實作的 112 項自動測試通過。不能推論 NCL 已能執行 70B 模型，也不能將 V8 harness 結果描述為 iPhone 真機測試。
