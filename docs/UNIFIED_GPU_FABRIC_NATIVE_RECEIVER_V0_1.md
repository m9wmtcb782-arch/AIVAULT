# 原生張量接收端 v0.1（研究）

新增 Swift actor 接收核心、私有檔案系統防重播 ledger、Network.framework TLS listener 與有上限的 HTTP/1.1 parser。沿用目前 Float32 tensor／transport 格式與 sender／receiver、job／operation／tensor 綁定。

- 短效 grant、SHA-256、形狀／長度／期限先驗證；同步 durable reservation 後才呼叫運算。
- 同一階段不可因換 token、換 message ID、重啟或 backend 失敗而自動再次執行；reservation 不保存運算結果，需另作恢復／對帳。
- listener 僅在明確 start(consentGranted: true) 時啟動，預設只綁 localhost；需要帶外提供 SecIdentity，不簽發憑證，不自動安裝 CA。
- 一個 POST /tensor、Content-Length，拒絕 chunked／壓縮／重複 header／pipeline；header 上限 8 KiB、最多 8 條同時連線、連線期限 15 秒。
- stop() 同步撤銷新 reservation，再關閉 admission 與 sockets；已保留的 callback 可以完成，不能將關 socket 視為 rollback。

CONFIRMED：提交 `533431d07a90ae26e79efccad84ee6bb9450ed48` 的 GitHub run 38128315514／job 114437210099 通過 iOS SDK type-check、Simulator build 與 macOS 原生 TLS 接收測試。兩段本地 Metal 經 native URLSession → NWListener TLS 接续，得到 `[5, 8, -1]`；裝置為單台 runner 的 Apple Paravirtual device。

CONFIRMED：HTTP 分片／上限、重複 header／chunked／壓縮／pipeline 拒絕；錯誤 token／peer／job／checksum／expiry／換行 ID 拒絕；並行重送只執行一次；backend 失敗保持 consumed；撤銷後不能保留新工作；儲存失敗不呼叫 backend；重開 ledger、換 token 與 message ID 仍拒絕同一階段。HTTP parser 及 actor 拒絕案例為直接核心測試，另有真實 native loopback TLS／系統不信任憑證／hostname mismatch／token／job／replay 驗證，不能混作實體裝置證據。

接收時間在 actor 真正處理完整 body 時取得，防止呼叫端預先計算參數／排隊影響期限檢核。mutable listener 狀態限制在專屬 serial queue，receiver 為 actor，停止准入以 lock 保護；相關 Sendable 編譯警告已消除。

REQUIRES TEST：前景 App 接入與完整小模型。

NOT VERIFIED：實體 iPhone、兩台實體 GPU、完整模型。App 的憑證／grant provision、前景加入／停止 UI、背景撤銷／重入流程仍未接入。現有 App 不會自動啟動 listener。

macOS CI 使用臨時 P12，僅記憶體匯入（macOS 15+），臨時測試 trust anchor 限於該 URLSession 並驗證 chain／hostname。P12 的 legacy 包裝僅供測試匯入相容性；網路 TLS 至少 1.2。無 system trust／Keychain 修改。
