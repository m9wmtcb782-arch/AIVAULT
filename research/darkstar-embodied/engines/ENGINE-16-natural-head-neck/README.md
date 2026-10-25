# ENGINE-16｜Natural Head, Neck & Posture（自然頭頸）

**狀態：開發中**｜Shared Body Core · 與 ENGINE-15 同一 GLB  
**版本：** `HEAD_NECK_VERSION`

## 本輪交付

| 項目 | 狀態 |
|------|------|
| 頭跟隨眼（eye lead → head cover≈62%） | ✅ |
| 加減速＋阻尼慣性（禁瞬間轉向） | ✅ |
| 微傾／聆聽細微點頭／說話頭動 | ✅ 低幅不規則 |
| 頸／頭分配＋肩部協調 | ✅ |
| 固定週期機械循環偵測 | ✅ `isFixedCycleYaw` |
| WebRTC 朋友端眼神體感驗證 | **未完成** |

## 原則

頭部動作由情境＋控制器產生，**不是**循環動畫播放。  
ENGINE-15 先更新眼球，ENGINE-16 再跟隨。

## 測試

見 `../ENGINE-15-autonomous-gaze/test-gaze-head.mjs` 與 `phase1/gaze-head-lab/`。
