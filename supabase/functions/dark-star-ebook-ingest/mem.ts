// sm1：共享記憶的 edge 介面。查詢／寫入／通知全部是資料庫函式（不花 token）；只有 memFix（驗收劇本裡 B 修 bug）會呼叫一次模型。
import { callModel } from "./floor.ts";
const URL0 = Deno.env.get("SUPABASE_URL") || "", SR = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const SRH = { apikey: SR, Authorization: "Bearer " + SR, "Content-Type": "application/json" };
async function rpc(f: string, a: any) { const r = await fetch(URL0 + "/rest/v1/rpc/" + f, { method: "POST", headers: SRH, body: JSON.stringify(a) }); const t = await r.text(); if (!r.ok) throw new Error("DB " + r.status + " " + t.slice(0, 200)); return t ? JSON.parse(t) : null; }
// 開工前檢索（lab／comm 都會呼叫）：回最多 k 筆片段文字，失敗就回空字串，不影響原流程。關閉：env MEM_HOOK_OFF=1
export async function memContext(agent: string, q: string, k = 3) {
  if (Deno.env.get("MEM_HOOK_OFF") === "1") return "";
  try { const r = await rpc("aivault_mem_search", { p_agent: agent, p_q: q, p_error: null, p_layers: null, p_district: null, p_project: null, p_status: null, p_since: null, p_version: null, p_k: k });
    return (r?.results || []).length ? "\n城市共享記憶（相關片段，已驗證的優先）：\n" + r.results.map((x: any) => `- [${x.status}] ${x.title}：${x.snippet}`).join("\n") : ""; } catch (_) { return ""; }
}
export async function memFix(b: any) {
  const c = await callModel("你是 AIVAULT 程式區代理，負責依共享記憶裡的重現步驟修 bug。只改必要的地方。", `重現步驟與錯誤：\n${String(b.repro || "").slice(0, 4000)}\n\n錯誤輸出：\n${String(b.error || "").slice(0, 1500)}\n\n原始 product.js：\n${String(b.product_js || "").slice(0, 4000)}\n\n只輸出 JSON：{"product_js":"修好的完整檔案","explanation":"一句話說明原因"}`, 2000);
  return { ok: !!c.v?.product_js, product_js: String(c.v?.product_js || ""), explanation: String(c.v?.explanation || ""), model: c.model, tokens: Number(c.usage?.total) || 0 };
}
