// vc2：Gemini 免費層影片抽查（只給影片學習中心驗收／抽查用）。
// 規則：只收公開授權影片（CC0／CC BY／CC BY-SA／Public Domain）；每天上限 VIDEO_SPOT_DAILY（預設 20，DB 計數器原子扣次）；
// 遇 429、quota、billing 相關錯誤 → 當天封鎖，讓出額度給暗星／曙光。只接受 service_role。關閉：函式 env VIDEO_SPOT_OFF=1。
const URL0 = Deno.env.get("SUPABASE_URL") || "", SR = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const KEY = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_API_KEY") || "";
const MODEL = Deno.env.get("VIDEO_SPOT_MODEL") || "gemini-3.6-flash";
const H = { apikey: SR, Authorization: "Bearer " + SR, "Content-Type": "application/json" };
const out = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "Content-Type": "application/json" } });
const LIC = /^(cc0|cc by(-sa)?( [0-9.]+)?|public domain)$/i;
async function block(err: string) { const d = new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10);
  await fetch(URL0 + "/rest/v1/aivault_video_spot_usage?day=eq." + d, { method: "PATCH", headers: H, body: JSON.stringify({ blocked: true, last_error: err.slice(0, 300) }) }); }
Deno.serve(async (r) => {
  if (Deno.env.get("VIDEO_SPOT_OFF") === "1") return out({ ok: false, off: true });
  const tok = (r.headers.get("authorization") || "").replace(/^Bearer /, "");
  if (!SR || tok !== SR) return out({ error: "service only" }, 403);
  const b = await r.json().catch(() => ({}));
  if (!LIC.test(String(b.license || "").trim())) return out({ error: "license not allowed: " + b.license }, 400);
  if (!KEY) return out({ error: "no Gemini key" }, 500);
  const cap = Number(Deno.env.get("VIDEO_SPOT_DAILY") || 20);
  const t = await fetch(URL0 + "/rest/v1/rpc/aivault_video_spot_take", { method: "POST", headers: H, body: JSON.stringify({ cap }) });
  const n = Number(await t.text()); if (!(n > 0)) return out({ ok: false, cap_hit: true, cap });
  const parts: any[] = []; if (b.video_b64) parts.push({ inline_data: { mime_type: String(b.mime || "video/mp4"), data: String(b.video_b64) } });
  parts.push({ text: String(b.prompt || "").slice(0, 8000) });
  const g = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, { method: "POST", headers: { "x-goog-api-key": KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ role: "user", parts }], generationConfig: { temperature: 0.1, maxOutputTokens: 2048 } }), signal: AbortSignal.timeout(120000) });
  const txt = await g.text();
  if (!g.ok) { if (g.status === 429 || /quota|billing|RESOURCE_EXHAUSTED|paid/i.test(txt)) await block(g.status + " " + txt); return out({ ok: false, status: g.status, error: txt.slice(0, 600), used_today: n }, 502); }
  const j = JSON.parse(txt); const text = (j.candidates?.[0]?.content?.parts || []).map((p: any) => p.text || "").join("");
  return out({ ok: true, model: MODEL, text, usage: j.usageMetadata, used_today: n, cap });
});
