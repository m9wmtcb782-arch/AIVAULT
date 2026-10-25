# embodiment-interfaces｜可遷移身體介面（虛擬 stub）

**狀態：開發中｜不連實體機器人**  
**規範：** `../docs/EMBODIMENT-AGNOSTIC-CORE.md`

| 模組 | 職責 |
|------|------|
| `sensory-nerve-bus.js` | 統一感覺事件（`source: virtual\|hardware`） |
| `body-control-bus.js` | 統一控制指令＋能力描述符 |
| `body-profile.js` | 身體檔案／換身校準 |
| `skill-gate.js` | 虛擬經驗 vs 實體技能（實體預設 locked） |
| `test-embodiment-interfaces.mjs` | 最小驗收 |

```bash
node research/darkstar-embodied/embodiment-interfaces/test-embodiment-interfaces.mjs
```
