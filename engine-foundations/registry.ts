/** AIVAULT engine foundations V0: typed registry, not model inference. */
export type EngineStatus = "scaffold" | "implemented" | "verified" | "production";
export type EngineKind = "core" | "specialist";
export type EngineId =
  | "reasoning" | "understanding" | "memory" | "discovery" | "dispatch"
  | "verification" | "learning" | "factory" | "compute"
  | "text" | "image" | "video" | "speech" | "singing" | "composition";
export interface EngineDefinition {
  id: EngineId;
  kind: EngineKind;
  version: "0.0.1";
  status: EngineStatus;
  capabilities: readonly string[];
  implementation: "none" | "cpu" | "gpu" | "hybrid";
}
export interface EngineRequest { taskId: string; input: unknown; }
export interface EngineResult {
  taskId: string;
  engine: EngineId;
  status: "ok" | "blocked" | "failed";
  output?: unknown;
  evidence: readonly string[];
  error?: string;
}
const core = ["reasoning","understanding","memory","discovery","dispatch","verification","learning","factory","compute"] as const;
const specialist = ["text","image","video","speech","singing","composition"] as const;
export const engineRegistry: readonly EngineDefinition[] = Object.freeze([
  ...core.map(id => ({id,kind:"core" as const,version:"0.0.1" as const,status:"scaffold" as const,capabilities:[],implementation:"none" as const})),
  ...specialist.map(id => ({id,kind:"specialist" as const,version:"0.0.1" as const,status:"scaffold" as const,capabilities:[],implementation:"none" as const}))
]);
export function getEngine(id: EngineId): EngineDefinition {
  const engine = engineRegistry.find(item => item.id === id);
  if (!engine) throw new Error("Unknown engine: " + id);
  return engine;
}
/** Fail closed: a registered engine is not evidence of real inference. */
export async function invokeEngine(id: EngineId, request: EngineRequest): Promise<EngineResult> {
  const engine = getEngine(id);
  return {
    taskId: request.taskId,
    engine: engine.id,
    status: "blocked",
    evidence: [],
    error: "ENGINE_NOT_IMPLEMENTED: registry scaffold only"
  };
}
