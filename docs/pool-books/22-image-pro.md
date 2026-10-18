---
title: 圖像（專業）｜影片與 3D 生成、視覺模型實作
tier: 專業
order: 22
domains: 圖像, 3D 遊戲
---
## 第 1 章 從圖像到影片擴散
影片生成在圖像擴散上加入時間維度：時空注意力、3D VAE 壓縮影格序列。CogVideoX（2024）使用 3D VAE 與「專家 Transformer」處理文字與影片 token。主要難題是時序一致性（物體不閃爍、不變形）與算力需求，協作池目前無 GPU，影片生成為 BLOCKED。
## 第 2 章 3D 表示法
- 網格（mesh）：頂點＋面，遊戲與 glTF 使用。
- NeRF（2020）：用神經網路表示體積密度與顏色，從多視角照片重建，可算出新視角。
- 3D Gaussian Splatting（2023）：用大量 3D 高斯點表示場景，可即時渲染。
- 單圖轉網格：TripoSR（2024）用 Transformer 從一張圖快速重建 3D。以上都需要 GPU 訓練或推論。
## 第 3 章 視覺語言模型實作
LLaVA 架構：視覺編碼器（CLIP ViT）→ 投影層 → 語言模型。Florence-2 用序列到序列方式統一多種視覺任務，以任務提示（如 <CAPTION>、<OCR>）切換。
協作池影片學習驗收（Big Buck Bunny 前 120 秒、10 題）：只聽字幕 0/10；Florence-2＋Qwen2.5-1.5B 1/10；Gemini 免費版抽查 9/10。改進方向：讓 VLM 直接看影格回答、在場景切換附近加密取樣、去掉有幻覺的 OCR。
## 第 4 章 場景切換偵測（已驗證作品）
ffmpeg 的 scdet／select='gt(scene,0.3)' 濾鏡可依影格差異偵測切換。協作池作品 lab_video/scene_detector.py 經不同 AI 獨立重跑：18 個真實切換點全部抓到（recall 1.0），多抓 3 個（precision 0.857），通過。
## 第 5 章 評估生成品質
圖像：FID、CLIP score、人工評分。3D：glTF 驗證、多角度渲染檢查、面數與材質。影片：時序一致性與文字對齊。任何分數都要附計算方法與樣本數。
## 練習（對應實驗工廠）
1. 用 ffmpeg 擷取一段授權短片的場景切換時間碼，與人工標註比對算 precision／recall。
2. 寫一個 glTF JSON 檢查器：確認 asset.version 為 "2.0"、每個 mesh 的 accessor 索引存在，附測試。
3. 閱讀 3D Gaussian Splatting 論文摘要，用 300 字說明它比 NeRF 快的原因，附出處。
## 參考資料（已檢查可開啟）
- CogVideoX：https://arxiv.org/abs/2408.06072
- NeRF：https://arxiv.org/abs/2003.08934
- 3D Gaussian Splatting：https://arxiv.org/abs/2308.04079 ／ https://github.com/graphdeco-inria/gaussian-splatting
- TripoSR：https://arxiv.org/abs/2403.02151 ／ https://github.com/VAST-AI-Research/TripoSR
- LLaVA：https://arxiv.org/abs/2304.08485
- Florence-2：https://arxiv.org/abs/2311.06242
- ffmpeg 濾鏡（scdet、select）：https://ffmpeg.org/ffmpeg-filters.html
- Big Buck Bunny（CC 授權短片）：https://peach.blender.org/
- glTF-Validator：https://github.com/KhronosGroup/glTF-Validator
