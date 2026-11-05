# AIVAULT 角色一致性資料庫 V0.3

本階段建立可執行的角色身分與參考素材管理，**不是**已完成的 AI 人臉一致性模型。

## 使用方式

```bash
python comic-studio/character_registry.py create --id heroine01 --name "女主角" --hair "long black hair" --face "oval face" --costume "blue hanfu" --body "adult, tall"
python comic-studio/character_registry.py prompt --id heroine01 --kind front
python comic-studio/character_registry.py add-reference --id heroine01 --kind front --file ./heroine.png --model local-model --seed 12345
python comic-studio/character_registry.py list
```

先使用 `comfy_generate.py` 生成 PNG，再將圖檔登錄為參考素材。新增素材的審核狀態為 `pending`；人工確認角色相符後：

```bash
python comic-studio/character_registry.py review --id heroine01 --file front_圖片雜湊前16碼.png --status approved
```

可用 `prompt` 指令查詢核准的參考圖片。要在後續生成中真正維持臉部一致，必須選擇支援參考圖條件控制的 ComfyUI 工作流程（例如適合所用模型的 image-conditioning、IP-Adapter 或其他一致性方案）；僅固定提示詞和 seed 並不保證人物相同。

## 後續階段
- V0.4：ComfyUI 參考圖條件輸入與固定角色 ID 的工作流程
- V0.5：人物與場景分層素材輸出（透明 PNG）
- V0.6：骨架、表情、嘴型與時間軸動畫

安全要求：本地儲存，不公開私有參考圖片；模型及圖片來源應有使用授權。現有 AIVAULT 三大核心保持不變。
