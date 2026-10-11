/**
 * AIVAULT Unified GPU Fabric deterministic graph planner v0.1.
 * Produces a PLANNED assignment only. It does not launch work or connect to devices.
 * Scheduling policy is intentionally simple and deterministic for conformance testing.
 */
const ID_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/;

function requireId(value, label) {
  if (typeof value !== "string" || !ID_RE.test(value)) throw new Error("invalid " + label);
}

export function planGraph({ operations, nodes, tensorBytes = {} }) {
  if (!Array.isArray(operations) || operations.length === 0) throw new Error("operations must be non-empty");
  if (!Array.isArray(nodes) || nodes.length === 0) throw new Error("nodes must be non-empty");
  if (!tensorBytes || typeof tensorBytes !== "object" || Array.isArray(tensorBytes)) throw new Error("tensorBytes must be an object");

  const operationById = new Map();
  for (const op of operations) {
    if (!op || typeof op !== "object") throw new Error("operation must be an object");
    requireId(op.operation_id, "operation_id");
    if (operationById.has(op.operation_id)) throw new Error("duplicate operation_id: " + op.operation_id);
    if (typeof op.operator !== "string" || !op.operator) throw new Error("invalid operator for " + op.operation_id);
    if (!Array.isArray(op.dependency_ids) || !Array.isArray(op.input_tensor_ids) ||
        !Array.isArray(op.output_tensor_ids) || op.output_tensor_ids.length === 0) {
      throw new Error("invalid dependency or tensor lists for " + op.operation_id);
    }
    const memory = op.estimated_memory_bytes ?? 0;
    if (!Number.isSafeInteger(memory) || memory < 0) throw new Error("invalid estimated_memory_bytes for " + op.operation_id);
    for (const tensorId of [...op.input_tensor_ids, ...op.output_tensor_ids]) requireId(tensorId, "tensor id");
    for (const dependencyId of op.dependency_ids) requireId(dependencyId, "dependency id");
    operationById.set(op.operation_id, { ...op, estimated_memory_bytes: memory });
  }

  const nodeById = new Map();
  for (const node of nodes) {
    if (!node || typeof node !== "object") throw new Error("node must be an object");
    requireId(node.node_id, "node_id");
    if (nodeById.has(node.node_id)) throw new Error("duplicate node_id: " + node.node_id);
    if (!Array.isArray(node.supported_operators) || !Array.isArray(node.backends) ||
        !Number.isSafeInteger(node.available_memory_bytes) || node.available_memory_bytes < 0) {
      throw new Error("invalid node capability descriptor for " + node.node_id);
    }
    nodeById.set(node.node_id, node);
  }

  for (const [tensorId, bytes] of Object.entries(tensorBytes)) {
    requireId(tensorId, "tensorBytes key");
    if (!Number.isSafeInteger(bytes) || bytes < 0) throw new Error("invalid byte size for tensor " + tensorId);
  }

  const indegree = new Map();
  const dependents = new Map();
  for (const op of operations) {
    const uniqueDeps = new Set(op.dependency_ids);
    if (uniqueDeps.size !== op.dependency_ids.length) throw new Error("duplicate dependencies for " + op.operation_id);
    indegree.set(op.operation_id, uniqueDeps.size);
    dependents.set(op.operation_id, []);
    for (const depId of uniqueDeps) {
      if (!operationById.has(depId)) throw new Error("unknown dependency " + depId + " for " + op.operation_id);
      dependents.get(depId).push(op.operation_id);
    }
  }

  const ready = operations.map((op) => op.operation_id).filter((id) => indegree.get(id) === 0).sort();
  const topologicalOrder = [];
  while (ready.length) {
    const id = ready.shift();
    topologicalOrder.push(id);
    for (const dependentId of dependents.get(id).sort()) {
      indegree.set(dependentId, indegree.get(dependentId) - 1);
      if (indegree.get(dependentId) === 0) {
        ready.push(dependentId);
        ready.sort();
      }
    }
  }
  if (topologicalOrder.length !== operations.length) throw new Error("operation graph contains a dependency cycle");

  const producerByTensor = new Map();
  for (const op of operations) {
    for (const tensorId of op.output_tensor_ids) {
      if (producerByTensor.has(tensorId)) throw new Error("multiple producers for tensor " + tensorId);
      producerByTensor.set(tensorId, op.operation_id);
    }
  }
  for (const op of operations) {
    for (const tensorId of op.input_tensor_ids) {
      const producerId = producerByTensor.get(tensorId);
      if (producerId && !op.dependency_ids.includes(producerId)) {
        throw new Error("missing dependency edge from " + producerId + " to " + op.operation_id + " for tensor " + tensorId);
      }
    }
  }

  const assignment = new Map();
  const remainingMemory = new Map([...nodeById].map(([id, node]) => [id, node.available_memory_bytes]));
  const planned = [];
  const transfers = [];
  let estimatedTransferBytes = 0;

  for (const operationId of topologicalOrder) {
    const op = operationById.get(operationId);
    const candidates = [...nodeById.values()].filter((node) =>
      node.supported_operators.includes(op.operator) &&
      (op.backend == null || node.backends.includes(op.backend)) &&
      remainingMemory.get(node.node_id) >= op.estimated_memory_bytes
    );
    if (candidates.length === 0) throw new Error("no capable node with sufficient memory for " + operationId);

    const scored = candidates.map((node) => {
      let transferCost = 0;
      for (const tensorId of op.input_tensor_ids) {
        const producerId = producerByTensor.get(tensorId);
        if (!producerId) continue; // input tensor originates outside this graph
        const producerNode = assignment.get(producerId);
        if (producerNode && producerNode !== node.node_id) transferCost += tensorBytes[tensorId] ?? 0;
      }
      return { node, transferCost };
    }).sort((a, b) =>
      a.transferCost - b.transferCost ||
      remainingMemory.get(b.node.node_id) - remainingMemory.get(a.node.node_id) ||
      a.node.node_id.localeCompare(b.node.node_id)
    );
    const { node, transferCost } = scored[0];
    assignment.set(operationId, node.node_id);
    remainingMemory.set(node.node_id, remainingMemory.get(node.node_id) - op.estimated_memory_bytes);
    planned.push({
      operation_id: operationId,
      node_id: node.node_id,
      operator: op.operator,
      dependency_ids: [...op.dependency_ids],
      input_tensor_ids: [...op.input_tensor_ids],
      output_tensor_ids: [...op.output_tensor_ids],
      estimated_memory_bytes: op.estimated_memory_bytes,
      status: "PLANNED",
    });
    for (const tensorId of op.input_tensor_ids) {
      const producerId = producerByTensor.get(tensorId);
      const sourceNodeId = producerId ? assignment.get(producerId) : null;
      if (sourceNodeId && sourceNodeId !== node.node_id) {
        const bytes = tensorBytes[tensorId] ?? 0;
        transfers.push({ tensor_id: tensorId, from_node_id: sourceNodeId, to_node_id: node.node_id, estimated_bytes: bytes, status: "PLANNED" });
      }
    }
    estimatedTransferBytes += transferCost;
  }

  return {
    status: "PLANNED",
    planner_version: "aivault.gpu-fabric-planner/0.1",
    topological_order: topologicalOrder,
    operations: planned,
    estimated_transfers: transfers,
    estimated_transfer_bytes: estimatedTransferBytes,
    remaining_memory_bytes: Object.fromEntries([...remainingMemory].sort(([a], [b]) => a.localeCompare(b))),
    note: "Planning result only. No node accepted work and no operation or tensor transfer was executed.",
  };
}
