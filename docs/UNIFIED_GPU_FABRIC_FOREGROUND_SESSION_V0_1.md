# Unified GPU Fabric：前景加入／停止控制 v0.1

僅修改研究分支 `research/unified-gpu-fabric-v0.1` 的 iOS worker、測試及 workflow。沒有修改正式網頁、暗星、Supabase 或部署；沒有呼叫 Grok／Kling API。

## 行為

- 原生 App 顯示「加入算力池」「停止接收」與真實接收狀態，保留既有 WebBridge 與測試頁。
- 預設 **BLOCKED**，未啟動 listener。缺少節點 TLS 憑證與限縮任務 grant 時不能加入。
- 可信原生端配置一個新的 listener 與期限後仍不啟動；使用者點擊加入並明確同意、且 App 在 active 前景，才呼叫既有 TLS listener。
- Ready 回呼只代表接收器就緒，UI 不宣稱 GPU 工作完成或實體雙設備運算。
- 停止、失去 active 狀態、退到背景、啟動失敗或授權到期時，立即同步撤銷 receiver admission，再關閉連線；撤銷不會回滾已保留且開始的 callback。
- 回到前景不會自動加入；停止後消耗該次配置，需要可信端提供新 listener／新授權並重新同意。
- generation 排除停止或替換後遲到的 ready／failure 回呼。重複加入／停止、同步啟動例外、UI 狀態通知中的重入停止均有測試。
- session 最長 10 分鐘，不能以未受限期限長期接收。到期 timer 關閉 listener，即使尚未收到張量也會撤銷。
- UI 不公開 token、私鑰、完整錯誤字串；WebBridge 沒有加入、配置憑證或授權入口。

## 新增來源

- `AIVAULTForegroundSessionV01.swift`：MainActor 生命週期控制及 one-shot 授權狀態。
- `AIVAULTForegroundTLSV01.swift`：沿用 native NWListener／receiver，將回呼轉到 MainActor。
- `AIVAULTNativeWorkerApp.swift`：native controls 與 UIApplication active/background 事件。

可信配置入口 `configureFabricListener(_:expiresAt:)` 尚未接憑證發行或 grant 領取。呼叫端必須提供與 receiver grant 相符的期限、合法 TLS identity、可信 graph/backend callback 與耐久 ledger；本次不從網頁、URL 或剪貼簿接受秘密。

## 驗證狀態

- **CONFIRMED**：初始提交 `28a328e5c6ed1eb5f4a86bfd3e0f28926c8748db` 的 [iOS 建置及 controlled-transport 生命週期測試](https://github.com/m9wmtcb782-arch/AIVAULT/actions/runs/38130512413) 通過。該測試不是 GPU 或實機證據。
- **CONFIRMED**：提交 `27b7184abf1003353b3539044b5e713aff245166` 的 [實際原生 TLS 撤銷整合測試](https://github.com/m9wmtcb782-arch/AIVAULT/actions/runs/38130604790) 通過。
- **CONFIRMED**：最終測試提交 `a972542911035e44e34581cd3141fbf0f46212a3` 的 [完整原生 CI](https://github.com/m9wmtcb782-arch/AIVAULT/actions/runs/38130740215) 通過並讀取日誌：先確認可信 TLS 可達，再停止並拒絕新的有效張量，callback 次數為 0；前景恢復不重啟。iOS 建置、既有 TLS／Metal 及 Dense 模型回歸均成功。
- **CONFIRMED**：重入停止與遲到回呼控制測試通過；沒有新增 Swift 編譯警告，runner 保留既有 AppIntents metadata 提示。
- **BLOCKED**：App 尚未取得正式節點憑證、任務 grant 與可信模型配置，加入按鍵目前保持停用；不是已可公開使用的算力池 App。
- **NOT VERIFIED**：iPhone 安裝簽署、UIKit 觸控／切換 App 的實機行為、兩台實體 GPU、外部 LAN 路由與收益。
- **REQUIRES TEST**：下一階段可信配置／授權交付、模型 stage 接到 native App、實體裝置簽署與雙設備測試。

## 整合測試的範圍

macOS runner 建立記憶體內的短期測試 identity，以 lifecycle controller 啟動實際 native TLS listener，取得真實 port，先以可信 TLS 的 GET 請求確認服務確實可達且回傳預期 404（不消耗張量 grant），再失去 foreground 並回到 foreground。測試送出未被保留過且 job/op/tensor 匹配的有效張量，要求其被拒絕且 callback 計數為 0。之後保留既有 Metal/TLS 測試，均在同一 runner，不能稱為兩台 iPhone。

使用者同意的 UIKit alert 與失去 active 的 delegate wiring 會由 iOS SDK 型別檢查及建置驗證；目前沒有 XCTest UI 操作或實體 iPhone 觸控證據。

上述確認限定 GPU Fabric iOS workflow；暗星既有 workflow 的失敗未在本階段修改。
