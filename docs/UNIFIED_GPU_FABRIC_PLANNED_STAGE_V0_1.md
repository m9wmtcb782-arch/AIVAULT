# 規劃器 → HTTPS 計算階段（研究分支）

## 本階段新增

`gpu-fabric-planned-stage-v0.1.mjs` 把可信協調端提供的計算圖／節點分配接到現有 HTTPS 接收端。接收端只接受該 job、operation、input tensor、來源節點的短效 grant。設定在建立時複製，呼叫者事後變更 scalar、plan 或 grant 不會改變已登記的運算。

收到完整性驗證通過的 Float32 張量後，先永久保留該階段的防重播紀錄，再呼叫指定 adapter。若有後續節點，依計算圖的指定邊傳送輸出，且必須驗證對方收據後，才回報本階段完成。下游傳輸或執行失敗不會自動重跑；需協調端核對工作狀態，另行建立新 job。永久保留的是 reservation，並非輸出保存／恢復機制。

## 範圍與限制

- 每節點一個 operation、一入一出、線性依賴鏈，僅支援 mul_scalar／add_scalar；不接受分支、多輸入、矩陣或權重運算。
- Node.js 接收端可接入本地 adapter；原生 iPhone 接收端與前景排程尚未完成。
- TLS／grant 仍須可信協調端在帶外配置，不提供簽發、發現、安裝或正式部署。
- grant 指定的是預期來源與階段，不能證明上游真的完成了 GPU 運算。傳輸收據證明張量驗證及 handler 成功，不能作為完整模型、兩台 GPU 或硬體認證。
- getState 是程序內階段結果。每個 operation 的完整圖工作狀態及獨立終端驗證尚未接到 coordinator。

## 驗證

CONFIRMED：本地 70 項 Node 測試通過；一份 plan 送入兩個獨立 CPU worker 程序，以真實 localhost TLS 傳遞中間張量，結果與獨立 Float32 基準一致，第二節點重啟後的重播被 durable ledger 拒絕。

CONFIRMED：單元測試涵蓋 plan／grant／來源替換、重複拓樸、呼叫者後改設定、錯誤 job、Float32 溢出及下游失敗後不能自動重跑。單元 HTTP 請求使用記憶體 harness；不當作 TLS 或 GPU 證據。

CONFIRMED：研究提交 `c13a1696bde35831819bbdf25239c48442bdcfc0` 的協定 CI（run 38127308971）與 iOS／macOS CI（run 38127308928）通過。新 planned stage 驅動 Metal CLI 第二階段，得到 `[5, 8, -1]`；iOS Simulator 建置、原生 URLSession TLS 與拒絕測試亦通過。runner 裝置是 Apple Paravirtual device，同一台 runner，不能視為兩台實體 GPU。

REQUIRES TEST：原生 iPhone 接收／前景執行、矩陣與權重運算、完整小模型及實體雙節點驗證。

NOT VERIFIED：兩台實體 GPU／iPhone，同一完整 AI 模型跨設備推論。
