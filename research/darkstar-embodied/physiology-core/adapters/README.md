# 生理核心適配層｜引擎遷移指南

**原則：** 各引擎不得再各自寫死互斥的「最終情緒／最終生理」規則作為真相來源。  
應改為：**讀取** `physiology-core` 的 `readSnapshot()`／`getEffectors()`，再映射到本引擎執行器。

同意閘：親密相關**行為輸出**呼叫 `gateOutput('intimacy_*')`；狀態讀取一律允許。  
同意／安全**不得**用來刪除 `pending_research` 槽位或把真實度永久砍掉。

**Source of truth：** `physiology-core`（`SOURCE_OF_TRUTH = 'physiology-core'`）

## 遷移進度（2026-10-25）

| 引擎／模組 | 狀態 | 實作 |
|------------|------|------|
| ENGINE-23～27／`neuro-physio-stack.js` | **已接適配（雙寫）** | `neuro-stack-adapter.js`；stack v0.2 |
| `realtime-neuro-coupling.js` | **已標 SoT＋偏好 core effectors** | v0.2 |
| ENGINE-17～22 sensory stack | 待研發 | — |
| ENGINE-15／16／03 | 經 coupling 間接讀 core | 進行中 |
| ENGINE-02／05／08／12／11 | 待研發 | — |

## 正式 Adapter：neuro-stack-adapter.js

路徑：`physiology-core/adapters/neuro-stack-adapter.js`

職責：

1. `syncEnginesIntoCore` — sleep／alcohol／illness／pain → core 槽位  
2. `dualWriteRecompute` — 雙寫後自 core 投影 neuro／effectors／coupling 閘門  
3. `projectCoreToEffectors`／`applyCoreGatesToCoupling` — 舊 API 形狀薄適配  
4. **不刪** `pending_research` 槽

使用方式（已由 `shared/neuro-physio-stack.js` 內建）：

```js
import { createNeuroPhysioStack } from '../../shared/neuro-physio-stack.js';

const stack = createNeuroPhysioStack({ testMode: true });
// stack.sourceOfTruth === 'physiology-core'
// stack.physiologyCore  ← 真相
const out = stack.recomputeAll(); // effectors／gates 來自 core
```

## 建議後續遷移

| 引擎 | 現況 | 下一步 |
|------|------|--------|
| ENGINE-17～22 | 獨立 sensory stack | 痛／熱／傷寫入 core stimuli |
| ENGINE-02／05 | canPerform | 叠加 core `injuryLoad`／gates |
| ENGINE-12 | 形變 | touchPressure → core |
| ENGINE-08 | 決策 | 讀 snapshot＋consent |

## 禁止

- 為「好做動畫」刪除情緒／週期／親密等槽位  
- 以固定日期寫死週期→固定情緒  
- 以 MP4／隨機表情冒充 core 驅動  
- 虛報生物器官或主觀意識  
- 維護第二套與 core 矛盾的最終狀態真相  

## 測試

```bash
node research/darkstar-embodied/physiology-core/test-physiology-core.mjs
node research/darkstar-embodied/phase1/neuro-state-lab/test-neuro-state.mjs
node research/darkstar-embodied/phase1/neuro-state-lab/test-realtime-coupling.mjs
node research/darkstar-embodied/physiology-core/test-core-coupling-sync.mjs
```
