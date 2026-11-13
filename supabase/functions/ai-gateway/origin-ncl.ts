const MODEL = "OriginAlice1M-NCL";
const WEIGHTS = "ab44dca3246af333861cf36764f90f0f0bd251026ba5401fb9dcc42410ea6667";

export async function originNclInference(
  body: Record<string, unknown>,
  endpoint: string,
  token: string,
) {
  const maxBytes = body.max_bytes === undefined ? 96 : body.max_bytes;
  const message = body.message;
  const promptBytes = typeof message === "string" ? new TextEncoder().encode(message).length : 0;
  if (promptBytes < 1 || promptBytes > 256 || typeof maxBytes !== "number" ||
    !Number.isInteger(maxBytes) || maxBytes < 1 || maxBytes > 256 || body.stream === true) {
    return { status: 400, payload: { success: false, error: "ORIGIN_INVALID_REQUEST" } };
  }

  let target: URL;
  try {
    target = new URL(endpoint);
    const loopback = target.hostname === "127.0.0.1";
    if (!(target.protocol === "https:" || (target.protocol === "http:" && loopback)) ||
      target.username || target.password || target.search || target.hash ||
      target.pathname !== "/worker-001/chat" || new TextEncoder().encode(token).length < 32) {
      throw new Error("invalid worker configuration");
    }
  } catch {
    return { status: 503, payload: { success: false, error: "ORIGIN_WORKER_NOT_CONFIGURED" } };
  }

  try {
    const response = await fetch(target, {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(25_000),
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ message, max_bytes: maxBytes }),
    });
    if (!response.ok) throw new Error("worker returned an error");
    const result = await response.json();
    if (result.model !== MODEL || result.source !== "local-aisl-native" ||
      result.weights_sha256 !== WEIGHTS || result.generated_bytes !== maxBytes ||
      typeof result.output_base64 !== "string" ||
      result.output_base64.length !== 4 * Math.ceil(maxBytes / 3)) {
      throw new Error("invalid inference evidence");
    }
    const raw = Uint8Array.from(atob(result.output_base64), (byte) => byte.charCodeAt(0));
    if (raw.length !== maxBytes || typeof result.answer !== "string") {
      throw new Error("invalid inference payload");
    }
    return {
      status: 200,
      payload: {
        success: true, provider: "origin_ncl", model: MODEL, text: result.answer,
        generated_bytes: raw.length, output_base64: result.output_base64, weights_sha256: WEIGHTS,
      },
    };
  } catch {
    return { status: 502, payload: { success: false, error: "ORIGIN_WORKER_UNAVAILABLE" } };
  }
}
