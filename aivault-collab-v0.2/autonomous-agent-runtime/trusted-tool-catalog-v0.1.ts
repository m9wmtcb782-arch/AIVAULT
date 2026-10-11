/** AIVAULT trusted tool catalog v0.1. Standalone, not deployed.
 * The planner may request a tool name and inputs, but must not assign its risk.
 * The server defines authoritative tool kind and allowed agent capabilities.
 */
import type { ToolKind, ToolRequest } from "./agent-runtime-v0.1.ts";

export type TrustedTool = {
  name: string;
  kind: ToolKind;
  enabled: boolean;
  permittedAgentIds: readonly string[];
};
export class TrustedToolCatalog {
  private readonly byName: Map<string, TrustedTool>;
  constructor(definitions: readonly TrustedTool[]) {
    this.byName = new Map();
    for (const definition of definitions) {
      if (!definition.name.trim() || this.byName.has(definition.name)) throw new Error("INVALID_TOOL_CATALOG");
      this.byName.set(definition.name, { ...definition, permittedAgentIds: [...definition.permittedAgentIds] });
    }
  }
  resolve(agentId: string, requested: ToolRequest): ToolRequest {
    const definition = this.byName.get(requested.name);
    if (!definition || !definition.enabled || !definition.permittedAgentIds.includes(agentId)) throw new Error("TOOL_NOT_AUTHORIZED");
    if (!requested.id || !requested.input || typeof requested.input !== "object" || Array.isArray(requested.input)) throw new Error("INVALID_TOOL_REQUEST");
    // Never downgrade a write tool to read based on model-supplied metadata.
    if (requested.kind !== definition.kind) throw new Error("TOOL_KIND_MISMATCH");
    return { id: requested.id, name: definition.name, kind: definition.kind, input: structuredClone(requested.input) };
  }
}
