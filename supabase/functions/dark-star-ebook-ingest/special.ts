// ai1：真正的暗星／曙光在協作池的活動。ai_beat 只接受登入使用者從 technical-dark-star.html 回報（不含任何使用者內容）；ai_presence 公開唯讀。關閉：函式 env AI_PRESENCE_OFF=1
const URL0 = Deno.env.get("SUPABASE_URL") || "", SR = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const SRH = { apikey: SR, Authorization: "Bearer " + SR, "Content-Type": "application/json" };
async function rest(path: string, init: RequestInit = {}) { const r = await fetch(URL0 + "/rest/v1/" + path, { ...init, headers: { ...SRH, Prefer: "return=representation", ...(init.headers || {}) } }); const t = await r.text(); if (!r.ok) throw new Error("DB " + r.status + " " + t.slice(0, 200)); return t ? JSON.parse(t) : null; }
const IDS = ["darkstar", "dawn-light"], ACTS = ["聊天", "語音", "讀書", "做圖", "看圖", "影片", "3D", "審核計畫"];
export async function special(a: string, b: any, r: Request) {
  if (Deno.env.get("AI_PRESENCE_OFF") === "1") return { ok: true, off: true, rows: [] };
  if (a === "ai_presence") { const rows = await rest("aivault_pool_special?select=id,name,activity,last_at,real_path"); return { ok: true, now: new Date().toISOString(), rows }; }
  if (a === "ai_beat") { const id = String(b.id || ""), act = String(b.activity || ""); if (!IDS.includes(id) || !ACTS.includes(act)) return { ok: false, error: "bad id/activity" };
    const tok = (r.headers.get("authorization") || "").replace(/^Bearer\s+/i, ""); const u = await fetch(URL0 + "/auth/v1/user", { headers: { apikey: SR, Authorization: "Bearer " + tok } }).then((x) => x.ok ? x.json() : null).catch(() => null);
    if (!u?.id) return { ok: false, error: "login required" };
    const [x] = await rest(`aivault_pool_special?id=eq.${id}&select=last_at,activity`); if (x?.last_at && Date.now() - Date.parse(x.last_at) < 15000 && x.activity === act) return { ok: true, throttled: true };
    await rest(`aivault_pool_special?id=eq.${id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ activity: act, last_at: new Date().toISOString(), updated_at: new Date().toISOString() }) }); return { ok: true }; }
  return { ok: false, error: "unknown" };
}
export async function markSpecial(id: string, act: string) { await rest(`aivault_pool_special?id=eq.${id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ activity: act, last_at: new Date().toISOString(), updated_at: new Date().toISOString() }) }).catch(() => {}); }
