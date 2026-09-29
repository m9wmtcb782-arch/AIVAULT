# AIVAULT｜暗星即時語音＋數字人施工單

日期：2026-09-29  
倉庫：m9wmtcb782-arch/AIVAULT  
原則：數字人不是第二個 AI。唯一大腦是 Technical Dark Star。

## J. 大腦聲明

數字人模組 `aivault-dark-star-digital-human.html` **使用 Technical Dark Star 作為唯一大腦**。

路徑：

使用者麥克風 16 kHz PCM  
→ `wss://clcddygkaaqqtsbswgdf.supabase.co/functions/v1/technical-dark-star-live-voice`  
→ Technical Dark Star（既有人格／記憶／推理／工具，Gemini 只當模型引擎）  
→ 24 kHz PCM + input/output transcription + turnComplete + interrupted  
→ 前端播放 + 數字人嘴型／表情

沒有 Digital Human AI、Avatar Chatbot、Gemini Avatar Assistant。

## A. 修改的檔案

- `aivault-home-original-dark.html`  
  新增「暗星即時語音＋數字人」入口卡片與 click handler。未改 Video Studio 原頁內容。

## B. 新增的檔案

- `aivault-dark-star-digital-human.html`
- `js/aivault-dark-star-live-client.js`
- `js/aivault-dark-star-avatar.js`
- `js/aivault-engine-bus.js`
- `supabase/functions/aivault-digital-human-session/index.ts`
- `DARK_STAR_VOICE_DIGITAL_HUMAN.md`

未修改：`technical-dark-star.html`

## C. Supabase Function

| Function | 動作 |
|---|---|
| `technical-dark-star-live-voice` | 未改原始碼（本倉庫本來就沒有這支 function 原始碼）。前端繼續當即時語音核心。HTTP 探測存在。 |
| `technical-dark-star-voice-session` | 未改。探測存在（405 on GET，符合只收 POST）。 |
| `aivault-tts` / `ai-human-voice` / `fish-tts` | 未當 realtime voice 使用。 |
| `aivault-digital-human-session` | **新增原始碼**，尚未由本施工者部署。 |

後端部署（交給有 Supabase 權限的工程／GPT）：

```
supabase functions deploy aivault-digital-human-session --project-ref clcddygkaaqqtsbswgdf
```

不要把任何 API Key 寫進 HTML / JS。

## D. CONFIRMED

- 本倉庫存在既有即時語音客戶端協議（`technical-dark-star-live-session.js`），新模組沿用同一 WSS 與 JSON 音訊格式。
- `technical-dark-star-live-voice` 邊緣端點 HTTP 可達（200）。
- `technical-dark-star.html` 未被改寫。
- 新前端沒有第二大腦、沒有預錄回答、沒有假 TTS 流程。
- MUSIC / 3D / VIDEO 只留接口，程式回 `ENGINE_RESERVED`，不呼叫生成服務。
- JS 語法通過 node `--check`。
- 前端不內嵌 vendor secret。

## E. NOT VERIFIED

- 瀏覽器實機麥克風 → 暗星 → 數字人嘴型（本施工環境無使用者麥克風／登入 session）。
- `aivault-digital-human-session` 是否已在 Supabase ACTIVE。
- live-voice 對未登入 visitor 的完整 Gemini Live 授權結果。
- 商業級 photoreal 數字人（HeyGen / D-ID 等）口型。現況是 canvas viseme body。

## F. REQUIRES TEST

1. 開測試 URL，允許麥克風。
2. 按「開始即時語音」，應出現 WS OPEN / live_open。
3. 說話不必等完整字幕，暗星應開始回 24 kHz PCM，數字人嘴型跟著能量張合。
4. 暗星說話時再說話，播放與嘴型應立刻停，連線保持。
5. 多輪對話、中英混合。
6. 與 `technical-dark-star.html` 原即時語音互不破壞。

## I. 測試 URL

GitHub Pages（main 部署後）：

https://m9wmtcb782-arch.github.io/AIVAULT/aivault-dark-star-digital-human.html

既有暗星本體（不得被本單改壞）：

https://m9wmtcb782-arch.github.io/AIVAULT/technical-dark-star.html

既有即時語音頁：

https://m9wmtcb782-arch.github.io/AIVAULT/dark-star-live-voice.html

## 交給後端／GPT 的剩餘工程

1. `supabase functions deploy aivault-digital-human-session`
2. 若要接外部數字人 vendor：只在 Edge Function 讀 `AVATAR_VENDOR_API_KEY`，實作 `mint-avatar-vendor-token`，禁止把 key 下發前端。
3. 不要改 `technical-dark-star.html` 既有身份／記憶／Gateway。
4. 不要把 fish-tts / aivault-tts 當成 realtime voice。
