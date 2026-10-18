---
title: 3D 與遊戲（專業）｜冰雪城市、WebGPU 與遊戲 AI
tier: 專業
order: 25
domains: 3D 遊戲
---
## 第 1 章 程序化場景：冰雪城市 v0 的做法
地形：用雜訊函式（例如多層 sin 或 simplex noise）產生高度圖，建成 PlaneGeometry 再位移頂點。建築：用程式依格子放置不同高度的方塊與屋頂，InstancedMesh 批次繪製。能源核心：發光材質（emissive）＋點光源＋緩慢脈動。下雪：Points 粒子，每幀下移、到底回到頂端。火與煙：粒子＋加法混合（AdditiveBlending）。夜燈：少量 PointLight，其餘用 emissive 假裝發光以省效能。
每個元素都要有開關與 FPS 量測，作品回報實際裝置的 FPS。
## 第 2 章 動畫與骨架
glTF 支援骨架（skin）與動畫通道（translation／rotation／scale／weights）。three.js 用 AnimationMixer 播放 AnimationClip。程式生成的動畫可以用 KeyframeTrack 建立後隨 GLB 匯出，再用驗證器檢查。
## 第 3 章 WebGPU
WebGPU 是新一代瀏覽器 GPU API，支援計算著色器（compute shader），可做粒子模擬、矩陣運算。iPhone Safari 支援度要實測，必須保留 WebGL 備援。協作池 GPU 區可以用 WebGPU 做張量運算基準，但不能把「把任務分給多台裝置」說成「同一模型跨裝置推論」。
## 第 4 章 遊戲 AI
- 有限狀態機（巡邏、追逐、逃跑）。
- 尋路：格子地圖上的 A* 演算法。
- 強化學習環境：Gymnasium 定義 reset／step／reward 介面，可以把簡單遊戲包成環境讓代理學習。
## 第 5 章 驗收：遊戲必須能玩、3D 必須能預覽
遊戲：規則純函式有單元測試；可在瀏覽器開啟操作；記錄 FPS。3D：GLB 通過 glTF-Validator；可在預覽頁開啟；多角度截圖（可用免費 Blender 預渲染）。即時與預渲染兩種模式分開評分。
## 練習（對應實驗工廠）
1. A* 尋路：20×20 格子含障礙，回傳最短路徑，附 5 個測試（含無解）。
2. 雪花粒子系統：1 萬個粒子，量測桌機與手機 FPS，寫成報告。
3. 把 Snow Catcher 規則包成 Gymnasium 風格的 reset／step 介面（純 Python），附測試。
## 參考資料（已檢查可開啟）
- three.js 手冊：https://threejs.org/manual/
- three.js 文件：https://threejs.org/docs/
- glTF（Khronos）：https://github.com/KhronosGroup/glTF
- glTF-Validator：https://github.com/KhronosGroup/glTF-Validator
- WebGPU 規範（W3C）：https://www.w3.org/TR/webgpu/
- Gymnasium：https://gymnasium.farama.org/
