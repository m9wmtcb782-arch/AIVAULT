import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { ttsGemini, geminiConfigured } from "./gemini.ts";

/**
 * AIVAULT TTS v1.0
 * Provider-agnostic text-to-speech.
 * Does not hardcode a vendor. Uses env keys if present.
 * If no TTS provider is configured, returns browser fallback.
 */

const VERSION = "aivault-tts-v1.2-gemini";
const SERVICE = "AIVAULT_TTS";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-aivault-internal",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Content-Type": "application/json; charset=utf-8",
  };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders() });
}

function providerPool() {
  const pool: { code: string; ready: boolean }[] = [
    { code: "google", ready: !!(Deno.env.get("GOOGLE_TTS_API_KEY") || Deno.env.get("GOOGLE_CLOUD_TTS_KEY")) },
    { code: "openai", ready: !!(Deno.env.get("OPENAI_API_KEY") || Deno.env.get("OPENAI_KEY")) },
    { code: "elevenlabs", ready: !!(Deno.env.get("ELEVENLABS_API_KEY") || Deno.env.get("ELEVEN_API_KEY")) },
    { code: "groq", ready: false },
    { code: "gemini", ready: geminiConfigured() },
    { code: "magic-hour", ready: false },
    { code: "browser", ready: true },
  ];
  return pool;
}

function pickProvider(requested?: string | null) {
  const pool = providerPool();
  if (requested && requested !== "auto") {
    const hit = pool.find((p) => p.code === requested);
    if (hit) return hit;
  }
  return pool.find((p) => p.code !== "browser" && p.code !== "gemini" && p.ready) || pool.find((p) => p.code === "browser")!;
}

async function ttsGoogle(text: string, language?: string, voice?: string) {
  const key = Deno.env.get("GOOGLE_TTS_API_KEY") || Deno.env.get("GOOGLE_CLOUD_TTS_KEY") || "";
  const lang = language === "en-US" || language === "en" ? "en-US"
    : language === "zh-CN" || language === "zh-Hans" ? "cmn-CN"
    : "cmn-TW";
  const voiceName = voice || (lang === "en-US" ? "en-US-Neural2-C" : lang === "cmn-CN" ? "cmn-CN-Wavenet-A" : "cmn-TW-Wavenet-A");
  const res = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      input: { text },
      voice: { languageCode: lang, name: voiceName },
      audioConfig: { audioEncoding: "MP3" },
    }),
  });
  if (!res.ok) throw new Error(`GOOGLE_TTS_FAILED:${res.status}:${await res.text()}`);
  const data = await res.json();
  if (!data.audioContent) throw new Error("GOOGLE_TTS_EMPTY");
  return { mime: "audio/mpeg", base64: data.audioContent };
}

async function ttsOpenAI(text: string, voice?: string) {
  const key = Deno.env.get("OPENAI_API_KEY") || Deno.env.get("OPENAI_KEY") || "";
  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: Deno.env.get("OPENAI_TTS_MODEL") || "gpt-4o-mini-tts",
      voice: voice || Deno.env.get("OPENAI_TTS_VOICE") || "alloy",
      input: text,
      format: "mp3",
    }),
  });
  if (!res.ok) throw new Error(`OPENAI_TTS_FAILED:${res.status}:${await res.text()}`);
  const buf = new Uint8Array(await res.arrayBuffer());
  return { mime: "audio/mpeg", base64: btoa(String.fromCharCode(...buf)) };
}

