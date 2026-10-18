---
title: 3D 與遊戲（入門）｜three.js、glTF 與遊戲迴圈
tier: 入門
order: 15
domains: 3D 遊戲
---
## 第 1 章 three.js 的三件套
每個 three.js 程式都有：場景（Scene）、相機（PerspectiveCamera）、渲染器（WebGLRenderer）。物件＝幾何（Geometry）＋材質（Material）組成網格（Mesh）。要看得到 MeshStandardMaterial，場景裡必須有光源（例如 HemisphereLight、DirectionalLight）。
動畫迴圈：用 renderer.setAnimationLoop 或 requestAnimationFrame，每一幀更新物件位置後呼叫 renderer.render(scene, camera)。
## 第 2 章 效能：讓 iPhone 也順
- 大量重複物件（桌子、樹、雪花）用 InstancedMesh，一次繪製呼叫畫上千個。
- 控制 draw call 數與三角形數；renderer.info 可以看到。
- 設定 renderer.setPixelRatio(Math.min(devicePixelRatio, 2))。
- 陰影很貴，只讓必要的物件 castShadow。
- 用簡單的 FPS 量測：累計 1 秒內的幀數，作品要回報實際 FPS。
## 第 3 章 glTF／GLB：3D 的 JPEG
glTF 2.0 是 Khronos 制定的 3D 交換格式：JSON 描述場景、節點、網格、材質（PBR metallic-roughness）、動畫、骨架；GLB 是把 JSON 與二進位資料包成一個檔案。three.js 用 GLTFLoader 載入、GLTFExporter 匯出。
驗證：Khronos 的 glTF-Validator 會檢查檔案是否符合規範。協作池規則：3D 作品必須匯出 GLB 並通過驗證器，有錯誤就不通過。
## 第 4 章 遊戲迴圈與規則
遊戲＝狀態＋輸入＋更新＋繪製。固定時間步長更新邏輯（例如每 1/60 秒），繪製可以跟著畫面更新率。把「遊戲規則」寫成純函式（輸入狀態與動作，輸出新狀態），就可以不開瀏覽器直接寫單元測試。
碰撞偵測入門：圓與圓（距離小於半徑和）、軸對齊方框（AABB）重疊。
## 第 5 章 協作池的 3D 現況
可以做：three.js 程式建模（地形、建築、雪、火、煙、燈光）、GLB 匯出與驗證、GitHub 上免費 Blender 預渲染。BLOCKED：沒有 GPU，文字或圖片轉 3D 模型（TripoSR、Hunyuan3D）無法執行。
## 練習（對應實驗工廠）
1. 寫一個 Snow Catcher 遊戲規則純函式：籃子左右移動、雪花落下、接到加分、漏接扣命，附 6 個測試。
2. 用 three.js 建一棟有屋頂的小屋，GLTFExporter 匯出 GLB，跑 glTF-Validator 0 錯誤。
3. 實作 AABB 碰撞函式與測試。
## 參考資料（已檢查可開啟）
- three.js 文件：https://threejs.org/docs/
- three.js 手冊：https://threejs.org/manual/
- three.js 原始碼：https://github.com/mrdoob/three.js
- glTF（Khronos，含 2.0 規範）：https://github.com/KhronosGroup/glTF
- glTF-Validator：https://github.com/KhronosGroup/glTF-Validator
- MDN requestAnimationFrame：https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame
- TripoSR（目前 BLOCKED）：https://arxiv.org/abs/2403.02151
