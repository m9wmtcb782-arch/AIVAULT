# 原生張量接收端 v0.1（研究）

新增 Swift actor 接收核心、私有檔案系統防重播 ledger、Network.framework TLS listener 與有上限的 HTTP/1.1 parser。沿用目前 Float32 tensor／transport 格式與 sender／receiver、job／operation／tensor 綁定。

- 短效 grant、SHA-256、形狀／長度／期限先驗證；同步 durable reservation 後才呼叫運算。
- 同一階段不可因換 token、換 message ID、重啟或 backend 失敗而自動再次執行；reservation 不保存運算結果，需另作恢復／對帳。
- listener 僅在明確 start(consentGranted: true) 時啟動，預設只綁 localhost；需要帶外提供 SecIdentity，不簽發憑證，不自動安裝 CA。
- 一個 POST /tensor、Content-Length，拒絕 chunked／壓縮／重複 header／pipeline；header 上限 8 KiB、最多 8 條同時連線、連線期限 15 秒。
- stop() 同步撤銷新 reservation，再關閉 admission 與 sockets；已保留的 callback 可以完成，不能將關 socket 視為 rollback。

REQUIRES TEST：iOS SDK type-check／Simulator build、macOS 真實 native URLSession → NWListener TLS → Metal、重播與拒絕案例。GitHub CI 執行結果確認後再更新。

NOT VERIFIED：實體 iPhone、兩台實體 GPU、完整模型。App 的憑證／grant provision、前景加入／停止 UI、背景撤銷／重入流程仍未接入。現有 App 不會自動啟動 listener。

macOS CI 使用臨時 P12，僅記憶體匯入（macOS 15+），臨時測試 trust anchor 限於該 URLSession 並驗證 chain／hostname。P12 的 legacy 包裝僅供測試匯入相容性；網路 TLS 至少 1.2。無 system trust／Keychain 修改。
