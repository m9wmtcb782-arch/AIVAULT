# ENGINE-05｜身體能力與行動可行性（Capability & Affordance）

**狀態：開發中（第一期委派 ENGINE-02）**

## 職責

執行動作前判斷：身體能力、姿態、可達範圍、虛擬／實體域、權限、可否驗證結果。

## 本階段實作

- `capability-engine.js` → `createCapabilityEngine({ bodyAwareness })`
- `canPerform` 委派 `ENGINE-02-body-awareness`
- **硬規則：** `domain=physical` 一律 `can=false`（無實體身體）

## 測試

見 `../ENGINE-02-body-awareness/test-capability.mjs`

## 禁止

- 將虛擬黑板擦除成功宣稱為擦掉現實黑板  
- 將 stub 技能宣稱為 ENGINE-09 自主學習完成  
