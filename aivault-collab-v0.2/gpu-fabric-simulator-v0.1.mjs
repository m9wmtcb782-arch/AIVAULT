/**
 * AIVAULT GPU Fabric local simulator v0.1.
 * SIMULATED only: executes allowlisted numeric operations on the local CPU.
 * It does not connect to devices, use GPUs, transfer network tensors, or prove performance.
 */
import { createHash } from "node:crypto";

const ALLOWED_OPERATORS = new Set(["mul_scalar", "add_scalar"]);

function digestCanonicalValue(value) {
  return createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex");
}

export function runSimulatedGraph({ jobId, inputTensorId = "x", inputValue, operations, nodeAssignments }) {
  if (typeof jobId !== "string" || !jobId.trim()) throw new Error("jobId is required");
  if (typeof inputTensorId !== "string" || !inputTensorId.trim()) throw new Error("inputTensorId is required");
  if (!Array.isArray(inputValue) || inputValue.length === 0 ||
      inputValue.some((n) => typeof n !== "number" || !Number.isFinite(n))) {
    throw new Error("inputValue must be a non-empty array of finite numbers");
  }
  if (!Array.isArray(operations) || operations.length === 0) throw new Error("operations must be non-empty");
  if (!nodeAssignments || typeof nodeAssignments !== "object" || Array.isArray(nodeAssignments)) {
    throw new Error("nodeAssignments must map operation IDs to simulated node IDs");
  }

  const tensors = new Map([[inputTensorId, [...inputValue]]]);
  const seenOperations = new Set();
  const trace = [];
  const transferTrace = [];

  for (const operation of operations) {
    if (!operation || typeof operation !== "object") throw new Error("operation must be an object");
    const { operation_id, operator, dependency_ids, input_tensor_ids, output_tensor_id, scalar } = operation;
    if (typeof operation_id !== "string" || !operation_id.trim() || seenOperations.has(operation_id)) {
      throw new Error("missing or duplicate operation_id");
    }
    if (!ALLOWED_OPERATORS.has(operator)) throw new Error("operator is not allowlisted: " + operator);
    if (!Array.isArray(dependency_ids) || !Array.isArray(input_tensor_ids) || input_tensor_ids.length === 0) {
      throw new Error("operation dependencies and inputs must be arrays");
    }
    if (typeof output_tensor_id !== "string" || !output_tensor_id.trim() || tensors.has(output_tensor_id)) {
      throw new Error("missing or duplicate output_tensor_id");
    }
    for (const dependencyId of dependency_ids) {
      if (!seenOperations.has(dependencyId)) throw new Error("dependency not completed before operation: " + dependencyId);
    }
    const inputArrays = input_tensor_ids.map((tensorId) => {
      if (!tensors.has(tensorId)) throw new Error("input tensor is unavailable: " + tensorId);
      return tensors.get(tensorId);
    });
    if (inputArrays.some((values) => values.length !== inputArrays[0].length)) {
      throw new Error("input tensor shapes do not match for this simulator operator");
    }
    if (typeof scalar !== "number" || !Number.isFinite(scalar)) throw new Error("scalar must be finite");
    const nodeId = nodeAssignments[operation_id];
    if (typeof nodeId !== "string" || !nodeId.trim()) throw new Error("missing node assignment for " + operation_id);

    const sourceTensorIds = [...input_tensor_ids];
    for (const sourceTensorId of sourceTensorIds) {
      const producer = trace.find((entry) => entry.output_tensor_id === sourceTensorId);
      if (producer && producer.node_id !== nodeId) {
        transferTrace.push({
          job_id: jobId,
          tensor_id: sourceTensorId,
          from_node_id: producer.node_id,
          to_node_id: nodeId,
          status: "SIMULATED",
          bytes: tensors.get(sourceTensorId).length * 8,
        });
      }
    }

    const values = inputArrays[0].map((value) =>
      operator === "mul_scalar" ? value * scalar : value + scalar
    );
    if (values.some((n) => !Number.isFinite(n))) throw new Error("operation produced a non-finite value");
    tensors.set(output_tensor_id, values);
    seenOperations.add(operation_id);
    trace.push({
      job_id: jobId,
      operation_id,
      operator,
      node_id: nodeId,
      dependency_ids: [...dependency_ids],
      input_tensor_ids: sourceTensorIds,
      output_tensor_id,
      output_value_sha256: digestCanonicalValue(values),
      status: "SIMULATED",
    });
  }

  const finalTensorId = operations[operations.length - 1].output_tensor_id;
  const participatingNodeIds = [...new Set(trace.map((entry) => entry.node_id))].sort();
  return {
    status: "SIMULATED",
    job_id: jobId,
    output_tensor_id: finalTensorId,
    output_value: [...tensors.get(finalTensorId)],
    output_value_sha256: digestCanonicalValue(tensors.get(finalTensorId)),
    participating_node_ids: participatingNodeIds,
    trace,
    transfer_trace: transferTrace,
    note: "CPU-only simulation. SIMULATED is not evidence of real GPU execution.",
  };
}
