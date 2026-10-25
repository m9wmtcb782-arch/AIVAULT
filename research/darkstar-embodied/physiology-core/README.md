# AIVAULT Virtual Human Physiology Core

**狀態：開發中（骨架可測）｜非正式部署｜虛擬模擬**  
**最高規範：** `../docs/HIGHEST-NORM-virtual-human-physiology.md`  
**原則：** 本核心**優先於**各引擎簡化實作；引擎逐步遷移為讀取本核心。

## 目標

建立統一、可測試的虛擬人體生理狀態核心：

- 連續狀態向量（神經／荷爾蒙／情緒／肌肉／皮膚／疲勞／疼痛／舒適／恢復／週期／親密動機等）
- 最小動態系統（多狀態耦合＋時間連續）
- 參數證據分級（`supported`／`approximation`／`hypothesis`）
- 親密相關輸出的情境判斷與同意閘（**不刪除**生理槽位）
- 適配層說明：ENGINE-02／12／15～27 等改為讀核心

未實作槽位必須保留並標 `status: pending_research`，不得從模型刪除。

## 目錄

| 檔案 | 職責 |
|------|------|
| `state-vector.js` | 連續狀態向量工廠、槽位定義、個體差異種子 |
| `dynamics.js` | `step(dt, stimuli)` 動態更新與耦合 |
| `evidence-tiers.js` | 參數來源分級與虛報禁令 |
| `consent-context.js` | 情境／同意閘（親密輸出） |
| `adapters/README.md` | 引擎遷移指南 |
| `test-physiology-core.mjs` | 耦合與規範符合性測試 |

## 快速測試

```bash
node research/darkstar-embodied/physiology-core/test-physiology-core.mjs
```

## 架構（示意）

```
  Stimuli / Events          Consent Context
         │                        │
         ▼                        ▼
 ┌───────────────────────────────────────┐
 │   Virtual Human Physiology Core       │
 │   state-vector  ←→  dynamics.step     │
 │   evidence-tiers（參數可信度標註）      │
 └───────────────────┬───────────────────┘
                     │ readSnapshot()
     ┌───────────────┼───────────────┐
     ▼               ▼               ▼
  E-02/05          E-15/16/03      E-17～27
  身體／可行性      視線／頭頸／運動   感覺／神經等
                     │
              Virtual Renderer | ENGINE-11
```

**禁止：** 各引擎各自維護互斥的「最終情緒／最終生理」寫死規則而不回寫核心。  
**禁止：** 宣稱本核心等於真實生物器官或主觀意識。

## 待研發（顯式）

見 `state-vector.js` 中 `status === 'pending_research'` 的槽位，以及 `adapters/README.md` 遷移清單。  
完整內分泌週期閉環、臨床級酒精／藥物交互、蒙皮級皮膚血流視覺等均標待研發。
