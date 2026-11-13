# 十萬筆出列與中斷回復實測

2026-11-09。Linux x86_64，容器記憶體上限 8 GiB，CPU 配額 8 核。Python 3.12.14，SQLite 3.53.1。沿用草稿 PR #62 的佇列程式，`runtime.py` 的 Git blob 為 `ac3d2767791668966eafba4e963c2800c6a38adb`。

```sh
python3 -B tools/agent-runtime/drain_benchmark.py /tmp/aivault-drain-62.sqlite
```

`drain-summary.json` 是腳本標準輸出。出列時間從啟動四個替補 worker 到完成所有佇列工作為止，排除入列、故障注入和最後稽核核對。RSS 是基準測試主程序的峰值，含其四個執行緒。資料庫容量在 WAL checkpoint 後量測。

`drain-recovery.jsonl` 收錄四筆受中止影響工作的完整事件。每筆依序保存原租約、租約到期、替補 run ID 及完成證據。全量稽核可從重跑腳本產生的 SQLite 資料庫匯出。
