// aivault-weather — 同步協作池天氣轉接口（範例碼：僅放 repo，未部署）
// 資料來源：中央氣象署開放資料（免費）。金鑰只從 Supabase Secrets 讀 CWA_API_KEY，絕不回傳。
// 部署：supabase functions deploy aivault-weather --no-verify-jwt --project-ref clcddygkaaqqtsbswgdf
const CWA = "https://opendata.cwa.gov.tw/api/v1/rest/datastore";
const STATION = "臺北"; const CITY = "臺北市";
const ALLOW = ["https://m9wmtcb782-arch.github.io"];
const TTL = 10 * 60 * 1000;
let cache: { at: number; body: string } | null = null;

function cors(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": origin && ALLOW.includes(origin) ? origin : ALLOW[0],
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
    "Vary": "Origin",
  };
}
async function cwa(id: string, q: Record<string, string>) {
  const key = Deno.env.get("CWA_API_KEY"); if (!key) throw new Error("CWA_API_KEY missing");
  const u = new URL(`${CWA}/${id}`); u.searchParams.set("Authorization", key); u.searchParams.set("format", "JSON");
  for (const [k, v] of Object.entries(q)) u.searchParams.set(k, v);
  const r = await fetch(u, { signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`${id} HTTP ${r.status}`); // 不帶網址，避免金鑰外洩到錯誤訊息
  return await r.json();
}
const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) && n > -90 ? n : null; };

async function build() {
  const [obs, fc, ty] = await Promise.allSettled([
    cwa("O-A0001-001", { StationName: STATION }),
    cwa("F-C0032-001", { locationName: CITY, elementName: "PoP,Wx" }),
    cwa("W-C0034-005", {}),
  ]);
  if (obs.status !== "fulfilled") throw new Error("observation unavailable");
  const st = obs.value?.records?.Station?.[0]; const we = st?.WeatherElement ?? {};
  const wx: string = String(we.Weather ?? "");
  const temp = num(we.AirTemperature), dir = num(we.WindDirection), spd = num(we.WindSpeed);
  let pop = 0;
  if (fc.status === "fulfilled") {
    const el = fc.value?.records?.location?.[0]?.weatherElement ?? [];
    const p = el.find((e: any) => e.elementName === "PoP")?.time?.[0]?.parameter?.parameterName; pop = Number(p) || 0;
  }
  let typhoonName: string | undefined;
  if (ty.status === "fulfilled") {
    const t = ty.value?.records?.tropicalCyclones?.tropicalCyclone?.[0];
    if (t) typhoonName = t.cwaTyphoonName || t.typhoonName;
  }
  let condition = "clear";
  if (typhoonName) condition = "typhoon";
  else if (/大雨|豪雨|雷/.test(wx)) condition = "heavy_rain";
  else if (/雨/.test(wx) || pop >= 70) condition = "rain";
  else if (/雲|陰/.test(wx)) condition = "cloudy";
  const obsTime: string = st?.ObsTime?.DateTime ?? new Date().toISOString();
  const h = Number(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Taipei", hour: "numeric", hourCycle: "h23" }).format(new Date()));
  return {
    condition, is_night: h < 6 || h >= 18,
    wind_dir_deg: dir ?? 0, wind_speed_ms: spd ?? 0, temp_c: temp, obs_time: obsTime,
    pop, weather_text: wx, ...(typhoonName ? { typhoon_name: typhoonName } : {}), source: "CWA",
  };
}

Deno.serve(async (req) => {
  const h = cors(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response(null, { headers: h });
  if (req.method !== "GET") return new Response("method not allowed", { status: 405, headers: h });
  try {
    if (!cache || Date.now() - cache.at > TTL) cache = { at: Date.now(), body: JSON.stringify(await build()) };
    return new Response(cache.body, { headers: { ...h, "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=300" } });
  } catch (e) {
    if (cache) return new Response(cache.body, { headers: { ...h, "content-type": "application/json", "x-stale": "1" } });
    return new Response(JSON.stringify({ error: "WEATHER_UNAVAILABLE", detail: String((e as Error).message).slice(0, 80) }), { status: 503, headers: { ...h, "content-type": "application/json" } });
  }
});
