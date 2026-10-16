// ?feature=signup-approval：擁有者核准新註冊（只有 app_metadata.role 為 owner/admin 的登入者可用）
const H = { "Access-Control-Allow-Origin": "https://m9wmtcb782-arch.github.io", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", "Content-Type": "application/json" };
const out = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: H });
const URL0 = Deno.env.get("SUPABASE_URL") || "", SR = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const adm = (p: string, init: RequestInit = {}) => fetch(URL0 + "/auth/v1/admin" + p, { ...init, headers: { apikey: SR, Authorization: "Bearer " + SR, "Content-Type": "application/json" } });
export async function signupApproval(r: Request) {
  if (r.method === "OPTIONS") return new Response("ok", { headers: H });
  const tok = (r.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const me = await fetch(URL0 + "/auth/v1/user", { headers: { apikey: SR, Authorization: "Bearer " + tok } }).then((x) => x.ok ? x.json() : null).catch(() => null);
  const role = me?.app_metadata?.role;
  if (!me || (role !== "owner" && role !== "admin")) return out({ error: "owner only" }, 403);
  const b = await r.json().catch(() => ({}));
  if (b.action === "list") {
    const all: any[] = [];
    for (let page = 1; page < 50; page++) { const j = await (await adm("/users?per_page=1000&page=" + page)).json(); const u = j.users || []; all.push(...u); if (u.length < 1000) break; }
    const pending = all.filter((u) => u.app_metadata?.approved === false).map((u) => ({ id: u.id, email: u.email, created_at: u.created_at, email_confirmed_at: u.email_confirmed_at, pending_since: u.app_metadata?.pending_since }));
    return out({ pending });
  }
  if ((b.action === "approve" || b.action === "reject") && typeof b.id === "string") {
    if (b.action === "approve") {
      const r2 = await adm("/users/" + b.id, { method: "PUT", body: JSON.stringify({ ban_duration: "none", app_metadata: { approved: true, approved_at: new Date().toISOString(), approved_by: me.id } }) });
      return out({ ok: r2.ok });
    }
    const r3 = await adm("/users/" + b.id, { method: "DELETE" });
    return out({ ok: r3.ok });
  }
  return out({ error: "bad request" }, 400);
}
