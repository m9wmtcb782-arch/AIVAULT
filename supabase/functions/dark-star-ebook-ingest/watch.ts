// wt1：「看影片」測試——GitHub Actions 下載授權允許的演講影片（FOSDEM，CC BY），抽聲音與截圖，送到這裡：
// 聲音 → Groq whisper-large-v3-turbo 逐字稿；截圖 → Groq llama-4-scout 描述投影片／程式碼／圖；最後代理結合兩者寫筆記。
// 只存文字結果（不存影片、聲音、圖片）。每日上限 LEARN_WATCH_DAILY（預設 3 部）。關閉：LEARN_WATCH_OFF=1
import { callModel } from "./floor.ts";
import { districtOf, DIST } from "./degree.ts";
const URL0 = Deno.env.get("SUPABASE_URL") || "", SR = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const SRH = { apikey: SR, Authorization: "Bearer " + SR, "Content-Type": "application/json" };
async function rest(path: string, init: RequestInit = {}) { const r = await fetch(URL0 + "/rest/v1/" + path, { ...init, headers: { ...SRH, Prefer: "return=representation", ...(init.headers || {}) } }); const t = await r.text(); if (!r.ok) throw new Error("DB " + r.status + " " + t.slice(0, 200)); return t ? JSON.parse(t) : null; }
const keys = () => ["GROQ_API_KEY", ...Array.from({ length: 9 }, (_, i) => "GROQ_API_KEY_" + (i + 1))].map((n) => Deno.env.get(n) || "").filter((v, i, a) => v && a.indexOf(v) === i);
export const ASR = "whisper-large-v3-turbo", VIS = "meta-llama/llama-4-scout-17b-16e-instruct";
const b64bytes = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
async function asr(bytes: Uint8Array, name: string) { let last = "";
  for (const k of keys()) { const fd = new FormData(); fd.append("file", new Blob([bytes as any]), name); fd.append("model", ASR); fd.append("response_format", "verbose_json");
    const r = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", { method: "POST", headers: { Authorization: "Bearer " + k }, body: fd, signal: AbortSignal.timeout(120000) });
    if (r.ok) { const j = await r.json(); return { text: String(j.text || ""), language: j.language, duration: j.duration, model: ASR }; } last += " " + r.status + ":" + (await r.text()).slice(0, 160); }
  throw new Error("ASR_FAILED" + last); }
async function vision(b64: string, prompt: string) { let last = "";
  for (const k of keys()) { const r = await fetch("https://api.groq.com/openai/v1/chat/completions", { method: "POST", headers: { Authorization: "Bearer " + k, "Content-Type": "application/json" }, signal: AbortSignal.timeout(60000),
      body: JSON.stringify({ model: VIS, max_tokens: 400, temperature: 0.2, messages: [{ role: "user", content: [{ type: "text", text: prompt }, { type: "image_url", image_url: { url: "data:image/jpeg;base64," + b64 } }] }] }) });
    if (r.ok) { const j = await r.json(); return { text: String(j.choices?.[0]?.message?.content || ""), usage: j.usage }; } last += " " + r.status + ":" + (await r.text()).slice(0, 160); }
  throw new Error("VISION_FAILED" + last); }
async function todayCount() { const d0 = new Date(Date.now() + 8 * 3600e3); d0.setUTCHours(0, 0, 0, 0); const since = new Date(d0.getTime() - 8 * 3600e3).toISOString();
  const r = await fetch(URL0 + `/rest/v1/aivault_pool_agent_learning?source_type=eq.video_watch&created_at=gte.${since}&select=id`, { headers: { ...SRH, Prefer: "count=exact", Range: "0-0" } }); return Number((r.headers.get("content-range") || "/0").split("/")[1]) || 0; }
async function sha(s: string) { const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)); return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join(""); }

