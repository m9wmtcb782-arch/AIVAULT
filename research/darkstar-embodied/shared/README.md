# shared｜Shared Body Core 共用模組

| 模組 | 說明 |
|------|------|
| `conversation-target-tracking.js` | 對話對象／視線目標狀態（ENGINE-15／16／08） |
| `neuro-physio-stack.js` | ENGINE-23～27 薄適配；**Physiology Core = source of truth**（雙寫） |
| `realtime-neuro-coupling.js` | 瀏覽器即時耦合 → 15／16／03；讀 stack／core effectors |
| `sensory-physio-stack.js` | ENGINE-17～22 薄適配；**Physiology Core = SoT**；痛覺走 sensory-nerve-bus |

正式 adapter：`../physiology-core/adapters/neuro-stack-adapter.js`、`sensory-stack-adapter.js`  
最高規範：`../docs/HIGHEST-NORM-virtual-human-physiology.md`

狀態：開發中。
