// Run from an authorized server with a deployed AIVAULT Gateway.
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";

const model = "OriginAlice1M-NCL";
const weights = "ab44dca3246af333861cf36764f90f0f0bd251026ba5401fb9dcc42410ea6667";
const gateway = process.env.AIVAULT_GATEWAY_URL;
const secret = process.env.AI_GATEWAY_INTERNAL_SECRET;

async function main() {
  if (!gateway || !secret) throw new Error("Set AIVAULT_GATEWAY_URL and AI_GATEWAY_INTERNAL_SECRET.");
  const url = new URL(gateway);
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) {
    throw new Error("Use the HTTPS Gateway endpoint without credentials or query parameters.");
  }
  async function request(prompt, authorized) {
    const headers = { "Content-Type": "application/json" };
    if (authorized) headers["x-aivault-internal"] = secret;
    return fetch(url, {
      method: "POST", redirect: "error", signal: AbortSignal.timeout(30_000), headers,
      body: JSON.stringify({ action: "origin_ncl_infer", message: prompt, max_bytes: 48 }),
    });
  }

  const denied = await request("Alice ", false);
  assert.equal(denied.status, 401, "Gateway did not reject an unauthenticated inference request");
  await denied.body?.cancel();

  const checks = [];
  for (const prompt of ["Alice ", "The Queen "]) {
    const response = await request(prompt, true);
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      const code = /^ORIGIN_[A-Z_]+$/.test(error.error) ? " " + error.error : "";
      throw new Error("Authenticated inference failed, HTTP " + response.status + code);
    }
    const result = await response.json();
    assert.equal(result.success, true);
    assert.equal(result.model, model);
    assert.equal(result.provider, "origin_ncl");
    assert.equal(result.weights_sha256, weights);
    assert.equal(result.generated_bytes, 48);
    assert.match(result.output_base64, /^[A-Za-z0-9+/]{64}$/);
    assert.equal(Buffer.from(result.output_base64, "base64").length, 48);
    checks.push(result);
  }
  assert.notEqual(checks[0].output_base64, checks[1].output_base64);
  console.log(JSON.stringify({ status: "PASS", model, weights_sha256: weights, authorized_inferences: 2 }));
}

try {
  await main();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
