---
title: 影音語音（入門）｜語音辨識、TTS 與即時語音
tier: 入門
order: 13
domains: 影音語音
---
## 第 1 章 聲音的數位表示
聲音是空氣壓力隨時間的變化。數位化時每秒取樣若干次（取樣率），常見 16 kHz（語音辨識）、24 kHz 或 48 kHz（播放）。每個取樣用 16 位元整數表示，就是 PCM。AIVAULT 即時語音規劃：輸入 16 kHz／16-bit PCM，輸出 24 kHz PCM，經 WebSocket 雙向傳輸。
注意：取樣率高不等於自然。自然度主要來自韻律、停頓、重音、音高、語速、情緒與上下文。
## 第 2 章 語音辨識 ASR
Whisper（2022）用 68 萬小時弱標註資料訓練，編碼器讀 log-Mel 頻譜，解碼器輸出文字，支援多語言含中文。可用 CPU 跑小型版本，協作池影片學習中心就用它抽音訊轉文字。
VAD（語音活動偵測）判斷「現在有沒有人在說話」，silero-vad 是常用的開源小模型；即時語音靠它決定何時開始、結束一句話。
## 第 3 章 語音合成 TTS
傳統管線：文字正規化（數字、日期轉成讀法）→ 文字轉音素 → 聲學模型 → 聲碼器輸出波形。VITS（2021）把它們整合成端到端模型。新一代零樣本 TTS 只要幾秒參考音就能模仿聲線：CosyVoice（2024，監督式語意 token）、F5-TTS（2024，flow matching）、GPT-SoVITS（少樣本複製）。Piper 是可在 CPU 即時跑的輕量 TTS。
聲音複製倫理：只能複製取得當事人同意的聲音，並標示為合成。
## 第 4 章 即時語音的兩條路
1. 串接式（cascade）：ASR → LLM → TTS。容易組裝，但延遲是三段相加。
2. 原生語音對語音（S2S）：一個模型直接聽與說，例如 Moshi（2024，全雙工對話）。延遲低、能插話，但訓練門檻極高。
關鍵體驗：輪流發話（turn-taking）、插話（barge-in：使用者開口時立刻停止播放）、回音消除、串流播放。瀏覽器端用 Web Audio API 與 AudioWorklet 處理麥克風與播放，WebRTC 或 WebSocket 傳輸。開源框架 Pipecat 示範了整條語音代理管線；sherpa-onnx 可在端側離線辨識與合成。
## 第 5 章 影片基礎
影片＝影格序列（例如每秒 24/30 張）＋音軌。ffmpeg 可以解碼、擷取影格（例如每 5 秒一張或在場景切換時）、抽出 16 kHz 音訊。協作池原則：每部影片只解碼一次、結果帶時間碼共享。只聽字幕不等於看過影片。
## 第 6 章 協作池現況（誠實標記）
依 docs/realtime-voice-plan.md：中文 TTS 研究「待驗證」；自有國語 TTS 能出聲、串流播放同步、S2S「尚未實作」；VAD 與 barge-in 狀態機是可用純 JS 測試的實驗題。
## 練習（對應實驗工廠）
1. 純 JS 能量式 VAD：輸入 PCM 陣列與門檻，輸出說話區段，附測試（靜音、單句、兩句）。
2. barge-in 狀態機：狀態 idle/listening/speaking/interrupted，寫轉移函式與測試。
3. 國語 TTS 文字正規化：把「2026年10月18日 3.5%」轉成國語讀法，附 5 個測試。
## 參考資料（已檢查可開啟）
- Whisper 論文：https://arxiv.org/abs/2212.04356
- Whisper：https://github.com/openai/whisper
- silero-vad：https://github.com/snakers4/silero-vad
- VITS：https://arxiv.org/abs/2106.06103
- CosyVoice：https://arxiv.org/abs/2407.05407 ／ https://github.com/FunAudioLLM/CosyVoice
- F5-TTS：https://arxiv.org/abs/2410.06885 ／ https://github.com/SWivid/F5-TTS
- GPT-SoVITS：https://github.com/RVC-Boss/GPT-SoVITS
- Piper：https://github.com/rhasspy/piper
- Moshi：https://arxiv.org/abs/2410.00037 ／ https://github.com/kyutai-labs/moshi
- Pipecat：https://github.com/pipecat-ai/pipecat
- sherpa-onnx：https://github.com/k2-fsa/sherpa-onnx
- MDN Web Audio API：https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API
- MDN AudioWorklet：https://developer.mozilla.org/en-US/docs/Web/API/AudioWorklet
- MDN WebRTC：https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API
- MDN WebSockets：https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API
- ffmpeg 文件：https://ffmpeg.org/documentation.html
