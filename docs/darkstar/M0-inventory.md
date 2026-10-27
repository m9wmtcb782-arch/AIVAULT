# M0｜第一基地暗星神經物理系統盤點（初版）

狀態：**IN PROGRESS / REQUIRES TEST**
基地：BASE-1
來源：GitHub 預設分支直接讀取，未假設其他基地資源。

## 已確認入口
- `aivault-guide.html`：舞台使用 `digital-human-real/guide/guide_idle.jpg` 背景、影片層、嘴部層、字幕與導讀控制。這是影片式數字人顯示，**不等於可控制 3D rig**。
- `aivault-home.html`：以 iframe 載入 `aivault-home-original-dark.html`，有首頁導航及認證相關邏輯。
- `index.html`：系統初始化入口。

## 已確認存在的獨立模組
- `modules/darkstar-somatic-safety.js`：16 個命名關節控制欄位的示意角度安全檢查，非 360 解剖關節。
- `modules/darkstar-coordinated-reflex.js`：反射群組與計畫，未解出物理動作。
- `modules/darkstar-anatomical-registry.js`：部分關節紀錄；已修正 C7-C8 為 C7-T1，尚未完整校驗。
- `modules/darkstar-musculoskeletal.js`：示意肌肉／肌腱／韌帶力學。
- `modules/darkstar-balance-recovery.js`：COM、XCoM、支撐多邊形；**不是**剛體動力學求解器。
- `modules/darkstar-avatar-somatic-adapter.js`：安全介面，未連接正式 3D rig。
- `modules/darkstar-coupled-axis.js`：多軸耦合資料檢查，缺經驗證的解剖參數。

## 本輪新增
- `modules/package.json`：只在 modules 子目錄啟用 Node ESM，避免改動整個網站。
- `.github/workflows/darkstar-somatic-tests.yml`：Node 22 自動測試。
- 現有測試檔：`tests/darkstar-somatic-integration.test.mjs`。

## 已知阻塞
- **BLOCKED_NO_CONFIRMED_RIG**：尚無證據表明正式暗星導讀影片有可操縱骨架；必須另行搜尋倉庫資產與建立隔離 rig。
- **BLOCKED_UNCALIBRATED_ANATOMY**：關節、肌肉、韌帶未有完整可追溯校準資料。
- **BLOCKED_NO_DYNAMICS_SOLVER**：缺完整剛體、接觸與摩擦求解器。
- **REQUIRES TEST**：CI 已提交，但尚未取得工作流程實際通過的證據。

## 保護與回滾
- 未改動 `aivault-guide.html`、`aivault-home.html`、`index.html`、現有角色、影片、觸控或語音。
- 只增加 `modules/package.json`、CI workflow 與本文件。
- 每個 GitHub commit 可獨立回滾，先確認沒有其他並行修改。

## 下一步
1. 檢查 CI 執行結果；若失敗，修復程式與測試。
2. 完成資產與 3D rig 全倉盤點（含模型格式與骨骼資料）。
3. 實作隔離測試 rig 與物理引擎，不碰正式導讀人物。
4. 依 Issue #43 的 M1–M7 順序推進，逐階段留下可重現驗收證據。
