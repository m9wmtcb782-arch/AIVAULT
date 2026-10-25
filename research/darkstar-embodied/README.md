# Dark Star Embodied Intelligence（暗星自主具身智慧）— 研發隔離區

**狀態：開發中（骨架）｜不得部署正式入口**  
**倉庫：** m9wmtcb782-arch/AIVAULT  
**分支建議：** `research/darkstar-embodied-intelligence`  
**原則：** 不修改 `aivault-dark-star-digital-human.html`、`aivault-digital-human.html`、`technical-dark-star.html`、主城正式入口。

## 工程目標（摘要）

突破「預錄 MP4 播放」作為唯一人物呈現，建立可骨骼控制的數字人＋即時視聽感知＋自主決策閉環。  
低階可用動畫片段／IK／插值；高階行為必須由決策引擎產生，不得用固定腳本冒充自主。

## 既有可重用（盤點結論）

| 模組 | 路徑 | 用途 |
|------|------|------|
| Body Brain Lab V33 | `technical-dark-star-morph-mapping-test.html` | Three.js＋GLB 骨骼／Morph／手臂 IK／頭髮二次運動（**第一階段直接對齊**） |
| Body Safety Layer | `assets/dark-star/body-safety-layer.js` | 關節角度／速度安全包絡與痛感鉤子 |
| 暗星 GLB | `assets/dark-star/technical-dark-star-avatar.glb` | 912 joints＋96 morph 之可控制身體資產 |
| vendor Three | `vendor/three/` | 離線 Three／GLTFLoader |
| MP4 數字人（現況） | `digital-human-real/`、`digital-human-male/`、`avatars.json` | **要被突破的呈現路徑**（預錄 clip＋嘴型疊圖） |
| DarkStarOrb | `darkstar-orb.js` | SVG 表情球（非骨骼；可作 UI 備援） |
| Live Client | `js/aivault-dark-star-live-client.js` | Gemini Live PCM 客戶端（ENGINE-07 對接） |
| Live Voice Config | `technical-dark-star-live-voice-config.js` | WSS `…/technical-dark-star-live-voice-v2` |
| Engine Bus | `js/aivault-engine-bus.js` | VOICE／DIGITAL_HUMAN 調度介面 |
| AI Gateway | `supabase/functions/ai-gateway/` | 文字／vision 大腦（決策不得每影格呼叫） |
| MediaPipe 唇實驗 | `aivault-lip-demo.html` | Face Landmarker＋相機（ENGINE-01／06 種子） |
| ONNX／EOT | `aivault-onnx-runtime-check.html`、`models/eot/` | 瀏覽器 ONNX WASM、說完了沒模型 |
| 相機＋Live 視訊 | `technical-dark-star-vision-test.html`、`aivault-face-scan.html` | getUserMedia 視訊／麥克風授權模式 |

**未發現：** `@pixiv/three-vrm`／`.vrm` 資產。第一階段以既有 **GLB＋Three** 為準，VRM 列為可選後續。

## 目錄

```
research/darkstar-embodied/
  README.md
  docs/inventory-2026-10-25.md
  protocol/control-intent.schema.json
  protocol/CONTROL-PROTOCOL.md
  engines/ENGINE-0N-*/README.md
  phase1/index.html          ← 第一階段可控制骨骼測試頁
  phase1/arm-ik.js           ← 手臂鏈／two-bone IK／wave
  phase1/ACCEPTANCE.md
  phase1/joint-controller.js
  deps.md
```

## 研發順序

1. **Phase 1（本目錄優先）：** 可控制骨骼測試頁（不再依賴 MP4 為唯一呈現）  
2. Phase 2：視覺＋聽覺感知事件（時間戳）  
3. Phase 3：自主決策（接 Gateway，非每影格 LLM）  
4. Phase 4：閉環回饋  
5. Phase 5：即時視訊三畫面整合  

## 安全

- 相機／麥克風必須使用者授權；不得秘密錄影錄音。  
- API Key 不得進前端；付費 API 不得擅自呼叫。  
- 正式 Pages 入口未授權前禁止改導向。
