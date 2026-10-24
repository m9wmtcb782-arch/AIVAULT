# Stage (b) — 單手機微型神經網路推論

- 狀態：**micro MLP only**（`owned-micro-mlp-v1`）。**不是** Qwen、**不是**跨設備、**不是** Stage (c)–(e)。
- 授權：使用者「第二階段」／Stage (b)。
- 日期：2026-10-24（Asia/Taipei）

## 模型

| 項目 | 值 |
|---|---|
| 架構 | 64 → 48 → 32 → 5 |
| 激活 | ReLU（最後一層 logits） |
| 參數 | 4,853（fp32，約 19 KB） |
| 訓練 | `scripts/train-micro-mlp.py`（**numpy only**，無付費 API） |
| 資料 | 合成 5 類高斯球（固定 seed），非 MNIST 下載 |
| 權重 | `models/micro-mlp/weights.f32.bin` + `manifest.json`（含 SHA-256） |
| 參考 | 100 筆固定輸入／logits／top1 二進位檔 |

主機參考準確率（同分布測試）：見 manifest `host_test_accuracy_full` / `host_ref_accuracy_100`。

## 檔案

- `aivault-compute-nn-micro-test.html` — 手機測試頁（CSP `connect-src 'self'`）
- `assets/compute-pool/nn-micro-engine.js` — 權重載入、CPU 前向、WebGPU GEMM+bias+ReLU
- `models/micro-mlp/*` — 權重與參考包
- `scripts/train-micro-mlp.py` — 可重現訓練
- `tests/nn-micro-engine.test.mjs` — 離線 CPU 校驗
- `docs/compute-nn-micro-stage-b.md` — 本文件

**未改動** Stage (a) 頁與 `gemm-engine.js` 行為。

## 執行路徑標籤（誠實）

| 路徑 | `executed_on` | 何時 |
|---|---|---|
| WebGPU compute（矩形 tiled GEMM + bias + ReLU） | `WebGPU` | `navigator.gpu` 可用（iPhone 需 iOS 26+） |
| JS Float32 前向 | `CPU` | 無 WebGPU 或 GPU 初始化失敗時自動後備 |

兩者都必須通過：對 host 參考 logits max abs ≤ **1e-4**，top-1 一致率 **100%**。

未使用 onnxruntime-web（避免 CDN；本頁嚴格同源 CSP）。未使用外部 LLM。

## Off switch

- `?COMPUTE_NN_MICRO_OFF=1` 或 `?off=1`
- 或 `localStorage.COMPUTE_NN_MICRO_OFF='1'`

## Rollback

- 回滾雜湊（合進前 HEAD）：`373faddea61ba03cd64cc21e1f76c007841b42a0`
- `git revert <stage-b-commit>` 或刪上表新檔（保留 `models/micro-mlp` 與否自行決定）

## 手機怎麼跑

1. `https://m9wmtcb782-arch.github.io/AIVAULT/aivault-compute-nn-micro-test.html`
2. 先讓頁面與 `models/micro-mlp/*` 載入完成，可開飛航再按測試。
3. 看 `executed_on` 是 `WebGPU` 還是 `CPU`；複製 JSON 回報。

## Box 限制

Box 上通常無 WebGPU adapter → 單元測試只保證 **CPU** 路徑。GPU 數字需實體手機。

## 未做

Stage (c) 協作池調度、(d) 跨設備、(e) Qwen3-0.6B。
