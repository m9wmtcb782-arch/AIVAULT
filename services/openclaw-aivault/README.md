# openclaw-aivault（本機 PoC，未部署）
OpenClaw 2026.10.9 + AIVAULT 外掛：共同記憶取代每個 agent 的記憶、動態身分、學徒管線（共同記憶→不二過→額度守門→Groq stub）、AI 標示、Docker 沙盒。
## 跑法
```bash
npm i openclaw@2026.10.9            # 另一個資料夾；Node 24.22.1+
ln -s <that>/node_modules/openclaw plugin/node_modules/openclaw
export OPENCLAW_STATE_DIR=/tmp/oc-state OPENCLAW_CONFIG_PATH=$PWD/config/openclaw.poc.json5
docker tag debian:bookworm-slim openclaw-sandbox:bookworm-slim
AIVAULT_STATE_DIR=$PWD/state node core/server.mjs &   # 127.0.0.1:18899
openclaw gateway run &                                 # 127.0.0.1:18789
test/e2e-openclaw.sh ; node --test test/unit.test.mjs
```
規模化時沙盒 scope 改 `agent`（session 會每個身分一個容器）。
