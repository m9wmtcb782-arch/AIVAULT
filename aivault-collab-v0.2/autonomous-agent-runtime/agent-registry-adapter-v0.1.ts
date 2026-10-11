/**
 * AIVAULT Agent Registry + Memory adapter v0.1.
 * Standalone contracts; no database migration, deployment or API calls.
 * Adapter must map to existing agent_registry, not generate another 1,000 agents.
 */
export type AgentRecord = {
  agentId: string;
  modelId: string | null;
  modelStatus: "AVAILABLE" | "PLANNED" | "SIMULATED" | "UNKNOWN";
  isSimulated: boolean;
  connected: boolean;
  skills: readonly string[];
  allowedTools: readonly string[];
};
export type MemoryEntry = {
  id: string;
  ownerId: string;
  agentId: string;
  namespace: string;
  content: string;
  createdAt: string;
};
export type AgentRegistryAdapter = {
  getAgent(agentId: string): Promise<AgentRecord | null>;
};
export type ScopedMemoryAdapter = {
  list(ownerId: string, agentId: string, namespace: string): Promise<readonly MemoryEntry[]>;
  append(entry: MemoryEntry): Promise<void>;
};
export type AgentActivation = {
  agent: AgentRecord;
  inferenceReady: boolean;
  reasons: readonly string[];
};
/** Capability readiness is separate from identity existence. */
export async function inspectAgent(registry: AgentRegistryAdapter, agentId: string): Promise<AgentActivation | null> {
  if (!agentId.trim()) throw new Error("INVALID_AGENT_ID");
  const agent = await registry.getAgent(agentId);
  if (!agent) return null;
  const reasons: string[] = [];
  if (agent.isSimulated) reasons.push("SIMULATED_AGENT");
  if (!agent.connected) reasons.push("NOT_CONNECTED");
  if (agent.modelStatus !== "AVAILABLE") reasons.push("MODEL_NOT_AVAILABLE");
  if (!agent.modelId) reasons.push("MODEL_NOT_CONFIGURED");
  return { agent, inferenceReady: reasons.length === 0, reasons };
}
/** Enforces owner, agent and namespace isolation on read and write. */
export class AgentMemory {
  constructor(private readonly adapter: ScopedMemoryAdapter, private readonly ownerId: string, private readonly agentId: string, private readonly namespace: string) {
    if (![ownerId, agentId, namespace].every(x => x.trim().length > 0)) throw new Error("INVALID_MEMORY_SCOPE");
  }
  async list(): Promise<readonly MemoryEntry[]> {
    const records = await this.adapter.list(this.ownerId, this.agentId, this.namespace);
    if (records.some(x => x.ownerId !== this.ownerId || x.agentId !== this.agentId || x.namespace !== this.namespace)) throw new Error("MEMORY_SCOPE_VIOLATION");
    return records;
  }
  async append(entry: MemoryEntry): Promise<void> {
    if (entry.ownerId !== this.ownerId || entry.agentId !== this.agentId || entry.namespace !== this.namespace) throw new Error("MEMORY_SCOPE_VIOLATION");
    if (!entry.id || !entry.content.trim() || !Number.isFinite(Date.parse(entry.createdAt))) throw new Error("INVALID_MEMORY_ENTRY");
    await this.adapter.append({ ...entry });
  }
}
