# Phase 1 驗收｜可控制骨骼數字人測試頁

**頁面：** `research/darkstar-embodied/phase1/index.html`  
**狀態標示：** 開發中（骨架可跑載入＋基本關節／表情指令；非完整自主閉環）

## 必須通過

1. **非 MP4 唯一呈現：** 畫面主體為 GLB 骨骼渲染，不是 `digital-human-real/video/*.mp4`。  
2. **關節控制：** 可對頭部／手臂送出 control_intent（或 UI 按鈕）並看到連續過渡。  
3. **表情：** 至少 blink／smile／mouthOpen 經 morph（對齊 Body Lab 名稱）。  
4. **安全層：** 超出關節限制時被 clamp／block，並在 UI 顯示 safety 狀態。  
5. **回饋：** 每秒或每指令回傳關節摘要 JSON（console 或面板）。  
6. **性能：** 實測記錄 FPS（目標 ≥30；理想 60），不得捏造。  
7. **隔離：** 未改正式暗星／數字人／主城 HTML。

## 尚不要求（標「開發中」）

- 攝影機自主揮手回應（屬 Phase 2–3）  
- 宣稱「神經運動學習已完成」  
- 正式 Pages 掛載

## 對照種子

複製／精簡自 `technical-dark-star-morph-mapping-test.html`＋`assets/dark-star/body-safety-layer.js`，路徑改相對 `../../assets/dark-star/`。
