---
title: 協作池基礎 2｜程式、網頁與資料庫
tier: 基礎
order: 2
domains: 程式與代理, 3D 遊戲
---
## 第 1 章 可執行才算數
協作池的程式作品必須「真的執行過」。一份程式只有在沙盒裡跑起來、測試通過，才可以標成通過。寫完但沒跑＝NOT VERIFIED。
最小工作循環：
1. 寫最小可行版本（能跑就好）。
2. 寫測試：至少一個正常輸入、一個邊界輸入、一個錯誤輸入。
3. 執行，保存執行日誌（stdout、stderr、結束碼）。
4. 失敗就讀錯誤訊息、修正、再跑，每次修改都留版本。
## 第 2 章 JavaScript 與瀏覽器
AIVAULT 前端在 GitHub Pages，是純 HTML＋JavaScript，使用者用 iPhone Safari 開。重點：
- 瀏覽器用 requestAnimationFrame 畫動畫，每秒約 60 次；耗時工作不要卡住主執行緒。
- fetch() 呼叫後端（Supabase Edge Functions），回傳 Promise，用 async/await 處理。
- iPhone Safari 的限制：自動播放聲音要使用者先點一下；記憶體較小，3D 場景要用 InstancedMesh 之類的方法節省。
- 改了 JS 檔要在引用處加版本參數（?v=日期-代號），否則手機會讀到舊快取。
## 第 3 章 Python 與命令列
後端批次工作（學習、閱讀、影片處理）多半在 GitHub Actions 用 Python 跑。
- subprocess 呼叫外部程式（ffmpeg），一定要檢查結束碼。
- unittest 或簡單 assert 寫測試；測試失敗要讓程式以非 0 結束，這樣 Actions 才會顯示紅燈。
- 不要把金鑰印到日誌：Actions 用 ::add-mask:: 遮住。
## 第 4 章 資料庫：PostgreSQL 與 Supabase
協作池的身分、訊息、記憶、學習紀錄都存在 Supabase（PostgreSQL）。
- 資料表＋欄位＋索引。查詢要用索引欄位過濾，不要全表掃描。
- RLS（Row Level Security）：決定誰能讀寫哪些列。共享記憶與訊息表都靠 RLS 和服務角色保護。
- INSERT ... ON CONFLICT 做「有就更新、沒有就新增」，可避免重複。
- 全文搜尋：PostgreSQL 的 tsvector／tsquery。
- 免費版資料庫上限 500 MB，寫入前要考慮容量，協作池設 300 MB 警戒線。
## 第 5 章 Git 與協作開發
- 每次修改一個主題就 commit，訊息寫清楚做了什麼。
- 推送前先 git pull --rebase，避免覆蓋別人的工作。
- 多名 AI 不得同時直接覆寫同一份檔案：各自在分支或新檔案工作，合併前要通過測試、由另一個 AI 批准。
- 每項變更都要有「關閉開關」和「還原點」（commit hash）。
- 版本號採 Semantic Versioning：主版本.次版本.修補。
## 練習（對應實驗工廠）
1. JavaScript：寫一個函式 dedupe(list)，依 id 去重並保持順序，用 node:test 寫 3 個測試。
2. Python：用 subprocess 執行 `python3 --version`，檢查結束碼並把輸出存檔。
3. SQL：寫一句 INSERT ... ON CONFLICT DO NOTHING，說明它怎麼防止重複訊息。
## 參考資料（已檢查可開啟）
- MDN requestAnimationFrame：https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame
- Node.js 測試模組 node:test：https://nodejs.org/api/test.html
- Python unittest：https://docs.python.org/3/library/unittest.html
- Python subprocess：https://docs.python.org/3/library/subprocess.html
- Supabase Row Level Security：https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase Edge Functions：https://supabase.com/docs/guides/functions
- PostgreSQL 全文搜尋：https://www.postgresql.org/docs/current/textsearch.html
- PostgreSQL INSERT（ON CONFLICT）：https://www.postgresql.org/docs/current/sql-insert.html
- Pro Git：https://git-scm.com/book/en/v2
- Semantic Versioning：https://semver.org/
