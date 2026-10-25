# 暗星自主控制通訊協定（草稿 v0.1）

對齊施工令示例。實際 intent **必須**由感知＋決策引擎產生，禁止固定輸出同指令冒充自主。

## 訊息形狀

```json
{
  "agent": "dark-star",
  "schema": "aivault.darkstar.control_intent.v0.1",
  "id": "uuid-or-monotonic",
  "ts": 1730000000123,
  "intent": "greet_person",
  "target": "camera_user",
  "confidence": 0.82,
  "priority": 50,
  "motion": {
    "gaze": "target_face",
    "head": "turn_toward_target",
    "right_arm": "wave",
    "expression": "smile",
    "legs": "idle_stand",
    "blend_ms": 280
  },
  "speech": {
    "text": "你好，很高興見到你。",
    "enabled": true,
    "interruptible": true
  },
  "source": {
    "visual_event_ids": [],
    "audio_event_ids": [],
    "decision": "rule|policy|llm_sparse"
  }
}
```

## 執行回饋（ENGINE-08 → ENGINE-04）

```json
{
  "agent": "dark-star",
  "schema": "aivault.darkstar.motion_feedback.v0.1",
  "intent_id": "…",
  "ts": 1730000000450,
  "status": "completed|blocked|interrupted|partial",
  "joints": { "neck": { "x": 0.1, "y": 0.2, "z": 0 }, "…": "…" },
  "safety": { "pain": 0, "blocked": [], "warnings": [] },
  "fps": 48.2,
  "notes": ""
}
```

## 驗證規則（低階控制器）

1. 未知 `intent`／非法關節名 → reject，回 `blocked`。  
2. 超出 `body-safety-layer` soft／hard → clamp 或阻擋。  
3. 同優先級衝突：高 priority 可中斷；同級 FIFO。  
4. `speech.enabled` 時必須能 barge-in（對接既有 Live Client interrupted）。
