# Phase 1 驗收｜可控制骨骼數字人測試頁

**頁面：** `research/darkstar-embodied/phase1/index.html`  
**狀態標示：** 開發中（GLB 骨骼＋手臂 IK 揮手已接 control_intent；**非**自主決策閉環）

## 本地預覽

在 AIVAULT 倉庫根目錄：

```bash
cd /path/to/AIVAULT
python3 -m http.server 8765 --bind 127.0.0.1
```

瀏覽器開啟：

`http://127.0.0.1:8765/research/darkstar-embodied/phase1/index.html`

（ES module＋相對路徑載入 GLB／safety，需 HTTP，不可 `file://`。）

## 必須通過

| # | 項目 | 狀態 |
|---|------|------|
| 1 | 非 MP4 唯一呈現（GLB） | ✅ 程式路徑完成；待瀏覽器目視 |
| 2 | 關節控制（頭／表情） | ✅ 按鈕可送 intent |
| 3 | 表情 morph（blink／smile／mouth） | ✅ |
| 4 | **`right_arm: "wave"` 驅動真實關節**（非 stub／非僅 console） | ✅ `arm-ik.js` 本地抬臂＋前臂振盪；Playwright 證實 quat 變化（見 docs）｜人工目視仍建議 |
| 5 | 安全層 clamp／block 顯示於 UI | ✅ Safety 卡片＋`#safeDetail` |
| 6 | 回饋 JSON（log 面板） | ✅ |
| 7 | FPS 實測面板 | ✅ Playwright 讀到 `#fpsVal`=60（本機實測，非捏造） |
| 8 | 隔離：未改正式 HTML | ✅ |

## wave 驗收勾選

- [x] `wave` 宏不再回傳 `stub: true`／`wave_macro_stub_phase1`
- [x] 執行路徑：`inspectArms` → `twoBoneIk(wave_ready)` → 前臂振盪（真實 quaternion）
- [x] 經 `DarkStarBodySafety.evaluateAngles` 軟拒絕不安全影格
- [x] **瀏覽器自動化實測（Playwright）**：右臂關節 quaternion 改變、wristY Δ≈0.16、82 frames、FPS UI=60；證據 `docs/phase1-wave-test-2026-10-25.json`（仍建議人工目視一次）
- [ ] 若 safety 中斷：回饋 `status: "partial"`，UI 顯示阻擋——標明 **partial**，不宣稱完美

## 尚不要求（開發中）

- 攝影機感知後自主揮手（ENGINE-01→04）
- 神經運動學習完成
- 正式 Pages 掛載

## 種子來源

- `technical-dark-star-morph-mapping-test.html`（手臂鏈辨識、two-bone IK、左右彎曲平面）
- `assets/dark-star/body-safety-layer.js`

## 檔案

- `phase1/arm-ik.js` — IK＋wave
- `phase1/joint-controller.js` — control_intent 執行（async）
- `phase1/index.html` — 測試 UI


## 實測備註（2026-10-25）

- 手臂左右：以骨名 `Left*`／`Right*` 優先（幾何 x 符號在此 GLB 會反）。
- `RightHand` 在 safety layer 被歸成 finger，靜止即 blocked → 揮手安全檢查只看 upper+fore。
- 揮手抬臂以 **local kinematic（limits 內）為主**；world IK `wave_ready` 常超過 shoulder soft limit，僅作備援。
- **非自主決策**：按鈕／demo greet intent 才觸發。
