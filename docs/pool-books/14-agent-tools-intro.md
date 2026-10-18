---
title: 程式與代理工具（入門）｜工具呼叫、ReAct 與程式代理
tier: 入門
order: 14
domains: 程式與代理
---
## 第 1 章 代理 = 模型 + 工具 + 迴圈
一個 AI 代理（agent）不只回答，而是在迴圈中：觀察 → 思考 → 選工具 → 執行 → 讀結果 → 再思考，直到完成或放棄。ReAct（2022）把「推理」與「行動」交錯寫出，讓模型邊想邊查。Toolformer（2023）讓模型學會在文字中插入 API 呼叫。
## 第 2 章 工具呼叫（function calling）
主流模型 API 都支援：你用 JSON Schema 描述工具（名稱、說明、參數），模型回傳要呼叫哪個工具與參數，程式執行後把結果送回。重點：
- 工具說明要寫清楚何時用、何時不要用。
- 參數一定要在程式端驗證，不能相信模型給的值。
- 有副作用的工具（刪除、發送、付款）要人類批准。
Model Context Protocol（MCP）是把工具標準化提供給代理的開放協定。
## 第 3 章 程式代理
SWE-bench（2023）用真實 GitHub issue 測試模型能否修 bug。SWE-agent（2024）證明「代理與電腦之間的介面設計（ACI）」很重要：簡潔的檔案瀏覽、編輯、執行測試指令，比原始 shell 效果好。OpenHands 是開源的程式代理平台。
協作池程式代理守則：每次修改後執行測試；在自己的分支或工作區修改；不直接覆寫別人的檔案。
## 第 4 章 記憶與規劃
代理需要：工作記憶（目前任務）、情節記憶（以前做過什麼、為何失敗）、語意記憶（知識、解法）。Generative Agents（2023）用「記憶流＋反思＋規劃」讓模擬角色有一致行為。協作池的五層記憶與共享記憶就是這個概念的工程化。
## 第 5 章 沙盒執行
代理寫的程式要在沙盒裡跑：限制時間、記憶體、網路、檔案存取。協作池實驗工廠在 GitHub Actions 的乾淨環境執行，卡住超過 30 分鐘自動標記失敗並回收。
## 練習（對應實驗工廠）
1. 寫一個工具註冊器：用 JSON Schema 驗證參數，未知工具或參數型別錯誤要回傳錯誤，附測試。
2. 寫一個最小 ReAct 迴圈模擬器（不用真模型）：用預先寫好的「模型回覆」序列驅動，最多 5 步，超過就停止，附測試。
3. 讀 SWE-agent README，說明 ACI 的意思。
## 參考資料（已檢查可開啟）
- ReAct：https://arxiv.org/abs/2210.03629
- Toolformer：https://arxiv.org/abs/2302.04761
- SWE-bench：https://arxiv.org/abs/2310.06770
- SWE-agent 論文：https://arxiv.org/abs/2405.15793 ／ https://github.com/SWE-agent/SWE-agent
- OpenHands：https://github.com/All-Hands-AI/OpenHands
- Generative Agents：https://arxiv.org/abs/2304.03442
- OpenAI function calling：https://platform.openai.com/docs/guides/function-calling
- Anthropic tool use：https://docs.anthropic.com/en/docs/build-with-claude/tool-use
- Model Context Protocol：https://modelcontextprotocol.io/introduction
