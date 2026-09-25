給 GPT：立即恢復暗星頂欄「即時語音／即時視訊／聲音選擇」。不要再刪。

警告

禁止再刪除、隱藏、停用、改 href 為空、或用 hideLiveJump / display:none 處理這些入口：

- #darkStarLiveButton（即時語音）
- #darkStarLiveVideoButton（即時視訊）
- #darkStarSoundButton（聲音）
- #darkStarVoiceSelect（聲音選擇）
- #darkStarLiveControls
- #darkStarFavoriteVideo

這些不是測試殘件。是正式頁功能。
修麥克風時只准動輸入框旁 #micButton 與 live-voice WebSocket。
不准順便清頂欄。

現況

technical-dark-star.html @ 78f64626 仍載入：
technical-dark-star-realtime-voice-v2.js?v=4

v2 本來就會動態插入上述按鈕。
若畫面上沒有，代表被刪或被藏，不是「本來就沒有」。

請 GPT 立刻做

1. 搜尋並刪掉任何 hideLiveJump、對上述 id 的 display:none、remove()、href 清空。
2. 確認頁尾仍有：
   <script src="technical-dark-star-realtime-voice-v2.js?v=4"></script>
3. 若頂欄仍沒有三個入口，在 .topbar 的「回工作中心」前方插入下面 HTML（不要重寫整頁）：

<div id="darkStarLiveControls" class="dark-star-live-controls" style="display:flex;align-items:center;gap:4px;margin-left:auto">
  <a id="darkStarLiveVideoButton" class="dark-star-live-button" href="technical-dark-star-live-video-test.html?mode=video&v=3">即時視訊</a>
  <button id="darkStarLiveButton" type="button" class="dark-star-live-button">即時語音</button>
  <button id="darkStarSoundButton" type="button" class="dark-star-sound-button">聲音</button>
  <select id="darkStarVoiceSelect" class="dark-star-voice-select">
    <option value="Kore">Kore｜沉穩、專業、溫柔</option>
    <option value="Puck">Puck｜活漿、俗皮、親切</option>
    <option value="Charon">Charon｜低沉、穩重、權威</option>
    <option value="Leda">Leda｜溫柔、細黃、知性</option>
    <option value="Aoede">Aoede｜明亮、優雅、自然</option>
    <option value="Fenrir">Fenrir｜低沉、強烈、果斷</option>
  </select>
</div>

4. 即時語音按鈕連：
   technical-dark-star-live-video-test.html?mode=voice&v=3
5. 聲音選擇變更時寫入 localStorage darkStarVoice，供 live-voice ?voice= 使用。
6. 不要改輸入框旁麥克風。
7. 不要改 ai-gateway、live-voice Function、資料庫。
8. 不要重寫整頁。

完成後回報頂欄是否看得到三個入口。不得寫 PASS。
