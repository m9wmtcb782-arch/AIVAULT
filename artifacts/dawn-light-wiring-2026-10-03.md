# 曙光接線證據 2026-10-03

倉庫：m9wmtcb782-arch/AIVAULT
活庫：https://clcddygkaaqqtsbswgdf.supabase.co
未修改 technical-dark-star.html、Dark Star memory、persona、voice、live voice。
未 UPDATE model_registry。PLANNED 維持 PLANNED。

## 鏈路

Dawn Light
→ agent_modules / agent_module_capabilities（活庫表存在；anon SELECT 被拒 42501，不是缺表）
→ agent_model_routes（活庫表存在；repository 沒有定義；anon 不能讀）
→ model_registry（repository 009 只有 planned-*，availability=PLANNED）
→ ai_models / providers（活庫表存在；anon 不能讀。使用者已確認 Gemini gemini-3.6-flash、Groq）
→ Runtime
→ 實測

## 為什麼 capability 不能執行

agent_module_capabilities 只插入 capability 名稱。
artifacts/aivault-011-agent-modules.sql 的 agent_module_handoff 回傳 model_status=PLANNED、executed=false。
repository 沒有把 dawn-light 綁到任何 runtime。
agent_model_routes 不在 Git 內容裡。

## 實測

Vision
- POST /functions/v1/ai-gateway
- provider=gemini，model=gemini-3.6-flash，HTTP 200，latency 約 4.4s
- messages 內帶圖：模型回「目前沒有收到任何圖片」
- 頂層 image 欄位：回「黑色」；測試圖是紅色
- 狀態：NOT VERIFIED
- technical-dark-star/vision：Route not found
- dawn-light-vision、compute-mesh function：NOT_FOUND
- repository 沒有 MobileNet 執行碼

Image
- POST /functions/v1/dark-star-image-generation
- provider=pollinations，model=flux
- mime=image/jpeg，format_verified=true，bytes=276713
- 下載檔頭 ffd8ffe0，content-type=image/jpeg
- 沒有 IMAGE_OUTPUT_CONTRACT_FAILED，沒有用 SVG 或文字充當圖片
- 狀態：CONFIRMED
- 這是現有函式，曙光頁只呼叫它

Video
- 既有 Magic Hour 任務 cmurgk2v9017cg901d9zcmpif
- provider job status=complete，credits_charged=120
- AIVAULT 儲存失敗：bucket aivault-videos 不存在（NoSuchBucket）
- 前端沒有可取得的影片 URL
- 狀態：BLOCKED
- 沒有再建立新影片任務

3D
- js/aivault-engine-bus.js：3D = RESERVED，禁止呼叫 provider
- aivault-3d-stage.html 只有 Three.js 顯示與文字對話
- repository 沒有 3D generation / mesh generation runtime
- 狀態：BLOCKED

## 需要本人操作

1. Supabase 建立 storage bucket：aivault-videos。
2. 用可讀角色查 agent_model_routes，確認沒有 dawn-light 列。沒有實測前不要把 model_registry 改成 AVAILABLE。
3. Vision 要另接真正會把圖片 bytes 送給模型的 Gateway 路徑。現有 ai-gateway-v3.1.5 沒有做到。
