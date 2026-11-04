# Issue #43 · M0 盤點報告（BASE-1）

- 基地：BASE-1（m9wmtcb782-arch/AIVAULT），未觸碰第二基地
- 基線 SHA（main / 分支起點）：`83951e3fb9cf0dce1d5617aaf891c35b7a77bc2e`
- 日期：2026-10-31（Asia/Taipei）
- 未修改：`aivault-guide.html`、`aivault-home.html`、首頁導航、語音、暗星外觀／影片
- 未使用任何付費 API

## 1. 3D rig 狀態

| 項目 | 結果 | 標記 |
|---|---|---|
| `aivault-guide.html` 正式暗星 | `<video id=v0/v1/pip>` 雙緩衝影片＋poster `digital-human-real/guide/guide_idle.jpg`＋嘴部顯示層；匯入 `darkstar-voice-motion-bridge.js`、`darkstar-silent-motion-director.js`、`darkstar-real-video-selector.js`，全部只做「選片段」，無骨架 | CONFIRMED：非 rig 驅動，影片無法被骨骼求解器驅動 |
| 正式暗星可控 rig | 無 | **BLOCKED_NO_RIG（正式人物）** |
| `assets/dark-star/technical-dark-star-avatar.glb` | 2.47 MB，glTF-Transform 3.8.0，8 個 skinned mesh，每個 skin 114 joints（Mixamo/RPM 式命名），0 動畫；由 `.github/workflows/cache-dark-star-avatar.yml` 從 `c-frame/valid-avatars-glb@c539a28 avatars/Asian/Asian_F_2_Casual.glb` 下載 | CONFIRMED 存在；**授權 REQUIRES TEST**（未在倉庫內附 LICENSE）；它**不是**正式暗星 |
| 使用此 GLB 的頁面 | 僅 `technical-dark-star-morph-mapping-test.html`（實驗頁；Three.js 0.180 from jsDelivr CDN，GLTFLoader＋MeshoptDecoder＋`assets/dark-star/body-safety-layer.js`） | CONFIRMED |

技術 GLB 骨骼清單（每 skin 一致，114 個，含 `_end` 葉節點）：
`Hips, Spine, Spine1, Spine2, Neck, Head, HeadEnd(+3 end), LeftEye/RightEye(+3 end), {L,R}Shoulder, Arm, ForeArm, Hand, FingerBase, Hand{Thumb,Index,Middle,Ring,Pinky}1–4(+3 end), {L,R}UpLeg, Leg, Foot, ToeBase, ToeEnd(+3 end)`。
實質可動骨：約 2×(肩/上臂/前臂/手/指基 + 5指×3) + 2×(大腿/小腿/足/趾) + 脊柱 3 + 頸/頭 + 眼 2 ≈ 59；無鎖骨分離、無個別椎節、無肋骨、無足部細骨。注意：實驗頁標示「912 關節」= 8 skin × 114 的重複計數，**不是**解剖關節數。

### 隔離測試 rig 方案（不改暗星）
1. 新建 `research/darkstar-embodied/test-rig/`＋獨立頁 `darkstar-physics-lab.html`（不加入導航）。
2. 候選 rig：(a) 現有 technical GLB——先確認 c-frame/valid-avatars-glb 上游授權；(b) 若授權不明，改用明確 CC0 / MIT 的人形 rig（例：Three.js 範例 Xbot/Soldier 需確認授權、Quaternius CC0 角色）。
3. 物理引擎候選（M5 選型）：Rapier（Apache-2.0, WASM）、cannon-es（MIT）。新增依賴前須開創者批准。
4. feature flag 預設 OFF；正式頁不 import。

## 2. 其他相關入口
- 模組（`modules/`）：darkstar-anatomical-registry / avatar-somatic-adapter / balance-recovery / coordinated-reflex / coupled-axis / forward-kinematics / greeting-100-catalog / joint-motion-atlas / motion-memory / musculoskeletal / neuromuscular / physics/world.js / real-video-selector / reference-skeleton / rig-audit / rig-binding / silent-motion-director / somatic-safety / tissue-calibration / voice-motion-bridge
- `research/darkstar-embodied/physiology-core/`（consent-context, dynamics, evidence-tiers, state-vector, test）
- `assets/dark-star/body-safety-layer.js`
- `vendor/three/`（three.module.js、GLTFLoader、BufferGeometryUtils）；`.github/workflows/cache-threejs.yml`
- 其他 GLB：`assets/town/kenney/**`（小鎮場景與 mini 角色，與暗星無關）
- 未發現 FBX / BVH / VRM、Babylon、cannon、ammo、rapier
- CI：`.github/workflows/darkstar-somatic-tests.yml`、`agent-runtime-tests.yml`；無 package.json（Node 直接跑 `.mjs`/ESM `.js`，不需額外設定）

