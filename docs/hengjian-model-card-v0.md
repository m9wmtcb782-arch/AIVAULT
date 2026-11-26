# 衡鑒 AI 模型卡 v1（Prototype）

**模型名稱：** HENGJIAN-PROTOTYPE-v1  
**版本：** 0.2.0-browser  
**日期：** 2026-11-27  
**狀態：** 原型（未微調、未經專業評測）  
**屬於：** AIVAULT 第一基地 · 第二階段可執行原型

## 基底模型
- **候選：** Qwen2.5-1.5B-Instruct-q4f16_1-MLC（WebLLM 預建）
- **參數：** ~1.5B
- **量化：** 4-bit
- **授權：** Apache 2.0（基底）
- **運行環境：** 瀏覽器 WebGPU（@mlc-ai/web-llm CDN），權重本地下載後離線可用

## 硬體需求（估計）
- VRAM / 統一記憶體：~1.5–2 GB
- 瀏覽器：Chrome / Edge 支援 WebGPU
- 首次下載：~800MB–1.1GB

## 能力範圍（原型 v1）
- 接收沙盒規則引擎結果 + 參數
- 內嵌合成知識庫關鍵字檢索（稅捐稽徵法、所得稅法、營業稅法、納稅者權利保護法、預算法、審計法、行政程序法 示範條文）
- 輸出：風險摘要、可能法規參考、不確定事項、改善建議框架
- 自動簡易評測日誌（localStorage）：記錄 Simulation ID、model_version、sources、eval score
- **明確限制：** 未經財稅專業微調，輸出不得冒充專業審計結論。必須人工覆核。

## 輸入 / 輸出規範（簡）
**輸入：**
```json
{
  "simulationId": "SIM-...",
  "params": { "year": 2027, "rev": -15, "err": 12 },
  "alerts": ["..."],
  "impact": { "taxImpact": -8 }
}
```
**輸出：**
- 風險分析摘要
- 可能法律依據（標註為參考，非權威）
- 不確定事項
- 改善建議框架
- model_version: "HENGJIAN-PROTOTYPE-v1"
- kb_hits 清單

## 安全與限制
- 資料不離開瀏覽器
- 無外部 API 呼叫
- 失敗時回退至規則引擎並標註 BLOCKED / FALLBACK
- 禁止使用於正式決策

## 下一步
- 擴大合成知識庫與檢索
- 建立評測基準集
- 整合進沙盒流程（仍保留人工覆核）

**不得宣稱已達專業審計標準或政府採用。**
