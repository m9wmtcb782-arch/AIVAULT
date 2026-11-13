import { createOriginCpu } from "./origin-cpu.mjs";

const WEIGHTS = "ab44dca3246af333861cf36764f90f0f0bd251026ba5401fb9dcc42410ea6667";
const PREFIX = "compute-models/origin-alice1m-ncl/" + WEIGHTS;
const ARTIFACTS = [
  ["weights.fp32", 4596736, WEIGHTS],
  ["links.i32", 8192, "ac7aef9b9e5c3b58851b7f5f76337b1684e4684e8fb82bb957ea060d806b98a0"],
  ["tensors.txt", 814, "caed8bed8124fad21c83e19ceb038fc9b885021ab3990589b4a706de82bc7fc2"],
] as const;

async function loadCheckpoint(base: string, serviceKey: string) {
  const root = new URL(base);
  if (root.protocol !== "https:" || root.username || root.password || root.pathname !== "/" ||
    root.search || root.hash || !serviceKey) throw new Error("Invalid Storage configuration");
  const [weights, links, index] = await Promise.all(ARTIFACTS.map(async ([name, bytes, sha256]) => {
    const url = new URL("/storage/v1/object/authenticated/" + PREFIX + "/" + name, root);
    const response = await fetch(url, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
      redirect: "error",
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok || !response.body) throw new Error("Missing private checkpoint artifact");
    const reader = response.body.getReader();
    const contents = new Uint8Array(bytes);
    let offset = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (offset + value.length > bytes) throw new Error("Oversized checkpoint artifact");
        contents.set(value, offset);
        offset += value.length;
      }
    } finally {
      await reader.cancel().catch(() => {});
    }
    const digest = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", contents)),
      (byte) => byte.toString(16).padStart(2, "0")).join("");
    if (offset !== bytes || digest !== sha256) throw new Error("Checkpoint integrity check failed");
    return contents;
  }));
  return createOriginCpu(new Float32Array(weights.buffer), new Int32Array(links.buffer),
    new TextDecoder().decode(index));
}

let checkpoint: ReturnType<typeof loadCheckpoint> | undefined;

export async function originEdgeInference(body: Record<string, unknown>, base: string, serviceKey: string) {
  const message = typeof body.message === "string" ? new TextEncoder().encode(body.message) : null;
  const count = body.max_bytes === undefined ? 96 : body.max_bytes;
  if (!message || message.length < 1 || message.length > 256 || typeof count !== "number" ||
    !Number.isInteger(count) || count < 1 || count > 256 || body.stream === true) {
    return { status: 400, payload: { success: false, error: "ORIGIN_INVALID_REQUEST" } };
  }
  try {
    checkpoint ??= loadCheckpoint(base, serviceKey).catch((error) => {
      checkpoint = undefined;
      throw error;
    });
    const infer = await checkpoint;
    const { generated } = infer(message, count);
    return { status: 200, payload: {
      success: true, provider: "origin_ncl", model: "OriginAlice1M-NCL",
      text: new TextDecoder("utf-8", { ignoreBOM: true }).decode(generated),
      output_base64: btoa(String.fromCharCode(...generated)),
      generated_bytes: generated.length, weights_sha256: WEIGHTS,
    } };
  } catch {
    return { status: 503, payload: { success: false, error: "ORIGIN_EDGE_UNAVAILABLE" } };
  }
}
