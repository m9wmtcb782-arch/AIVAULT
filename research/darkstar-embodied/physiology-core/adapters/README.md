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
| ENGINE-17～22／`sensory-physio-stack.js` | **已接適配（雙寫）** | `sensory-stack-adapter.js`；stack v0.2 |
| Sensory Nerve Bus | **痛覺／傷害 virtual 事件** | 經 sensory adapter → 危險記憶／保護 |
| ENGINE-15／16／03 | 經 coupling 間接讀 core | 進行中 |
| ENGINE-02／05／08／12／11 | 待研發 | — |

## 正式 Adapter：neuro-stack-adapter.js

路徑：`physiology-core/adapters/neuro-stack-adapter.js`

職責：sleep／alcohol／illness／pain → core；effectors／gates 自 core 讀回。

## 正式 Adapter：sensory-stack-adapter.js

路徑：`physiology-core/adapters/sensory-stack-adapter.js`

職責：

1. `mapSensationToNerveEvents` — ENGINE-17 → `sensory-nerve-bus`（`source: virtual`）  
2. `syncSensoryIntoCore` — nociception／thermal／pressure／injuryLoad／illness → core  
3. `dualWriteAfterStimulus` — 雙寫＋危險記憶（`notExpressionOnly`）  
4. 保護路徑：反射先於決策 **且** nerve-bus nociception **且** danger memory（非只表情）  
5. **不刪** `pending_research`；**不**解鎖實體技能

```js
import { createSensoryPhysioStack } from '../../shared/sensory-physio-stack.js';

const stack = createSensoryPhysioStack({ timeScale: 50 });
// stack.sourceOfTruth === 'physiology-core'
const out = stack.processStimulus({ region: 'hand_R', type: 'temperature', temperatureC: 80, intensity: 1 });
// out.nerveEvents / out.danger / out.coreSensory
```

## 建議後續遷移

| 引擎 | 下一步 |
|------|--------|
| ENGINE-02／05 | canPerform 叠加 core `injuryLoad`／gates |
| ENGINE-12 | touchPressure → core |
| ENGINE-08 | 讀 snapshot＋consent |
| 硬體 driver | 維持 skill-gate locked直至校準＋授權 |

## 禁止

- 為「好做動畫」刪除情緒／週期／親密等槽位  
- 以固定日期寫死週期→固定情緒  
- 以 MP4／隨機表情冒充 core 驅動或冒充保護系統  
- 虛報生物器官或主觀意識  
- 維護第二套與 core 矛盾的最終狀態真相  
- 未經校準／實測／授權啟用實體技能  

## 測試

```bash
node research/darkstar-embodied/physiology-core/test-physiology-core.mjs
node research/darkstar-embodied/phase1/neuro-state-lab/test-neuro-state.mjs
node research/darkstar-embodied/phase1/neuro-state-lab/test-realtime-coupling.mjs
node research/darkstar-embodied/physiology-core/test-core-coupling-sync.mjs
node research/darkstar-embodied/phase1/sensory-physio-lab/test-sensory-physio.mjs
node research/darkstar-embodied/physiology-core/test-core-sensory-sync.mjs
node research/darkstar-embodied/embodiment-interfaces/test-embodiment-interfaces.mjs
```
