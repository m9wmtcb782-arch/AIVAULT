# 十個模型驅動 Agent 的驗收

2026-11-09 在 8 GiB 上限的 Linux x86_64 工作容器上執行，推論全程在該容器內的 CPU。llama.cpp b6500 的 Ubuntu x64 發行檔 SHA-256 為 `716803084e565fe779bc2d01ea576c418be141f8fabac97509bc6d7c3cd786b2`。所有 GGUF 以發行倉庫的 LFS SHA-256 驗證，驗證值見 `ai10-summary.json`。

每輪十個獨立 run 使用相同的題目、工具選擇提示及判分規則。工具的選擇來自模型輸出。選到允許的工具後才執行，並讓模型回報工具結果。允許的工具如果選錯，仍留下結果並判定失敗。沒有合規工具選擇時，不替模型選擇，也不計為完成。

各輪 `ai10-*.jsonl` 保存每次模型生成與工具事件，`ai10-*-llama-log.txt` 保存相符的本機 llama.cpp 載入與生成日誌摘錄。每輪生成次數以執行紀錄與 llama.cpp 的 HTTP 200 紀錄交叉核對。這些紀錄適用於同權重、不同執行身分的驗收。

模型來源

- [SmolLM2 135M GGUF 固定版本](https://huggingface.co/bartowski/SmolLM2-135M-Instruct-GGUF/tree/09816acd5d99df7be770d85ea30822623dab342c)
- [Qwen2.5 0.5B GGUF 固定版本](https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/tree/9217f5db79a29953eb74d5343926648285ec7e67)
- [Qwen2.5 1.5B GGUF 固定版本](https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/tree/91cad51170dc346986eccefdc2dd33a9da36ead9)
