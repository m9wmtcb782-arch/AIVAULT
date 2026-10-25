# AIVAULT Virtual Embodied World（虛擬具身智慧世界）

**狀態：開發中（第一～二期＋E12／E15～27＋統一生理核心骨架）｜不得部署正式入口｜不得宣稱工程完成**  
**倉庫／帳號：** m9wmtcb782-arch/AIVAULT（第一基地）  
**分支：** `research/darkstar-embodied-intelligence`  
**變更令：** `docs/CHANGE-ORDER-virtual-embodied-world-2026-10-25.md`  
**最高規範（優先於各引擎簡化實作）：** `docs/HIGHEST-NORM-virtual-human-physiology.md`  
**統一生理核心：** `physiology-core/`（Virtual Human Physiology Core｜骨架可測｜引擎逐步遷移）  
**可遷移身體介面：** `docs/EMBODIMENT-AGNOSTIC-CORE.md` ＋ `embodiment-interfaces/`（虛擬 stub｜實體技能預設 locked）

## 方向（正式）

**真人進入暗星虛擬世界**；暗星為具自主身體控制的虛擬世界居民。  
同時保留 **真人視訊混合實境**（ENGINE-11）：數字人合成進真實攝影機畫面／WebRTC——**本輪僅 stub**。

不得用預錄 MP4 冒充自主動作；MP4 數字人**保留作回退**（不刪）。  
禁止改：`aivault-dark-star-digital-human.html`、`aivault-digital-human.html`、`technical-dark-star.html`、主城入口。

## Shared Body Core（唯一大腦／身體控制）

```
   Virtual Human Physiology Core（最高層狀態真相）
   physiology-core/  ← 連續向量＋動態＋證據分級＋同意閘
              │
        Shared Body Core（讀核心／逐步遷移）
   ENGINE-02 身體自我認知
   ENGINE-03 運動控制
   ENGINE-08 具身決策
   ENGINE-05 可行性閘門
   ENGINE-12 soft-tissue（形變狀態共用）
   ENGINE-15 自主視線 ＋ ENGINE-16 自然頭頸
   ENGINE-17～22 感覺／創傷／復原／疾病／味嗅／記憶
   ENGINE-23～27 神經狀態／睡眠／酒精／耦合／持久
              │
     ┌────────┴────────┐
     ▼                 ▼
 Virtual World     Real-world Compositor
 Renderer          (ENGINE-11 stub)
 虛擬教室／物件      原影像＋入鏡＋WebRTC
```

**最高規範優先於各引擎簡化實作**；既有引擎逐步改為讀 `physiology-core`，避免互相矛盾的寫死規則。  
**禁止**做兩套互不相干的暗星 AI。虛擬場景與現實合成只是不同 renderer／compositor。  
未完成生理槽位標 `pending_research`，**不得從模型刪除**。

## 雙模式

| 模式 | 狀態 |
|------|------|
| 虛擬世界模式 | 第二期 Shared Motor＋教室進行中 |
| 真人視訊混合實境模式 | ENGINE-11 **開發中／stub**；完整合成未做 |

## 新十＋一引擎

