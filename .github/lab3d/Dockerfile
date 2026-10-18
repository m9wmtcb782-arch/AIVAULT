# city1：3D／遊戲沙盒映像。只有建映像時連網裝 three 與 Khronos glTF-Validator，執行 AI 程式時一律 --network none。
FROM node:20-alpine
WORKDIR /opt/lab
RUN npm init -y >/dev/null && npm i --no-audit --no-fund three@0.160.0 gltf-validator@2.0.0-dev.3.9 >/dev/null
COPY export.mjs /opt/lab/export.mjs
ENV NODE_PATH=/opt/lab/node_modules
