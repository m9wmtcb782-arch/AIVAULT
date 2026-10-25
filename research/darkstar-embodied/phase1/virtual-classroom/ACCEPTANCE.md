# 虛擬教室驗收｜第二期 Shared Motor（開發中）

**頁面：** `phase1/virtual-classroom/index.html`  
**分支：** `research/darkstar-embodied-intelligence`

## 必須通過

| # | 項目 | 自動化 |
|---|------|--------|
| 1 | 坐下非瞬間 teleport（多幀 root Y／關節過渡） | `test-motor.mjs` uniqueRootY≥2 |
| 2 | 擦虛擬黑板：text 清除＋dirty=false，有前後 diff | `test-motor.mjs` stateDiff |
| 3 | 擦現實黑板：can=false，黑板狀態不變 | capability + board unchanged |
| 4 | 可選 walk stub 多幀短位移 | test-motor walk |
| 5 | 未改正式頁 | 僅 `research/darkstar-embodied/` |

## 執行

```bash
node research/darkstar-embodied/engines/ENGINE-03-motor-control/test-motor.mjs
node research/darkstar-embodied/engines/ENGINE-02-body-awareness/test-capability.mjs
```

本地預覽：倉庫根目錄 `python3 -m http.server 8765 --bind 127.0.0.1`  
→ `/research/darkstar-embodied/phase1/virtual-classroom/index.html`

## 不得宣稱

- 混合實境／WebRTC／ENGINE-11 完成  
- ENGINE-09 自主學習完成  
- 完整平衡／腳步 IK  
