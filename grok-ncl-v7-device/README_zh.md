# Grok NCL v7 iPhone Safari 離線量測套件（尚未實機測試）

## 一鍵使用（建議）
1. 用 iPhone Safari（iOS 26 以上）打開 HTTPS 網址。
2. 按頁面最上方唯一的大按鈕「開始測試」，不要切換畫面，等全部步驟出現 ✅/❌。
   自動依序：檢查HTTPS與WebGPU → 安裝離線快取並驗SHA → 載入真實v7模型（再驗SHA與GPU首次分布）→ GPU案例核對（6組分布＋4組序列）→ 短測（3輪×256 bytes）→ 正式30輪×1024 bytes。
   若單次dispatch失敗，會自動重新載入並改用每段64步重試，JSON會記錄 chunk_used。
3. 按「下載結果JSON」傳回。
4. 斷網測試：開飛航模式（Wi‑Fi也關）後重新整理頁面，勾選「斷網（飛航模式）測試」裡的選項、按「檢查網路」，再按一次「開始測試」，下載第二份JSON。
「進階參數與手動步驟」預設收合，一般不需打開。


狀態：REQUIRES TEST。本套件尚未在 iPhone 或 Safari 執行；桌面 llvmpipe 的結果不是手機數據。模型是已訓練的 v7 compat byte 模型，有 70,048 個可學參數，外加統計圖，不是 70B。

## 分工（無 CPU 冒充）
- GPU（WebGPU WGSL compute）：統計圖查找、hash 特徵、神經 MLP、softmax 混合、逐 byte 採樣。單次 dispatch 可在 GPU 內完成整段生成。
- CPU（JavaScript）：讀檔、SHA-256、上傳、提交、等待同步、讀回、解碼與匯出。另在計時範圍外，用 float64 CPU 參考重播每個 byte，核對 GPU 輸出。
- 沒有 `navigator.gpu`、不是安全來源、adapter 為 null，或瀏覽器回報 fallback adapter 時，頁面會直接失敗，不會改用 CPU 生成。

## 需要 HTTPS
WebGPU 與 Service Worker 都需要安全來源。iPhone 必須用 `https://` 開啟本資料夾，`localhost` 只適用桌面。把資料夾內全部檔案原樣放到任何靜態 HTTPS 主機即可；不需要伺服器程式，也沒有遠端推論。另一種方法是用 Mac 本機 HTTPS，並在 iPhone 安裝受信任憑證。頁面 CSP 只允許同源連線。前提：iOS 26／Safari 26 預設啟用 WebGPU（WebKit「Safari 26.0」公告）；實際機型是否可用，仍須實測。

## 實機流程
1. 連線時用 HTTPS 開啟頁面，按「安裝離線快取」，確認所有檔案的 SHA 都吻合。
2. 按「從網路載入（冷）」，再按「GPU分布/固定案例核對」。第一輪生成必須和 NumPy golden 的 SHA 一致，或標示為 BOUNDARY_ONLY。
3. 開啟飛航模式，關閉 Wi-Fi 與行動網路，然後重新整理頁面。勾選自述欄位，按「檢查離線證據」：同源網路探測應為 unreachable，且 Service Worker 應接管頁面。
4. 按「從離線快取載入（暖）」，設定提示詞、seed、bytes、輪數（預設 30，可 1–200），然後執行量測。若出現 device lost，把每次 dispatch 改成 64 步。
5. 下載或複製 JSON，並保留螢幕錄影：需含飛航模式畫面、裝置型號與 iOS 版本。

## JSON 內容
- 模型、規格、頁面與每輪輸出的 SHA。
- adapter 資訊（瀏覽器可能清空）、features 與 limits。
- 冷／暖載入各階段 ms：fetch、SHA、device、upload、shader 編譯、首次分布。
- 每輪 wall time，以及 submit→`onSubmittedWorkDone`、submit→`mapAsync` 讀回。
- byte/s 的平均、中位、P95、標準差、ms/byte，不同輸出數，CPU 參考核對結果，失敗紀錄。
- 記憶體標為 NOT VERIFIED：Safari 不提供程序 RSS，本頁不推算；只列模型檔與 GPU buffer bytes。
- 1 token = 1 byte。

## 已在 box 驗證（桌面／llvmpipe，非手機）
- `tests/test_v7_device.py`：用與頁面相同的 WGSL 與 buffer 配置在 wgpu 上執行。分布與 NumPy 誤差小於 3e-5；4 組 golden 序列在單次與分段 dispatch 下逐 byte 一致；權重和現有 `web/v7` 相同。
- `tests/core.test.mjs`（Node）：JS CPU 參考與 NumPy 吻合；重播 golden 完全一致，竄改輸出能被偵測；分段生成結果一致；30 輪統計正確；缺少 WebGPU 會拒絕執行；頁面無外部網址。
- 桌面 llvmpipe 30 輪參考：`results/v7_device/llvmpipe_desktop_bench.json`。這是 CPU 軟體 GPU，不能代表 iPhone。

## 未完成／限制
- 未在 iPhone、Safari 或任何實體 GPU 上執行；瀏覽器內的 `app.js`／`gpu-engine.js` UI 尚未以實際瀏覽器測試，只做過 Node 語法與邏輯 mock 測試。
- Safari 無 RSS API，記憶體為 NOT VERIFIED；未使用 timestamp-query；沒有功耗或熱資料。
- 「冷載入」無法排除瀏覽器或系統的 shader／HTTP 快取。
- 離線只能以飛航模式自述、同源探測與錄影佐證，網頁無法證明無線電已關閉。
- 只含 v7 compat 小模型；v7 large、分頁版與 70B 都不在本套件。
