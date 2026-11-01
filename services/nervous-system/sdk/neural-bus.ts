// AIVAULT 神經訊號匯流排（Deno / Supabase Edge SDK）。預設關閉（NEURAL_BUS_ON !== "1"）→ 這個模組什麼都不做，函式行為完全不變。
// 開啟後：包裝 Deno.serve 的 handler，對每個請求發出 sensory（request）與 motor（response status）事件到 neural_events（service role，append-only）。
// 只記 method、path、status、耗時；不記 body、header、金鑰。寫入失敗一律忽略，不影響原本回應。
const ON = (() => { try { return Deno.env.get("NEURAL_BUS_ON") === "1"; } catch { return false; } })();
export function neuralEmit(ev: Record<string, unknown>) {
  if (!ON) return; const url = Deno.env.get("SUPABASE_URL"), key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"); if (!url || !key) return;
  fetch(url + "/rest/v1/neural_events", { method: "POST", headers: { apikey: key, Authorization: "Bearer " + key, "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify({ v: 1, ...ev }) }).catch(() => {});
}
if (ON) {
  const orig = Deno.serve.bind(Deno); const program = (() => { try { return new URL(import.meta.url).pathname; } catch { return "edge"; } })();
  // deno-lint-ignore no-explicit-any
  (Deno as any).serve = (...args: any[]) => {
    const i = args.findIndex((a) => typeof a === "function"); if (i < 0) return (orig as any)(...args);
    const h = args[i]; args[i] = async (req: Request, info: unknown) => { const t0 = Date.now(); const path = new URL(req.url).pathname;
      try { const res = await h(req, info); neuralEmit({ base: Deno.env.get("NEURAL_BASE") || "base1", program: path, organ: "motor", kind: "edge_response", outcome: res.status < 400 ? "pass" : "fail", payload: { method: req.method, status: res.status, ms: Date.now() - t0 } }); return res; }
      catch (e) { neuralEmit({ base: Deno.env.get("NEURAL_BASE") || "base1", program: path, organ: "reflex", kind: "edge_error", outcome: "fail", payload: { msg: String((e as Error)?.message || e).slice(0, 160) } }); throw e; } };
    return (orig as any)(...args); };
  void program;
}