async function ttsElevenLabs(text: string, voiceId?: string) {
  const key = Deno.env.get("ELEVENLABS_API_KEY") || Deno.env.get("ELEVEN_API_KEY") || "";
  const vid = voiceId || Deno.env.get("ELEVENLABS_VOICE_ID") || "21m00Tcm4TlvDq8ikWAM";
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${vid}`, {
    method: "POST",
    headers: {
      "xi-api-key": key,
      accept: "audio/mpeg",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text,
      model_id: Deno.env.get("ELEVENLABS_MODEL") || "eleven_multilingual_v2",
    }),
  });
  if (!res.ok) throw new Error(`ELEVENLABS_TTS_FAILED:${res.status}:${await res.text()}`);
  const buf = new Uint8Array(await res.arrayBuffer());
  return { mime: "audio/mpeg", base64: btoa(String.fromCharCode(...buf)) };
}

async function speak(body: any) {
  const text = String(body?.text || body?.message || body?.content || "").trim();
  if (!text) throw new Error("TEXT_REQUIRED");

  const requested = typeof body?.provider === "string" ? body.provider.trim().toLowerCase() : "auto";
  const chosen = pickProvider(requested);

  if (chosen.code === "gemini" && !chosen.ready) throw new Error("GEMINI_TTS_NOT_CONFIGURED");
  if (chosen.code === "browser" || !chosen.ready) {
    return {
      fallback: "browser_speech_synthesis",
      provider: "browser",
      audio_url: null,
      audio_base64: null,
      language: body?.language || "zh-TW",
      reason: "NO_TTS_PROVIDER_KEY",
    };
  }

  let audio: { mime: string; base64: string };
  if (chosen.code === "gemini") audio = await ttsGemini(text, body?.language, body?.voice_id || body?.voice);
  else if (chosen.code === "google") audio = await ttsGoogle(text, body?.language, body?.voice_id || body?.voice);
  else if (chosen.code === "openai") audio = await ttsOpenAI(text, body?.voice_id || body?.voice);
  else if (chosen.code === "elevenlabs") audio = await ttsElevenLabs(text, body?.voice_id || body?.provider_voice_id);
  else {
    return {
      fallback: "browser_speech_synthesis",
      provider: chosen.code,
      audio_url: null,
      audio_base64: null,
      language: body?.language || "zh-TW",
      reason: "PROVIDER_TTS_NOT_IMPLEMENTED",
    };
  }

  let audioUrl: string | null = null;
  if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY && body?.save !== false) {
    const path = `tts/${crypto.randomUUID()}.${audio.mime === "audio/wav" ? "wav" : "mp3"}`;
    const bin = Uint8Array.from(atob(audio.base64), (c) => c.charCodeAt(0));
    const up = await fetch(`${SUPABASE_URL}/storage/v1/object/aivault-digital-human-voices/${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        "Content-Type": audio.mime,
        "x-upsert": "true",
      },
      body: bin,
    });
    if (up.ok) {
      const signed = await fetch(
        `${SUPABASE_URL}/storage/v1/object/sign/aivault-digital-human-voices/${encodeURIComponent(path)}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            apikey: SUPABASE_SERVICE_ROLE_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ expiresIn: 3600 }),
        },
      );
      if (signed.ok) {
        const d = await signed.json();
        if (d.signedURL) {
          audioUrl = String(d.signedURL).startsWith("http")
            ? d.signedURL
            : `${SUPABASE_URL}/storage/v1${d.signedURL}`;
        }
      }
    }
  }

  return {
    fallback: null,
    provider: chosen.code,
    mime: audio.mime,
    audio_base64: audio.base64,
    audio_url: audioUrl,
    language: body?.language || "zh-TW",
    voice_id: body?.voice_id || null,
    digital_human_id: body?.digital_human_id || null,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders() });

  if (req.method === "GET") {
    return json({
      success: true,
      service: SERVICE,
      version: VERSION,
      status: "ready",
      actions: ["tts", "speak", "health"],
      providers: providerPool().map((p) => ({ code: p.code, configured: p.ready })),
      note: "provider is optional. auto picks first configured key. browser is always fallback.",
      security: { api_keys_exposed: false },
    });
  }

  if (req.method !== "POST") {
    return json({ success: false, service: SERVICE, version: VERSION, error: "METHOD_NOT_ALLOWED" }, 405);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "tts");
    if (action === "health") {
      return json({
        success: true,
        service: SERVICE,
        version: VERSION,
        status: "ready",
        providers: providerPool(),
        security: { api_keys_exposed: false },
      });
    }
    if (action !== "tts" && action !== "speak") {
      return json({
        success: false,
        service: SERVICE,
        version: VERSION,
        error: "INVALID_ACTION",
        message: "Supported actions: tts, speak, health",
      }, 400);
    }

    const result = await speak(body);
    return json({
      success: true,
      action: "tts",
      service: SERVICE,
      version: VERSION,
      result,
      security: { api_keys_exposed: false },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return json({
      success: false,
      service: SERVICE,
      version: VERSION,
      error: "TTS_ERROR",
      message,
      result: { fallback: "browser_speech_synthesis" },
      security: { api_keys_exposed: false },
    }, 500);
  }
});

