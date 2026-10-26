# 公開同源教材學習（Public Material Learn）

> **不是** TronClass 帳密同步。學校授權未確認前，私有課件仍 BLOCKED。  
> 本套件：課名／檔名／`name=` → 公開 allowlist 比對 → 抓取 → provenance=`public_source` → 暗星 learnNotify stub。

詳見：[`../../research/dark_star_public_learn/DESIGN.md`](../../research/dark_star_public_learn/DESIGN.md)

## 開發

```bash
cd connectors/public-material-learn
npm install
npm test
```

## 餵清單

見 `fixtures/sample-material-list.json`，呼叫 `PublicLearnPipeline.runList(...)`。

## 相關

- TronClass connector（並行／替代說明）：`docs/RELATION_TO_TRONCLASS.md`
- 分類佇列契約：`docs/public-learn-iface.md`
- Issues：#36（雙層分類）、#38（TronClass 缺口；本管線為公開學習並行路徑）
