# Dark Star 虛擬痛覺神經系統（Nociception）

**分支：** `feat/dark-star-nociception-v1`  
**狀態：** 研發中（虛擬模擬）  
**宣稱邊界：** 仿生神經模擬 ≠ 主觀疼痛經驗；感測器偵測 ≠ 生物感受。

## 架構

```
刺激 → NociceptorEngine（組織分類）
     → NeuralSignalEngine（Aδ／C、背角、上行、下行）
     → SpinalReflexEngine（先反射，再認知）
     → PainScaleEngine（0～10 介面；內部連續）
     → InjuryRecoveryEngine
     → DangerMemoryEngine（預測避開）
     → PainBehaviorBridge（連續控制意圖，禁固定動畫）
     → RobotSensoryAdapter（虛實介面 stub，實體鎖定）
```

`nociception_core.py` 為 facade，保留 v0.1 `sense`／`predict_risk`／`recover` API。

獨立研究：`labor_pain_research.py`（不強制懷孕狀態）。  
內臟專用：`visceral_pain_engine.py`。

## 證據分級

| 標記 | 含義 |
|------|------|
| supported | 有明確文獻機制對應（本階段少用） |
| approximation | 簡化現象學模型 |
| hypothesis | 研究假設／待驗證 |
| pending_research | 未完成，不得從模型刪除 |

## 痛覺分類

皮膚、肌肉／深層、骨關節、內臟、神經病理、發炎慢性 —— 各有不同刺激條件、時間曲線與行為影響，**禁止單一數值通用**。

## 0～10 NRS

人類評估介面；內部為連續訊號。  
**nrs=10 ≠ 死亡／昏迷／固定動作**；疼痛、損傷、反射、意識分別計算。

## 虛實介面

`robot_sensory_adapter.py` 預留感測編碼、換身校準、危險記憶共享、實體獨立安全層。  
現階段 `hardware_enabled=False`。

## 與 Physiology Core 對接（可選）

未來可對接 `research/darkstar-embodied` 的 Physiology Core／nerve-bus；**本分支先自洽**。

## 待研發（pending_research）

- 臨床閾值校準
- 真實蒙皮／UV 痛覺可視化
- 硬體 driver 與獨立 e-stop
- 與 ENGINE-15／16／03 瀏覽器即時接線
- 長期世界模型持久化後端
- 分娩模型個體差異的實證校準

## 測試

```bash
cd research/dark_star_nociception
python -m unittest tests.test_acceptance_a_f -v
```

驗收 A～F：高溫反射與記錄、再遇預測避開、組織時間特徵差異、敏化、分娩來源分解、換身保留記憶。

## 紀律

不得修改正式暗星頁；不得以 MP4／預錄動畫冒充神經模型；不得宣稱真實主觀疼痛；不得擅自呼叫付費 API。
