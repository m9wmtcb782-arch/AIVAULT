/** Ten model-backed agent trials against the existing authenticated local model bridge. */
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { AutonomousAgentRuntime } from "../../aivault-collab-v0.2/autonomous-agent-runtime/agent-runtime-v0.1.ts";

const bridge = "http://127.0.0.1:8765/worker-001/chat";
const token = process.env.AIVAULT_WORKER_BRIDGE_TOKEN ?? "";
const model = process.env.AIVAULT_WORKER_MODEL ?? "SmolLM2-135M-Instruct";
const sample = JSON.parse(readFileSync(process.env.AIVAULT_POOL_SAMPLE, "utf8"));
if (sample.length !== 10 || new Set(sample.map(r => r.id)).size !== 10) {
  throw new Error("Expected ten distinct pool identities");
}
const tools = { MAX: Math.max, MIN: Math.min };
const trials = [
  ["MAX", 74, 31, "Choose the higher sensor reading."],
  ["MIN", 45, 16, "Choose the lower bid."],
  ["MIN", 20, 89, "Choose the smaller parcel weight."],
  ["MAX", 42, 87, "Choose the greater score."],
  ["MAX", 93, 47, "Choose the larger stock count."],
  ["MIN", 68, 39, "Choose the lower temperature."],
  ["MAX", 27, 52, "Choose the higher voltage."],
  ["MIN", 12, 78, "Choose the smaller measurement."],
  ["MIN", 83, 24, "Choose the lower price."],
  ["MAX", 36, 95, "Choose the greater capacity."],
];

async function infer(message, phase, calls) {
  const started = performance.now();
  const response = await fetch(bridge, {
    method: "POST", redirect: "error", signal: AbortSignal.timeout(95_000),
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });
  if (!response.ok) throw new Error(`MODEL_BRIDGE_HTTP_${response.status}`);
  const payload = await response.json();
  const { answer, usage } = payload;
  if (payload.status !== "MODEL_RESPONSE_RECEIVED_NOT_INDEPENDENTLY_VERIFIED" ||
      payload.model !== model || payload.source !== "local-llama-cpp" ||
      typeof answer !== "string" || !answer.trim() ||
      !Number.isInteger(usage?.completion_tokens) || usage.completion_tokens < 1) {
    throw new Error("MISSING_MODEL_GENERATION_EVIDENCE");
  }
  calls.push({ phase, prompt: message, answer, usage, elapsed_ms: Math.round(performance.now() - started) });
  return answer.trim();
}

async function runTrial(index, [expectedTool, left, right, objective]) {
  const { id: agentId, ...registered } = sample[index];
  const runId = randomUUID();
  const calls = [];
  let result;
  let error;
  const runtime = new AutonomousAgentRuntime(
    { agentId, allowedTools: Object.keys(tools), maxSteps: 2 },
    { next: async history => {
      try {
        if (!history.length) {
          const prompt =
            `Choose a tool for this task: ${objective} Numbers: ${left}, ${right}.\n` +
            "Tools: MAX returns the larger number. MIN returns the smaller number.\n" +
            "Output exactly one word, MAX or MIN, without explanation.";
          for (let attempt = 0; attempt < 4; attempt++) {
            const retryPrompt =
              "Classify the intent of a comparison request. " +
              "Higher, larger, or greater means MAX. Lower, smaller, or lesser means MIN.\n" +
              "Request: Choose the higher bid. Tool: MAX\n" +
              "Request: Choose the lower score. Tool: MIN\n" +
              `Request: ${objective}\nTool:`;
            const answer = await infer(attempt === 0 ? prompt : retryPrompt, "select_tool", calls);
            const name = /^(?:tool:\s*)?(MAX|MIN)\.?$/i.exec(answer)?.[1]?.toUpperCase();
            const accepted = Object.hasOwn(tools, name) && name === expectedTool;
            calls.at(-1).tool_check = accepted ? "accepted" : "rejected";
            if (accepted) {
              return { type: "tool", request: { id: runId, name, kind: "read", input: { left, right } } };
            }
          }
          throw new Error("NO_CORRECT_TOOL_SELECTED");
        }
        if (!history[0].ok) throw new Error("TOOL_FAILED");
        const answer = await infer(
          `The verified calculator result is ${result.value}. Reply with exactly that number and nothing else.`,
          "report_result", calls,
        );
        if (result.name !== expectedTool || !/^\d+$/.test(answer) ||
            Number(answer) !== tools[expectedTool](left, right)) {
          throw new Error("WRONG_TOOL_OR_RESULT");
        }
        return { type: "complete", summary: answer };
      } catch (cause) {
        error = cause.message;
        throw cause;
      }
    } },
    { execute: async ({ name, input }) => {
      result = { name, input, value: tools[name](input.left, input.right) };
      return { ok: true, output: result.value };
    } },
  );
  runtime.authorize();
  const observed = await runtime.step();
  const terminal = observed.state === "OBSERVING" ? await runtime.step() : observed;
  return { agent_id: agentId, run_id: runId, registered, model, expected_tool: expectedTool, calls,
    tool: result, events: terminal.events, state: terminal.state, answer: terminal.result, error };
}

if (token.length < 32) {
  console.error("BLOCKED: set AIVAULT_WORKER_BRIDGE_TOKEN on the model host");
  process.exitCode = 2;
} else {
  let passed = 0;
  for (const [index, trial] of trials.entries()) {
    const result = await runTrial(index, trial);
    console.log(JSON.stringify(result));
    if (result.state === "COMPLETED") passed++;
    if (result.error?.startsWith("MODEL_BRIDGE_HTTP_") || result.error === "fetch failed") break;
  }
  console.error(`Verified model-backed agents: ${passed}/${trials.length}`);
  if (passed !== trials.length) process.exitCode = 1;
}
