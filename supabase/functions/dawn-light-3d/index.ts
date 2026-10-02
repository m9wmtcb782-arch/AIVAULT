const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "https://m9wmtcb782-arch.github.io",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  return new Response(JSON.stringify({
    agent_id: "dawn-light",
    function: "dawn-light-3d",
    status: "BLOCKED",
    provider: null,
    error: "repo 沒有 3D generation runtime，不呼叫 provider",
  }), {
    status: 409,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
});
