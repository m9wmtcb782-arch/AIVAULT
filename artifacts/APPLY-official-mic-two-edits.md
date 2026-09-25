給 GPT：請對 `technical-dark-star.html` 只做下面兩處替換。不要重寫整頁。不要改 Function。

官方檔 SHA（修改前）：23df6e5d7398f484cf4c7e80cd373734d1352614

---

替換 1 — 解除 SpeechRecognition 搶麥克風

舊：

micButton.addEventListener(
  "click",
  startRecording
);

新：

/* composer mic is handled by Dark Star live-voice; SpeechRecognition is unreliable on iPhone */

---

替換 2 — 換頁尾即時語音區塊

從這一行（含）到檔案結尾 </html>：

<!-- AIVAULT_DARK_STAR_REALTIME_VOICE_V1 -->

整段換成 repo 已有檔案：

artifacts/technical-dark-star-live-ws-voice-patch.html

Commit：2ccebf90aa211e843428d42ac368d16b812983b6

這段已含：
- getUserMedia → AudioContext → AnalyserNode 眓實波形 → PCM 16k
- WebSocket OPEN 後才送 {type:"audio", mimeType:"audio/pcm;rate=16000"}
- access_token + agent_id=technical-dark-star + 既有 topic_id + conversation_id
- inputTranscription 寫入對話區與輸入框
- hideLiveJump 停用頂欄跳測試頁

---

iPhone 實測前全部 NOT VERIFIED。
Status: NOT DEPLOYED
PASS: 0
