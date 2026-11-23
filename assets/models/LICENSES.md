# 3D 模型與資料來源授權（臺北衛星地圖 v1：`aivault-taipei-satellite.html`）

## 3D 模型（`assets/models/tpe-sat/`）

| 檔案 | 來源 | 授權 | 修改 |
|---|---|---|---|
| `people/male-a.glb`、`female-b.glb`、`male-c.glb`、`female-d.glb`、`male-e.glb`、`female-f.glb` | Kenney「Mini Characters 1.0」https://kenney.nl/assets/mini-characters（repo 原有 `assets/town/kenney/mini/character-*.glb`） | **CC0 1.0**（公眾領域，可商用，免標示） | 只保留 `idle`、`walk` 兩段骨架動畫；gltf-transform prune/dedup/resample＋meshopt 壓縮（約 100 KB／個，約 723 三角面，骨架蒙皮保留） |
| `vehicles/sedan.glb`、`taxi.glb`、`suv.glb`、`van.glb`、`hatchback-sports.glb`、`delivery.glb` | Kenney「Car Kit 3.1」https://kenney.nl/assets/car-kit | **CC0 1.0** | gltf-transform prune/dedup＋meshopt 壓縮（約 42–49 KB／個） |

- 學生的背包是程式產生的圓角膠囊配件（非外部模型）。
- **公車**：Car Kit 沒有公車，暫以 `delivery.glb` 拉長 1.9 倍並套路線色代替，畫面與 PR 皆已標示。
- 列車、飛機：程式建模的圓潤造型（three.js 基本幾何），不是外部模型。
- 3D 引擎：three.js r160（MIT），由 jsDelivr 載入。

## 資料

| 資料 | 來源 | 授權 |
|---|---|---|
| 地標座標 | OpenStreetMap（Nominatim 查詢）與維基百科座標交叉核對 | ODbL 1.0（© OpenStreetMap contributors）；維基百科 CC BY-SA |
| 步行／道路路徑 | OSRM（router.project-osrm.org、routing.openstreetmap.de），底層為 OSM | ODbL 1.0 |
| 捷運線形與車站 | repo 原有 `data/aivault-taipei-map-data.js`（臺北市捷運工程局開放資料簡化） | 政府資料開放授權條款第 1 版 |
| 捷運班距 | 臺北捷運公司 metro.taipei「路線及班距」；新北捷運環狀線公告 | 政府公開資訊 |
| 松山機場跑道 10/28 | OurAirports（runways.csv） | Public Domain |
| 備援底圖 | 內政部國土測繪中心 PHOTO2、EMAP12（WMTS） | 政府資料開放授權條款第 1 版 |
| 主要底圖 | Google Maps JavaScript API（hybrid） | Google Maps Platform 服務條款（不快取、不描繪衛星影像、不與非 Google 地圖混用） |
