const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "https://m9wmtcb782-arch.github.io",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method" }), {
      status: 405,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const key = Deno.env.get("FISH_API_KEY") || "";
  if (!key) {
    return new Response(JSON.stringify({ error: "missing_secret" }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  let body: { text?: string; reference_id?: string; format?: string } = {};
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "bad_json" }), {
      status: 400,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const text = String(body.text || "").trim();
  const reference_id = String(body.reference_id || "").trim();
  const format = String(body.format || "mp3");
  if (!text || !reference_id) {
    return new Response(JSON.stringify({ error: "need_text_and_reference_id" }), {
      status: 400,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const fish = await fetch("https://api.fish.audio/v1/tts", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + key,
      "Content-Type": "application/json",
      model: "s2.1-pro",
    },
    body: JSON.stringify({
      text,
      reference_id,
      format,
      model: "s2.1-pro",
    }),
  });

  const buf = await fish.arrayBuffer();
  const ctype = fish.headers.get("content-type") || (fish.ok ? "audio/mpeg" : "application/json");
  return new Response(buf, {
    status: fish.status,
    headers: { ...CORS, "Content-Type": ctype },
  });
});
