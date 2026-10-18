# ss1：小鎮台灣四季・節日・天氣・穿著（第一批）

## 檔案
- `.github/scripts/town_seasons.src.js`：原始碼。`build_town_seasons.py` 會把官方資料嵌進去，產生 `town_seasons.js`。
- `.github/scripts/agent_floor_setup.py`：publish 時注入 ss1。另外新增兩個步驟：`backup` 把線上版複製到私有列 `agent-floor-bak-20261018`，`restore` 把備份寫回去。
- `data/tw-holidays-dgpa-2026-2027.json`：行政院人事行政總處〈政府行政機關辦公日曆表〉115、116 年版。
  - 資料集：https://data.gov.tw/dataset/14718
  - 115 年 CSV：https://www.dgpa.gov.tw/FileConversion?filename=dgpa/files/202506/a52331bd-a189-466b-b0f0-cae3062bbf74.csv
  - 116 年 CSV：https://www.dgpa.gov.tw/FileConversion?filename=dgpa/files/202607/f538b1ff-ba60-4c63-9477-10db8e6612d1.csv
  - 元宵不是放假日，所以官方表裡沒有。這裡用官方春節初一加 14 天推算。
- `data/typhoon-names-cwa-2026.json`：中央氣象署颱風中文譯名對照表（2026 年更新），共 140 個名字，照輪替順序排列。來源：https://www.cwa.gov.tw/V8/C/K/Encyclopedia/typhoon/typhoon-07.txt
- 即時颱風：RSMC 東京（JMA）https://www.jma.go.jp/bosai/typhoon/data/targetTc.json，免費、不用金鑰。
- `.github/workflows/town-weather.yml` 與 `.github/scripts/town_weather.py`：每 30 分鐘寫入 `aivault_town_weather`。
  - 台北即時天氣和颱風警報要有 secrets.CWA_API_KEY 才抓得到。
  - 沒有金鑰時只寫 JMA 資料，小鎮改用依日期推算的模擬天氣，畫面上會標示。
- `supabase/migrations/20261018110000_aivault_town_weather.sql`

## 規則
- 季節照台北日期：春 3–5 月、夏 6–8 月、秋 9–11 月、冬 12–2 月。
- 冬天下雪，地面積雪、天上飄雪。這是唯一跟台灣不一樣的地方。
- 穿著：27°C 以上短袖加草帽；17°C 以下或冬天穿外套；下雨或颱風撐傘。
- 颱風日：中央氣象署發布警報時，顯示真實颱風名。沒有警報時，7–10 月依日期推算模擬颱風日，名稱用真實輪替表裡最新一個真實颱風的下一個名字，畫面會標「模擬」。

## 開關
- 單一使用者關閉：`localStorage.seasonsOff='1'` 或網址加 `?seasons=0`。
- 全站關閉：把 `aivault_town_weather.data.off` 設成 true，或用 `TOWN_SEASONS_OFF=1` 重新 publish。
- 冰雪主題：`localStorage.townTheme='frozen'` 或 `?season=frozen`。原本的 FROZEN CITY 頁 `aivault-frozen-city.html` 保留不動。
- 停止天氣排程：repo 變數 `TOWN_WEATHER_OFF=1`。

## 預覽
`?date=2027-02-06`、`?season=`、`?wx=clear|cloudy|rain|snow|typhoon`、`?temp=33`、`?hour=20`

## 回滾
1. 跑 `agent-floor.yml`，step 設成 `restore`，會把 `agent-floor-bak-20261018` 寫回 agent-floor。
2. 或刪掉 `town_seasons.js` 再 publish。
3. 或 `git revert <ss1 commit>` 之後 publish。
