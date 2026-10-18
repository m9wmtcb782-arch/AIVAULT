---
title: 程式與代理工具（專業）｜代理執行環境、沙盒與 CI
tier: 專業
order: 24
domains: 程式與代理
---
## 第 1 章 代理執行環境（Agent Runtime）
每個代理需要：唯一 ID、狀態（REGISTERED、READY、RUNNING、WAITING、SLEEPING、BLOCKED、RETIRED）、任務佇列、記憶命名空間、技能設定、執行權限。只有實際取得執行資源才能標 RUNNING。
OpenClaw（開源個人 AI 助理閘道）提供 Agent Loop、Workspace、Skills、Memory、Tool Calling 的參考設計，但它要自備模型、會接外部聊天軟體；協作池只參考設計，不直接安裝。
## 第 2 章 任務佇列與租約
工作租約（lease）：代理領取任務時寫入「到期時間」；逾時未完成，其他代理可以接手。冪等（idempotent）：同一任務被處理兩次結果也一樣。重試要有上限與退避（backoff）。協作池學習鎖 25 分鐘、整輪鎖 8 分鐘，就是租約的應用。
## 第 3 章 沙盒隔離
- 程序隔離：子程序執行、設定逾時。
- 資源限制：CPU 時間、記憶體、輸出大小。
- 網路與檔案：預設最小權限，不給金鑰。
- 每次在乾淨環境（GitHub Actions 新 runner）執行，保證可重現。
## 第 4 章 CI 與合併驗收
GitHub Actions：push 或排程觸發工作流程，跑測試，失敗會紅燈。協作池合併規則：各自分支 → 測試通過 → 另一名 AI 批准 → 合併。commit 訊息寫代號、改了什麼、關閉開關、還原點。
## 第 5 章 可觀測性與成本
每次執行紀錄：開始、結束、結束碼、token 用量、費用、錯誤。儀表板顯示佇列長度、執行中數量、失敗率、額度剩餘。成本上限到了就停止，不自動擴充。
## 練習（對應實驗工廠）
1. 實作租約佇列（記憶體版）：claim、complete、逾時回收、重試上限，附測試。
2. 寫一個子程序執行器：逾時 5 秒、輸出截斷 10 KB、回傳結束碼，附測試（含無限迴圈案例）。
3. 寫一個 GitHub Actions YAML：push 時跑 node --test 與 python -m unittest。
## 參考資料（已檢查可開啟）
- SWE-agent：https://arxiv.org/abs/2405.15793
- OpenHands：https://github.com/All-Hands-AI/OpenHands
- OpenClaw：https://github.com/openclaw/openclaw
- GitHub Actions 文件：https://docs.github.com/en/actions
- Python subprocess：https://docs.python.org/3/library/subprocess.html
- Node.js node:test：https://nodejs.org/api/test.html
- The Twelve-Factor App：https://12factor.net/
