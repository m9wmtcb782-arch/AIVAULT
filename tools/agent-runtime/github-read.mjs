import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { AutonomousAgentRuntime } from "../../aivault-collab-v0.2/autonomous-agent-runtime/agent-runtime-v0.1.ts";

const [agentId, runId] = process.argv.slice(2);
const revision = "1fe46d827416eeaa5e9a3916c39278295d978e4f";
const source = `https://raw.githubusercontent.com/m9wmtcb782-arch/AIVAULT/${revision}/README.md`;
const tool = "github_read_pinned_readme";
const expectedBlob = "bf63f5cdba10891f670142b27923a5718e1f6a38";
const evidence = { source, tool };
const runtime = new AutonomousAgentRuntime(
  { agentId, allowedTools: [tool], maxSteps: 2 },
  { next: async history => {
    if (!history.length) return { type: "tool", request: { id: runId, name: tool, kind: "read", input: {} } };
    if (!history[0].ok) throw new Error("READ_NOT_VERIFIED");
    return { type: "complete", summary: "AIVAULT README matches the pinned Git blob." };
  } },
  { execute: async () => {
    try {
      const output = execFileSync("curl", [
        "--silent", "--show-error", "--max-time", "8", "--max-filesize", "4096",
        "--proto", "=https", "--write-out", "%{http_code}", source,
      ], { maxBuffer: 8192, stdio: ["ignore", "pipe", "pipe"] });
      evidence.http_status = Number(output.subarray(-3).toString());
      if (evidence.http_status !== 200) throw new Error("HTTP_ERROR");
      const bytes = output.subarray(0, -3);
      const size = bytes.length;
      if (size > 4096) throw new Error("RESPONSE_TOO_LARGE");
      const blob = createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex");
      if (blob !== expectedBlob) throw new Error("GIT_BLOB_MISMATCH");
      Object.assign(evidence, { bytes: size, git_blob: blob,
        sha256: createHash("sha256").update(bytes).digest("hex") });
      return { ok: true };
    } catch (error) {
      evidence.error = evidence.http_status && evidence.http_status !== 200
        ? `HTTP_${evidence.http_status}`
        : error.status === 28 ? "TIMEOUT" : error.status ? `CURL_${error.status}` : error.message;
      return { ok: false };
    }
  } }
);
runtime.authorize();
await runtime.step();
const result = await runtime.step();
console.log(JSON.stringify({ ...evidence, state: result.state, events: result.events,
  summary: result.result }));
