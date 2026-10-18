---
title: 圖像（入門）｜擴散模型與視覺理解
tier: 入門
order: 12
domains: 圖像
---
## 第 1 章 擴散模型怎麼畫圖
DDPM（2020）：訓練時把圖片逐步加雜訊，讓模型學會「預測雜訊」；生成時從純雜訊開始，一步步去噪。步數越多越慢，品質通常越好。
Latent Diffusion（2022，Stable Diffusion 的基礎）：先用 VAE 把圖片壓縮到較小的「潛在空間」，在那裡做擴散，大幅降低計算量。文字條件透過交叉注意力（cross-attention）加入。
## 第 2 章 新架構：DiT 與 Flow Matching
DiT（2022）用 Transformer 取代 U-Net 作為去噪網路，擴展性更好。Flow Matching（2022）學習從雜訊到資料的「速度場」，路徑更直，常能用更少步數生成；許多新圖像、語音模型（包括 F5-TTS）都採用它。
## 第 3 章 控制與微調
ControlNet（2023）讓擴散模型依照邊緣圖、姿勢骨架、深度圖等條件生成，構圖更可控。LoRA 可以用少量圖片微調出特定風格或角色。Hugging Face diffusers 是最常用的開源實作庫。
## 第 4 章 視覺理解：讓 AI 看懂圖片
CLIP（2021）把圖片和文字對齊到同一個向量空間，可用來做圖文搜尋與零樣本分類。LLaVA（2023，Visual Instruction Tuning）把視覺編碼器接到語言模型上，可以針對圖片問答。Florence-2（2023）是小型統一視覺模型，能做描述、偵測、OCR，可在 CPU 上跑。
協作池實測（影片學習中心）：Florence-2-base 在 CPU 上每張約 5.8 秒，但用它的描述答影片問題只答對 1/10，未達 7/10 門檻，標記 BLOCKED；OCR 有幻覺。
## 第 5 章 協作池能做與不能做
- 能做：圖像處理（縮放、裁切、格式轉換、色彩分析）、用程式畫向量圖或 Canvas 圖、小型視覺模型的 CPU 推論。
- BLOCKED：沒有 GPU 時，高解析擴散生成無法實際執行，不得以文字描述冒充生成的圖。
## 練習（對應實驗工廠）
1. 用 Python（Pillow）寫一個工具：檢查一資料夾圖片的尺寸與格式是否符合規格，輸出報告與測試。
2. 用 Canvas 或 SVG 程式繪製一個 512×512 的冰雪城市圖示，並寫測試檢查輸出尺寸。
3. 讀 diffusers README，列出 3 種 pipeline 名稱並附出處。
## 參考資料（已檢查可開啟）
- DDPM：https://arxiv.org/abs/2006.11239
- Latent Diffusion：https://arxiv.org/abs/2112.10752
- DiT：https://arxiv.org/abs/2212.09748
- Flow Matching：https://arxiv.org/abs/2210.02747
- ControlNet：https://arxiv.org/abs/2302.05543
- CLIP：https://arxiv.org/abs/2103.00020
- LLaVA：https://arxiv.org/abs/2304.08485
- Florence-2：https://arxiv.org/abs/2311.06242
- Florence-2-base 模型頁：https://huggingface.co/microsoft/Florence-2-base
- diffusers：https://github.com/huggingface/diffusers
