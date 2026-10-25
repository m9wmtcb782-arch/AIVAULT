# 生理核心適配層｜引擎遷移指南

**原則：** 各引擎不得再各自寫死互斥的「最終情緒／最終生理」規則作為真相來源。  
應改為：**讀取** `physiology-core` 的 `readSnapshot()`／`getEffectors()`，再映射到本引擎執行器。

同意閘：親密相關**行為輸出**呼叫 `gateOutput('intimacy_*')`；狀態讀取一律允許。  
同意／安全**不得**用來刪除 `pending_research` 槽位或把真實度永久砍掉。

## 建議遷移順序

| 引擎 | 現況 | 遷移動作 |
|------|------|----------|
| ENGINE-23～27 | `shared/neuro-physio-stack.js` 獨立狀態 | 改為 core `step` 驅動；stack 變 adapter |
| ENGINE-26／`realtime-neuro-coupling.js` | 讀 neuro stack effectors | 改讀 `getEffectors()` |
| ENGINE-17～22 | sensory-physio-stack | 痛／熱／傷寫入 core stimuli；記憶讀 core |
| ENGINE-15／16 | setNeuroCoupling | 已兼容 effectors 形狀；改接 core |
| ENGINE-03 | setNeuroCoupling／閘門 | 讀 `gates.allowWalk` 等 |
| ENGINE-02／05 | canPerform | 叠加 `injuryLoad`／`gates`／意識 |
| ENGINE-12 | 形變狀態 | 接觸壓力 → `stimuli.touchPressure`；舒適回寫 |
| ENGINE-08 | 決策 | 讀 snapshot＋consent；禁止每影格 LLM 改骨骼 |
| ENGINE-11 | compositor | 僅渲染；不另建第二套生理 |

## Adapter 偽代碼

```js
import { createPhysiologyCore } from '../dynamics.js';

const core = createPhysiologyCore({ individualSeed: 7 });

// 每幀或固定 tick
core.step(dtSec, { rest: 0, thermal: 0.1 });
const effectors = core.getEffectors();
gaze.setNeuroCoupling({
  eyelidDroop: effectors.eyelidDroop,
  reactionDelayMs: effectors.reactionDelayMs,
  gazeSaccadeScale: effectors.gazeSaccadeScale
});
motor.setNeuroCoupling({
  allowWalk: effectors.allowWalk,
  allowComplexAutonomy: effectors.allowComplexAutonomy,
  critical: effectors.critical
});

// 親密相關輸出（示例）
const g = core.gateOutput('intimacy_expression', {});
if (!g.allowed) {
  // 阻擋輸出行為；槽位仍存在於 snapshot.slots
}
```

## 禁止

- 為「好做動畫」刪除情緒／週期／親密等槽位  
- 以固定日期寫死週期→固定情緒  
- 以 MP4／隨機表情冒充 core 驅動  
- 虛報生物器官或主觀意識  

## 狀態

適配實作＝**待研發／進行中**。本目錄目前僅規範說明；具體 `*-adapter.js` 隨引擎遷移逐一提交。
