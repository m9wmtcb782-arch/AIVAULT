# Stage (a) — 單手機 GPU 矩陣乘法（tiled GEMM）

- 狀態：**matmul only**。神經網路標籤固定為 `NOT AVAILABLE`。
- 實作日期：2026-10-24（Asia/Taipei）
- 授權依據：使用者 widget「授權第一階段」；僅 Stage (a)，未做 b–e。

## 檔案

| 路徑 | 用途 |
|---|---|
| `aivault-compute-gemm-test.html` | 手機可開的獨立測試頁（CSP local-only） |
| `assets/compute-pool/gemm-engine.js` | WGSL 16×16 tiled GEMM + JS Float32 參考校驗 |
| `scripts/compute-gemm-cpu-ref.py` | 主機 numpy 填值公式對照（非 GPU） |
| `tests/gemm-engine.test.mjs` | 離線單元測試（不需 WebGPU） |

**未修改**魚種分級 benchmark（`compute-mesh-gpu-test.html`）與既有 `tensor-engine.js` dense16。

## 成功標準（頁面內自動檢查）

1. 真實 WebGPU `@compute` shader，`var<workgroup>` 共享記憶體 tiled GEMM（非假 timer）。
2. 方陣尺寸 256／512／1024，fp32：對 JS Float32 參考的 max abs error ≤ 1e-3，或相對誤差 ≤ 1e-5。
3. 有 `shader-f16` 時另跑 fp16：max abs ≤ 1e-1 或相對 ≤ 1e-2。
4. 同一尺寸連跑 5 次，`output_sha256` 一致。
5. 記錄 GFLOPS（含 readback 牆鐘時間；**無** timestamp-query）。
6. CSP `connect-src 'self'` + PerformanceObserver + fetch 守衛：不得出現 groq／openai／gemini 等 LLM 網域。
7. UI 明確顯示 `神經網路：NOT AVAILABLE`。

## 關閉開關（Off switch）

- 網址：`?COMPUTE_GEMM_OFF=1` 或 `?off=1`
- 或 `localStorage.setItem('COMPUTE_GEMM_OFF','1')`
- 文件／CI 約定環境變數名：`COMPUTE_GEMM_OFF=1`（本靜態頁以 URL／localStorage 為準）

關閉時頁面拒絕建立 GPU runner，不提交任何 compute pass。

## Rollback

- 回滾雜湊（本功能合進 main 前的 HEAD）：`6f0de4a4ecef079de83985762d6d60190264932e`
- 回滾方式：刪除上表四個新檔，或 `git revert <本 commit>`。

## 手機怎麼跑

1. 等 GitHub Pages 部署後開啟：  
   `https://m9wmtcb782-arch.github.io/AIVAULT/aivault-compute-gemm-test.html`
2. **iPhone**：需 **iOS 26+／Safari 26+**（系統預設開 WebGPU）。較舊 iOS 會顯示不支援。
3. **Android**：Chrome（支援 WebGPU 的版本）可當對照。
4. 按「開始 Stage (a) GEMM 測試」，完成後按「複製完整結果」貼回。
5. 可開飛航模式再跑一次，作為「無外部 API」的最強證明（頁面本身也不會發 LLM 請求）。

## 本機（開發機）驗證

```bash
node --test tests/gemm-engine.test.mjs
python3 scripts/compute-gemm-cpu-ref.py --sizes 256,512
```

## Box／CI 上的 WebGPU

此執行環境的 Chrome headless **沒有可用的 GPU adapter**（`requestAdapter` → null；Vulkan／SwiftShader 初始化失敗）。因此 **無法在 box 上量到真實 GPU maxAbs**。CPU 參考路徑與 WGSL／CSP 單元測試已通過；GPU 誤差數字需在實體手機或有 WebGPU 的瀏覽器上讀取頁面報告。

## 誠實邊界

- 這是 **GEMM／matmul**，不是神經網路、不是權重載入、不是推論。
- 計時含 readback，不是純 GPU timestamp。
- `adapter.info` 若瀏覽器提供會寫入報告，但**不是**硬體認證。
- Stage (b)–(e) **尚未開始**。
