# 部署到網路上的 AI 繪圖引擎

本專案已備妥 GitHub Actions 手動部署流程：`.github/workflows/deploy-aivault-drawing-space.yml`。

## 一次性設定
1. 在 Hugging Face 建立一個 **Gradio Space**。選擇 ZeroGPU 前先確認帳號資格；不要開通付費硬體。
2. 在 Hugging Face 建立**細粒度** Access Token，只授權該 Space 的寫入權限。
3. 在 GitHub AIVAULT repository Settings → Secrets and variables → Actions，新增 `HF_TOKEN`，只填在 Secret 裡，絕對不要貼在聊天或程式碼。
4. 將工作流程經過檢查後合併到第一基地預設分支（GitHub Actions 手動工作流程通常需要在預設分支存在才會出現在 Actions 頁面）。
5. 在 Actions 選 **Deploy AIVAULT Drawing Space** → Run workflow，輸入已建立的 `owner/space-name` 和審核過的 source_ref。
6. 上傳後開啟 Space 頁面，等待建置及模型載入，實際生成一張人物 PNG 才算通過驗收。

## 安全限制
- 不自動建立 Space、不更換付費硬體、不自動執行部署。
- `HF_TOKEN` 只從 GitHub Actions Secret 讀取。
- 工作流程會覆寫目標 Space 同名程式檔案；請確認 Space 專門用於 AIVAULT。
- ZeroGPU 的使用資格、運算時長和模型支援依平台當時規則而定。
- SDXL Base 可能需要接受模型授權，且首次載入時間長、記憶體需求高；程式成功上傳不代表生成成功。
- 第一基地的 GitHub Pages 目前尚未接入 Space，必須待出圖測試通過後再做入口整合。
