const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "https://m9wmtcb782-arch.github.io",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);

  const base = Deno.env.get("SUPABASE_URL") || "";
  if (!base) return json({ agent_id: "dawn-light", error: "missing_supabase_url" }, 500);

  let body: { prompt?: string; image?: string; messages?: unknown[] } = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad_json" }, 400);
  }
  if (!body.image && !body.messages) return json({ agent_id: "dawn-light", error: "need_image" }, 400);

  const upstream = await fetch(base + "/functions/v1/ai-gateway", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      authorization: req.headers.get("authorization") || "",
      apikey: req.headers.get("apikey") || "",
    },
    body: JSON.stringify({
      agent_id: "dawn-light",
      capability: "vision",
      messages: body.messages || [
        { role: "user", content: body.prompt || "描述這張圖", image: body.image },
      ],
      image: body.image || null,
    }),
  });
  const data = await upstream.json().catch(() => ({}));
  return json({
    agent_id: "dawn-light",
    function: "dawn-light-vision",
    status: "NOT_VERIFIED",
    note: "轉送現有 ai-gateway。2026-10-03 圖內容辨識未驗證。",
    upstream: "ai-gateway",
    upstream_status: upstream.status,
    ...data,
  }, upstream.ok ? 200 : upstream.status);
});
