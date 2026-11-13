// Upload the exact validated Alice1M checkpoint to private Supabase Storage.
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const artifacts = [
  ["weights.fp32", 4596736, "ab44dca3246af333861cf36764f90f0f0bd251026ba5401fb9dcc42410ea6667"],
  ["links.i32", 8192, "ac7aef9b9e5c3b58851b7f5f76337b1684e4684e8fb82bb957ea060d806b98a0"],
  ["tensors.txt", 814, "caed8bed8124fad21c83e19ceb038fc9b885021ab3990589b4a706de82bc7fc2"],
];
const prefix = "compute-models/origin-alice1m-ncl/" + artifacts[0][2];
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");

async function main() {
  const [directory, flag] = process.argv.slice(2);
  if (!directory || (flag && flag !== "--check")) {
    throw new Error("Usage: node upload-origin-checkpoint.mjs CHECKPOINT_DIRECTORY [--check]");
  }
  const payloads = [];
  for (const [name, size, expected] of artifacts) {
    const bytes = await readFile(join(directory, name));
    if (bytes.length !== size || hash(bytes) !== expected) {
      throw new Error("Local checkpoint integrity failure: " + name);
    }
    payloads.push(bytes);
  }
  if (flag === "--check") {
    console.log(JSON.stringify({ status: "LOCAL_CHECKPOINT_VERIFIED", prefix, files: artifacts.length }));
    return;
  }

  const base = new URL(process.env.SUPABASE_URL ?? "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (base.protocol !== "https:" || base.hostname !== "clcddygkaaqqtsbswgdf.supabase.co" ||
    base.username || base.password || base.port || base.pathname !== "/" || base.search || base.hash || !key) {
    throw new Error("Configure the First Base SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  }
  function request(path, options) {
    return fetch(new URL("/storage/v1/object/" + path, base), {
      ...options, redirect: "error", signal: AbortSignal.timeout(45_000),
      headers: { ...options?.headers, apikey: key, Authorization: "Bearer " + key },
    });
  }
  for (const [index, [name, size, expected]] of artifacts.entries()) {
    const path = prefix + "/" + name;
    const uploaded = await request(path, {
      method: "POST", body: payloads[index],
      headers: { "Content-Type": "application/octet-stream", "x-upsert": "false" },
    });
    const status = uploaded.status;
    await uploaded.body?.cancel();
    const verified = await request("authenticated/" + path);
    if (!verified.ok) throw new Error(`Storage readback failed for ${name} (upload HTTP ${status}, read HTTP ${verified.status})`);
    const bytes = Buffer.from(await verified.arrayBuffer());
    if (bytes.length !== size || hash(bytes) !== expected) {
      throw new Error("Remote checkpoint integrity failure: " + name);
    }
  }
  console.log(JSON.stringify({ status: "PRIVATE_STORAGE_VERIFIED", prefix, files: artifacts.length }));
}

try {
  await main();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
