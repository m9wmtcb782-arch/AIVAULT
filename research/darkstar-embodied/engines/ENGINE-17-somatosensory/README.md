# ENGINE-17｜Virtual Somatosensory Nervous System

**狀態：開發中**｜虛擬模擬｜**禁止宣稱真實主觀痛覺**

## 功能
- 全身皮膚區映射（`skin-regions.js`，可連 soft-tissue 區域）
- 接觸／壓力／溫度／碰撞刺激
- 虛擬冷覺／熱覺／痛覺訊號（強度＋時長＋部位）
- **保護反射先於決策**：過熱 → `withdraw_hand`，再交 ENGINE-08／22

## API
```js
import { createSomatosensory } from './somatosensory.js';
const sns = createSomatosensory({ onReflex });
sns.applyStimulus({ region: 'hand_R', type: 'temperature', temperatureC: 80, source: 'hot_plate' });
```

## 整合
Shared Body Core · soft-tissue(12) · injury(18) · memory(22) · capability(02/05)

## 未完成
- 真實蒙皮 UV 感覺場、連續溫度擴散、與 Three mesh 材質即時連動（lab 用 mock 渲染）
