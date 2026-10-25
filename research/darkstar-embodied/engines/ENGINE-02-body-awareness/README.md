# ENGINE-02｜暗星身體自我認知（最高優先・第一期）

**狀態：開發中｜已接 Phase1 控制器介面（非空表）**  
**版本：** `BODY_AWARENESS_VERSION` in `body-awareness.js`

## 能查詢什麼

| API | 內容 |
|-----|------|
| `getBodyState()` | 資產、骨骼摘要、位置／朝向／姿態、關節活動範圍、技能清單、無實體操作旗標、場景物件 |
| `canPerform(action, context)` | `{ can, reason, domain: 'virtual'\|'physical', checks }` |
| `listSkills()` | learned／stub／unlearned |

## 連線真實控制器

```js
import { createJointController } from '../../../phase1/joint-controller.js';
import { createBodyAwareness } from './body-awareness.js';

const controller = createJointController({ avatar, bones, bonesByHint, setMorph, getFps, onSafety });
const body = createBodyAwareness({ controller, avatar, bones, bonesByHint, scene, getFps });
body.getBodyState(); // controller.bound === true
```

Safety 關節包絡來自 `assets/dark-star/body-safety-layer.js`（`JOINT_LIMITS`）。

## 能力邊界（必過）

1. `sit_on_virtual_chair` → 場景有椅子且非已坐下 → `can=true`  
2. `erase_virtual_blackboard` → 需黑板＋板擦＋依賴技能 → `can` 依場景  
3. `erase_real_classroom_blackboard` → **永遠** `can=false`，reason 含無實體身體  

```bash
node research/darkstar-embodied/engines/ENGINE-02-body-awareness/test-capability.mjs
```

## 檔案

- `body-awareness.js` — 主引擎  
- `skills-registry.js` — 技能表（≠ 自主學習）  
- `test-capability.mjs` — Node 驗收  

## 未完成

- 完整身高／體型計量（GLB bbox 自動量測）  
- 與 ENGINE-10 狀態機（想做／正在做／已完成）完整串接  
