# 第一階段最小依賴

## 必備（瀏覽器，優先本地 vendor）

- **Three.js** `>=0.160`（倉庫已有 `vendor/three/three.module.js`；Body Lab 曾用 CDN `0.180.0`）
- **GLTFLoader** + **OrbitControls** + **MeshoptDecoder**（`vendor/three/examples/jsm/` 或 CDN）
- **資產：** `../../assets/dark-star/technical-dark-star-avatar.glb`
- **安全層：** `../../assets/dark-star/body-safety-layer.js`（ES module）

## 第二階段起（勿在 Phase1 強綁）

- `@mediapipe/tasks-vision` FaceLandmarker／Pose／Hands（參考 `aivault-lip-demo.html`）
- `onnxruntime-web`（參考 `aivault-onnx-runtime-check.html`、`models/eot/`）
- Live Voice WSS（`technical-dark-star-live-voice-v2`）— ENGINE-07

## 刻意不做（Phase1）

- VRM（無現成資產；後續可評估）
- 付費 Avatar API（HeyGen／D-ID／Magic Hour）
- 修改正式暗星／數字人 HTML


## Phase1 實測備註（2026-10-25）

本機 `vendor/three/three.module.js` 會再 import 不存在的 `three.core.js`，Phase1 測試頁改用 CDN `three@0.180.0`（與 Body Brain Lab 一致）。GLB／safety 仍走倉庫相對路徑。