| # | 目錄 | 狀態 |
|---|------|------|
| 01 | `ENGINE-01-human-pose` | 開發中（種子：舊 visual） |
| 02 | `ENGINE-02-body-awareness` | **第一期核心・實作中** |
| 03 | `ENGINE-03-motor-control` | **第二期進行中**（連續 sit／erase state／walk stub） |
| 04 | `ENGINE-04-world-perception` | 開發中 |
| 05 | `ENGINE-05-capability` | 第一期委派 02 |
| 06 | `ENGINE-06-human-to-virtual` | 第四期；相機占位 |
| 07 | `ENGINE-07-interaction-physics` | 開發中（黑板 state） |
| 08 | `ENGINE-08-embodied-decision` | 開發中 |
| 09 | `ENGINE-09-motor-learning` | 第六期未做 |
| 10 | `ENGINE-10-closed-loop-feedback` | 開發中 |
| 11 | `ENGINE-11-realworld-compositor` | **stub／規格** |
| 12 | `ENGINE-12-soft-tissue` | **開發中**（肩膀碰撞擠壓測試頁） |
| 15 | `ENGINE-15-autonomous-gaze` | **開發中**（自主視線＋對話對象追蹤） |
| 16 | `ENGINE-16-natural-head-neck` | **開發中**（頭跟隨眼／慣性） |
| 17 | `ENGINE-17-somatosensory` | **開發中**（感覺＋保護縮手） |
| 18 | `ENGINE-18-virtual-injury` | **開發中**（物理規則創傷） |
| 19 | `ENGINE-19-virtual-recovery` | **開發中**（可調時間尺度） |
| 20 | `ENGINE-20-virtual-illness` | **開發中**（虛擬感冒可見表現） |
| 21 | `ENGINE-21-taste-olfactory` | **開發中**（推論＋可信度） |
| 22 | `ENGINE-22-sensory-memory` | **開發中**（限制閘門） |
| 23 | `ENGINE-23-neurobehavioral-state` | **開發中**（神經行為狀態） |
| 24 | `ENGINE-24-sleep-fatigue` | **開發中**（睡眠／疲勞） |
| 25 | `ENGINE-25-alcohol-impairment` | **開發中**（連續 BAC 模型） |
| 26 | `ENGINE-26-neuro-motor-coupling` | **開發中**（接 15／16／03） |
| 27 | `ENGINE-27-persistent-physio` | **開發中**（持久＋時鐘） |

另：`shared/conversation-target-tracking.js` 供 15／16／08 共用。
`shared/realtime-neuro-coupling.js`：23～27 → 15／16／03 瀏覽器即時耦合（開發中）。
`physiology-core/adapters/neuro-stack-adapter.js`：**正式適配**；`neuro-physio-stack` 雙寫，**Physiology Core 為真相**（遷移進行中）。

舊 `engines/ENGINE-0N-*` 目錄保留並附 `REDIRECT.md`，勿刪已有程式。

## 本地預覽

```bash
cd /path/to/AIVAULT
python3 -m http.server 8765 --bind 127.0.0.1
```

- Phase1 骨骼：`http://127.0.0.1:8765/research/darkstar-embodied/phase1/index.html`
- **虛擬教室：** `http://127.0.0.1:8765/research/darkstar-embodied/phase1/virtual-classroom/index.html`
- **軟組織 demo：** `http://127.0.0.1:8765/research/darkstar-embodied/engines/ENGINE-12-soft-tissue/demo/index.html`
- **視線／頭頸 Lab：** `http://127.0.0.1:8765/research/darkstar-embodied/phase1/gaze-head-lab/index.html`
- **感覺／生理 Lab：** `http://127.0.0.1:8765/research/darkstar-embodied/phase1/sensory-physio-lab/index.html`
- **神經狀態 Lab：** `http://127.0.0.1:8765/research/darkstar-embodied/phase1/neuro-state-lab/index.html`

## 能力／運動測試（Node）

```bash
node research/darkstar-embodied/engines/ENGINE-02-body-awareness/test-capability.mjs
node research/darkstar-embodied/engines/ENGINE-03-motor-control/test-motor.mjs
node research/darkstar-embodied/engines/ENGINE-12-soft-tissue/test-soft-tissue.mjs
node research/darkstar-embodied/engines/ENGINE-15-autonomous-gaze/test-gaze-head.mjs
node research/darkstar-embodied/phase1/sensory-physio-lab/test-sensory-physio.mjs
node research/darkstar-embodied/phase1/neuro-state-lab/test-neuro-state.mjs
node research/darkstar-embodied/phase1/neuro-state-lab/test-realtime-coupling.mjs
node research/darkstar-embodied/physiology-core/test-physiology-core.mjs
node research/darkstar-embodied/physiology-core/test-core-coupling-sync.mjs
node research/darkstar-embodied/physiology-core/test-core-sensory-sync.mjs
node research/darkstar-embodied/embodiment-interfaces/test-embodiment-interfaces.mjs
```

## 既有可重用（摘要）

見 `docs/inventory-2026-10-25.md`。關鍵：GLB `assets/dark-star/technical-dark-star-avatar.glb`、`body-safety-layer.js`、phase1 `arm-ik`／`joint-controller`、AI Gateway（決策勿每影格）。
