---
title: 影音語音（專業）｜中文 TTS、聲音複製與即時語音工程
tier: 專業
order: 23
domains: 影音語音
---
## 第 1 章 零樣本中文 TTS 架構比較
- CosyVoice：把語音轉成「監督式語意 token」，LLM 從文字生成語意 token，再用 flow matching 轉成梅爾頻譜，最後聲碼器出聲。支援中文與跨語言零樣本複製。
- F5-TTS：非自回歸、flow matching＋DiT，文字以填充方式對齊，不需要音素對齊器，推論步數可調。
- GPT-SoVITS：少量（約 1 分鐘）語料微調即可複製聲線，社群使用廣泛。
- VITS：端到端 VAE＋對抗訓練，是許多輕量 TTS（含 Piper）的基礎。
## 第 2 章 自然度的工程要素
文字正規化（數字、單位、日期、英文縮寫）→ 斷詞與多音字（行 háng/xíng）→ 韻律邊界與停頓預測 → 重音與語調 → 情緒與語速。有聲書自然的關鍵是「語意段落」決定停頓，不是逗號一律停同樣長。評估：MOS 人工評分、字錯誤率（用 ASR 回辨）、說話人相似度。
## 第 3 章 即時語音延遲預算
使用者說完 → 端點偵測（VAD 靜音 300–700 ms）→ ASR 最終結果 → LLM 首 token → TTS 首個音訊封包 → 播放。目標總延遲越低越好，每段都要量測並記錄。技巧：串流 ASR、LLM 串流輸出、TTS 分塊合成、首句先播。
插話（barge-in）：播放中偵測到使用者語音 → 立即停止播放、清空佇列、取消進行中的生成。回音消除（瀏覽器 getUserMedia 的 echoCancellation）避免把自己的聲音當成使用者說話。
## 第 4 章 原生語音對語音
Moshi 同時建模使用者與系統兩條音訊流（全雙工），可邊聽邊說，延遲很低。訓練需要大量語音與 GPU；協作池階段 4（S2S）尚未實作。
## 第 5 章 AIVAULT 語音路線圖（docs/realtime-voice-plan.md）
階段 1 自有國語 TTS → 2 串流、播放、VAD、barge-in → 3 自然度 → 4 原生 S2S → 5 整合暗星／曙光 → 6 分散式 GPU 推論。原則：只用合法開源模型；外部商業 API 不包裝成自研；介面完成≠模型完成；單 GPU≠跨裝置。不得修改暗星、曙光現有即時語音視訊功能。
## 第 6 章 聲音複製倫理
只複製有書面同意的聲音；產出標示為合成語音；不得冒充真人進行對外通話或發布。
## 練習（對應實驗工廠）
1. 停頓／韻律規劃器：輸入中文段落，依標點與語意長度輸出停頓毫秒數，附測試。
2. 多音字字典查表器：處理「行、長、重、樂」在 10 個詞中的讀音，附測試。
3. 延遲量測器：給一串事件時間戳（vad_end, asr_final, llm_first, tts_first, play_start），算各段延遲並找出最慢一段。
## 參考資料（已檢查可開啟）
- CosyVoice：https://arxiv.org/abs/2407.05407 ／ https://github.com/FunAudioLLM/CosyVoice
- F5-TTS：https://arxiv.org/abs/2410.06885 ／ https://github.com/SWivid/F5-TTS
- GPT-SoVITS：https://github.com/RVC-Boss/GPT-SoVITS
- VITS：https://arxiv.org/abs/2106.06103
- Piper：https://github.com/rhasspy/piper
- Moshi：https://arxiv.org/abs/2410.00037
- Whisper：https://arxiv.org/abs/2212.04356
- silero-vad：https://github.com/snakers4/silero-vad
- Pipecat：https://github.com/pipecat-ai/pipecat
- Web Audio API 規範：https://webaudio.github.io/web-audio-api/
- WebSocket 協定 RFC 6455：https://www.ietf.org/rfc/rfc6455.txt
