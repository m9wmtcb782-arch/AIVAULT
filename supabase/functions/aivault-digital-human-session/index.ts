/**
 * AIVAULT Digital Human session relay.
 * Secrets stay in Edge Function environment. Frontend must never embed vendor keys.
 *
 * This function does NOT replace technical-dark-star-live-voice.
 * Voice brain path remains: user PCM → live-voice → Technical Dark Star → 24 kHz PCM.
 *
 * MUSIC / 3D / VIDEO dispatch is reserved and must not call generation providers.
 *
 * Deploy (owner / GPT backend):
 *   supabase functions deploy aivault-digital-human-session
 */
const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "https://m9wmtcb782-arch.github.io",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const LIVE_VOICE =
  "wss://clcddygkaaqqtsbswgdf.supabase.co/functions/v1/technical-dark-star-live-voice";

const CONFIG = {
  ok: true,
  module: "aivault-digital-human-session",
  version: "2026-09-29-dh1",
  brain: "technical-dark-star",
  digitalHumanIsBodyOnly: true,
  voice: {
    engine: "VOICE",
    status: "LIVE",
    endpointName: "technical-dark-star-live-voice",
    websocket: LIVE_VOICE,
    input: "audio/pcm;rate=16000",
    output: "audio/pcm;rate=24000",
    features: [
      "microphone",
      "barge-in",
      "inputTranscription",
      "outputTranscription",
      "turnComplete",
      "multi-turn",
      "language-unlocked",
    ],
  },
  engines: {
    VOICE: { status: "LIVE", bind: "technical-dark-star-live-voice" },
    DIGITAL_HUMAN: { status: "LIVE", role: "body", renderer: "canvas-viseme-v1" },
    MUSIC: { status: "RESERVED", invoke: false },
    "3D": { status: "RESERVED", invoke: false },
    VIDEO: { status: "RESERVED", invoke: false },
  },
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function paused(engine: string) {
  return json(200, {
    ok: false,
    engine,
    status: "PAUSED",
    code: "ENGINE_RESERVED",
    verified: "NOT_VERIFIED",
    mock: false,
    reason: "Generation engine is reserved in this build. No provider call was made.",
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  let action = "config";
  let engine = "";
  if (req.method === "GET") {
    const url = new URL(req.url);
    action = url.searchParams.get("action") || "config";
    engine = url.searchParams.get("engine") || "";
  } else if (req.method === "POST") {
    try {
      const body = await req.json();
      action = String(body.action || "config");
      engine = String(body.engine || "");
    } catch {
      return json(400, { ok: false, error: "bad_json", mock: false });
    }
  } else {
    return json(405, { ok: false, error: "method" });
  }

  if (action === "health") {
    return json(200, {
      ok: true,
      status: "source-ready",
      deployed: true,
      brain: "technical-dark-star",
      note: "Function source is in-repo. Confirm ACTIVE after supabase deploy.",
      verified: "REQUIRES_TEST",
    });
  }

  if (action === "config") {
    const auth = req.headers.get("authorization") || "";
    return json(200, {
      ...CONFIG,
      authenticatedHint: auth.toLowerCase().startsWith("bearer ") ? "present" : "missing",
      vendorToken: null,
      secretsExposed: false,
    });
  }

  if (action === "dispatch") {
    const key = engine.toUpperCase();
    if (key === "MUSIC" || key === "3D" || key === "VIDEO") return paused(key);
    if (key === "VOICE" || key === "DIGITAL_HUMAN") {
      return json(200, {
        ok: true,
        engine: key,
        brain: "technical-dark-star",
        status: "LIVE",
        voiceWebsocket: LIVE_VOICE,
        note: "Attach browser client to live-voice. Do not create a second chatbot.",
      });
    }
    return json(400, { ok: false, error: "unknown_engine", engine: key, mock: false });
  }

  if (action === "mint-avatar-vendor-token") {
    const vendorKey = Deno.env.get("AVATAR_VENDOR_API_KEY") || "";
    if (!vendorKey) {
      return json(501, {
        ok: false,
        code: "VENDOR_NOT_CONFIGURED",
        verified: "NOT_VERIFIED",
        mock: false,
        reason: "No AVATAR_VENDOR_API_KEY in Edge secrets. Canvas body remains the renderer.",
      });
    }
    return json(501, {
      ok: false,
      code: "VENDOR_MINT_NOT_IMPLEMENTED",
      verified: "NOT_VERIFIED",
      mock: false,
      reason: "Secret is present but minting is not implemented. Do not fake a talking video.",
    });
  }

  return json(400, { ok: false, error: "unknown_action", action, mock: false });
});
