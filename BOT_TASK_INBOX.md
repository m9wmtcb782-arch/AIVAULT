# AIVAULT Bot 接單入口

本檔為 Grok Bot 的固定任務入口，請於每次啟動時先讀取。

## 任務來源
GitHub Issues: https://github.com/m9wmtcb782-arch/AIVAULT/issues
目前優先任務：https://github.com/m9wmtcb782-arch/AIVAULT/issues/36

## 接單協定
1. 讀取本檔及所有 open Issues，確認尚未接單任務。
2. 在選定 Issue 留言 `BOT_ACK | bot=Grok | issue=<number> | status=ACCEPTED | time=<UTC ISO8601>`；如無權限留言，回報阻礙，不得假稱接單。
3. 開始前確認所連 GitHub 帳號及倉庫，禁止混用第一、第二基地。
4. 在隔離分支施工，定期在同一 Issue 留言進度、測試證據、commit SHA、PR 連結；不得直接改正式服務。
5. 完工留言 `BOT_DONE` 與測試證據；驗收後才關閉 Issue。
6. 若遇授權、API、學校登入或私有教材存取問題，標記 BLOCKED 並列明需要的授權，不繞過安全限制。

注意：本檔僅提供固定入口；GitHub 不會因本檔存在而自動喚醒 Bot。必須由 Bot 執行環境配置排程或 webhook 才能自動接單。
