# V0.4 角色參考圖生成

這是 **本地 ComfyUI 參考圖條件生成連接器**，並非獨立的 AI 模型。

## 先決條件
1. 本機 ComfyUI 已啟動，且已安裝可用的圖像生成模型。
2. 準備 **API 格式** workflow JSON。工作流程必須有 CLIPTextEncode 正面提示節點、LoadImage 參考圖節點，以及 SaveImage 輸出節點。
3. **LoadImage 必須實際連接至支援參考圖片的模型條件控制節點**，例如相容的 IP-Adapter 或 image-to-image 工作流程。僅存在 LoadImage 節點不代表模型真的使用參考圖。
4. 先用 character_registry.py 建立角色、加入參考圖並人工核准。

## 執行
```bash
python comic-studio/character_generate.py \
  --id heroine01 \
  --kind front \
  --pose "full body standing, looking left, calm expression" \
  --workflow ./workflow_api.json \
  --positive-node 6 \
  --load-image-node 10
```

請用實際 workflow 節點 ID 取代 6 與 10。程式會校驗核准參考圖的 SHA-256、上傳至本地 ComfyUI、提交生成任務、下載 PNG 與紀錄 JSON。產出的圖像標記為 pending，**不會自動認定是同一張臉**。

## 驗收
- 能生成同一角色正面、側面、全身及表情圖，且參考圖確實進入條件控制鏈。
- 人工核對臉孔、髮型、服裝、比例與手部；失敗素材不得入庫。
- 後續再加入自動一致性評估與動畫分層。

## 限制
- 尚未在使用者的 Mac/手機上實測 ComfyUI 或生成圖片。
- 不保證模型能維持身分一致；模型能力、參考圖權重、工作流程會影響結果。
- 不支援手機 GPU 直接執行此 Python CLI；手機協作需另外開發工作節點。
- 無外部付費 API；僅允許 loopback ComfyUI。
