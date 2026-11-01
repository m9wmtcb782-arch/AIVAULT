// verify_jwt=false。驗 X-Line-Signature（HMAC-SHA256, LINE_CHANNEL_SECRET）後把原始 body 存進 line_inbox，回 200。
import { createClient } from "npm:@supabase/supabase-js@2";
const enc = new TextEncoder();
async function valid(body: string, sig: string | null, secret: string) {
  if (!sig) return false;
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(body)))));
  if (mac.length !== sig.length) return false; let d = 0; for (let i = 0; i < mac.length; i++) d |= mac.charCodeAt(i) ^ sig.charCodeAt(i); return d === 0;
}
const eq = (a: string, b: string) => { const x = enc.encode(a), y = enc.encode(b); let d = x.length ^ y.length; for (let i = 0; i < Math.max(x.length, y.length); i++) d |= (x[i] ?? 0) ^ (y[i] ?? 0); return d === 0; };
const db = () => createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
Deno.serve(async (req) => {
  const url = new URL(req.url);
  if (url.pathname.endsWith("/pull")) { // box 輪詢：x-relay-secret 常數時間比對；回傳並標記已取走
    const want = Deno.env.get("RELAY_POLL_SECRET") ?? ""; const got = req.headers.get("x-relay-secret") ?? "";
    if (!want || !eq(got, want)) return new Response("", { status: 401 });
    const sb = db(); const { data, error } = await sb.from("line_inbox").select("id,signature,raw_body").is("consumed_at", null).order("id").limit(20);
    if (error) { console.error("pull select failed", error.code); return new Response("", { status: 500 }); }
    if (data?.length) await sb.from("line_inbox").update({ consumed_at: new Date().toISOString() }).in("id", data.map((r) => r.id));
    return new Response(JSON.stringify({ events: data ?? [] }), { headers: { "content-type": "application/json" } });
  }
  if (req.method !== "POST") return new Response("", { status: 404 });
  const body = await req.text(); if (body.length > 65536) return new Response("", { status: 413 });
  const sig = req.headers.get("x-line-signature");
  if (!(await valid(body, sig, Deno.env.get("LINE_CHANNEL_SECRET") ?? ""))) return new Response("", { status: 401 });
  const sb = db();
  const { error } = await sb.from("line_inbox").insert({ signature: sig, raw_body: body });
  if (error) { console.error("line_inbox insert failed", error.code); return new Response("", { status: 500 }); }
  return new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
});
