# ENGINE-15｜Autonomous Gaze & Eye Contact（自主視線）

**狀態：開發中**｜掛在 **Shared Body Core**（同一 GLB，非第二套假人物）  
**版本：** `GAZE_ENGINE_VERSION`  
**對話狀態：** `shared/conversation-target-tracking.js`

## 本輪交付

| 項目 | 狀態 |
|------|------|
| 對話對象追蹤（speaker／listener／answerTarget） | ✅ |
| 使用者眼睛／虛擬鏡頭／朋友影像目標 | ✅ |
| 雙眼協調＋微 saccade＋不規則眨眼 | ✅ |
| 凝視過久短暫移開（anti-stare） | ✅ |
| `reportToDecision()` 回傳決策系統 | ✅ |
| 對朋友說話 → **virtual_camera**（非螢幕朋友影像） | ✅ 校準規則 |
| WebRTC 三畫面遠端眼神驗證（Test B） | **未完成** |
| 真人臉／眼 MediaPipe 追蹤 | stub（lab 用 mock 滑桿） |

## 視線校準

- 回答**使用者** → `user_eyes`
- 回答**遠端朋友** → `virtual_camera`（合成視訊輸出對應的虛擬攝影機）
- 聆聽朋友且朋友畫面在場景中 → 可 `friend_display`
- 實體手機鏡頭／螢幕位置 ≠ 虛擬鏡頭；禁止對朋友說話時看錯螢幕座標

## 本地預覽

```bash
python3 -m http.server 8765 --bind 127.0.0.1
# http://127.0.0.1:8765/research/darkstar-embodied/phase1/gaze-head-lab/index.html
node research/darkstar-embodied/engines/ENGINE-15-autonomous-gaze/test-gaze-head.mjs
```

## 接入

ENGINE-08 決策 · ENGINE-01 姿態 · ENGINE-03 骨骼 · 表情 morph · 三畫面（ENGINE-11）· ENGINE-02 身體自我認知 · **ENGINE-16** 頭跟隨眼

## 禁止

- 永遠盯鏡頭／固定循環眨眼或搖頭冒充自然互動  
- 預錄 MP4 當眼神驗收  
- 另建只會動眼睛的獨立假人物  
- 掛載正式暗星頁  
