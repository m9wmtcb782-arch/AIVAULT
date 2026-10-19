// AIVAULT model registry and execution admission. Pure, offline, no provider calls.
// A database entry is not evidence of a loaded model or available GPU.
export type ModelOrigin = "OWNED" | "SELF_HOSTED_OPEN_WEIGHT" | "EXTERNAL_API";
export type ModelStatus = "PLANNED" | "REGISTERED" | "DEPLOYED" | "VERIFIED";
export type ComputeType = "AIVAULT_GPU_FABRIC" | "AIVAULT_SERVER" | "EXTERNAL_PROVIDER";
export type ModelCapability = "text" | "reasoning" | "vision" | "image" | "video" | "speech" | "music" | "3d" | "code" | "legal";
export type ModelRecord = {
 id: string; origin: ModelOrigin; status: ModelStatus;
 capabilities: readonly ModelCapability[]; compute: ComputeType;
 endpoint?: string; runtimeVerifiedAt?: string;
 lastHealthCheckAt?: string; gpuFabricVerified?: boolean;
 costPolicy: "LOCAL_ONLY" | "FREE_ONLY" | "PAID";
};
export type Admission = { permitted: boolean; reason: string };
const validDate = (value: string | undefined, now: number, maxAgeMs: number): boolean => {
 if (!value) return false;
 const ms = Date.parse(value);
 return Number.isFinite(ms) && ms <= now && now - ms <= maxAgeMs;
};
export function admitModel(model: ModelRecord, capability: ModelCapability, now = Date.now()): Admission {
 const deny = (reason: string): Admission => ({permitted:false,reason});
 if (!model.id || !model.capabilities.includes(capability)) return deny("CAPABILITY_UNAVAILABLE");
 if (model.status !== "VERIFIED") return deny("MODEL_NOT_VERIFIED");
 if (!validDate(model.runtimeVerifiedAt, now, 7*24*3600_000)) return deny("RUNTIME_EVIDENCE_MISSING_OR_STALE");
 if (!validDate(model.lastHealthCheckAt, now, 5*60_000)) return deny("HEALTH_CHECK_MISSING_OR_STALE");
 if (model.costPolicy === "PAID") return deny("PAID_MODEL_BLOCKED");
 if (model.origin === "EXTERNAL_API") {
  if (model.compute !== "EXTERNAL_PROVIDER" || model.costPolicy !== "FREE_ONLY")
   return deny("EXTERNAL_POLICY_MISMATCH");
  if (model.endpoint !== "https://openrouter.ai/api/v1/chat/completions")
   return deny("EXTERNAL_ENDPOINT_NOT_VERIFIED");
  return {permitted:true,reason:"EXTERNAL_FREE_SERVICE_ONLY_NOT_GPU_CAPACITY"};
 }
 if (model.compute === "EXTERNAL_PROVIDER" || model.costPolicy !== "LOCAL_ONLY")
  return deny("OWNED_RUNTIME_POLICY_MISMATCH");
 if (model.compute === "AIVAULT_GPU_FABRIC" && model.gpuFabricVerified !== true)
  return deny("FABRIC_INFERENCE_NOT_VERIFIED");
 return {permitted:true,reason:"LOCAL_RUNTIME_VERIFIED"};
}
