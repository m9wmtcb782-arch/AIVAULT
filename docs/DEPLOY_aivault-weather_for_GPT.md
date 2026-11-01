# 給 GPT 的部署信：aivault-weather（同步協作池天氣轉接口）

GPT 你好：

這封信請你協助部署第一基地的天氣後端。前端動畫已經完成（分支 `feat/collab-pool-weather-v1`），只差這支後端函式。

## 背景
- 倉庫：`m9wmtcb782-arch/AIVAULT`（第一基地，**禁碰第二基地任何帳號／專案**）。
- Supabase 專案：`clcddygkaaqqtsbswgdf`。
- 使用者已把中央氣象署授權碼放進 Supabase Secrets，名稱 **`CWA_API_KEY`**。請直接使用，**不要要求使用者再貼一次，也不要把金鑰寫進程式、log、回應或前端**。

## 請建立的 Edge Function
- 名稱：`aivault-weather`
- `verify_jwt = false`（公開讀取天氣，不需登入）
- CORS：只允許 `https://m9wmtcb782-arch.github.io`，方法 `GET, OPTIONS`
- 範例程式碼：repo 內 `supabase/functions/aivault-weather/index.ts`（可直接用或微調）

## 資料來源（中央氣象署開放資料，免費）
| 資料集 | 用途 |
|---|---|
| `O-A0001-001` | 即時觀測，臺北站：`Weather`、`AirTemperature`、`WindDirection`、`WindSpeed` |
| `F-C0032-001` | 臺北市預報降雨機率 `PoP`（≥70% 視為下雨） |
| `W-C0034-005` | 颱風警報；有颱風則 `condition = "typhoon"` 並帶 `typhoon_name` |

## 回傳 JSON 約定（前端已依此實作）
```json
{"condition":"clear|cloudy|rain|heavy_rain|typhoon","is_night":false,"wind_dir_deg":180,"wind_speed_ms":1.7,"temp_c":26.3,"obs_time":"2026-11-01T20:00:00+08:00","typhoon_name":"（選填）"}
```
- `is_night`：以 Asia/Taipei 時間 18:00–06:00 為夜。
- 觀測值缺測（CWA 用 -99／-999／空字串／非數字，風向 990 不定）時：`temp_c`、`wind_dir_deg`、`wind_speed_ms` **回 `null`，絕不補 0**（邏輯在 `supabase/functions/aivault-weather/normalize.js`，`node tests/aivault-weather-nulls.test.mjs` 驗證）。真實的 0（靜風 0 m/s、北風 0°）照實回 0。
- 前端收到 `null`：右上角顯示「氣溫無資料／風速無資料／風向無資料」，風車停轉、風向魚下垂不擺、風向箭頭隱藏（2D 覆蓋層、版本 A/B/D）；版本 C 目前沒有風車。

## 規則
1. **後端快取 10 分鐘**（函式記憶體快取），避免用光 CWA 配額。前端每 10 分鐘自動重抓、頁面回到前景時立即重抓；日夜與節慶由前端每分鐘依 Asia/Taipei 重算。上游失敗時回上一次快取，沒有快取回 503。
2. **不得回傳金鑰**，錯誤訊息也不能帶含金鑰的網址。
3. **禁用任何付費服務／付費 API。**
4. **不得刪除、覆寫或修改既有 function**（包含 `dark-star-youtube`、`ai-gateway`、`dark-star-ebook-ingest` 等），只新增 `aivault-weather`。
5. 不要動暗星／曙光數字人頁。

## 追加：GET /config（版本 D Google 3D 地圖金鑰）
- 使用者會自己把 Google Map Tiles API 金鑰放進 Supabase Secrets，名稱 **`GOOGLE_MAP_TILES_KEY`**（該金鑰已在 Google Cloud 設 HTTP Referer 限制 `https://m9wmtcb782-arch.github.io/*`、只開 Map Tiles API）。**請不要要求使用者貼給你，也不要寫進 repo／log。**
- 路徑：`GET /functions/v1/aivault-weather/config` → `{"map_tiles_key":"…"}`。
- 只在 `Origin` 為 `https://m9wmtcb782-arch.github.io` 時回傳；其他 Origin 回 403 `ORIGIN_NOT_ALLOWED`；未設定回 503 `NOT_CONFIGURED`；`cache-control: no-store`；天氣快取不可包含此值。
- 前端每次載入最多打一次 Google root.json，session 存 sessionStorage 約 2.5 小時（每日上限約 30 次 root 請求）。
- 驗收：
```bash
curl -s -o /dev/null -w "%{http_code}\n" "$F/config"                                              # 無 Origin → 403
curl -s -H 'Origin: https://evil.example' -o /dev/null -w "%{http_code}\n" "$F/config"           # 403
curl -s -H 'Origin: https://m9wmtcb782-arch.github.io' "$F/config" | python3 -c 'import sys,json;print("ok" if json.load(sys.stdin).get("map_tiles_key") else "missing")'  # 只印 ok，不要印出金鑰
```

## 部署注意（回覆你 2026-11-01 的回報）
- `/config` 路由已在 commit `373ea31` 加入 `index.ts`；缺測補 0 已在本次 commit 修正。請以分支最新版部署。
- 這次部署要上傳兩個檔：`index.ts` 與 `normalize.js`（同一個 function 目錄）。
- 你回報 Supabase 已達 100 個 Function 上限：**仍不可自行刪除任何既有 function**。請等使用者指定並授權要刪除哪一個，再部署。

## 部署指令（參考）
```bash
supabase functions deploy aivault-weather --no-verify-jwt --project-ref clcddygkaaqqtsbswgdf
```

## curl 驗收步驟
```bash
F=https://clcddygkaaqqtsbswgdf.supabase.co/functions/v1/aivault-weather
# 1. 200 + JSON，condition 是五種之一
curl -s -i "$F" | head -20
curl -s "$F" | python3 -c 'import sys,json;j=json.load(sys.stdin);assert j["condition"] in ["clear","cloudy","rain","heavy_rain","typhoon"];print(j)'
# 2. CORS
curl -s -i -X OPTIONS -H 'Origin: https://m9wmtcb782-arch.github.io' "$F" | grep -i access-control-allow-origin
# 3. 回應不可含金鑰（應輸出 0）
curl -s "$F" | grep -c 'CWA-' || true
# 4. 快取：連打兩次，obs_time 相同、第二次很快
time curl -s "$F" >/dev/null; time curl -s "$F" >/dev/null
# 5. 前端驗收：開協作池頁，右上角應顯示「晴・26°C・風 1.7 m/s…（CWA）」而不是「天氣離線」
```

完成後請回報：部署版本、上面 5 項的實際輸出（遮掉任何敏感值）。謝謝！
