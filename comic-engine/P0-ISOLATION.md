# AIVAULT AI 漫劇製作引擎 V1.0 — P0 隔離與盤點

- 基地：BASE-1（m9wmtcb782-arch/AIVAULT）
- Issue：#57
- 分支：`feat/comic-engine-v1`（自 main `2c5cb8535b6b9ac2c836fa8a940a2f14372d614a` 分出）
- 回滾：刪除本分支即可；main 未被修改。

## 隔離規則
1. 所有新檔只放在 `comic-engine/` 目錄。
2. 不修改首頁、電子書、數字人（暗星／曙光）、協作池、AI Gateway、Cognitive Engine、Governance Engine 既有檔案。
3. 付費 API 開關預設 OFF（`paid_api_enabled=false`）。
4. GitHub Pages 只放前端（時間軸 UI、預覽）；渲染在本地工作節點執行。

## 規劃目錄
```
comic-engine/
  schema/        專案／分鏡／角色／場景 JSON schema（P1）
  director/      劇本與一致性檢查（P1）
  ui/            時間軸與預覽（P1，前端）
  worker/        Godot 2D 分層動畫 + FFmpeg 合成（P2，本地節點）
  scheduler/     設備能力探測與影格分發（P3）
  projects/      每個漫劇的獨立資料夾與輸出紀錄
```

## 狀態
| 階段 | 狀態 | 說明 |
|---|---|---|
| P0 隔離分支與目錄 | CONFIRMED | 本檔 |
| P0 既有系統盤點 | REQUIRES TEST | 需逐一確認 AI Gateway／Cognitive／Governance 實際檔案與介面 |
| P1 schema／時間軸／素材庫 | REQUIRES TEST | 見 P1-SCHEMA.md；示例＋驗證器＋隔離預覽 |
| P2 本機 60 秒 MP4 | BLOCKED | 需本地工作節點（安裝 Godot 4 與 FFmpeg）實際執行 |
| P3 雙設備分發 | BLOCKED | 需兩台實機實測吞吐、傳輸、熱降頻 |
| P4 暗星／曙光接入 | 未開始 | 需人工審核 |

未驗收前不宣稱已完成部署。
