# ENGINE-12 軟組織參數說明（開發中）

| 參數 | 意義 |
|------|------|
| volume | 相對質量／慣性，影響壓陷與回彈節奏 |
| elasticity | 拉回靜止形的彈簧常數；臉頰 > 胸 > 腹（較軟） |
| damping | 速度阻尼，抑振盪 |
| gravityBias | 靜態下垂傾向 |
| maxPenetration | 單次接觸最大壓陷深度（米） |
| contactAreaGain | 由碰撞球推得的接觸面積增益 |
| recoveryRate | 離開接觸後回彈加速 |
| lateralCoupling | 擠壓時側向擴散 |
| restCenter / halfExtents | 區域空間範圍（非整身 scale） |

接觸響應另乘：`angleFactor`（法線相對正面）、`areaFactor`（面積）、影響半徑指數衰減 → **不同角度／面積／時長產生不同形變路徑**。
