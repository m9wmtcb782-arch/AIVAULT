import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { createOriginCpu } from "./origin-cpu.mjs";

const [checkpoint, executable] = process.argv.slice(2);
if (!checkpoint || !executable) throw new Error("Provide checkpoint directory and native executable");
const weights = readFileSync(join(checkpoint, "weights.fp32"));
assert.equal(createHash("sha256").update(weights).digest("hex"),
  "ab44dca3246af333861cf36764f90f0f0bd251026ba5401fb9dcc42410ea6667");
const cpu = createOriginCpu(new Float32Array(Uint8Array.from(weights).buffer),
  new Int32Array(Uint8Array.from(readFileSync(join(checkpoint, "links.i32"))).buffer),
  readFileSync(join(checkpoint, "tensors.txt"), "utf8"));
const work = mkdtempSync(join(tmpdir(), "origin-parity-"));
try {
  for (const [message, count] of [["Alice ", 48], ["The Queen ", 48], ["A".repeat(256), 256]]) {
    const prompt = new TextEncoder().encode(message);
    const logitsFile = join(work, "logits.bin");
    const native = execFileSync(executable, [checkpoint, prompt.join(","), String(count), logitsFile], {
      encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, AISL_TEMPERATURE: "0.8", AISL_TOP_K: "20", AISL_SAMPLE_SEED: "42",
        AISL_CACHE_BYTES: "8388608" },
    });
    const started = performance.now();
    const before = process.cpuUsage();
    const result = cpu(prompt, count);
    const usage = process.cpuUsage(before);
    const elapsed = performance.now() - started;
    const golden = new Float32Array(Uint8Array.from(readFileSync(logitsFile)).buffer);
    const error = Math.max(...golden.map((value, index) => Math.abs(value - result.prefill[index])));
    assert(error < 0.002, "logits differ");
    assert.deepEqual([...result.generated], native.trim().split("\n").map(line => JSON.parse(line).byte));
    console.log(JSON.stringify({ prompt_bytes: prompt.length, output_bytes: count, max_logit_error: error,
      wall_ms: Math.round(elapsed), cpu_ms: Math.round((usage.user + usage.system) / 1000) }));
  }
} finally {
  rmSync(work, { recursive: true, force: true });
}
