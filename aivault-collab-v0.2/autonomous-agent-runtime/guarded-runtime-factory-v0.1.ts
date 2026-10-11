/** AIVAULT guarded runtime factory v0.1 — NOT DEPLOYED.
 * Use this factory instead of directly constructing v0.2 when connecting
 * any external tool. All catalog definitions must originate from trusted server config.
 */
import { AutonomousAgentRuntimeV2, type TrustedApprovalContext } from "./agent-runtime-v0.2.ts";
import type { AgentConfig, Planner, ToolAdapter, ToolRequest } from "./agent-runtime-v0.1.ts";
import { TrustedToolCatalog } from "./trusted-tool-catalog-v0.1.ts";

export function createGuardedRuntime(
  config: AgentConfig,
  planner: Planner,
  executor: ToolAdapter,
  approval: TrustedApprovalContext,
  catalog: TrustedToolCatalog
): AutonomousAgentRuntimeV2 {
  const safePlanner: Planner = {
    next: async history => {
      const decision = await planner.next(history);
      if (decision.type === "complete") return decision;
      return { type: "tool", request: catalog.resolve(config.agentId, decision.request) };
    }
  };
  const safeExecutor: ToolAdapter = {
    execute: async (request: ToolRequest) => {
      // Enforce again at the actual execution boundary.
      const authorized = catalog.resolve(config.agentId, request);
      return executor.execute(authorized);
    }
  };
  return new AutonomousAgentRuntimeV2(config, safePlanner, safeExecutor, approval);
}
