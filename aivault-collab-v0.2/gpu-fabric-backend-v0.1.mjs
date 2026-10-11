import { validateDenseOperation } from './gpu-fabric-dense-v0.1.mjs';
/**
 * AIVAULT Unified GPU Fabric backend adapter contract v0.1.
 *
 * This module validates and invokes an explicitly supplied local adapter.
 * It does not discover hardware, load native libraries, connect to remote nodes,
 * or claim that a backend is a GPU. Adapter metadata must be reported by the
 * adapter implementation and separately verified against the actual device.
 */
const ID_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/;
const REQUIRED_METHODS = ["getCapabilities", "execute", "release"];

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function validateBackendAdapter(adapter) {
  const errors = [];
  if (!isRecord(adapter)) return { valid: false, errors: ["adapter must be an object"] };
  if (typeof adapter.backend_id !== "string" || !ID_RE.test(adapter.backend_id)) errors.push("invalid backend_id");
  if (typeof adapter.runtime !== "string" || adapter.runtime.trim().length === 0) errors.push("invalid runtime");
  for (const method of REQUIRED_METHODS) {
    if (typeof adapter[method] !== "function") errors.push("missing adapter method: " + method);
  }
  return { valid: errors.length === 0, errors };
}

export async function readBackendCapabilities(adapter) {
  const validation = validateBackendAdapter(adapter);
  if (!validation.valid) throw new Error("invalid backend adapter: " + validation.errors.join("; "));
  const capabilities = await adapter.getCapabilities();
  if (!isRecord(capabilities)) throw new Error("backend capabilities must be an object");
  if (!Array.isArray(capabilities.operators) ||
      capabilities.operators.some((op) => typeof op !== "string" || !op.trim())) {
    throw new Error("backend capabilities.operators must be an array of operator names");
  }
  if (!Number.isSafeInteger(capabilities.memory_bytes) || capabilities.memory_bytes < 0) {
    throw new Error("backend capabilities.memory_bytes must be a non-negative safe integer");
  }
  if (typeof capabilities.device_kind !== "string" ||
      !["cpu", "gpu", "accelerator", "unknown"].includes(capabilities.device_kind)) {
    throw new Error("backend capabilities.device_kind is invalid");
  }
  return {
    backend_id: adapter.backend_id,
    runtime: adapter.runtime,
    device_kind: capabilities.device_kind,
    operators: [...new Set(capabilities.operators)].sort(),
    memory_bytes: capabilities.memory_bytes,
  };
}

/**
 * Execute exactly one operation through a local adapter.
 * Inputs/outputs are numeric arrays in this v0.1 conformance API, not model tensors.
 */
export async function executeBackendOperation(adapter, operation, inputs, context = {}) {
  operation = structuredClone(operation); // Pin parameters before adapter awaits.
  const caps = await readBackendCapabilities(adapter);
  if (!isRecord(operation) || typeof operation.operator !== "string") throw new Error("invalid operation");
  if (!caps.operators.includes(operation.operator)) throw new Error("backend does not support operator: " + operation.operator);
  if (!Array.isArray(inputs) || inputs.length !== 1 ||
      inputs.some((values) => !Array.isArray(values) || values.some((n) => typeof n !== "number" || !Number.isFinite(n)))) {
    throw new Error("v0.1 backend operations require exactly one input array of finite numbers");
  }
  if (inputs.some((values) => values.length !== inputs[0].length)) throw new Error("input shapes do not match");
  const dense = operation.operator === "dense" ? validateDenseOperation(operation) : null;
  if (dense && (inputs[0].length !== dense.inputSize || dense.memoryBytes > caps.memory_bytes)) throw new Error("dense input shape or memory budget mismatch");
  const safeContext = {
    job_id: typeof context.job_id === "string" ? context.job_id : null,
    operation_id: typeof context.operation_id === "string" ? context.operation_id : null,
    deadline_ms: Number.isSafeInteger(context.deadline_ms) && context.deadline_ms > 0 ? context.deadline_ms : null,
  };
  const result = await adapter.execute({
    operation: structuredClone(operation),
    inputs: inputs.map((values) => [...values]),
    context: safeContext,
  });
  if (!isRecord(result) || !Array.isArray(result.output) ||
      result.output.some((n) => typeof n !== "number" || !Number.isFinite(n))) {
    throw new Error("backend returned invalid output");
  }
  if (result.output.length !== (dense ? dense.outputSize : inputs[0].length)) throw new Error("backend returned unexpected output shape");
  return {
    status: "EXECUTED_LOCAL_ADAPTER",
    backend_id: caps.backend_id,
    device_kind: caps.device_kind,
    output: [...result.output],
    backend_execution_id: typeof result.execution_id === "string" ? result.execution_id : null,
    note: "A local adapter returned this result. Hardware authenticity and GPU execution are not independently attested by this module.",
  };
}

