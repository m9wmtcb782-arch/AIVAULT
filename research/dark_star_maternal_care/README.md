# Dark Star 虛擬育幼／照顧系統（Maternal Care）

**分支：** `feat/dark-star-maternal-care-v1`  
**狀態：** 研發中（虛擬模擬）  
**宣稱邊界：** 虛擬照顧動機 ≠ 真實母愛主觀經驗；不依賴血緣預設。

## 架構

```
InfantSignalEngine → MaternalNeuralEngine（多機制）
                  → CareMotivationEngine
                  → ProtectiveBehaviorEngine（偵測→…→記憶）
                  → DevelopmentalLearningEngine
                  → AttachmentMemoryEngine
                  → MaternalCareBridge（可接痛覺 DangerMemory）
```

## 實驗 A～F

| 代號 | 內容 |
|------|------|
| A | 哭泣安撫學習 |
| B | 跌倒協助 |
| C | 接近危險提前保護（可接痛覺物件記憶） |
| D | 長期記憶不因對話結束全重置 |
| E | 成長調整策略 |
| F | 非血緣長期互動建立照顧 |

## 待研發

- 視聽哭聲分類器
- 即時數字人安撫動作
- 跨代理世界模型同步
- 實證依附曲線校準

## 紀律

禁改正式頁；禁固定台詞／隨機表情／MP4；虛擬幼兒避免不必要傷害模擬；禁付費 API；禁宣稱真實母愛。
