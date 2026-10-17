// so1：長期命令。擁有者設定後，每次排程呼叫模型（學習、實驗工廠、作品、計畫、暗星／曙光）都把適用的命令當成必須遵守的指示，並要求模型回報怎麼遵守；每次都記錄。
// 閉卷考試不注入（避免洩題或干擾評分）。涉及對外發送、花錢、上線、刪除資料的命令會被標記，需擁有者核准才生效，且即使生效也不能越過這些審核關卡。關閉：函式 env STANDING_ORDERS_OFF=1
const URL0 = Deno.env.get("SUPABASE_URL") || "", SR = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const SRH = { apikey: SR, Authorization: "Bearer " + SR, "Content-Type": "application/json" };
async function rest(path: string, init: RequestInit = {}) { const r = await fetch(URL0 + "/rest/v1/" + path, { ...init, headers: { ...SRH, Prefer: "return=representation", ...(init.headers || {}) } }); const t = await r.text(); if (!r.ok) throw new Error("DB " + r.status + " " + t.slice(0, 200)); return t ? JSON.parse(t) : null; }
const RISK = /寄|發信|email|e-mail|簡訊|發文|貼文|po文|推文|對外|付費|花錢|購買|刷卡|訂閱|上線|部署|發佈|發布|publish|deploy|刪除|刪掉|清空|drop|delete|truncate|轉帳|密碼|金鑰|token/i;
const GATE = "（安全限制：任何命令都不能讓你對外發送訊息、花錢、發佈到正式環境、刪除資料；這類行動只能提出建議，等擁有者逐次核准。）";
let CACHE: { t: number; rows: any[] } | null = null;
const DLAB: Record<string, string[]> = { code: ["程式與代理", "code"], llm: ["大型語言", "llm"], img: ["圖像", "img"], av: ["影音", "av"] };
async function active() { if (CACHE && Date.now() - CACHE.t < 60000) return CACHE.rows; const rows = await rest("aivault_standing_orders?active=eq.true&revoked_at=is.null&or=(flagged.eq.false,approved_at.not.is.null)&select=id,text,districts,agents&order=id.asc").catch(() => []); CACHE = { t: Date.now(), rows }; return rows; }
export function clearOrders() { CACHE = null; }
// 依 system prompt 判斷對象（區名或代理名／id 出現在 prompt 裡）
export async function ordersFor(system: string) {
  if (Deno.env.get("STANDING_ORDERS_OFF") === "1" || /閉卷考試/.test(system)) return [];
  return (await active()).filter((o: any) => {
    const ds: string[] = o.districts || [], as: string[] = o.agents || [];
    if (!ds.length && !as.length) return true;
    if (as.some((a) => system.includes(a))) return true;
    return ds.some((d) => (DLAB[d] || [d]).some((k) => system.includes(k)));
  });
}
export function orderBlock(os: any[]) { return os.length ? `\n\n【擁有者的長期命令（必須遵守）】\n${os.map((o: any) => `#${o.id} ${o.text}`).join("\n")}\n${GATE}\n請在輸出的 JSON 裡多加一個欄位 "order_compliance":{"命令編號":"你這次怎麼遵守（或為什麼這次不適用）"}。` : ""; }
export async function logOrders(os: any[], system: string, v: any, model: string, evidence?: string) {
  if (!os.length) return; const comp = v && typeof v === "object" ? v.order_compliance || null : null; if (v && typeof v === "object") delete v.order_compliance;
  const ctx = system.replace(/\s+/g, " ").slice(0, 160);
  await rest("aivault_standing_order_log", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify(os.map((o: any) => ({ order_id: o.id, context: ctx, compliance: comp ? String(comp[String(o.id)] ?? comp["#" + o.id] ?? JSON.stringify(comp)).slice(0, 600) : "（模型沒有回報遵守情況）", model, evidence: evidence || null }))) }).catch(() => {});
}
export async function orders(a: string, b: any, uid: string | null) {
  if (a === "orders_list") { const rows = await rest("aivault_standing_orders?select=*&order=id.desc&limit=50"); const ids = rows.map((r: any) => r.id); const cnt = ids.length ? await rest(`aivault_standing_order_log?order_id=in.(${ids.join(",")})&select=order_id&limit=5000`) : []; rows.forEach((r: any) => r.applied = cnt.filter((c: any) => c.order_id === r.id).length); return { ok: true, off: Deno.env.get("STANDING_ORDERS_OFF") === "1", rows }; }
  if (a === "order_log") return { ok: true, rows: await rest(`aivault_standing_order_log?order_id=eq.${Number(b.id)}&select=*&order=id.desc&limit=50`) };
  if (a === "order_save") { const text = String(b.text || "").trim().slice(0, 500); if (!text) return { ok: false, error: "empty" }; const flagged = RISK.test(text);
    const body: any = { text, districts: (b.districts || []).filter((x: string) => DLAB[x]), agents: (b.agents || []).map(String).slice(0, 50), flagged, approved_at: null, updated_at: new Date().toISOString(), active: true };
    const r = b.id ? await rest(`aivault_standing_orders?id=eq.${Number(b.id)}`, { method: "PATCH", body: JSON.stringify(body) }) : await rest("aivault_standing_orders", { method: "POST", body: JSON.stringify({ ...body, created_by: uid }) }); clearOrders();
    return { ok: true, order: r[0], note: flagged ? "這條命令提到對外發送／花錢／上線／刪除等行動，已標記，需要你按「核准」才會生效；生效後也只能提出建議，實際行動仍要你逐次核准。" : "" }; }
  if (a === "order_approve") { await rest(`aivault_standing_orders?id=eq.${Number(b.id)}`, { method: "PATCH", body: JSON.stringify({ approved_at: new Date().toISOString() }) }); clearOrders(); return { ok: true }; }
  if (a === "order_revoke") { await rest(`aivault_standing_orders?id=eq.${Number(b.id)}`, { method: "PATCH", body: JSON.stringify({ active: false, revoked_at: new Date().toISOString() }) }); clearOrders(); return { ok: true }; }
  return { ok: false, error: "unknown" };
}
