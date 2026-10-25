# 可遷移自主核心｜Embodiment-Agnostic Core

**狀態：開發中（虛擬架構＋測試介面｜不購買／不連接實體機器人）**  
**日期：** 2026-10-25（Asia/Taipei）  
**分支：** `research/darkstar-embodied-intelligence`  
**最高規範：** `HIGHEST-NORM-virtual-human-physiology.md`  
**生理核心：** `../physiology-core/`  
**介面骨架：** `../embodiment-interfaces/`

---

## 1. 目標

建立**不依附單一數字人模型**的可遷移自主核心：

- AI 決策、長期記憶、世界模型與學習系統  
- 與**虛擬身體渲染器**（GLB／表情／場景）**分離**  
- 透過統一感覺神經介面與統一身體控制介面，可掛接不同虛擬身體；未來在安全校準後才可掛接實體感測／致動硬體

**本階段不買實體機器人**，只交付虛擬架構、schema 與可測 stub。

---

## 2. 分層架構

```
 ┌─────────────────────────────────────────────┐
 │  Autonomous Core（可遷移）                     │
 │  決策／長期記憶／世界模型／學習／Physiology Core │
 └──────────────────┬──────────────────────────┘
                    │ 統一 bus（本文件介面）
     ┌──────────────┼──────────────┐
     ▼              ▼              ▼
 Sensory Nerve   Body Control   Body Profile
 Bus             Bus            ＋ Skill Gate
 (感覺事件)       (控制指令)      (換身／技能啟用)
     │              │
     ▼              ▼
 Virtual Renderer  (今)     Hardware Driver (未來・預設 locked)
 GLB／場景／合成              感測器／致動器
```

**禁止：** 把渲染動畫、固定 MP4 或單一模型綁死成「唯一自我」。  
換身體時，必須重新跑**自我認知與能力校準**（接 ENGINE-02）。

---

## 3. 統一感覺神經介面（Sensory Nerve Bus）

所有刺激（虛擬或未來硬體）必須正規化為同一事件格式：

| 欄位 | 說明 |
|------|------|
| `id` | 事件 ID |
| `ts` | 時間戳（ms） |
| `source` | `virtual` \| `hardware` |
| `modality` | touch／pressure／temperature／nociception／vision／audition／proprioception／… |
| `bodyRegion` | 身體部位代號（依當前 Body Profile 映射） |
| `intensity` | 連續強度 \[0,1\] 或物理單位＋歸一化 |
| `vector` | 可選方向／法線 |
| `confidence` | 感知可信度 |
| `rawRef` | 可選原始樣本引用（不強制上傳） |

原則：

- 虛擬刺激與未來真實感測器使用**相容 schema**；差異只在 `source` 與 driver。  
- 疼痛／傷害事件必須進入 Physiology Core 與危險記憶，**不得只觸發表情動畫**。  
- 未授權不得錄製／外傳感測資料。

實作 stub：`embodiment-interfaces/sensory-nerve-bus.js`

---

## 4. 統一身體控制介面（Body Control Bus）

控制指令與能力描述符分離：

**能力描述符（Capability Descriptor）**

- 骨骼／關節列表與限位  
- 可用致動器／自由度  
- 感測通道  
- 負載／速度／安全邊界  
- `embodimentKind`: `virtual_avatar` \| `physical_robot`（未來）

**控制指令（Control Intent）**

- 與既有 `protocol/control-intent` 對齊之 JSON  
- 依當前身體能力裁剪（不可達 → 拒絕並回報）  
- 低階執行器負責平滑／IK／安全；高階決策不每影格直驅關節

實作 stub：`embodiment-interfaces/body-control-bus.js`

---

## 5. 換身體與自我認知校準（Body Profile）

換身流程（虛擬 stub）：

1. 載入新 `BodyProfile`（關節圖、外型、感測／致動能力）  
2. 呼叫 ENGINE-02 風格自我認知刷新：`whoAmI`／可動範圍／尚不會的技能  
3. 能力可行性閘（ENGINE-05）改讀新 profile  
4. 舊身體技能標記為「需再校準」；不自動宣稱實體可用

實作 stub：`embodiment-interfaces/body-profile.js`

---

## 6. 疼痛／傷害 → 危險記憶與保護

| 層級 | 行為 |
|------|------|
| 反射 | 縮手等保護性動作（可先於高階決策） |
| 狀態 | 寫入 Physiology Core（nociception／injuryLoad） |
| 記憶 | 危險記憶：部位、來源、強度、時間、結果 |
| 學習 | 預測同類刺激風險；規劃時避開（虛擬） |
| 禁止 | 僅播放痛苦表情／MP4 冒充完整保護系統 |

實體傷害通道僅預留介面；**不得**對真人造成傷害，亦不得將虛擬模擬誤述為真實生物痛覺。

---

## 7. 虛擬經驗 vs 實體技能（Skill Gate）

| 類型 | 預設 | 啟用條件 |
|------|------|----------|
| 虛擬經驗／虛擬技能 | 可在隔離環境訓練與測試 | 虛擬驗收通過即可標記 `virtual_validated` |
| 實體技能 | **locked** | 安全校準＋實測驗證＋明確授權後才 `hardware_enabled` |

原則：虛擬經驗**保留**；遷移到實體必須重新校準，禁止「虛擬會做＝實體已啟用」。

實作 stub：`embodiment-interfaces/skill-gate.js`

---

## 8. 預留標準介面（本階段僅 stub）

- 觸覺／壓力／溫度  
- 人工傷害／nociception 通道（虛擬）  
- 視聽感知事件  
- 機器人運動控制（關節目標／阻抗／安全停機）  

硬體 driver 目錄預留概念位置；**不採購、不連真機**。

---

## 9. 與既有引擎關係

- Physiology Core：感覺事件與傷害狀態的真相來源之一  
- ENGINE-02：換身後自我認知與能力邊界  
- ENGINE-03／15／16：經 Body Control Bus 執行  
- ENGINE-17～22：感覺／創傷／記憶應對齊 Sensory Nerve Bus  
- ENGINE-11：僅渲染／合成，不另建第二套自主核心  

最高規範仍適用：完整生理槽位、`pending_research` 不得刪除、禁固定劇本冒充真實反應。

---

## 10. 驗收（本階段）

1. 文件入庫（本檔）  
2. `embodiment-interfaces/*` stub 可跑 `test-embodiment-interfaces.mjs`  
3. 感覺事件 `source: virtual` 可發布；`hardware` 可標註但技能閘預設 locked  
4. 換身 API 可切換 profile 並觸發校準回呼 stub  
5. 正式暗星／主城頁**未改**  

未完成：真實硬體、實機運動、跨身體技能自動遷移宣稱。

---

*虛擬架構免責：不宣稱已具備實體機器人能力或真實生物感受。*
