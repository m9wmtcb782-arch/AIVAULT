# Dark Star Physiological Digital Twin Engine

**分支：** `feat/dark-star-physiological-twin-v1`  
**狀態：** 研發中（虛擬數學生理引擎｜可測）  
**宣稱邊界：** 虛擬模擬 ≠ 主觀意識／真實生物感受；非正式臨床工具；**未宣稱完整人體生理系統**。

## 盤點與複用計畫

| 既有資產 | 位置 | 本工程關係 |
|----------|------|------------|
| Physiology Core（JS 狀態向量／dynamics） | `research/darkstar-embodied/physiology-core/`（分支 `research/darkstar-embodied-intelligence`） | **參考規範與槽位**；心率／呼吸仍標 `pending_research`。本工程以 **Python 數學模型** 新建可驗證心肺／代謝／恆定，未來可合併為 Core 後端。 |
| ENGINE-17～27 | 同分支 `engines/` | 感覺／創傷／睡眠等；本引擎經 `physiology_neural_bridge`／body bridge **對接意圖**，不改正式頁。 |
| sensory-physio-lab | `phase1/sensory-physio-lab/` | 瀏覽器實驗；本分支不部署。 |
| 痛覺 | `research/dark_star_nociception/` | 軟依賴：損傷刺激可呼叫 `NociceptionCore.sense`。 |
| 母愛／浪漫／愛恐懼求生 | 對應 `dark_star_*` | 決策上下文可注入 protect／attachment／fear；衝突引擎軟連結。 |

**新建目錄：** `research/dark_star_physiological_twin/`（本分支唯一交付面；不改正式暗星頁）。

## 架構

```
DecisionContext / 神經輸入
        │
        ▼
physiology_neural_bridge ──► NeuralDrive（連續，禁情緒寫死 HR）
        │
        ▼
physiological_twin_core.step(dt)
  ├─ metabolism → VO2 需求、疲勞、能量守恆
  ├─ digestive / liver / endocrine / renal / thermo
  ├─ cardiovascular  CO=HR×SV  MAP≈CO×SVR+CVP
  ├─ circulation     集中參數再分配 + 血容量守恆
  ├─ respiratory     與 VO2／CO／自主神經聯動
  ├─ homeostasis     負回饋與模式（正常／急性／持續失衡）
  └─ organ_state
        │
        ▼
BehaviorStrategy → physiology_body_bridge（虛實隔離／Gateway 不中斷）
```

## 模組

- `virtual_cardiovascular_engine.py`
- `virtual_circulation_engine.py`
- `virtual_respiratory_engine.py`
- `virtual_metabolism_engine.py`
- `virtual_digestive_engine.py` / `virtual_liver_engine.py` / `virtual_renal_engine.py`
- `virtual_endocrine_engine.py` / `virtual_thermoregulation_engine.py`
- `virtual_organ_state_engine.py` / `virtual_homeostasis_engine.py`
- `physiology_neural_bridge.py` / `physiology_body_bridge.py`
- `physiological_twin_core.py` / `state.py` / `units.py`

支援：pause／resume、serialize／reload、seed 可重現。

## 假設與適用範圍（ASSUMPTIONS）

| 項目 | 分級 | 說明 |
|------|------|------|
| CO=HR×SV、MAP≈CO×SVR+CVP | approximation | 集中參數；忽略波動傳輸與瓣膜細節 |
| 血流再分配分數 | approximation | 教科書靜息／運動趨勢，非個體影像校準 |
| O₂ 攜帶 ≈ flow×200×SpO₂ | hypothesis | 工程代理，非血紅素解離曲線 |
| 胰島素／升糖素 AU | hypothesis | 可校準無量綱；非臨床藥代 |
| 能量 5 kcal≈1 L O₂ 粗換算 | approximation | 用於 VO₂ 需求耦合 |
| 熱容／散熱係數 | hypothesis | 維持 35–41°C 合理帶，待校準 |
| 長時程 dt=30s | approximation | 穩定性測試用，非逐心跳解析 |
| 女性週期／親密槽位 | pending_research | 見 Physiology Core；本引擎未關閉槽位需求，動力學待合併 |

## 虛實隔離

- `virtual_only=True`；`gateway_unaffected` 恒真於虛擬昏迷。
- `HardwareSensorInterface.hardware_enabled=False`；禁止虛擬血壓／疼痛冒充真實感測。

## 測試

```bash
cd research/dark_star_physiological_twin
python -m unittest tests.test_acceptance_a_h -v
```

| 代號 | 內容 |
|------|------|
| A | 靜止穩態不發散；CO／MAP 公式成立 |
| B | 運動心肺／肌耗／疲勞協同 |
| C | 恐懼→交感→心肺；非標籤寫死 |
| D | 能量不足→策略／疲勞 |
| E | 脫水／失血→血容量與 SVR |
| F | 受傷痛覺×循環×恢復 |
| G | 虛擬多日無負質量／溢位；serialize |
| H | 生理改變行為決策；Gateway 隔離 |

## 待研發

- 臨床參數校準與文獻綁定（supported 級）
- 與 `physiology-core` JS 合併／雙向同步
- 硬體 e-stop 與真實感測驅動
- 週期／內分泌閉環、血氣精細模型
- 正式頁接線（本分支禁止改正式頁）

## 紀律

不得修改正式暗星頁；不得以 MP4／隨機心跳／固定血糖冒充生理；不得未經授權付費 API；不得宣稱完整人體生理或主觀感受。
