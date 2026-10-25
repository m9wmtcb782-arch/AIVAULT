# 與 `connectors/tronclass` 的關係

本套件（`public-material-learn`）與 TronClass connector（Draft PR #35／Issue #38）是**替代／並行**管線，**不是** TronClass 登入後端。

| | public-material-learn | tronclass connector |
|--|--|--|
| 輸入 | 課名／檔名／`name=`／公開清單 | 學校允許的 session／token handoff |
| 抓取目標 | allowlist 公開 URL（如衛福部） | 教師允許下載的私有課件 |
| 帳密 | 永不 | 永不存明文；官方頁自行登 |
| `tronclassE2eSuccess` | 永遠 `false` | 真實授權 E2E 前亦 `false` |
| 學校授權 | 不需要（公開網） | **需要**（目前未確認 → BLOCKED） |

當公開同源比對失敗時，訊息應引導使用者：**手動**自 TronClass 下載後上傳，而不是觸發自動登入。

若 `connectors/tronclass` 尚未合併進 `main`，本文件仍以該路徑為契約參考；合併後可在 TronClass README 加反向連結至本套件。
