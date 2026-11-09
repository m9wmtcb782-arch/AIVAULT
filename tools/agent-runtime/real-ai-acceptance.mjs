/** Ten model-backed agent trials against the existing authenticated local model bridge. */
import { randomUUID } from "node:crypto";
import { AutonomousAgentRuntime } from "../../aivault-collab-v0.2/autonomous-agent-runtime/agent-runtime-v0.1.ts";

const bridge = "http://127.0.0.1:8765/worker-001/chat";
const token = process.env.AIVAULT_WORKER_BRIDGE_TOKEN ?? "";
const model = process.env.AIVAULT_WORKER_MODEL ?? "SmolLM2-135M-Instruct";
const tools = {
  ADD: (left, right) => left + right,
  SUBTRACT: (left, right) => left - right,
};
const trials = [
  ["ADD", 12, 7, "Combine two inventory counts."],
  ["SUBTRACT", 18, 6, "Remove the second quantity from the first."],
  ["ADD", 21, 13, "Find the total of both quantities."],
  ["SUBTRACT", 25, 9, "Take away the second amount from the first."],
  ["ADD", 14, 17, "Find how many items there are altogether."],
  ["SUBTRACT", 29, 8, "Find the amount left after spending the second quantity."],
  ["ADD", 23, 15, "Increase the first quantity by the second."],
  ["SUBTRACT", 34, 12, "Decrease the first quantity by the second."],
  ["ADD", 27, 16, "Merge both piles and find the total count."],
  ["SUBTRACT", 43, 14, "Deduct the second inventory count from the first."],
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
  const agentId = `AI-${String(index + 1).padStart(3, "0")}`;
  const runId = randomUUID();
  const calls = [];
  let result;
  let error;
  const runtime = new AutonomousAgentRuntime(
    { agentId, allowedTools: Object.keys(tools), maxSteps: 2 },
    { next: async history => {
      try {
        if (!history.length) {
          const answer = await infer(
            `Choose a tool for this task: ${objective} Numbers: ${left}, ${right}.\n` +
            "Tools: ADD combines quantities. SUBTRACT removes a quantity.\n" +
            "Output exactly one word, ADD or SUBTRACT, without explanation.",
            "select_tool", calls,
          );
          const name = answer.replace(/^[`"']+|[`"'.]+$/g, "").toUpperCase();
          if (!Object.hasOwn(tools, name)) throw new Error("MODEL_DID_NOT_SELECT_ALLOWED_TOOL");
          return { type: "tool", request: { id: runId, name, kind: "read", input: { left, right } } };
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
  return { agent_id: agentId, run_id: runId, model, expected_tool: expectedTool, calls,
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
