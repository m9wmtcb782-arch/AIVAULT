# 給 GPT：暗星「視訊」與 live-voice 現況

請只處理後台／協定。不要改正式 technical-dark-star.html UI，不要重寫前端架構。

## 現況（已用 repo 程式核對，不是猜）

1. 暗星頂欄「視訊」進入：`technical-dark-star-live-video-test.html`，script：`technical-dark-star-live-session.js`

2. 這頁現在連：`wss://clcddygkaaqqtsbswgdf.supabase.co/functions/v1/technical-dark-star-live-voice`
   帶：voice、agent_id=technical-dark-star、topic_id、conversation_id、access_token（有登入才有）。

3. 稍早曾連 `technical-dark-star-live-memory`，實測變慢或沒反應。已改回 live-voice。

4. live-voice 已證實契約：audio PCM 16k、text、收回 PCM／transcription。**沒有**已驗證的 type:video 轉發。

5. 前端若每秒送 `{type:"video", mimeType:"image/jpeg"}`，連線會被關。因此已停止把 JPEG 丟給 live-voice。鏡頭只本機 preview。

6. 「我的聲音」不再走 Gemini Live。路徑：說話／打字 → 正式暗星文字 → Fish 克隆語音。不要改回 Live。

## 請 GPT 做

若要視訊真的給 Gemini 看：

A. 在 technical-dark-star-live-voice（或另開 live-av Function）同一條 WebSocket 收 JPEG base64，type:video。
B. 轉進 Gemini Live realtime input，禁止 HTTP 上傳再等。
C. 收到 video 不得關 WebSocket；audio/text/PCM 不可壞。
D. 不換 model；key 不放前端。
E. 若不收 video，請回 `video_unsupported`，不要默默斷線。

## 不要做

不要改正式暗星 UI、不要刪「我的聲音」、不要又指回 live-memory、不要宣稱 Video 已接通 Gemini。

目前：voice NOT VERIFIED；video 後台未證實支援；記憶 Test A–D NOT VERIFIED。
