# AIVAULT 網路版部署步驟

目前此資料夾只在 AIVAULT GitHub 開發分支，**尚未部署到 Hugging Face**。

1. 登入 https://huggingface.co ，建立新的 **Gradio Space**，名稱可用 `aivault-ai-drawing`。
2. 若帳號符合免費 ZeroGPU 資格，在 Space Hardware 選擇 ZeroGPU；否則不要啟用任何付費 GPU。
3. 把本資料夾的 `app.py`、`requirements.txt`、`README.md` 放到 Space 根目錄。
4. 等待建置，首次生成會下載模型。請確認 SDXL Base 模型授權、存取條件與資源可用性。
5. 生成第一張動漫人物 PNG，檢查臉、手、服裝及場景。失敗不得標示完成。
6. 確認運作後，再將 Space 網址接到 AIVAULT 第一基地網頁。

注意：Hugging Face Free ZeroGPU 受帳號資格、排隊、配額與模型下載時間限制；部分模型需要同意授權或登入。沒有 Space 寫入憑證與使用者確認時，GitHub 端無法替使用者在 Hugging Face 建立或啟動 Space。不要把 HF token 寫入前端或 GitHub。
