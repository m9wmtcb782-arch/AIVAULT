# 正式變更令｜Virtual Embodied World（虛擬具身智慧世界）

**日期：** 2026-10-25（Asia/Taipei）  
**狀態：開發中（第一期進行中）｜未宣稱工程完成**  
**分支：** `research/darkstar-embodied-intelligence`  
**基地：** 第一基地 m9wmtcb782-arch/AIVAULT（禁止混用第二／第三基地寫入）

## 方向變更（一句話）

| 舊目標（已停） | 新目標（正式） |
|----------------|----------------|
| 暗星數字人進入真人攝影機畫面 | **真人進入暗星虛擬世界**；暗星為虛擬世界居民 |

不得再將「暗星進現實畫面」作為唯一工程目標。  
不得用預錄 MP4／固定腳本冒充自主具身行為。  
MP4 數字人**保留為回退**，禁止刪除正式數字人資產。

## 舊八引擎 → 新十引擎對照

| 舊編號／目錄 | 處置 | 新編號／目錄 | 說明 |
|--------------|------|--------------|------|
| ENGINE-01-visual（即時視覺神經） | **保留程式＋重配**；停「暗星觀察現實為唯一目標」 | **ENGINE-01-human-pose** | 真人姿態／手／軀幹追蹤 → 虛擬世界可理解資料；種子仍用 MediaPipe |
| ENGINE-02-auditory | **暫緩**（語音後段再接）；目錄留 REDIRECT | （介面保留於語音相關／ENGINE-08 輸入） | 本階段優先無語音身體互動 |
| ENGINE-03-fusion | **重配** | 併入 ENGINE-04／ENGINE-08 消費 | 時間對齊改服務虛擬場景狀態 |
| ENGINE-04-decision | **改名重配** | **ENGINE-08-embodied-decision** | 具身自主決策；稀疏 Gateway |
| ENGINE-05-skeletal | **保留並重配** | **ENGINE-03-motor-control** | Phase1 GLB／arm-ik／safety 為核心種子 |
| ENGINE-06-face-gaze | **保留並重配** | 併入 ENGINE-03（表情／視線低階） | Morph／gaze 仍由運動層執行 |
| ENGINE-07-speech-lipsync | **介面保留**；本階段不擴 | 後續整合 | 不刪 Live Voice 種子路徑 |
| ENGINE-08-feedback-learning | **拆分重配** | **ENGINE-10** 閉環回饋 ＋ **ENGINE-09** 運動學習 | 學習不得等於寫死技能表 |
| — | **新增** | **ENGINE-02-body-awareness** | **最高優先**：身體自我認知 |
| — | **新增** | **ENGINE-04-world-perception** | 虛擬環境／座標／物件 |
| — | **新增** | **ENGINE-05-capability** | 能力與可行性（affordance） |
| — | **新增** | **ENGINE-06-human-to-virtual** | 真人進虛擬（去背／合成＝第四期） |
| — | **新增** | **ENGINE-07-interaction-physics** | 虛擬物件互動／物理 |

## 已完成有效成果（保留並重配）

| 成果 | 路徑 | 處置 |
|------|------|------|
| Phase1 GLB 測試頁 | `phase1/index.html` | 保留；教室頁另開，不取代 |
| arm-ik wave 真實關節 | `phase1/arm-ik.js` | 保留 → ENGINE-03 技能 |
| joint-controller | `phase1/joint-controller.js` | 保留；ENGINE-02 讀真實狀態 |
| control protocol | `protocol/*` | 保留；後續加 domain=virtual\|physical |
| body-safety-layer | `assets/dark-star/body-safety-layer.js` | 保留（正式資產，只讀用） |
| inventory 盤點 | `docs/inventory-2026-10-25.md` | 保留 |
| ENGINE-01 MediaPipe 最小版（未提交／本輪一併納入） | `engines/ENGINE-01-visual/*` | **種子保留**；目標改標為真人姿態進虛擬（見 REDIRECT） |

## 已停止的施工方向

