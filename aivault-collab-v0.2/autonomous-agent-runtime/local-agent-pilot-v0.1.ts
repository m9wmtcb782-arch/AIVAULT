/**
 * AIVAULT local pilot v0.1. Run with: deno run local-agent-pilot-v0.1.ts
 * In-memory only. No network, no paid model API, no external posts, no DB writes.
 * Demonstrates orchestration; does NOT demonstrate real AI inference.
 */
import { AutonomousAgentRuntime, type PlanDecision, type ToolResult } from "./agent-runtime-v0.1.ts";
import { AgentMemory, inspectAgent, type AgentRecord, type MemoryEntry } from "./agent-registry-adapter-v0.1.ts";
import { ScopedTrainingRecords, type TrainingExample } from "./learning-records-v0.1.ts";
const agent: AgentRecord = {
  agentId: "Worker-0101", modelId: "planned-reasoning", modelStatus: "PLANNED",
  isSimulated: false, connected: false, skills: ["public-market-research"], allowedTools: ["mock_public_research"]
};
const readiness = await inspectAgent({ getAgent: async id => id === agent.agentId ? agent : null }, agent.agentId);
if (!readiness || readiness.inferenceReady) throw new Error("PILOT_MUST_NOT_CLAIM_REAL_INFERENCE");
const memory: MemoryEntry[] = [];
const scopedMemory = new AgentMemory({
  list: async (ownerId, agentId, namespace) => memory.filter(x => x.ownerId === ownerId && x.agentId === agentId && x.namespace === namespace),
  append: async entry => { memory.push(entry); }
}, "aivault-pilot", agent.agentId, "commercial");
const examples: TrainingExample[] = [];
const training = new ScopedTrainingRecords({
  append: async example => { examples.push(example); },
  listByAgent: async (ownerId, agentId) => examples.filter(x => x.ownerId === ownerId && x.agentId === agentId)
}, "aivault-pilot", agent.agentId);
let planCount = 0;
const planner = { next: async (_history: readonly ToolResult[]): Promise<PlanDecision> =>
  ++planCount === 1
    ? { type: "tool", request: { id: "mock-1", name: "mock_public_research", kind: "read", input: { topic: "AIVAULT service demand" } } }
    : { type: "complete", summary: "Mock market research completed; no outreach performed." }
};
const runtime = new AutonomousAgentRuntime(
  { agentId: agent.agentId, allowedTools: agent.allowedTools, maxSteps: 3 },
  planner,
  { execute: async req => req.name === "mock_public_research"
    ? { ok: true, output: { leadCount: 0, source: "MOCK_DATA" } }
    : { ok: false, error: "UNSUPPORTED_TOOL" } }
);
runtime.authorize();
let snapshot = await runtime.step();
if (snapshot.state !== "OBSERVING") throw new Error("PILOT_OBSERVATION_FAILED");
snapshot = await runtime.step();
if (snapshot.state !== "COMPLETED") throw new Error("PILOT_COMPLETION_FAILED");
await scopedMemory.append({
  id: "pilot-memory-1", ownerId: "aivault-pilot", agentId: agent.agentId, namespace: "commercial",
  content: snapshot.result ?? "", createdAt: new Date().toISOString()
});
await training.append({
  exampleId: "pilot-example-1", ownerId: "aivault-pilot", agentId: agent.agentId,
  skillId: "public-market-research", taskSummary: "Mock market research",
  observation: "Mock tool response", outcome: "unknown", reviewedBy: null, reviewedAt: null,
  consentOrLicense: null, createdAt: new Date().toISOString()
});
if ((await training.reviewed()).length !== 0) throw new Error("UNREVIEWED_EXAMPLE_EXPOSED");
console.log(JSON.stringify({
  status: "LOCAL_MOCK_ONLY", inferenceReady: readiness.inferenceReady, readinessReasons: readiness.reasons,
  runtimeState: snapshot.state, auditEvents: snapshot.events.length,
  memoryRecords: (await scopedMemory.list()).length, trainingEligible: (await training.reviewed()).length,
  externalPosts: 0, paidApiCalls: 0
}, null, 2));
