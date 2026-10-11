/**
 * AIVAULT Unified GPU Fabric local DAG runtime v0.1.
 *
 * Runs a PLANNED graph through caller-supplied local adapters. Tensor copies
 * between adapters are in-process JavaScript copies, not network transfers.
 * It is a conformance harness, not a remote-node or physical-GPU runtime.
 */
import { createHash } from "node:crypto";
import { executeBackendOperation, readBackendCapabilities } from "./gpu-fabric-backend-v0.1.mjs";

function digest(values) {
  return createHash("sha256").update(JSON.stringify(values), "utf8").digest("hex");
}

function assertTensor(values, label) {
  if (!Array.isArray(values) || values.length === 0 ||
      values.some((n) => typeof n !== "number" || !Number.isFinite(n))) {
    throw new Error(label + " must be a non-empty array of finite numbers");
  }
}

export async function executeLocalPlannedGraph({ plan, operations, inputTensors, adaptersByNodeId, jobId = "local-job" }) {
  if (!plan || plan.status !== "PLANNED" || !Array.isArray(plan.operations) ||
      !Array.isArray(plan.topological_order)) {
    throw new Error("plan must be a valid PLANNED graph plan");
  }
  if (!Array.isArray(operations) || operations.length !== plan.operations.length) {
    throw new Error("operations must match the planned operation count");
  }
  if (!inputTensors || typeof inputTensors !== "object" || Array.isArray(inputTensors)) {
    throw new Error("inputTensors must be a tensor-id map");
  }
  if (!adaptersByNodeId || typeof adaptersByNodeId !== "object" || Array.isArray(adaptersByNodeId)) {
    throw new Error("adaptersByNodeId must map planned node IDs to local adapters");
  }
  if (typeof jobId !== "string" || !jobId.trim()) throw new Error("jobId is required");

  const graphById = new Map();
  for (const op of operations) {
    if (!op || typeof op.operation_id !== "string" || graphById.has(op.operation_id)) {
      throw new Error("graph contains missing or duplicate operation IDs");
    }
    graphById.set(op.operation_id, op);
  }
  const planById = new Map(plan.operations.map((op) => [op.operation_id, op]));
  if (planById.size !== graphById.size || plan.topological_order.length !== graphById.size) {
    throw new Error("plan operation IDs do not match graph");
  }
  for (const id of plan.topological_order) {
    if (!graphById.has(id) || !planById.has(id)) throw new Error("plan contains an unknown operation: " + id);
  }

  const tensors = new Map();
  for (const [tensorId, values] of Object.entries(inputTensors)) {
    assertTensor(values, "input tensor " + tensorId);
    tensors.set(tensorId, [...values]);
  }
  const outputProducer = new Map();
  for (const op of operations) {
    if (!Array.isArray(op.input_tensor_ids) || !Array.isArray(op.output_tensor_ids) ||
        op.output_tensor_ids.length !== 1 || !Array.isArray(op.dependency_ids)) {
      throw new Error("v0.1 runtime requires operation tensor lists and exactly one output tensor");
    }
    for (const tensorId of op.output_tensor_ids) {
      if (outputProducer.has(tensorId) || tensors.has(tensorId)) throw new Error("duplicate tensor producer: " + tensorId);
      outputProducer.set(tensorId, op.operation_id);
    }
  }

  const capabilityCache = new Map();
  const completed = new Set();
  const producerNodeByTensor = new Map();
  const trace = [];
  const transfers = [];

  for (const operationId of plan.topological_order) {
    const op = graphById.get(operationId);
    const placement = planById.get(operationId);
    if (placement.operator !== op.operator ||
        JSON.stringify([...placement.input_tensor_ids].sort()) !== JSON.stringify([...op.input_tensor_ids].sort()) ||
        JSON.stringify([...placement.output_tensor_ids].sort()) !== JSON.stringify([...op.output_tensor_ids].sort())) {
      throw new Error("planned operation does not match graph definition: " + operationId);
    }
    for (const depId of op.dependency_ids) {
      if (!completed.has(depId)) throw new Error("dependency not completed: " + depId);
    }
    const adapter = adaptersByNodeId[placement.node_id];
    if (!adapter) throw new Error("missing local adapter for planned node: " + placement.node_id);
    if (!capabilityCache.has(placement.node_id)) {
      capabilityCache.set(placement.node_id, await readBackendCapabilities(adapter));
    }
    const caps = capabilityCache.get(placement.node_id);
    if (!caps.operators.includes(op.operator)) throw new Error("adapter does not support planned operator: " + op.operator);

    const inputArrays = op.input_tensor_ids.map((tensorId) => {
      if (!tensors.has(tensorId)) throw new Error("input tensor unavailable: " + tensorId);
      const producerId = outputProducer.get(tensorId);
      if (producerId && !completed.has(producerId)) throw new Error("tensor producer not completed: " + tensorId);
      const sourceNodeId = producerNodeByTensor.get(tensorId);
      if (sourceNodeId && sourceNodeId !== placement.node_id) {
        // This is a local copy record only; no remote transfer occurs in v0.1.
        transfers.push({
          tensor_id: tensorId,
          from_node_id: sourceNodeId,
          to_node_id: placement.node_id,
          bytes_estimate: tensors.get(tensorId).length * 8,
          status: "IN_MEMORY_LOCAL_COPY",
        });
      }
      return [...tensors.get(tensorId)];
    });
    if (inputArrays.length !== 1) throw new Error("v0.1 runtime supports exactly one input tensor per operation");

    const result = await executeBackendOperation(adapter, {
      operator: op.operator,
      scalar: op.scalar,
    }, inputArrays, { job_id: jobId, operation_id: operationId });
    const outputTensorId = op.output_tensor_ids[0];
    tensors.set(outputTensorId, [...result.output]);
    producerNodeByTensor.set(outputTensorId, placement.node_id);
    completed.add(operationId);
    trace.push({
      job_id: jobId,
      operation_id: operationId,
      node_id: placement.node_id,
      backend_id: result.backend_id,
      operator: op.operator,
      output_tensor_id: outputTensorId,
      output_sha256: digest(result.output),
      status: "LOCAL_ADAPTER_EXECUTED",
    });
  }

  const terminalTensorIds = [...outputProducer.keys()].filter((tensorId) =>
    !operations.some((op) => op.input_tensor_ids.includes(tensorId))
  );
  if (terminalTensorIds.length !== 1) throw new Error("v0.1 runtime requires exactly one terminal output tensor");
  const outputTensorId = terminalTensorIds[0];
  return {
    status: "LOCAL_ADAPTER_RUN",
    job_id: jobId,
    output_tensor_id: outputTensorId,
    output: [...tensors.get(outputTensorId)],
    output_sha256: digest(tensors.get(outputTensorId)),
    participating_node_ids: [...new Set(trace.map((entry) => entry.node_id))].sort(),
    trace,
    transfers,
    note: "Operations ran through local adapters in one process. Cross-node records are in-memory copies, not network transfers; this does not prove GPU execution.",
  };
}
