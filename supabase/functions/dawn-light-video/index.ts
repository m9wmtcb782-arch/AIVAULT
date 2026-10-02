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

  let body: { prompt?: string; duration_seconds?: number; id?: string } = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad_json" }, 400);
  }

  if (body.id) {
    const result = await fetch(base + "/functions/v1/magic-hour-result", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        authorization: req.headers.get("authorization") || "",
        apikey: req.headers.get("apikey") || "",
      },
      body: JSON.stringify({ id: body.id }),
    });
    const data = await result.json().catch(() => ({}));
    return json({
      agent_id: "dawn-light",
      function: "dawn-light-video",
      action: "result",
      upstream: "magic-hour-result",
      upstream_status: result.status,
      storage: "aivault-videos bucket 2026-10-03 不存在，這次未重測",
      ...data,
    }, result.ok ? 200 : result.status);
  }

  return json({
    agent_id: "dawn-light",
    function: "dawn-light-video",
    status: "BLOCKED",
    duration_seconds: body.duration_seconds || 5,
    error: "aivault-videos bucket 未確認，不建立新影片任務",
  }, 409);
});
