# AIVAULT 皇家電子圖書館 V3.2 驗收紀錄

日期：2026-11-02（台北時間）
狀態：工程測試版，尚未達成全部完工標準。

入口：https://m9wmtcb782-arch.github.io/AIVAULT/aivault-royal-library-v3.2-test.html
測試分支：work/royal-library-v3.2-20261102
審查：https://github.com/m9wmtcb782-arch/AIVAULT/pull/56

## 實測結果

| 項目 | 結果 | 證據或限制 |
|---|---|---|
| 女性暗星自動待機 | PASS（桌面 Chrome） | idle.mp4 readyState=4、paused=false、muted=true、loop=true；兩次觀察 currentTime=2.268188 / 3.5413，畫面顯示女性原生影片。不是 iPhone 測試。 |
| 縮小且置於原位置 | PASS（桌面 Chrome） | 位於場景左下暗星 AI 導讀區；left=3%、top=80.1%、width=28%、height=12.3%；只有一位動態人物。此為上一輪觀察；本輪原位合成版仍待部署畫面複驗。 |
| 動作切換且無黑畫面 | NOT TESTED | 已修正原生 reveal 分支被註解吞掉的問題，等待 playing 才切畫面；現有開心、思考、喝水、摸貓控制收納在更多功能。尚無完整切換實測。 |
| 點頭 | NOT TESTED | 已讀取的女性 avatars.json 沒有獨立 nod 片段，不冒稱已具備。 |
| iPhone Safari | NOT TESTED | 無 iPhone 真機；未把桌面 Chrome 或編碼檢查當作 Safari 通過。 |
| 麥克風啟動 | FAIL（測試環境） | 點擊開始即時語音後，瀏覽器回報 Requested device not found。測試環境沒有可用麥克風。 |
| 語音服務握手及真人問答 | NOT TESTED | 未取得麥克風，尚未測到 WebSocket / 上游服務確認階段。 |
| 回答時嘴型與動作同步 | NOT TESTED | 沿用原生 PCM 每 20ms 分析、AudioContext 排程及 dhLip.schedule；沒有收到實際 AI 音訊，不能判為 PASS。 |
| 書架載入 | PASS | 顯示原有 4 筆示範書目，標示示範，不冒稱有全文。 |
| 切換書籍 | PASS | 點下一本，由行政法入門改為行政法與行政訴訟法學。 |
| 館區分類與折疊選單 | PASS | 展開十大館區，切至英語學習，正確顯示 0 筆與國中、高中、大學等子分類。 |
| PDF 匯入／閱讀／保存 | NOT TESTED | 檔案上傳授權未獲准；未繞過。保留原 IndexedDB、匯入及閱讀器程式。 |
| PDF 導讀內容擷取 | NOT TESTED | 新增 PDF.js 逐頁擷取與頁碼；最多 18,000 字元。掃描本無文字時明示限制，沒有 OCR，不代表讀完整本。 |
| 學習紀錄顯示 | PASS（載入） | 顯示本機手動標記與來源核對台，未將本機標記宣稱為真實 AI 學習。新增／刪除紀錄未測。 |
| 核心引擎與既有頁面修改邊界 | PASS（檔案範圍） | 只新增獨立測試 HTML 與本報告；未覆寫首頁、數字人原檔、AI Gateway、Cognitive 或 Governance Engine。全站回歸未執行。 |

## 實作與依賴

HTML 含樣式、圖書館原有程式與嵌入的原生數字人衍生頁；無需另放自訂 JS/CSS。
沿用第一基地 digital-human-real/avatars.json、video/、lip/ 與原有輔助腳本。
沿用 technical-dark-star-live-voice-v2 即時語音服務與原站登入狀態，不新增金鑰或付費模型回退。
修正 WebSocket 開啟就宣稱連線的狀態；等待原有 live_open/setupComplete 訊號後才標記服務確認。
女性待機預設直接 idle，其他動作延後載入，iOS 麥克風使用者手勢同步呼叫原生 start。
書籍內容僅取自實際匯入 PDF；示範書目無全文，限制必須告知。語音中傳入書籍上下文的效果尚未驗證。
需要 HTTPS 及網路；下載 HTML 並不包含 MP4 全部素材，也不保證手機檔案預覽器支援麥克風。

## 修改檔案與回復

- aivault-royal-library-v3.2-test.html：新增測試入口。
- reports/royal-library-v3.2-acceptance.md：驗收紀錄。

正式首頁未加入口、未覆寫，使用者透過獨立網址開啟。
回復只需以新提交移除新增測試頁與報告，或 revert 新增／更新測試頁的提交；不要 reset main 或還原其他並行工程。
第一筆主分支提交 70b6904accb70b780a9f5c6a144e14dc8f2b98f9，後續只更新同一測試頁。
本機 PDF 不需刪除；勿清除網站儲存來回復前端。

## 待完成

1. 最新動作控制部署後，逐一實測開心、思考與回待機。
2. 在具備真實麥克風且已登入第一基地的 iPhone Safari，實測握手、收音、AI 回音、打斷與嘴型。
3. 在上傳獲准的測試環境匯入 PDF，驗證閱讀、重整恢復、逐頁擷取與實際語音引用。
4. 通過上述驗收後才能稱為完工。

## 原位替換修正（開創者指示）

本輪取消獨立人物小框，將原生影片以人物輪廓遮罩直接合成於原圖女主角位置；移除邊框、陰影、影片房間背景及人物框內按鈕。使用原導讀區右側麥克風。
遮罩是固定輪廓，尚未逐段驗證所有大動作邊緣；不能宣稱為逐影格精密去背。
提交 main: 8ac3bb79e270f38c8d13a94f70d29b336c733526。
新版原位合成初測：idle readyState=4、paused=false；border=0、shadow=none。初測發現 iframe 白底，已加外層同座標輪廓遮罩，待部署複驗。
