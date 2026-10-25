# ENGINE-11｜Real-world Scene Compositing Engine（真人視訊混合實境合成）

**狀態：開發中（stub／介面規格｜本輪未實作完整 WebRTC 合成）**  
**工程名：** AIVAULT Virtual Embodied World — 雙模式之一  
**原則：** 不得破壞正式頁；不得宣稱同框／WebRTC 已完成。

## 在架構中的位置

```
Shared Body Core (ENGINE-02 / 03 / 08)
        │
        ├── Virtual World Renderer（虛擬教室）
        └── Real-world Compositor ← 本引擎
```

暗星的身體狀態、技能、決策來自**同一套** Shared Body Core；本引擎只負責把已控制的數字人**合成進真實攝影機畫面**並經 WebRTC 送出。

## 模式對照

| 模式 | 本引擎角色 |
|------|------------|
| 虛擬世界模式 | 不啟用（或僅旁路預覽） |
| 真人視訊混合實境模式 | 主路徑：原影像保留＋數字人入鏡＋串流 |

## 規劃功能（規格清單）

1. **保留原影像** — 真實攝影機與現實背景不替換成虛擬 HDRI 冒充  
2. **分界／深度估計** — 人像分割或深度；標明單相機限制  
3. **地面／座位空間** — 估計可站立／就座平面，供 Shared Core 給出站位  
4. **數字人入鏡** — 使用 ENGINE-03 當前姿勢的渲染結果疊加  
5. **遮擋** — 人／物前後關係（開發中）  
6. **光影比例** — 粗匹配場景亮度（開發中）  
7. **即時串流輸出** — canvas／MediaStream  
8. **WebRTC** — 傳給朋友／三畫面佈局  
9. **雙路／三路顯示** — 使用者真實｜朋友真實｜合成同框  

## 建議介面（尚未實作）

```js
// compositor-api.stub.js 將實作空殼
createRealworldCompositor({
  bodyCore,          // Shared Body Core handle (getBodyState / execute motion)
  localVideo,        // HTMLVideoElement — user camera (授權後)
  remoteVideo,       // optional friend stream
  outputCanvas,      // composite destination
  onFrameStats       // fps / latency hooks — 真實測量，禁止捏造
})

// methods (planned):
// start({ mode: 'mixed-reality' })
// stop()
// setAvatarPoseFromCore()  // pull joints from ENGINE-03
// getCompositeStream()     // MediaStream for WebRTC
// getStatus() → { mode, compositing: false, webrtc: 'not_started', label: '開發中' }
```

## 施工順序位置

排在：第一期身體自我認知 → 第二期自主運動 → 虛擬教室可互動 **之後**的**獨立測試階段**。  
與 ENGINE-06（真人進虛擬）互補：06＝人進虛擬世界；11＝數字人進現實視訊畫面。

## 本輪交付

- [x] 目錄與本 README（規格）  
- [x] `compositor-api.stub.js`（空殼＋明確 開發中）  
- [ ] 分割／深度  
- [ ] 入鏡合成實作  
- [ ] WebRTC 三畫面  

## 禁止

- 用預錄 MP4 冒充即時合成直播  
- 另建一套與 ENGINE-02／03／08 無關的「暗星 AI」  
- 未授權改正式暗星／數字人頁  
