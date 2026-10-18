# Gemini 即時語音技術分析與 AIVAULT 自研語音模型規劃（使用者 2026-10-18 08:14 提供）
Summary of user's plan (keep verbatim intent):
- Study Gemini Live components: native audio, audio encoder, multimodal transformer, streaming audio decoder, VAD, affective dialogue, proactive audio, barge-in, function calling, session context. Mark which are public product capabilities vs abstract architecture guesses.
- Transport: in 16kHz/16-bit PCM, out 24kHz PCM, WebSocket bidirectional, JPEG frames ~1fps. Sample rate != naturalness; prosody/pauses/stress/pitch/rate/emotion/context matter.
- Cascade (ASR→LLM→TTS) vs native speech-to-speech.
- Naturalness keys: prosody, emotion, streaming, turn-taking, barge-in, context consistency, voice identity consistency.
- Two paths: A) 暗星 native realtime voice (continuous listening, barge-in, context, emotion, stable voice, reconnect, playback sync, 暗星/曙光 speaker routing). B) Ebook narration (semantic parsing, prosody/pause planning, Mandarin TTS, multi voices, speed, text highlight sync, position memory, no repeat, no interruption).
- GPU pool research: model partitioning, heterogeneous GPU inference, tensor transfer, distributed memory, low-latency scheduling, node dropout, state recovery, phone+GPU coop. Never claim cross-phone single-model inference until verified.
- Phases: 1 own Mandarin TTS working; 2 streaming/playback/VAD/barge-in; 3 naturalness; 4 native S2S; 5 integrate 暗星 core/曙光/multimodal; 6 distributed GPU pool inference.
- Principles: open-source legal models; never pass off external commercial API as ours; UI≠model done; code≠deployed; single GPU≠cross-device; no Grok/Kling or paid API/tests without authorization; verifiable first; label each item 已完成/已驗證/待驗證/尚未實作; don't modify existing 暗星/曙光/ebook/compute-pool features.

---
## 狀態（2026-10-18 台北）
> 這份是**研究規劃**，目前**沒有任何一項已實作成功能**。協作池 AI 依「長期命令 #2」按階段研究；成果只算學習紀錄與實驗工廠的小作品，不代表產品功能完成。

標籤：已完成／已驗證／待驗證／尚未實作

| 階段 | 項目 | 狀態 | 說明 |
|---|---|---|---|
| 1 | 中文 TTS 研究（CosyVoice、GPT-SoVITS、F5-TTS、Fish Speech、MaskGCT、Spark-TTS） | 待驗證 | 已排進影音區學習課程（vc1、長期命令 #1／#2），學習紀錄是真的，還沒驗證能做出模型 |
| 1 | 國語 TTS 文字正規化（實驗工廠小作品） | 尚未實作 | 已加入實驗工廠題目；做出且自動測試通過才改「已驗證」 |
| 1 | 停頓／韻律規劃器（實驗工廠小作品） | 尚未實作 | 同上 |
| 1 | 自有國語 TTS 能出聲 | 尚未實作 | 需要開源模型＋可用 GPU；尚未開始 |
| 2 | 瀏覽器 VAD（能量／免費函式庫） | 尚未實作 | 已加入實驗工廠題目（純 JS 可測） |
| 2 | barge-in 插話狀態機 | 尚未實作 | 已加入實驗工廠題目（純 JS 可測） |
| 2 | 串流播放同步 | 尚未實作 | |
| 3 | 自然度（韻律、情緒、一致聲線） | 尚未實作 | |
| 4 | 原生語音對語音（S2S） | 尚未實作 | |
| 5 | 整合 暗星核心／曙光／多模態 | 尚未實作 | 不得改動既有 暗星／曙光／電子書／算力池功能 |
| 6 | 分散式 GPU 池推論 | 尚未實作 | 未驗證前不宣稱跨手機單模型推論 |

原則：只用合法開源模型；不把外部商業 API 包裝成自研；介面≠模型完成、程式≠已部署、單 GPU≠跨裝置；未經授權不用 Grok／Kling 或任何付費 API。
