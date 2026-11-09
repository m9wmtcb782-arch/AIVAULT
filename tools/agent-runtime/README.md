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