- ~~以「暗星進入現實攝影機畫面」為唯一最終目標的 ENGINE-01 施工~~  
- ~~驗收以「暗星疊進真人鏡頭」為第一優先~~  
- 舊 Phase 順序中「Phase5 才虛擬整合」改為：**先虛擬教室／身體自我認知，真人同框屬第四期**

舊 `ENGINE-01-visual` 程式**不刪**；標 DEPRECATED／REDIRECT，供新 ENGINE-01／ENGINE-06 重用。

## 新施工期次（對齊變更令）

1. **第一期（本輪）：** 身體自我認知 ENGINE-02＋能力邊界＋虛擬教室骨架  
2. 第二期：自主運動控制 ENGINE-03  
3. 第三期：虛擬生活空間 ENGINE-04／07  
4. 第四期：真人進虛擬 ENGINE-06（去背／合成；**未完成不得宣稱同框**）  
5. 第五期：三畫面 WebRTC  
6. 第六期：ENGINE-09 學習（須獨立訓練證據）

## 禁止事項（重申）

- 不改正式頁：`aivault-dark-star-digital-human.html`、`aivault-digital-human.html`、`technical-dark-star.html`、主城入口  
- 不部署正式、不寫第三基地、不付費 API  
- 不刪 MP4 回退資產  
- 虛擬操作完成 ≠ 現實任務完成  

## 正式補充｜雙模式（不得刪除原即時視訊需求）

系統必須同時支援兩種呈現／互動模式；**只有一套自主身體控制核心**。

| 模式 | 說明 | 主要引擎 |
|------|------|----------|
| **虛擬世界模式** | 暗星虛擬身體＋虛擬場景；真人可進入虛擬世界互動 | ENGINE-02／03／04／06／07／08 |
| **真人視訊混合實境模式** | WebRTC 雙向真人視訊；保留真實攝影機與現實背景；暗星數字人即時合成進同一畫面；朋友可看同框 | **ENGINE-11**＋共享身體核心＋WebRTC |

```
                    ┌─────────────────────────────┐
                    │   Shared Body Core（唯一）     │
                    │  ENGINE-02 身體自我認知         │
                    │  ENGINE-03 運動控制             │
                    │  ENGINE-08 具身自主決策         │
                    │  (+ ENGINE-05 可行性閘門)       │
                    └─────────────┬───────────────┘
                                  │
              ┌───────────────────┴───────────────────┐
              ▼                                       ▼
   Virtual World Renderer                    Real-world Compositor
   (虛擬教室／場景／物件)                      (ENGINE-11)
   ENGINE-04／06／07                          保留原影像＋入鏡合成
                                              ＋WebRTC 三畫面
```

**禁止：** 做兩套互不相干的暗星 AI／兩套互不相干的運動決策腦。  
虛擬場景與現實合成場景只是不同 **renderer／compositor**。

## ENGINE-11｜Real-world Scene Compositing（新增・本輪 stub）

**狀態：開發中（僅目錄＋介面規格；完整 WebRTC 合成未做）**  
**路徑：** `engines/ENGINE-11-realworld-compositor/`

功能要點（規格，未宣稱完成）：

1. 保留使用者真實攝影機原影像與現實背景  
2. 人／景分界或深度估計（標限制：單相機無法精準全身 3D）  
3. 地面／座位空間估計，供數字人站位  
4. 暗星數字人即時入鏡合成  
5. 遮擋關係  
6. 光影比例粗調  
7. 即時串流輸出  
8. WebRTC 傳輸  
9. 雙路／三路顯示（使用者真實／朋友真實／合成同框）

## 施工順序（更新）

1. **第一期（本輪優先）：** ENGINE-02 身體自我認知＋能力邊界＋虛擬教室骨架  
2. **第二期：** ENGINE-03 自主運動控制（共享核心）  
3. **第三期：** 虛擬生活空間 ENGINE-04／07  
4. **第四期：** 真人進入虛擬世界 ENGINE-06  
5. **獨立測試階段（在 2～3 之後）：** ENGINE-11 混合實境合成＋三畫面 WebRTC  
6. **第六期：** ENGINE-09 學習（須獨立證據）

各階段均標：**不得破壞正式頁**；未經授權不得合併／部署正式。
