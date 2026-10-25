# ENGINE-03｜暗星自主神經運動控制（Shared Motor）

**狀態：開發中（第二期）**｜**Shared Body Core 成員**  
**版本：** `MOTOR_CONTROLLER_VERSION` in `motor-controller.js`  
**別名目錄：** 本路徑即 neural-motor；勿另建第二套暗星運動腦。

## 本階段能力

| 技能 | 行為 | 證據 |
|------|------|------|
| `sit_on_virtual_chair` | 髖／膝／脊柱＋root Y **多幀**安全夾限過渡 | `uniqueRootY >= 2`、timeline |
| `erase_virtual_blackboard` | 可選抬臂 tween＋黑板 `text`/`dirty` 狀態變更 | `stateDiff` |
| `walk_to` | root XZ 短位移 stub | multi-frame distance |
| `wave` | 仍由 phase1 `arm-ik.js` | 既有 |

## 檔案

- `joint-tween.js` — safety.clampAngles 多幀插值  
- `motor-controller.js` — sit／stand／walk／erase  
- `test-motor.mjs` — Node 同步驗收  

```bash
node research/darkstar-embodied/engines/ENGINE-03-motor-control/test-motor.mjs
```

## 原則

- 低階連續動作；高階決策屬 ENGINE-08  
- 經 `body-safety-layer`；不得 MP4 冒充  
- 虛擬擦除 ≠ 現實任務完成  

## 未完成

- 完整腳步 IK／平衡  
- 手指抓取板擦  
- 與 ENGINE-08 規則決策串接  
