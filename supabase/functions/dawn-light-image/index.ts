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

  let body: { prompt?: string; aspect_ratio?: string } = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad_json" }, 400);
  }
  const prompt = String(body.prompt || "").trim();
  if (!prompt) return json({ agent_id: "dawn-light", error: "need_prompt" }, 400);

  const upstream = await fetch(base + "/functions/v1/dark-star-image-generation", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      authorization: req.headers.get("authorization") || "",
      apikey: req.headers.get("apikey") || "",
    },
    body: JSON.stringify({
      agent_id: "dawn-light",
      sandbox: "dawn-light",
      prompt,
      mime_type: "image/jpeg",
      aspect_ratio: body.aspect_ratio || "1:1",
      reject_svg: true,
    }),
  });
  const data = await upstream.json().catch(() => ({}));
  const mime = String(data.mime_type || "");
  const url = String(data.artifact?.signed_url || "");
  if (/svg/i.test(mime) || /<svg/i.test(JSON.stringify(data))) {
    return json({ agent_id: "dawn-light", ok: false, error: "svg_rejected", upstream_status: upstream.status }, 422);
  }
  return json({
    agent_id: "dawn-light",
    function: "dawn-light-image",
    format: "image/jpeg",
    upstream: "dark-star-image-generation",
    upstream_status: upstream.status,
    url,
    ...data,
  }, upstream.ok ? 200 : upstream.status);
});
