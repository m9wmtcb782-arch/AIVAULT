# Unified GPU Fabric：原生授權模型 stage v0.1

研究分支限定；不修改正式網站、暗星或 Supabase，不部署正式環境，不使用 Grok／Kling API。

## 本階段接續內容

新增 `AIVAULTPlannedDenseStageV01.swift`，把已驗證的 Dense Metal、原生張量 receiver、URLSession sender、TLS listener 與前景生命週期接成可配置的模型 stage。保留原有核心與 WebBridge allowlist。

可信原生配置包含：job、依拓樸排序的線性模型、每個 operation 的 node／input／output／dependency、固定 Float32 權重／bias／activation、輸入 grant 與下游 TLS 路由。Swift value types 的 immutable 屬性與 array copy-on-write 防止後續 caller 陣列修改影響執行。

- 每節點恰好一個 Dense＋activation，最多 32 個線性 stage；不支援 fan-out、batch、動態 shader 或任意模型程式碼。
- 檢查唯一 operation／node／output、相鄰 dependency／張量邊／維度，以及 incoming grant 的 job/op/tensor/peer/shape 與最多 10 分鐘期限。
- 非終端節點一定要有下游 route；終端禁止額外 route。路由只能 HTTPS `/tensor`，不允許 URL credential、query 或 fragment，且須匹配下游 operation、tensor、peer、shape 及有效期限。
- GPU 初始化與 kernel 執行只在驗證輸入及 durable reservation 後發生。listener 啟動由既有原生前景 consent/session 控制，配置本身不啟動接收或 Metal。
- 第一層算完 `h` 後，以 native URLSession 將 Float32＋SHA-256 envelope 傳到第二個 native NWListener，第二層完成後回傳有界、匹配的 receipt。收到有效 receipt 才把第一層標為完成。
- 執行或傳輸失敗維持 consumed，狀態 `FAILED_REQUIRES_NEW_JOB`，沒有隱藏的工作重試或成功宣告；無法保證 receipt 遺失時另一節點未運算。
- 公開建構使用正常系統 TLS 信任。測試注入的 ephemeral CA 僅為 internal seam，沒有安裝憑證或改寫 Keychain。

原生 App 增加可信 `configureFabricStage(_:identity:ledgerDirectory:bindHost:)` factory，從上述 configuration 建立 durable ledger、stage 與 listener，並將 grant 到期時間交給前景 session。仍須使用者明確加入才接收。預設 bind 為 loopback，尚未對 LAN 公開。

## 測試範圍與狀態

- **CONFIRMED**：先前前景 stage 的 CI 已通過，本次讀取研究 branch 最新來源與該 CI 後才續作。
- **CONFIRMED**：來源提交 `1910f9d61fb7886a55a5dd950d350b0a9bff9968` 的 [iOS 與 native planned model CI](https://github.com/m9wmtcb782-arch/AIVAULT/actions/runs/38131333523) 通過並讀取日誌：iOS Simulator 建置成功、既有生命週期／TLS／Metal／Dense 回歸成功，新增全原生雙 listener 模型流程、配置拒絕／重播／失敗保持 consumed 測試成功。裝置名稱為 `Apple Paravirtual device`。
- 新測試在同一 macOS runner 上啟動兩個原生 TLS listener、兩個 foreground session，執行同一個 3 → 4 → 2 模型。`x=[1,2,-1]` 的獨立已知基準為 `h=[2,2,0,0.5]`、`y=[6.5,-1.5]`。
- 驗證配置後仍等待輸入、caller 修改原始權重不改結果、錯誤 job 拒絕但不消耗有效工作、重播拒絕、無效 graph/grant/dimension/route 拒絕。
- 傳輸失敗的 state／新訊息重播測試直接呼叫 receiver actor；該部分不是 TLS 證據。兩個成功模型 stage 的交接實際走 native URLSession＋NWListener TLS，不經 Node receiver／Metal CLI。
- **NOT VERIFIED**：兩個 listener 不代表兩台實體 GPU；runner 使用同一個 Metal device。iPhone 簽署／安裝、實體雙設備、外網/LAN 路由仍未驗證。
- **BLOCKED**：目前沒有可信憑證與 grant 的交付／發行服務，App 預設加入仍停用；factory 是原生接線入口，不是已完成部署的 provisioning。
- **REQUIRES TEST**：下一階段端到端可信配置交付、App 內實際任務狀態與裝置安裝流程。

## 邊界

graph configuration 是可信本地輸入，尚無簽名驗證、受信 coordinator 設定匯入或硬體身分 attestation。Token 綁定的是具體 job/op/tensor/peer，不是經驗證的 GPU 實體身分。

目前為固定權重的小模型，每份 graph 配置仍攜帶所有層參數；沒有證明大型模型的記憶體跨 GPU 聚合、Transformer 支援或效能收益。receiver 與 ledger 可被可信 native test/controller 直接呼叫；consent 由 App 的前景 listener admission path 負責，不能宣稱任何 native 呼叫都必須先經 UIKit。

確認僅適用於 GPU Fabric iOS workflow；暗星既有失敗 workflow 未於本階段更改。
