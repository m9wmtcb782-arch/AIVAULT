# AIVAULT 自架自然語音（部署程式已準備，尚未上線）

這是自行運行 Qwen3-TTS 的語音服務，不呼叫 Gemini、Grok 或 Kling 的生成 API。它使用開源預訓練模型，並非 AIVAULT 從零訓練的基礎模型。模型與套件的 Apache-2.0 授權及來源須隨部署保留。

來源：https://github.com/QwenLM/Qwen3-TTS
模型：https://huggingface.co/Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign

實作流程：VoiceDesign 先產生自有音色參考，再由 Base 模型重用該參考，避免每段重新設計而改變音色。預設準備三男兩女的成年中文音色。參考與音訊快取保存在 `--data-dir`，正式部署需掛載持久化磁碟。

## 在實際運算節點部署

目前施工環境沒有 GPU，也沒有安装模型或生成自有聲音。下列指令應在模型運算節點執行；需要安裝與 CUDA 環境相容的 PyTorch。模型權重會從官方模型庫下載，並占用磁碟與記憶體。尚未量測本專案的硬體需求、中文自然度與生成延遲。

```bash
python -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
python engine.py prepare --data-dir ./voice-data --voice warm_female
# 將 AIVAULT_VOICE_TOKEN 設成隨機值，至少 24 字元；不要提交到 Git。
python engine.py serve --data-dir ./voice-data --host 127.0.0.1 --port 8090
```

`--device cpu` 僅供離線評估；不宣稱 CPU 可以即時生成。正式外部連線應透過 HTTPS 反向代理與後端驗證，保持此服務的 Bearer token 不進入前端。

## 接口

- `GET /health`：只有模型載入完成且音色參考存在，才回傳 ready 與可用音色。
- `POST /v1/audio/speech`：JSON `{"input":"完整原文。","voice":"warm_female","response_format":"wav"}`，回傳實際 WAV 音訊。
- 兩者均需要 `Authorization: Bearer <AIVAULT_VOICE_TOKEN>`。
- 最多四個排隊請求；模型推論串行，避免同一 GPU 重複搶占。
- 成功生成的音訊快取最多保留 256 段，減少重播成本。

播放器尚未切换到本服務，因為目前沒有可用的部署主機與模型音訊。完成部署後需接上既有 aivault-tts 路由，再验证固定音色、長篇穩定性、法條原文無遗漏和反藍同步；正式頁面不得先標成可用。