// vc2：Gemini 免費層影片抽查（Supabase 免費方案函式數已滿，所以放在這裡；只走 watch_ 的 owner／service 驗證）。
// 只收公開授權；DB 計數 aivault_video_spot_take 每天上限 VIDEO_SPOT_DAILY（預設 20）；429/quota/billing → 當天封鎖，讓給暗星／曙光。關閉：VIDEO_SPOT_OFF=1
async function spot(b: any) {
  if (Deno.env.get("VIDEO_SPOT_OFF") === "1") return { ok: false, off: true };
  if (!/^(cc0|cc by(-sa)?( [0-9.]+)?|public domain)$/i.test(String(b.license || "").trim())) return { ok: false, error: "license not allowed" };
  const KEY = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_API_KEY") || ""; if (!KEY) return { ok: false, error: "no Gemini key" };
  const MODEL = Deno.env.get("VIDEO_SPOT_MODEL") || "gemini-3.6-flash", cap = Number(Deno.env.get("VIDEO_SPOT_DAILY") || 20);
  const t = await fetch(URL0 + "/rest/v1/rpc/aivault_video_spot_take", { method: "POST", headers: SRH, body: JSON.stringify({ cap }) }); const n = Number(await t.text());
  if (!(n > 0)) return { ok: false, cap_hit: true, cap };
  const parts: any[] = []; if (b.video_b64) parts.push({ inline_data: { mime_type: String(b.mime || "video/mp4"), data: String(b.video_b64) } }); parts.push({ text: String(b.prompt || "").slice(0, 8000) });
  const g = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, { method: "POST", headers: { "x-goog-api-key": KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ role: "user", parts }], generationConfig: { temperature: 0.1, maxOutputTokens: 2048 } }), signal: AbortSignal.timeout(120000) });
  const txt = await g.text();
  if (!g.ok) { if (g.status === 429 || /quota|billing|RESOURCE_EXHAUSTED|paid/i.test(txt)) { const d = new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10);
      await fetch(URL0 + "/rest/v1/aivault_video_spot_usage?day=eq." + d, { method: "PATCH", headers: SRH, body: JSON.stringify({ blocked: true, last_error: (g.status + " " + txt).slice(0, 300) }) }); }
    return { ok: false, status: g.status, error: txt.slice(0, 600), used_today: n }; }
  const j = JSON.parse(txt); return { ok: true, model: MODEL, text: (j.candidates?.[0]?.content?.parts || []).map((p: any) => p.text || "").join(""), usage: j.usageMetadata, used_today: n, cap };
}
export async function watch(a: string, b: any) {
  if (a === "watch_spot") return await spot(b);
  if (Deno.env.get("LEARN_WATCH_OFF") === "1") return { ok: true, off: true };
  if (a === "watch_probe") { const out: any = { keys: keys().length };
    try { const r = await fetch("https://api.groq.com/openai/v1/models", { headers: { Authorization: "Bearer " + keys()[0] } }); const j = await r.json(); out.models = (j.data || []).map((m: any) => m.id).filter((x: string) => /whisper|llama-4|vision|scout|maverick/i.test(x)); } catch (e) { out.models_err = String(e); }
    return out; }
  if (a === "watch_cap") { const n = await todayCount(), cap = Number(Deno.env.get("LEARN_WATCH_DAILY") || 3); return { ok: true, today: n, cap, allowed: n < cap }; }
  if (a === "watch_asr") { const r = await asr(b64bytes(String(b.audio_b64 || "")), String(b.name || "a.mp3")); return { ok: true, ...r }; }
  if (a === "watch_frame") { const r = await vision(String(b.image_b64 || ""), "這是一部技術演講影片在 " + String(b.t || "") + " 的截圖。用繁體中文 2–4 句描述畫面上的投影片文字、程式碼、架構圖或數字；若只是講者或空白畫面，回覆「無技術內容」。"); return { ok: true, ...r, model: VIS }; }
  if (a === "watch_note") { const n = await todayCount(), cap = Number(Deno.env.get("LEARN_WATCH_DAILY") || 3); if (n >= cap) return { ok: false, cap_hit: true, today: n, cap };
    const agents = await rest("aivault_pool_agents?select=id,domain,persona,name&limit=1400"); const pool = agents.filter((x: any) => ["av", "code"].includes(districtOf(x.domain))); const ag = pool[Math.floor(Math.random() * pool.length)]; const d = districtOf(ag.domain);
    const frames = (b.frames || []).filter((f: any) => f.desc && !/無技術內容/.test(f.desc)); const tr = String(b.transcript || "");
    const call = await callModel(`${ag.persona || ""}\n你是 AIVAULT ${DIST[d]} 的 AI，剛「看」完一部演講影片：你拿到的是聲音轉出的逐字稿和截圖描述（不是影片本身）。為「口語化即時語音模組」寫學習筆記，只能根據這些內容，沒講到的不要編。`,
      `影片：${b.url}\n標題：${b.title}\n授權：${b.license}\n\n【逐字稿（Whisper）節錄】\n${tr.slice(0, 6000)}\n\n【截圖描述（${frames.length} 張有技術內容）】\n${frames.map((f: any) => `[${f.t}] ${f.desc}`).join("\n").slice(0, 3000)}\n\n只輸出 JSON：{"notes":"300–500 字繁體中文筆記：講者重點、截圖上的架構／程式碼／數字、可以套用到 AIVAULT 暗星即時語音之處；標明哪些來自截圖","relevant":true 或 false}`, 1600);
    const notes = String(call.v?.notes || "").trim(); if (!notes) throw new Error("NO_NOTES");
    const row = { agent_id: ag.id, district: d, topic: "即時語音：看影片", query: String(b.title || "").slice(0, 200), url: b.url, title: ((frames.length ? "🎬 看影片（聲音＋截圖）｜" : "🎬 看影片（只有聲音，截圖辨識不可用）｜") + String(b.title || "")).slice(0, 200), http_status: 200, bytes: tr.length, sha256: await sha(tr), excerpt: tr.slice(0, 600),
      notes: (call.v?.relevant === false ? "［自評：此影片與主題關聯低］" : "") + notes.slice(0, 1500), model: call.model + ` + ${ASR} + ${VIS}`, usage: { ...(call.usage || {}), asr_seconds: b.asr_seconds, vision_tokens: b.vision_tokens, frames_total: b.frame_count, frames_described: (b.frames || []).map((f: any) => f.t) },
      fetched_at: new Date().toISOString(), source_type: "video_watch", caption_lang: b.language || null, transcript_chars: tr.length };
    await rest("aivault_pool_agent_learning", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify(row) });
    await rest("aivault_pool_agent_memory", { method: "POST", body: JSON.stringify({ agent_id: ag.id, kind: "learning", content: `看影片（聲音＋截圖）學習：${notes.slice(0, 300)}（${b.url}）` }) });
    return { ok: true, agent: ag.id, name: ag.name, district: d, notes_preview: notes.slice(0, 220), usage: call.usage }; }
  return { error: "unknown" };
}
