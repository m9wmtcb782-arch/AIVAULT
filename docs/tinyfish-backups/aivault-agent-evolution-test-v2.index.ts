import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const TEST_AGENT_ID = "Worker-0134";

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "POST_REQUIRED" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "AUTH_REQUIRED" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: { task?: string } = {};
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "INVALID_JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const task = typeof body.task === "string" ? body.task.trim() : "";
  if (!task.startsWith("[CAUSAL-TEST]")) {
    return new Response(JSON.stringify({
      error: "TEST_TASK_REQUIRED",
      required_prefix: "[CAUSAL-TEST]",
      agent_id: TEST_AGENT_ID,
    }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/aivault-agent-evolution`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": auth,
      },
      body: JSON.stringify({
        agent_id: TEST_AGENT_ID,
        task,
        source: "controlled_causal_test_harness",
      }),
    },
  );

  const text = await response.text();
  return new Response(text, {
    status: response.status,
    headers: {
      "Content-Type": response.headers.get("Content-Type") ?? "application/json",
    },
  });
});
