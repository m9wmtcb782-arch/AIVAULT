> **DEPRECATED AS SOLE GOAL（2026-10-25）：**「暗星進現實畫面」不再是唯一目標。程式保留作種子。見 `REDIRECT.md`、`DEPRECATED.md`、`docs/CHANGE-ORDER-virtual-embodied-world-2026-10-25.md`。新名稱空間：`ENGINE-01-human-pose`／`ENGINE-11`。

# ENGINE-01｜暗星即時視覺神經引擎（最小版）

**狀態：開發中（尚未宣稱完整感知閉環）**  
**版本：** `visual-engine.js` → `ENGINE01_VERSION`  
**位置：** `research/darkstar-embodied/engines/ENGINE-01-visual/`  
**原則：** 不每影格呼叫 LLM／AI Gateway；不上傳攝影機畫面；正式頁不掛載。

## 功能（本最小版）

| 事件 `type` | 來源 | 方法（啟發式規則） |
|-------------|------|-------------------|
| `face_present` / `lost_face` | Face Landmarker | 臉部 landmark 有無 |
| `smile` | Face blendshapes | `mouthSmileLeft/Right` 平均 |
| `head_turn` | Face matrix 或 landmark | yaw／鼻相對臉中心 |
| `wave` | Hand Landmarker | 舉手＋腕部 X 方向變號次數 |

輸出經 **event bus**（`event-bus.js`），可供 Phase1 示範映射或未來 ENGINE-03 消費。

## 檔案

| 檔案 | 用途 |
|------|------|
| `visual-engine.js` | 相機＋MediaPipe 主引擎 |
| `detectors.js` | 微笑／轉頭／揮手規則 |
| `event-bus.js` | 訂閱／歷史 |
| `event-schema.json` | JSON Schema |
| `mock-feed.js` | 無相機 mock＋`validateVisualEvent` |
| `map-to-intent.js` | **示範** visual→control_intent（非 ENGINE-04） |
| `demo.html` | 隔離測試頁 |
| `test-mock.mjs` | Node 單元／mock 測試 |

## 事件 JSON 範例

```json
{
  "schema": "aivault.darkstar.visual_event.v0.1",
  "id": "smile-1730000000123-ab12",
  "ts": 1730000000123,
  "stream_ts": 18402.5,
  "type": "smile",
  "confidence": 0.72,
  "source": "mediapipe_face",
  "payload": { "mouthSmileLeft": 0.7, "mouthSmileRight": 0.74, "threshold": 0.45 }
}
```

Mock 事件必須 `source: "mock"`，不得標成 mediapipe。

## 依賴

- `@mediapipe/tasks-vision@0.10.14`（CDN，與 `aivault-lip-demo.html` 同系）
- Face Landmarker + Hand Landmarker float16 `.task`（Google storage CDN）
- 瀏覽器 `getUserMedia({ video, audio: false })` — **明示授權**；本引擎不停用 mic、不錄檔、不上傳

## 本地預覽

```bash
cd /path/to/AIVAULT
python3 -m http.server 8765 --bind 127.0.0.1
```

- 相機：`http://127.0.0.1:8765/research/darkstar-embodied/engines/ENGINE-01-visual/demo.html`
- 無相機／CI：`…/demo.html?mock=1`

## 驗收

1. [x] 結構化事件含 `ts`／`confidence`／`type`／`source`
2. [x] 不每影格打 Gateway（程式路徑無 fetch 到 ai-gateway）
3. [x] Mock 模式可測（`node test-mock.mjs`）
4. [ ] **需瀏覽器＋相機實測**：真人微笑／轉頭／揮手觸發 `source=mediapipe_*` 事件
5. [x] 自動映射 UI 標明「示範映射，非自主決策」
6. [x] 僅改 `research/darkstar-embodied/`

## 已知限制

- 規則啟發式，無標註準確率；側臉、遮擋、光線差會誤判。
- 揮手依賴 Hand Landmarker；雙手交疊／出框會漏檢。
- 事件有 cooldown（預設 1.2s）避免洗版，快速連揮可能合併。
- 示範映射不是自主決策；完整閉環屬後續引擎。
- Headless 無實體相機時只能跑 mock／單元測試。

## 下一步

- ENGINE-02 聽覺（串流 VAD／STT）與 ENGINE-03 時間對齊融合。
- 可選：Pose 補強揮手；把 bus 接到 Phase1 同頁（仍標示範）。
