# ENGINE-12｜全身軟組織物理模擬（Soft Tissue）

**狀態：開發中**｜Shared Body Core **soft-tissue 層**  
**版本：** `SOFT_TISSUE_SIM_VERSION`  
**原則：** 虛擬世界渲染與 ENGINE-11 合成讀**同一套** `getDeformationState()`；禁止另建第二套形變腦。

## 本輪交付

| 項目 | 狀態 |
|------|------|
| 多區域獨立參數（臉頰／胸／腹／臀） | ✅ `region-params.js` |
| 碰撞＋局部 sample 場＋彈簧阻尼回彈 | ✅ `soft-tissue-sim.js` |
| 可控制虛擬肩膀碰撞體 | ✅ `shoulder-collider.js` |
| 攝影機肩膀追蹤 | stub `camera-shoulder-stub.js` |
| 測試頁 | `demo/index.html` |
| 自動化角度／面積／時長差異測試 | `test-soft-tissue.mjs` |

## 禁止

- 整塊 `mesh.scale` 冒充軟組織形變  
- 單一固定 morph／MP4 覆蓋所有接觸  
- 掛到正式暗星頁  

## 參數（摘要）

每區獨立：`volume`、`elasticity`、`damping`、`gravityBias`、`maxPenetration`、`contactAreaGain`、`recoveryRate`、`lateralCoupling`、`restCenter`、`halfExtents`。  
詳見 `region-params.js` 與 `docs/PARAMETERS.md`。

## 本地預覽

```bash
python3 -m http.server 8765 --bind 127.0.0.1
# http://127.0.0.1:8765/research/darkstar-embodied/engines/ENGINE-12-soft-tissue/demo/index.html
```

```bash
node research/darkstar-embodied/engines/ENGINE-12-soft-tissue/test-soft-tissue.mjs
```

## 技術限制（標明）

- 非完整 FEM／體積網格；為即時可跑的 **局部變形場近似**  
- 區域為橢球代理，尚未蒙皮到正式 GLB 頂點  
- 衣物碰撞僅預留；尚未做布料  
- 單相機肩膀追蹤未實作（stub）  
- 性能視區域數／sample 密度；demo 顯示真實 step ms／FPS  

## 架構位置

```
Shared Body Core
  ENGINE-02 / 03 / 08
  ENGINE-12 soft-tissue  ← getDeformationState()
       │
       ├── Virtual World Renderer
       └── ENGINE-11 Real-world Compositor
```
