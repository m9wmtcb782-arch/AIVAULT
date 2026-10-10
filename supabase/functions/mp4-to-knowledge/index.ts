import "jsr:@supabase/functions-js/edge-runtime.d.ts";

/**
 * AIVAULT MP4 -> Knowledge transcription endpoint.
 *
 * Accepts multipart/form-data with a required "file" field, then delegates
 * multimodal processing to the existing ai-gateway. No provider API key is
 * stored in or exposed by this function.
 *
 * Request: POST /functions/v1/mp4-to-knowledge
 * Form field: file (video/*, preferably video/mp4)
 * Response: { ok: true, transcript, characters, filename, source }
 */

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const MAX_FILE_BYTES = 18 * 1024 * 1024;
const MAX_TRANSCRIPT_CHARS = 500_000;
const GATEWAY_TIMEOUT_MS = 110_000;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, apikey, x-client-info, content-type, x-aivault-internal",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders,
  });
}

function bytesToBase64(bytes: Uint8Array): string {
  // Avoid argument-count limits from String.fromCharCode(...largeArray).
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(
      ...bytes.subarray(offset, Math.min(offset + chunkSize, bytes.length)),
    );
  }
  return btoa(binary);
}

function extractText(payload: unknown): string {
  if (typeof payload === "string") return payload.trim();
  if (!payload || typeof payload !== "object") return "";
  const value = payload as Record<string, unknown>;

  for (const key of [
    "content", "text", "answer", "message", "analysis",
    "transcript", "transcription",
  ]) {
    if (typeof value[key] === "string" && String(value[key]).trim()) {
      return String(value[key]).trim();
    }
  }

  for (const key of ["data", "result", "response", "output"]) {
    if (value[key] && typeof value[key] === "object") {
      const nested = extractText(value[key]);
      if (nested) return nested;
    }
  }

  // Defensive support if a provider-shaped response passes through the gateway.
  const candidates = value.candidates;
  if (Array.isArray(candidates)) {
    const parts = candidates.flatMap((candidate: any) =>
      Array.isArray(candidate?.content?.parts) ? candidate.content.parts : []
    );
    const text = parts.map((part: any) =>
      typeof part?.text === "string" ? part.text : ""
    ).filter(Boolean).join("\n").trim();
    if (text) return text;
  }
  return "";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return json({ ok: false, error: "METHOD_NOT_ALLOWED" }, 405);
  }
  if (!SUPABASE_URL) {
    return json({ ok: false, error: "SUPABASE_URL_NOT_CONFIGURED" }, 500);
  }

  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return json({
        ok: false,
        error: "MP4_FILE_REQUIRED",
        message: "請以 multipart/form-data 的 file 欄位上傳影片。",
      }, 400);
    }
    if (file.size === 0) {
      return json({ ok: false, error: "EMPTY_FILE" }, 400);
    }
    if (file.size > MAX_FILE_BYTES) {
      return json({
        ok: false,
        error: "FILE_TOO_LARGE",
        max_bytes: MAX_FILE_BYTES,
        message: "單檔上限為 18 MB，請壓縮影片後重試。",
      }, 413);
    }

    const isMp4 = /\.mp4$/i.test(file.name);
    if (!file.type.startsWith("video/") && !isMp4) {
      return json({ ok: false, error: "VIDEO_FILE_REQUIRED" }, 415);
    }

    const mimeType = file.type || "video/mp4";
    const videoDataUrl = `data:${mimeType};base64,${bytesToBase64(new Uint8Array(await file.arrayBuffer()))}`;
    const prompt = [
      "任務：將附加影片中的可辨識語音逐字轉錄。",
      "以繁體中文輸出；若講者使用其他語言，保留原語言，不要擅自翻譯。",
      "不要摘要、改寫、推測或補造聽不清楚的內容。",
      "保留可辨識的專有名詞、數字與語句順序；可依停頓分段換行。",
      "若確實沒有可辨識語音，明確輸出「未辨識到可轉錄語音」。",
      "只輸出轉錄本文，不要輸出影片畫面描述或前言。",
    ].join("\n");

    const forwardedHeaders: Record<string, string> = {
      "Content-Type": "application/json",
    };
    // Forward the caller's Supabase auth context. Never add a service-role key.
    const authorization = req.headers.get("authorization");
    const apikey = req.headers.get("apikey");
    const clientInfo = req.headers.get("x-client-info");
    if (authorization) forwardedHeaders.Authorization = authorization;
    if (apikey) forwardedHeaders.apikey = apikey;
    if (clientInfo) forwardedHeaders["x-client-info"] = clientInfo;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), GATEWAY_TIMEOUT_MS);
    let gatewayResponse: Response;
    try {
      gatewayResponse = await fetch(`${SUPABASE_URL}/functions/v1/ai-gateway`, {
        method: "POST",
        headers: forwardedHeaders,
        body: JSON.stringify({
          message: prompt,
          capability: "vision",
          media: videoDataUrl,
          media_type: "video",
          temperature: 0.1,
          max_tokens: 8192,
          metadata: {
            source: "mp4-to-knowledge",
            filename: file.name,
            mime_type: mimeType,
          },
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    const raw = await gatewayResponse.text();
    let gatewayPayload: any;
    try {
      gatewayPayload = JSON.parse(raw);
    } catch {
      gatewayPayload = { raw };
    }

    if (!gatewayResponse.ok || gatewayPayload?.success === false) {
      return json({
        ok: false,
        error: "AI_GATEWAY_FAILED",
        status: gatewayResponse.status,
        detail: String(
          gatewayPayload?.error ||
          gatewayPayload?.message ||
          gatewayPayload?.raw ||
          "AI Gateway did not complete the transcription",
        ).slice(0, 1200),
      }, 502);
    }

    const transcript = extractText(gatewayPayload);
    if (
      !transcript ||
      /後端轉錄完成後|這裡會顯示從 MP4 轉出的完整文字內容|示範文字/.test(transcript)
    ) {
      return json({
        ok: false,
        error: "EMPTY_TRANSCRIPTION",
        message: "AI Gateway 未回傳可用的真實轉錄文字；未以示範文字代替。",
        gateway_fields: Object.keys(gatewayPayload || {}),
      }, 502);
    }
    if (transcript.length > MAX_TRANSCRIPT_CHARS) {
      return json({
        ok: false,
        error: "TRANSCRIPT_TOO_LONG",
        message: "轉錄結果超出單次回傳長度上限。",
      }, 502);
    }

    return json({
      ok: true,
      filename: file.name,
      transcript,
      characters: transcript.length,
      source: "ai-gateway",
      message: "轉錄完成",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const timedOut = error instanceof Error &&
      (error.name === "AbortError" || /abort|timed out/i.test(error.message));
    return json({
      ok: false,
      error: timedOut ? "AI_GATEWAY_TIMEOUT" : "TRANSCRIPTION_REQUEST_FAILED",
      message: timedOut
        ? "影片轉錄逾時，請縮短影片或降低檔案大小後重試。"
        : message.slice(0, 1000),
    }, timedOut ? 504 : 500);
  }
});
