---
title: 語言模型（專業）｜訓練、微調、量化與評估
tier: 專業
order: 21
domains: 語言模型
---
## 第 1 章 預訓練到對齊的完整管線
1. 預訓練：大量文字上做「預測下一個 token」，得到基礎模型。
2. 監督式微調（SFT）：用「指令→理想回答」配對教模型遵守指令。
3. 偏好對齊：RLHF（InstructGPT）先訓練獎勵模型再用強化學習；DPO 直接用偏好配對最佳化，實作更簡單。Hugging Face TRL 提供 SFTTrainer、DPOTrainer。
協作池守則：上述任何一步都會改變權重，只有實際執行並保存新權重與評估結果，才可以說「模型訓練完成」。
## 第 2 章 參數高效微調
LoRA：凍結原始權重，只學兩個小矩陣 A、B，使 W' = W + BA。秩 r 常設 8–64。優點：可訓練參數少、可以疊加多個 LoRA。即使如此，7B 模型訓練通常仍需要 GPU；CPU 上只適合極小模型（如 nanoGPT 的字元級 Shakespeare 範例）做流程驗證。
## 第 3 章 量化與推論效能
量化把 16 位元浮點權重轉成 8、5、4 位元整數。llama.cpp 的 GGUF 格式支援多種量化等級；通常 4-bit 在品質與速度間取得平衡。推論效能指標：首 token 延遲（TTFT）、每秒 token 數、記憶體占用。報告時要寫硬體、量化等級、上下文長度。
## 第 4 章 評估
- 有標準答案的任務：精確比對、單元測試通過率（程式）、數學答案比對。
- 開放式任務：人工評分或用另一個模型評分，但要注意評審偏差。
- 污染：測試題不能出現在訓練或提示範例中；協作池考試的題目與隱藏測試不得提前給應試者。
- 統計：題數太少（例如 10 題）結論不穩，回報要寫題數與信賴程度。
## 第 5 章 推理與代理能力
Chain-of-Thought 提升多步推理；ReAct 結合工具。評估代理要看「任務完成率」而不是輸出字數。SWE-bench 以真實 repo 測試是否修好 issue。
## 練習（對應實驗工廠）
1. 在 CPU 上用 nanoGPT 跑字元級 Shakespeare 訓練 200 步，記錄 loss 曲線與耗時（只作流程驗證，標明規模）。
2. 寫一個評估腳本：讀 JSONL（question, answer, prediction），算精確率，附測試。
3. 比較同一模型兩種量化等級的檔案大小（從 README 或模型卡讀取），附來源。
## 參考資料（已檢查可開啟）
- InstructGPT：https://arxiv.org/abs/2203.02155
- DPO：https://arxiv.org/abs/2305.18290
- LoRA：https://arxiv.org/abs/2106.09685
- TRL：https://github.com/huggingface/trl
- nanoGPT：https://github.com/karpathy/nanoGPT
- llama.cpp：https://github.com/ggml-org/llama.cpp
- Chain-of-Thought：https://arxiv.org/abs/2201.11903
- SWE-bench：https://arxiv.org/abs/2310.06770
