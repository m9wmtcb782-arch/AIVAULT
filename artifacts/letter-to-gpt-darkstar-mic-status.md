給 GPT：暗星正式頁麥克風／記憶目前狀況

目前真實狀況

目前還沒有上線修正。

Grok 這次只修改了 artifacts 裡的前端副本，沒有 commit 回 GitHub Pages，也沒有替換正式線上頁面。

因此不能把這次修正描述成「線上已修好」。

正式 GitHub Pages 目前仍可能使用舊版 technical-dark-star.html；手機實測時，輸入框旁的麥克風目前仍可能沒有作用。

Grok 修改的檔案

artifacts/technical-dark-star-live-ws-patched.html

這份檔案目前只是待部署的前端副本。

請 GPT 執行的事情

請將：

artifacts/technical-dark-star-live-ws-patched.html

覆蓋 repo 正式檔：

technical-dark-star.html

然後 commit / push 到 GitHub Pages，使正式頁真正更新。

這份前端修改的內容

1. 麥克風改走：
    getUserMedia → AudioContext → AnalyserNode 真實波形 → 16 kHz PCM → 現有 live-voice WebSocket
2. WebSocket 帶入：
    * access_token
    * agent_id=technical-dark-star
    * 與文字聊天相同的 topic_id
    * 與文字聊天相同的 conversation_id
3. 即時語音轉寫內容寫入目前對話區與輸入框。
4. 頂欄原本會跳到其他 Live Video 測試頁的入口已隱藏／停用。
5. 沒有修改後台 Function。
6. 沒有更換 Gemini Live model。
7. 沒有修改現有 PCM 格式。
8. 沒有重新設計正式頁 UI。

測試狀態

目前所有測試都必須維持：

NOT VERIFIED

不能把任何尚未在實際手機上完成的測試標成 PASS。

尤其不能因為程式碼看起來正確，就宣稱手機麥克風已修好。

上線後實際測試

部署 GitHub Pages 後，使用 iPhone 實測：

1. 登入 AIVAULT。
2. 硬重新整理正式頁。
3. 只使用輸入框旁的麥克風。
4. 不使用頂欄原本會跳轉的即時語音／即時視訊入口。
5. 確認：
    * 麥克風真的取得權限。
    * 波形會隨實際聲音變化。
    * 有實際 PCM 音訊送出。
    * 暗星收到語音。
    * inputTranscription 能出現在目前對話。
    * 暗星能正常回答。
    * topic_id / conversation_id 沒有被重新建立。
    * 重新連線後仍能延續暗星的正式記憶。

測試結果請如實記錄；沒有實測成功就維持 NOT VERIFIED。

最重要

這一階段不是再改架構，而是：

把已經存在於 artifacts 的前端修正版真正覆蓋到正式 technical-dark-star.html，部署 GitHub Pages，然後用 iPhone 實測。

不要把 artifacts 副本當成已上線版本。
不要標假 PASS。
不要擴大修改範圍。
