/**
 * AIVAULT Unified GPU Fabric protocol helpers v0.1.
 * Pure validation/state helpers only; no networking, GPU execution, auth, or persistence.
 * Node.js ESM; no third-party dependencies.
 */
export const PROTOCOL_VERSION = "aivault.gpu-fabric/0.1";

const DTYPE_BYTES = Object.freeze({
  bool: 1, int8: 1, uint8: 1, int16: 2, uint16: 2,
  int32: 4, uint32: 4, float16: 2, bfloat16: 2, float32: 4,
  int64: 8, uint64: 8, float64: 8,
});

const ID_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/;
const SHA256_RE = /^[a-fA-F0-9]{64}$/;

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isTimestamp(value) {
  return typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) &&
    Number.isFinite(Date.parse(value));
}

/** Returns { valid, errors }. This is syntactic validation, not authentication. */
export function validateEnvelope(message, now = Date.now(), maxClockSkewMs = 30_000) {
  const errors = [];
  if (!isRecord(message)) return { valid: false, errors: ["message must be an object"] };
  const required = [
    "protocol_version", "message_type", "job_id", "session_id",
    "model_manifest_sha256", "message_id", "issued_at", "expires_at",
    "sender_node_id",
  ];
  for (const key of required) {
    if (!(key in message)) errors.push("missing " + key);
  }
  if (message.protocol_version !== PROTOCOL_VERSION) errors.push("unsupported protocol_version");
  for (const key of ["job_id", "session_id", "message_id", "sender_node_id"]) {
    if (typeof message[key] !== "string" || !ID_RE.test(message[key])) errors.push("invalid " + key);
  }
  if (typeof message.message_type !== "string" || message.message_type.length < 1) {
    errors.push("invalid message_type");
  }
  if (typeof message.model_manifest_sha256 !== "string" || !SHA256_RE.test(message.model_manifest_sha256)) {
    errors.push("invalid model_manifest_sha256");
  }
  if (!isTimestamp(message.issued_at)) errors.push("invalid issued_at");
  if (!isTimestamp(message.expires_at)) errors.push("invalid expires_at");
  if (isTimestamp(message.issued_at) && isTimestamp(message.expires_at)) {
    const issued = Date.parse(message.issued_at);
    const expires = Date.parse(message.expires_at);
    if (expires <= issued) errors.push("expires_at must be later than issued_at");
    if (issued > now + maxClockSkewMs) errors.push("issued_at exceeds allowed clock skew");
    if (expires <= now) errors.push("message expired");
  }
  return { valid: errors.length === 0, errors };
}

/** Safe descriptor validation. The runtime must still hash actual transferred bytes. */
export function validateTensorDescriptor(tensor, maxBytes = 1_099_511_627_776) {
  const errors = [];
  if (!isRecord(tensor)) return { valid: false, errors: ["tensor must be an object"] };
  if (typeof tensor.tensor_id !== "string" || !ID_RE.test(tensor.tensor_id)) errors.push("invalid tensor_id");
  if (!(tensor.dtype in DTYPE_BYTES)) errors.push("unsupported dtype");
  if (!Array.isArray(tensor.shape) || tensor.shape.length < 1 || tensor.shape.length > 16 ||
      tensor.shape.some((n) => !Number.isSafeInteger(n) || n < 0)) {
    errors.push("invalid shape");
  }
  if (typeof tensor.layout !== "string" || tensor.layout.length < 1 || tensor.layout.length > 80) errors.push("invalid layout");
  if (!Number.isSafeInteger(tensor.byte_length) || tensor.byte_length < 0 || tensor.byte_length > maxBytes) {
    errors.push("invalid byte_length");
  }
  if (!Array.isArray(tensor.consumers) || tensor.consumers.some((x) => typeof x !== "string" || !ID_RE.test(x))) {
    errors.push("invalid consumers");
  }
  if (tensor.content_sha256 !== undefined &&
      (typeof tensor.content_sha256 !== "string" || !SHA256_RE.test(tensor.content_sha256))) {
    errors.push("invalid content_sha256");
  }
  if (errors.length === 0) {
    let elements = 1n;
    for (const dim of tensor.shape) {
      elements *= BigInt(dim);
      if (elements > BigInt(Number.MAX_SAFE_INTEGER)) {
        errors.push("shape element count exceeds safe integer range");
        break;
      }
    }
    if (errors.length === 0) {
      const expected = elements * BigInt(DTYPE_BYTES[tensor.dtype]);
      if (expected > BigInt(maxBytes)) errors.push("computed tensor size exceeds configured limit");
      else if (BigInt(tensor.byte_length) !== expected) errors.push("byte_length does not match dtype and shape");
    }
  }
  return { valid: errors.length === 0, errors };
}

const TRANSITIONS = Object.freeze({
  CREATED: new Set(["PREPARING", "FAILED", "CANCELLED"]),
  PREPARING: new Set(["READY", "FAILED", "CANCELLED"]),
  READY: new Set(["RUNNING", "FAILED", "CANCELLED"]),
  RUNNING: new Set(["VERIFYING", "FAILED", "CANCELLED"]),
  VERIFYING: new Set(["COMPLETED", "FAILED", "CANCELLED"]),
  COMPLETED: new Set(),
  FAILED: new Set(),
  CANCELLED: new Set(),
});

/** Throws on illegal transitions. COMPLETED requires evaluateCompletion() to pass. */
export function transitionJob(current, next, evidence = {}) {
  if (!TRANSITIONS[current]) throw new Error("unknown current job state");
  if (!TRANSITIONS[current].has(next)) throw new Error("illegal job transition: " + current + " -> " + next);
  if (next === "COMPLETED" && evidence.completionEligible !== true) {
    throw new Error("completion requires validated completion evidence");
  }
  return next;
}

/**
 * Completion gate for a single graph execution. Worker-reported success is not
 * enough: required operations, node participation, and independent validation
 * must all be represented in the supplied evidence.
 */
export function evaluateCompletion({
  requiredOperationIds,
  operationResults,
  verification,
  requiredNodeCount = 1,
}) {
  const errors = [];
  if (!Array.isArray(requiredOperationIds) || requiredOperationIds.length === 0) {
    errors.push("requiredOperationIds must be a non-empty array");
  }
  if (!Array.isArray(operationResults)) errors.push("operationResults must be an array");
  const results = Array.isArray(operationResults) ? operationResults : [];
  const succeeded = new Map();
  for (const result of results) {
    if (!isRecord(result) || typeof result.operation_id !== "string" ||
        typeof result.node_id !== "string" || result.status !== "succeeded") continue;
    if (succeeded.has(result.operation_id)) {
      errors.push("duplicate successful result for operation " + result.operation_id);
    } else {
      succeeded.set(result.operation_id, result);
    }
  }
  if (Array.isArray(requiredOperationIds)) {
    for (const id of requiredOperationIds) {
      if (!succeeded.has(id)) errors.push("required operation not succeeded: " + id);
    }
  }
  const nodeIds = new Set([...succeeded.values()].map((r) => r.node_id));
  if (!Number.isInteger(requiredNodeCount) || requiredNodeCount < 1) {
    errors.push("requiredNodeCount must be a positive integer");
  } else if (nodeIds.size < requiredNodeCount) {
    errors.push("insufficient distinct participating nodes");
  }
  if (!isRecord(verification) || verification.independent !== true ||
      verification.passed !== true || typeof verification.method !== "string" ||
      verification.method.length === 0) {
    errors.push("independent output verification has not passed");
  }
  return {
    eligible: errors.length === 0,
    errors,
    participatingNodeIds: [...nodeIds].sort(),
  };
}
