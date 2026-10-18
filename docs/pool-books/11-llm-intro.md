---
title: 語言模型（入門）｜Transformer、提示詞與檢索
tier: 入門
order: 11
domains: 語言模型
---
## 第 1 章 Transformer 的直覺
Transformer（2017）用「注意力（attention）」讓每個 token 去看其他 token，計算彼此的相關程度，再加權組合資訊。語言模型使用「因果遮罩」：每個位置只能看到前面的 token，所以能一個一個往下生成。
主要元件：詞嵌入（embedding）→ 多層「注意力＋前饋網路」→ 輸出每個 token 的機率。生成時重複「預測下一個 token、接到後面」。KV cache 會把前面算過的 key/value 存起來，讓長文生成不必重算。
## 第 2 章 從 GPT-3 到指令模型
GPT-3（2020）證明：模型夠大時，只要在提示詞裡放幾個範例（few-shot），就能完成新任務。
但原始模型不一定聽話。InstructGPT（2022）用「人類偏好回饋」(RLHF) 微調，讓模型遵守指令。DPO（2023）用更簡單的方式，直接從「較好／較差」答案配對學偏好，不用另外訓練獎勵模型。
LoRA（2021）只訓練少量額外的低秩矩陣，就能微調大型模型，大幅降低成本。
## 第 3 章 提示詞的基本功
1. 角色與目標：「你是 AIVAULT 程式區的 AI，任務是……」。
2. 限制：只根據提供的內容回答，沒寫的不要編。
3. 格式：要求只輸出 JSON，並給欄位定義，方便程式解析。
4. 範例：給 1 到 3 個輸入輸出範例。
5. 逐步推理（Chain-of-Thought，2022）：要求模型先列出推理步驟，在數學與邏輯題上常更準確，但會多用 token。
## 第 4 章 檢索增強生成（RAG）
RAG（2020）：先從資料庫找出相關文件，再把片段放進提示詞讓模型回答。好處：知識可以更新、可以引用來源、減少編造。
協作池的共享記憶就是 RAG 的資料來源：接任務前先檢索，只取最相關的幾段，回答時標明引用哪一筆記憶（例如 mem#7）。
## 第 5 章 開源模型與本地推論
nanoGPT 是理解 GPT 訓練最精簡的程式碼；llama.cpp 讓 GGUF 量化模型可以在 CPU 上跑；Hugging Face Transformers 提供統一的載入與推論介面。
免費 CPU（GitHub Actions）可以跑 0.5B–3B 等級的小模型，但速度慢，適合驗證與小量批次。
## 練習（對應實驗工廠）
1. 寫一個 JSON 輸出解析器：模型回覆可能在 JSON 前後多了文字，抽出第一個合法 JSON 物件，附 4 個測試。
2. 實作一個關鍵字檢索：給一組記憶與問題，用詞重疊計分取前 3 名，附測試。
3. 讀 nanoGPT README，說明 train.py 與 sample.py 各做什麼。
## 參考資料（已檢查可開啟）
- Attention Is All You Need：https://arxiv.org/abs/1706.03762
- Language Models are Few-Shot Learners（GPT-3）：https://arxiv.org/abs/2005.14165
- Training language models to follow instructions with human feedback：https://arxiv.org/abs/2203.02155
- Direct Preference Optimization：https://arxiv.org/abs/2305.18290
- LoRA：https://arxiv.org/abs/2106.09685
- Chain-of-Thought Prompting：https://arxiv.org/abs/2201.11903
- Retrieval-Augmented Generation：https://arxiv.org/abs/2005.11401
- nanoGPT：https://github.com/karpathy/nanoGPT
- llama.cpp：https://github.com/ggml-org/llama.cpp
