---
title: 協作池基礎 1｜AI 與模型怎麼運作
tier: 基礎
order: 1
domains: 語言模型, 圖像, 影音語音
---
## 第 1 章 什麼是模型：輸入、參數、輸出
一個「模型」是一個有大量可調整數字（參數、權重）的函式：給它輸入（文字、圖片、聲音），它算出輸出（下一個字、一張圖、一段聲音）。訓練就是用大量資料，反覆調整這些參數，讓輸出越來越接近正確答案。
三個常被混淆的事：
1. 模型權重（weights）：真正的「能力」所在，例如 Llama、Qwen、Whisper 的檔案，大小從幾百 MB 到數百 GB。
2. 推論（inference）：拿已訓練好的權重去算答案。需要 CPU 或 GPU，有時間與算力成本。
3. 記憶（memory）：協作池存在資料庫裡的筆記、經驗、解法。更新記憶不等於訓練模型。
協作池守則：寫入共享記憶只能說「知識已更新」，不能說「模型已訓練」。只有真正跑過訓練流程、權重改變，才可以說訓練。
## 第 2 章 Token、上下文與成本
語言模型不是一個字一個字讀，而是讀「token」。中文一個字大約是 1 到 2 個 token，英文一個單字大約 1 個多 token。模型一次能看的 token 數叫「上下文長度（context window）」。
協作池使用的免費額度是以 token 計算的。每次呼叫模型＝輸入 token＋輸出 token。所以：
- 只把與任務相關的片段放進提示詞（retrieval），不要把整份記憶塞進去。
- 傳訊、查資料庫、執行測試不需要模型，0 token。
- 額度用完（HTTP 429）就停止，排隊等待，不要重試轟炸。
練習：估算一則 2000 字中文提示詞加 500 字回答，大約用掉多少 token？寫下估算方法。
## 第 3 章 三大類生成模型
1. 自回歸模型（autoregressive）：一次預測下一個 token。GPT 系列、Llama、Qwen 都是。核心架構是 Transformer（Vaswani 等 2017《Attention Is All You Need》）。
2. 擴散模型（diffusion）：從雜訊一步步去噪還原成圖片或影片（Ho 等 2020 DDPM；Rombach 等 2022 Latent Diffusion，即 Stable Diffusion 的基礎）。
3. 編碼器模型（encoder）：把輸入轉成向量，用於辨識、搜尋、分類，例如 CLIP 把圖片和文字放進同一個向量空間，Whisper 的編碼器處理聲音。
語音合成（TTS）、影片生成、3D 生成，多半是上面幾種的組合。
## 第 4 章 開源、授權與「自研」的界線
開源模型（例如 Llama、Qwen、Whisper、F5-TTS）可以下載權重在自己的機器跑，但每個都有授權條款，有的禁止商用、有的要求標示。使用前必須讀 LICENSE。
協作池守則：
- 呼叫外部 API（Groq、Gemini）得到的結果，不能說成「我們自研的模型」。
- 用開源模型跑出來的作品，要寫明使用的模型名稱與版本。
- 付費 API（Grok、Kling 等）未經使用者批准不得呼叫。
## 第 5 章 硬體：CPU、GPU 與為什麼我們很多事做不到
大型模型推論主要是矩陣乘法，GPU 有數千個平行運算單元，比 CPU 快很多。協作池目前沒有 GPU，所以：
- 小模型（例如 Florence-2-base、Whisper small、1.5B 參數語言模型）可以用 GitHub Actions 的 CPU 慢慢跑。
- 大型圖像、影片、3D 生成模型（例如 TripoSR、Hunyuan3D）在沒有 GPU 時標記 BLOCKED，不能偽造結果。
量化（quantization，例如 llama.cpp 的 GGUF 4-bit）可以讓模型變小、在 CPU 上變快，但會損失一點品質。
## 練習（對應實驗工廠）
1. 用 Python 寫一個函式，粗略估算一段中英混合文字的 token 數（中文字×1.5＋英文單字×1.3），並寫 3 個單元測試。
2. 讀 llama.cpp 的 README，列出它支援的 3 種量化格式，附上原文出處。
3. 判斷題：「把 100 筆學習筆記寫進共享記憶，所以模型已經變聰明了。」對或錯？說明原因。
## 參考資料（已檢查可開啟）
- Attention Is All You Need：https://arxiv.org/abs/1706.03762
- Denoising Diffusion Probabilistic Models：https://arxiv.org/abs/2006.11239
- High-Resolution Image Synthesis with Latent Diffusion Models：https://arxiv.org/abs/2112.10752
- CLIP（Learning Transferable Visual Models From Natural Language Supervision）：https://arxiv.org/abs/2103.00020
- llama.cpp：https://github.com/ggml-org/llama.cpp
- Hugging Face Transformers 文件：https://huggingface.co/docs/transformers/index
