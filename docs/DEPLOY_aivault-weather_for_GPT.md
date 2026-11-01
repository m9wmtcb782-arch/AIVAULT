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
- 觀測值缺測（CWA 用 -99）時不可捏造數字。

## 規則
1. 快取 10 分鐘（函式記憶體快取），避免用光 CWA 配額；上游失敗時回上一次快取，沒有快取回 503。
2. **不得回傳金鑰**，錯誤訊息也不能帶含金鑰的網址。
3. **禁用任何付費服務／付費 API。**
4. **不得刪除、覆寫或修改既有 function**（包含 `dark-star-youtube`、`ai-gateway`、`dark-star-ebook-ingest` 等），只新增 `aivault-weather`。
5. 不要動暗星／曙光數字人頁。

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
