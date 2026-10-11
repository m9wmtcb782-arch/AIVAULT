
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(
  body: Record<string, unknown>,
  status = 200,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return json(
      { success: false, error: "METHOD_NOT_ALLOWED" },
      405,
    );
  }

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return json(
      { success: false, error: "CONFIGURATION_UNAVAILABLE" },
      503,
    );
  }

  const authorization = req.headers.get("authorization") || "";
  const tokenMatch = /^Bearer\s+(\S+)$/i.exec(authorization);

  if (!tokenMatch) {
    return json(
      { success: false, error: "AUTH_REQUIRED" },
      401,
    );
  }

  let agentId: string;

  try {
    const body = await req.json();

    agentId =
      typeof body.agent_id === "string"
        ? body.agent_id.trim()
        : "";
  } catch {
    return json(
      { success: false, error: "INVALID_JSON" },
      400,
    );
  }

  if (!agentId || agentId.length > 128) {
    return json(
      { success: false, error: "INVALID_AGENT_ID" },
      400,
    );
  }

  try {
    // Verify the user's token with Supabase Auth.
    const userResponse = await fetch(
      `${SUPABASE_URL}/auth/v1/user`,
      {
        headers: {
          apikey: SERVICE_ROLE_KEY,
          Authorization: `Bearer ${tokenMatch[1]}`,
        },
      },
    );

    if (!userResponse.ok) {
      return json(
        { success: false, error: "AUTH_INVALID" },
        401,
      );
    }

    const user = await userResponse.json();

    if (
      typeof user.id !== "string" ||
      !/^[0-9a-f-]{36}$/i.test(user.id)
    ) {
      return json(
        { success: false, error: "AUTH_INVALID" },
        401,
      );
    }

    // Only the backend can call this protected RPC.
    const accessResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/rpc/aivault_check_agent_execute_access`,
      {
        method: "POST",
        headers: {
          apikey: SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          p_agent_id: agentId,
          p_user_id: user.id,
        }),
      },
    );

    if (!accessResponse.ok) {
      return json(
        {
          success: false,
          error: "AUTHORIZATION_UNAVAILABLE",
        },
        503,
      );
    }

    const allowed = await accessResponse.json();

    if (allowed !== true) {
      return json(
        {
          success: false,
          error: "AGENT_ACCESS_DENIED",
        },
        403,
      );
    }

    return json({
      success: true,
      authorized: true,
      agent_id: agentId,
    });
  } catch {
    return json(
      {
        success: false,
        error: "AUTHORIZATION_UNAVAILABLE",
      },
      503,
    );
  }
});
