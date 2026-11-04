# AIVAULT Comic Studio — Local Renderer V0.2

本目錄為漫劇工作室的本地影片渲染階段。請從工作室匯出 `aivault-comic-project.json`。

## 執行
```bash
python -m pip install pillow
# FFmpeg 與 ffprobe 需在 PATH 中
python render.py aivault-comic-project.json -o episode.mp4
```

V0.2 使用 Pillow 生成每個分鏡的示意畫面，FFmpeg 將分鏡串接為 H.264 MP4。此版並非 AI 影片生成，人物仍為佔位圖，尚無配音、音樂或分散式 GPU 運算。驗收時應使用 ffprobe 檢查影片長度、畫面大小與編碼。

預設輸出為 540x960 / 30fps，可用 `--width 1080 --height 1920 --fps 30` 改變。請在本機渲染；GitHub Pages 無法執行 Python 或 FFmpeg。
