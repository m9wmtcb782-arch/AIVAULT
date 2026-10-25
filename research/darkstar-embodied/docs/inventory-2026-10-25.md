# 盤點紀錄｜2026-10-25（Asia/Taipei）

執行者：Grok Bot 盤點子代理  
範圍：只讀 AIVAULT＋homework-helper；第三基地 my-ai 僅確認無 push。

## 倉庫權限

| 基地 | Repo | 本機帳號 | push |
|------|------|----------|------|
| 第一 | m9wmtcb782-arch/AIVAULT | m9wmtcb782-arch | 是（admin） |
| 第二 | NL13741619-commits/homework-helper | 同上可讀；第二基地有 push 歷史 | 是 |
| 第三 | vkzvyzvh94-byte/my-ai | 僅 pull | **否**（登入擁有者未完成） |

## 現況瓶頸（施工令要突破）

正式數字人呈現鏈：

1. `aivault-digital-human.html` 讀 `digital-human-real/avatars.json`
2. 依 `clips.*.src` 播放 **預錄 MP4**（idle／talk／wave-intro／情緒 fillers…）
3. 嘴型：`lip/` 靜態圖疊加於影片座標（女 480×432；男 dawn-male 720×960）
4. 即時語音：Gemini Live → PCM → 能量／viseme 驅動嘴型，**身體仍是 clip 切換**

結論：高階「自主身體控制」尚不存在於正式頁；Body Brain Lab 已有骨骼原型但未接正式入口。

## avatars.json 角色

- `darkstar`：女／Aoede／`digital-human-real/video/`
- `dawn-male`、`darkstar-male`：男／Charon／`digital-human-male/video/`（35 clips）

## Gateway／語音端點

- AI Gateway：`https://clcddygkaaqqtsbswgdf.supabase.co/functions/v1/ai-gateway`（v3.1.x）
- Live Voice v2：`wss://…/technical-dark-star-live-voice-v2`
- Digital Human Session：`supabase/functions/aivault-digital-human-session`（body-only 聲明）
- 第二基地曙光：禁止依賴 Gemini Live；走 `dawn-own-voice.js`／`dawn-neural-tts.js`（GPU 常 BLOCKED）

## MediaPipe／ONNX／攝影機

- **有：** `aivault-lip-demo.html`（MediaPipe Face Landmarker）、ONNX EOT、多處 `getUserMedia` video
- **無：** 完整 Pose／Hands 生產引擎；無 VRM

## 第三基地

公開頁面殼（chat／home／world…），本輪不寫入。
