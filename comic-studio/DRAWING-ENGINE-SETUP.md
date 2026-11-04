# 第一基地｜真正的 AI 漫劇繪圖引擎

## 已寫好的程式
- `install_local_drawing.sh`：由電腦擁有者明確執行後，下載官方 ComfyUI 原始碼並建立 Python 虛擬環境；**不自動下載模型權重**，避免未經確認的硬碟占用與授權問題。
- `build_anime_workflow.py`：產生可由 ComfyUI API 執行的標準 SDXL 文生圖 workflow，使用本地 checkpoint。
- `comfy_generate.py`：呼叫本地 ComfyUI、下載 PNG 與生成紀錄。
- `character_registry.py`、`character_generate.py`：管理人物參考圖和一致性生成。

## Mac / Linux 安裝（在自己的電腦終端機）
```bash
bash comic-studio/install_local_drawing.sh --install
```
請先確認 Python、Git、PyTorch 對 GPU 的支援。Mac Apple Silicon 可用 ComfyUI 官方 Desktop 版替代安裝腳本；Windows 建議官方 Desktop 版：https://www.comfy.org/download 。

在 ComfyUI 的 `models/checkpoints/` 放入你有權使用、與 SDXL 架構相容的動漫 checkpoint（模型須自行選擇、檢查來源與授權）。

```bash
python comic-studio/build_anime_workflow.py --checkpoint "你的模型檔名.safetensors" --output workflow_anime_sdxl_api.json
python comic-studio/comfy_generate.py --workflow workflow_anime_sdxl_api.json --node 2 --prompt "beautiful anime heroine, full body, moonlit courtyard" --name character
```

**驗收**：ComfyUI API 返回完成狀態、PNG 實際存在、圖像中有完整動漫人物、面部與手部可辨識，沒有幾何占位圖。未實際運行之前一律標記為「未驗證」。

## 下一步
1. 安裝本地模型，生成三張人物、三張場景與三張道具，人工評估。
2. 對人物執行正面／側面／全身一致性測試。
3. 接逐幀引擎：原圖 + 角色參考 + 動作條件 + 上一幀 → 下一幀；定期與基準圖比較，避免人物漂移。
4. 完成後再考慮在正式第一基地增加入口，不能直接宣稱 GitHub Pages 可運行本地 GPU 模型。

**注意**：GitHub Pages 只提供靜態前端，無法代替電腦安裝 GPU 模型；遠端瀏覽器要接本機模型需另行設計安全的連線與授權。
