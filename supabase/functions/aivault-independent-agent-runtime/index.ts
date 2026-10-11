import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const GATEWAY_URL = SUPABASE_URL.replace(/\/$/, "") + "/functions/v1/ai-gateway";
const GATEWAY_INTERNAL_SECRET = Deno.env.get("AI_GATEWAY_INTERNAL_SECRET") || Deno.env.get("GATEWAY_INTERNAL_SECRET") || "";

function cors() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-aivault-internal",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json; charset=utf-8",
  };
}
function json(body: unknown, status=200) {
  return new Response(JSON.stringify(body), { status, headers: cors() });
}
function authHeaders() {
  return { "apikey": SERVICE_ROLE, "Authorization": "Bearer " + SERVICE_ROLE, "Content-Type": "application/json" };
}
async function rest(path: string, init: RequestInit = {}) {
  return fetch(SUPABASE_URL + "/rest/v1/" + path, {
    ...init,
    headers: { ...authHeaders(), ...(init.headers || {}) },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, {status:204, headers:cors()});
  if (req.method !== "POST") return json({success:false,error:"METHOD_NOT_ALLOWED"},405);

  try {
    const body = await req.json();
    const agentId = String(body.agent_id || body.agent || "").trim();
    const task = String(body.task || body.question || body.prompt || "").trim();
    const executionId = String(body.execution_id || crypto.randomUUID());

    if (!agentId || !task) return json({success:false,error:"AGENT_ID_AND_TASK_REQUIRED"},400);

    // Fail closed before context access, model inference, or learning writes.
    if (!SUPABASE_URL || !SERVICE_ROLE) return json({success:false,error:"AUTHORIZATION_UNAVAILABLE"},503);
    const bearer = /^Bearer\s+(\S+)$/i.exec(req.headers.get("authorization") || "");
    if (!bearer || bearer[1] === SERVICE_ROLE) return json({success:false,error:"AUTH_REQUIRED"},401);
    const userResp = await fetch(SUPABASE_URL + "/auth/v1/user", {
      headers: { apikey: SERVICE_ROLE, Authorization: "Bearer " + bearer[1] }
    });
    if (!userResp.ok) return json({success:false,error:"AUTH_INVALID"},401);
    const user = await userResp.json();
    if (typeof user.id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user.id)) {
      return json({success:false,error:"AUTH_INVALID"},401);
    }
    const accessResp = await rest("rpc/aivault_check_agent_execute_access", {
      method: "POST",
      body: JSON.stringify({p_agent_id:agentId,p_user_id:user.id})
    });
    if (!accessResp.ok) return json({success:false,error:"AUTHORIZATION_UNAVAILABLE"},503);
    if (await accessResp.json() !== true) return json({success:false,error:"AGENT_ACCESS_DENIED"},403);

    const contextResp = await rest("rpc/aivault_prepare_agent_context", {
      method:"POST",
      body: JSON.stringify({p_agent_id: agentId, p_task: task}),
    });
    const contextRows = await contextResp.json();
    if (!contextResp.ok) return json({success:false,error:"CONTEXT_PREPARATION_FAILED",detail:contextRows},500);
    const context = Array.isArray(contextRows) ? contextRows[0] : contextRows;

    const requestedCapability = String(body.capability || "").trim().toLowerCase();
    if (requestedCapability === "image_generation" || requestedCapability === "image/jpeg") {
      const imageUrl = SUPABASE_URL.replace(/\/$/, "") + "/functions/v1/aivault-ai-image-generation";
      const imageSecret =
        Deno.env.get("AIVAULT_INTERNAL_SECRET") ||
        Deno.env.get("GATEWAY_INTERNAL_SECRET") ||
        Deno.env.get("COMPUTE_COORDINATOR_SECRET") || "";

      const imageResp = await fetch(imageUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-aivault-internal": imageSecret,
          "x-aivault-agent-id": agentId
        },
        body: JSON.stringify({
          agent_id: agentId,
          prompt: String(body.image_prompt || task),
          aspect_ratio: body.aspect_ratio || "1:1",
          image_size: body.image_size || "1K"
        })
      });

      const imageRaw = await imageResp.text();
      let imageResult: any;
      try { imageResult = JSON.parse(imageRaw); }
      catch { imageResult = { ok:false, error:{code:"INVALID_IMAGE_RESPONSE",message:imageRaw} }; }

      if (!imageResp.ok || !imageResult.ok) {
        return json({
          success:false,
          evidence:"IMAGE_GENERATION_FAILED",
          agent_id:agentId,
          capability:"image_generation",
          image:imageResult
        },502);
      }

      return json({
        success:true,
        evidence:"IMAGE_GENERATION_CONNECTED",
        agent_id:agentId,
        capability:"image_generation",
        mime_type:"image/jpeg",
        format_verified:imageResult.format_verified === true,
        image:imageResult.artifact,
        provider:imageResult.provider || null,
        model:imageResult.model || null,
        response_id:imageResult.response_id || null
      });
    }


    const system = [
      "你是 AIVAULT 中一個獨立 Agent。",
      "你不是暗星，也不是曙光。",
      "你必須依照自己的身份、人格、價值、目標、信念、經驗與記憶形成判斷。",
      "不要假裝擁有尚未發生的經驗。",
      "先獨立分析，再提出決策；如果資訊不足，明確指出不確定性。",
      "請用繁體中文回答。",
      "",
      "你的個人上下文：",
      JSON.stringify(context),
    ].join("\n");

    const gatewayResp = await fetch(GATEWAY_URL, {
      method:"POST",
      headers:{
        "Content-Type":"application/json",
        ...(GATEWAY_INTERNAL_SECRET
          ? {"x-aivault-internal": GATEWAY_INTERNAL_SECRET}
          : (req.headers.get("x-aivault-internal")
              ? {"x-aivault-internal":req.headers.get("x-aivault-internal")!}
              : (req.headers.get("authorization")
                  ? {"Authorization":req.headers.get("authorization")!}
                  : {}))),
      },
      body: JSON.stringify({
        provider: body.provider || "gemini",
        model: body.model || "gemini-3.6-flash",
        capability: "chat",
        agent: agentId,
        execution_id: executionId,
        temperature: typeof body.temperature === "number" ? body.temperature : 0.7,
        max_tokens: typeof body.max_tokens === "number" ? body.max_tokens : 1200,
        messages: [
          {role:"system", content:system},
          {role:"user", content:task},
        ],
      }),
    });

    const gatewayRaw = await gatewayResp.text();
    let gateway: any;
    try { gateway = JSON.parse(gatewayRaw); } catch { gateway = {success:false,error:"INVALID_GATEWAY_RESPONSE",raw:gatewayRaw}; }

    if (!gatewayResp.ok || !gateway.success || !gateway.content) {
      await rest("aivault_agent_runtime?agent_id=eq." + encodeURIComponent(agentId), {
        method:"PATCH",
        headers:{"Prefer":"return=minimal"},
        body:JSON.stringify({state:"ERROR",current_task:task,current_context:context,updated_at:new Date().toISOString()}),
      });
      return json({success:false,error:"MODEL_INFERENCE_FAILED",agent_id:agentId,gateway_status:gatewayResp.status,gateway},502);
    }

    const answer = String(gateway.content);
    const decision = {
      task,
      answer,
      provider: gateway.provider || null,
      model: gateway.model || null,
      execution_id: executionId,
      created_at: new Date().toISOString(),
    };
    const experience = {
      task,
      outcome: answer,
      provider: gateway.provider || null,
      model: gateway.model || null,
      execution_id: executionId,
      learned_at: new Date().toISOString(),
    };

    const recordResp = await rest("rpc/aivault_record_agent_learning", {
      method:"POST",
      body:JSON.stringify({
        p_agent_id:agentId,
        p_task:task,
        p_thought:answer,
        p_decision:decision,
        p_experience:experience,
      }),
    });
    const record = await recordResp.json();
    if (!recordResp.ok) {
      return json({success:false,error:"RUNTIME_LEARNING_WRITE_FAILED",detail:record,agent_id:agentId,answer},500);
    }

    const memoryInsert = await rest("aivault_agent_memory", {
      method:"POST",
      headers:{"Prefer":"return=minimal"},
      body:JSON.stringify({
        agent_id:agentId,
        memory_type:"experience",
        content:"任務："+task+"\\n我的回應："+answer,
        importance:0.7,
        source:"aivault-independent-agent-runtime",
        token_estimate:Math.ceil(answer.length/4),
        active:true,
      }),
    });

    await rest("aivault_agent_runtime?agent_id=eq." + encodeURIComponent(agentId), {
      method:"PATCH",
      headers:{"Prefer":"return=minimal"},
      body:JSON.stringify({state:"READY",updated_at:new Date().toISOString()}),
    });

    return json({
      success:true,
      evidence:"MODEL_INFERENCE_CONNECTED",
      agent_id:agentId,
      identity:context?.identity || null,
      decision,
      experience,
      memory_written:memoryInsert.ok,
      gateway:{
        provider:gateway.provider || null,
        model:gateway.model || null,
        fallback:gateway.fallback ?? null,
        execution_id:gateway.execution_id || executionId,
      },
    });
  } catch (error) {
    return json({success:false,error:"INDEPENDENT_AGENT_RUNTIME_ERROR",message:error instanceof Error ? error.message : String(error)},500);
  }
});
