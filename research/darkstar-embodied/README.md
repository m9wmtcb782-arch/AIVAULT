# AIVAULT Virtual Embodied World（虛擬具身智慧世界）

**狀態：開發中（第一期）｜不得部署正式入口｜不得宣稱工程完成**  
**倉庫／帳號：** m9wmtcb782-arch/AIVAULT（第一基地）  
**分支：** `research/darkstar-embodied-intelligence`  
**變更令：** `docs/CHANGE-ORDER-virtual-embodied-world-2026-10-25.md`

## 方向（正式）

**真人進入暗星虛擬世界**；暗星為具自主身體控制的虛擬世界居民。  
同時保留 **真人視訊混合實境**（ENGINE-11）：數字人合成進真實攝影機畫面／WebRTC——**本輪僅 stub**。

不得用預錄 MP4 冒充自主動作；MP4 數字人**保留作回退**（不刪）。  
禁止改：`aivault-dark-star-digital-human.html`、`aivault-digital-human.html`、`technical-dark-star.html`、主城入口。

## Shared Body Core（唯一大腦／身體控制）

```
        Shared Body Core
   ENGINE-02 身體自我認知
   ENGINE-03 運動控制
   ENGINE-08 具身決策
   ENGINE-05 可行性閘門
              │
     ┌────────┴────────┐
     ▼                 ▼
 Virtual World     Real-world Compositor
 Renderer          (ENGINE-11 stub)
 虛擬教室／物件      原影像＋入鏡＋WebRTC
```

**禁止**做兩套互不相干的暗星 AI。虛擬場景與現實合成只是不同 renderer／compositor。

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

舊 `engines/ENGINE-0N-*` 目錄保留並附 `REDIRECT.md`，勿刪已有程式。

## 本地預覽

```bash
cd /path/to/AIVAULT
python3 -m http.server 8765 --bind 127.0.0.1
```

- Phase1 骨骼：`http://127.0.0.1:8765/research/darkstar-embodied/phase1/index.html`
- **虛擬教室：** `http://127.0.0.1:8765/research/darkstar-embodied/phase1/virtual-classroom/index.html`

## 能力／運動測試（Node）

```bash
node research/darkstar-embodied/engines/ENGINE-02-body-awareness/test-capability.mjs
node research/darkstar-embodied/engines/ENGINE-03-motor-control/test-motor.mjs
```

## 既有可重用（摘要）

見 `docs/inventory-2026-10-25.md`。關鍵：GLB `assets/dark-star/technical-dark-star-avatar.glb`、`body-safety-layer.js`、phase1 `arm-ik`／`joint-controller`、AI Gateway（決策勿每影格）。
