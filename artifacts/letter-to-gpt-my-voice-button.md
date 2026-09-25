給 GPT：加「我的聲音」按鈕。不要改 live-voice Function。

只在 technical-dark-star.html 頁尾、現有 v2.js 之後加一行：

<script src="technical-dark-star-my-voice.js"></script>

禁止：
- 不要改 technical-dark-star-live-voice
- 不要刪即時語音／即時視訊／聲音選擇
- 不要改 Gemini model／PCM
- 不要新建 TTS Function（用現有 fish-tts）
- 不要把 Fish API key 放前端

按鈕開啟後：暗星文字回答用電子書同一個 FISH_VOICE_ID 播放。
沒有 Voice id 就提示去電子書存。
NOT VERIFIED