## 3. 模組契約檢查
| 模組 | 導出 | 備註 |
|---|---|---|
| somatic-safety | `JOINT_LIMITS, evaluateJoint, protectPose` | JOINT_LIMITS 為示意值，未附來源 → REQUIRES TEST（M2） |
| coordinated-reflex | `coordinateReflex, validateSkeletonCoverage` | 輸出需再經求解器（M4） |
| anatomical-registry | `ANATOMICAL_JOINTS, TARGET_RECORD_COUNT=360, COVERAGE, jointById, jointAudit` | 見 §4 |
| musculoskeletal | `muscleForce, tendonForce, ligamentForce, jointTorque, somaticRisk` | 示意公式，非 Hill 校準（M3） |
| balance-recovery | `centerOfMass, assessBalance` | 只是 COM/支撐估計，**不是**物理引擎 |
| avatar-somatic-adapter | `createSomaticAvatarAdapter` | fail-closed 檢查：rig 未驗證→throw；未 enable→DISABLED；反射→BLOCKED_REFLEX；缺 segments/velocity/contacts→BLOCKED；不穩→BLOCKED；無 validateDynamics→BLOCKED_NO_DYNAMICS_SOLVER；approved!==true→BLOCKED。CONFIRMED fail-closed。**但 `validateDynamics` 回傳 `approved=true` 只是介面約定，不是物理正確性證據**；目前無受信任求解器實作 → REQUIRES TEST（M5） |
| coupled-axis | `validateEnvelope, evaluateCoupledPose` | 尚無已驗證包絡資料（M2） |

## 4. 解剖登錄缺陷（已修／未修）
已修（本 PR，`modules/darkstar-anatomical-registry.js` v0.2）：
1. **缺 T12–L1 胸腰交界節段**（原 T1–T12 只到 T11-T12，腰椎從 L1-L2 起）→ 已補。
2. **上肢全部設為 3 軸** → 依關節類型更正：胸鎖鞍狀3、肩鎖平面滑動、盂肱球窩3、肱尺鉸鏈1、肱橈2、近/遠橈尺樞軸1、橈腕髁狀2、腕中2。
3. **下肢全部設為 3 軸** → 更正：薦髂平面（nutation）、髖球窩3、脛股改良鉸鏈2、髕股滑動、近脛腓滑動、遠脛腓韌帶聯合（纖維、0 軸）、距小腿鉸鏈1、距下內外翻1、距舟/跟骰滑動。
4. C7–T1：CONFIRMED 存在、無虛構 C7-C8。

尚未修（列入 M1，不在 M0 湊數）：
- ID 依插入順序產生（`DSJ-001…`），補 T12-L1 後其後 ID 位移 → M1 需改為語意化 stable ID。
- 缺：腕間關節、跗間其他關節、肋 11–12 無肋橫突關節（正確）但缺胸骨柄體、劍胸、肋間軟骨關節、鉤椎關節、小面關節左右分列、指骨間側別細節等。
- `frontal suture`（額縫）成人多已癒合，需註明族群。
- 薦髂歸在 `lower-limb`，應歸 `pelvis`。
- 所有 ROM 為 null、`motorEnabled=false`（正確：無資料禁致動）。

現況：204 筆紀錄、296 個控制軸、9 筆 0 軸（固定/纖維）；目標 360 尚差 156，**不得以假節點補足**。

## 5. 測試
命令：`node --test tests/darkstar-*.test.mjs`（Node v20.19.2）
- 修改前基線：tests 78 / pass 78 / fail 0
- 修改後：tests 82 / pass 82 / fail 0（新增 4 個 M0 回歸測試：T12-L1、非全 3 軸、纖維關節 0 軸無馬達、motorReady=0）
- `node research/darkstar-embodied/physiology-core/test-physiology-core.mjs`：31 passed, 0 failed
- CI 修正：`darkstar-somatic-tests.yml` 原未執行 `darkstar-silent-motion-director.test.mjs`，已加入。

## 6. 360 計數口徑提案
分三本帳，**分開統計、不可相加充數**：
1. **解剖關節紀錄**（anatomical joint records）：每個左右側分列的實際關節/節段；固定縫合、韌帶聯合、軟骨結合計入但標 `static`，**不配置馬達**。
2. **控制自由度**（control DOF）：只計可動關節的獨立運動軸；每軸須有來源 ROM 且 verified 才可啟用。
3. **rig 骨骼**（rig bones）：3D 模型實際骨骼；`_end` 葉節點、重複 skin 不計。三者用映射表連結。
若嚴謹計數無法達 360，報實數並逐筆列缺額來源。

## 7. 風險與回滾
| 風險 | 影響 | 緩解 | 回滾 |
|---|---|---|---|
| 登錄 ID 位移 | 若外部引用 DSJ-ID 會錯位（目前 grep 無外部引用） | M1 改 stable ID | `git revert <本 PR commit>` |
| technical GLB 授權不明 | 不可公開用作正式人物 | 確認上游 LICENSE 或換 CC0 rig | 不接入正式頁即無影響 |
| validateDynamics 被誤當證據 | 假物理 | 文件與 adapter 註解明示；M5 受信任求解器 | adapter 維持 fail-closed |
| 正式頁 | 本 PR 未動 | — | 基線 `83951e3` |

## 8. 下一步（M1）
語意化 stable ID＋JSON schema；骨骼階層（含鎖骨/肩胛分離、足骨）；technical GLB → anatomy 映射器與覆蓋率報告（只做報告不自動啟用）；授權確認。
