# 第五級本機執行驗收

這個命令列工具以 SQLite 保存本機測試身分、工作佇列、租約和稽核事件。它呼叫第一基地既有的 AutonomousAgentRuntime v0.1 執行固定的唯讀任務。每個 Agent 各自讀取 GitHub 指定提交的 README，核對 Git blob 並保存 SHA-256、run ID 和 Runtime 事件。

環境需 Python 3.10+、SQLite 3.38+、Node.js 22+ 與 curl。請在具 GitHub 唯讀連線的本機執行。

```sh
python3 -B tools/agent-runtime/test_runtime.py
python3 tools/agent-runtime/benchmark.py /tmp/aivault-level5-evidence
```

驗收程式用新資料庫跑 100 個不同身分的唯讀工作。接著用獨立資料庫量測 1,000、10,000、100,000 筆身分及佇列入列容量，重複提交同批次驗證去重。輸出包含逐次稽核 JSONL 和摘要。這些容量數字代表已入列的工作數。報告中的 peak child RSS 是最大單一子程序峰值，整組程序的合計記憶體與指定 8GB 裝置仍待實測。

工作可用下列命令分步操作。程序中斷後可重新執行 run，租約到期後會重新派發。已核驗的任務與其證據會一起提交至資料庫。

```sh
python3 tools/agent-runtime/runtime.py /tmp/aivault.sqlite seed 100 --batch example
python3 tools/agent-runtime/runtime.py /tmp/aivault.sqlite run --workers 4
python3 tools/agent-runtime/runtime.py /tmp/aivault.sqlite metrics
python3 tools/agent-runtime/runtime.py /tmp/aivault.sqlite audit
```

本機驗收採固定規則和工具白名單，並行租約上限四個、待處理任務上限十萬、每工作最多三次嘗試。工具子程序限時 15 秒，短於 60 秒租約。後續階段仍需接入既有 Governance、Cognitive、因果引擎及模型 Gateway，驗證長任務 heartbeat、取消、跨代理人協作、跨節點排程與正式站整合。

## 十萬筆出列與程序中斷回復

```sh
python3 -B tools/agent-runtime/drain_benchmark.py /tmp/aivault-level5-drain.sqlite
```

請指定尚未存在的資料庫。腳本填入十萬筆任務，讓子程序持有四筆一秒期測試租約，再強制結束子程序。四個替補 worker 使用原有 SQLite 取件、完成和稽核流程，把整個佇列排空。腳本逐筆對照完成紀錄及 run ID，並檢查失效 run ID 無法再次寫入結果。工作負載是本機 SHA-256，量測範圍為佇列和稽核寫入。GitHub 工具吞吐量由前一節的獨立測試量測。

輸出含出列時間、CPU 時間、主程序峰值 RSS 和資料庫容量。完整稽核可用 `runtime.py DATABASE audit` 匯出。

## 十個有模型推論的 Agent 驗收

在測試主機先驗證 GGUF 權重的 SHA-256，以 llama.cpp 啟動本機模型，並啟動既有 `workers/worker-001/model-bridge.py`。模型服務與 bridge 都只監聽 loopback。Bridge 和驗收程式共用 `AIVAULT_WORKER_MODEL`（須等於 llama.cpp 模型別名）與伺服器端 `AIVAULT_WORKER_BRIDGE_TOKEN`。執行：

```sh
node --experimental-transform-types tools/agent-runtime/real-ai-acceptance.mjs > acceptance.jsonl
```

十個 Agent 各自接收一道任務。第一個模型回應必須選中允許的工具，Runtime 隨後執行該工具。第二個模型回應須正確回報結果，並經獨立核對。驗收保留每個 Agent 的 run ID、模型回應、實際輸出 token 數、工具結果與 Runtime 事件。模型選錯、回報不符、沒有推論服務或沒有生成證據時，該次不計為通過。

這批使用同一份模型權重，測試範圍為十個分開執行的模型驅動 Agent。現有 Worker-001 本機 bridge 是這次測試入口。正式 AI Gateway 路徑、長期獨立記憶與開創者電腦上的執行仍待驗收。
