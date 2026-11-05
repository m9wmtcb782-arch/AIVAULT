# P1 — 專案／分鏡／角色／場景 schema 與時間軸預覽

- Issue：#57
- 分支：`feat/comic-engine-v1`
- 狀態：REQUIRES TEST（結構已落地；瀏覽器預覽與正式素材待驗）

## 交付
| 路徑 | 說明 |
|---|---|
| `schema/project.schema.json` | 專案根 schema（1080×1920／30fps／60s、兩角三角、付費 API 強制 false） |
| `schema/character.schema.json` | 角色與分層素材 |
| `schema/scene.schema.json` | 場景與道具 |
| `schema/shot.schema.json` | 時間軸鏡頭（鏡頭、演員、對白、音效） |
| `projects/_example/project.json` | 示例專案（無真實貼圖／無 MP4） |
| `director/validate_project.mjs` | 一致性檢查（角色／場景引用、時長、付費開關） |
| `ui/timeline-preview.html` | 隔離時間軸預覽（本機開檔；非正式 Pages） |

## 驗證
```bash
node comic-engine/director/validate_project.mjs comic-engine/projects/_example/project.json
```

## 與 Draft PR #58
`feature/comic-studio-v01`（PR #58）另有 `comic-studio/` 與 `aivault-comic-studio.html`。本 P1 刻意只寫在 `comic-engine/`，不合併、不改正式頁。後續是否收斂兩條線，等開創者決定。

## 未做（仍 BLOCKED／未開始）
- P2：本機 Godot＋FFmpeg 輸出可播 MP4（需指定工作節點）
- P3：雙設備影格分發（需兩台實機）
- 真實角色／場景素材與配音檔
