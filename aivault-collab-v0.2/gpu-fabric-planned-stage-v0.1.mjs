/** Research-only one-operation HTTPS worker bound to an immutable graph plan.
 * A trusted coordinator provisions the plan and grants out of band. This is
 * not a scheduler, grant issuer, native iPhone listener or hardware attestation.
 */
import { createHttpsTensorReceiver } from './gpu-fabric-https-receiver-v0.1.mjs';
import { createHttpsTensorSender } from './gpu-fabric-https-channel-v0.1.mjs';
import { sendTensorOverAuthenticatedChannel } from './gpu-fabric-transport-v0.1.mjs';
import { executeBackendOperation } from './gpu-fabric-backend-v0.1.mjs';

const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/;
function equal(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
export function createPlannedHttpsStage({ localNodeId, jobId, plan, operations,
  grant, adapter, replayStore, next, fetchImpl, onCompleted = async () => {},
  maxBytes = 1024 * 1024 }) {
  // Snapshot trusted configuration before any asynchronous execution.
  const p = structuredClone(plan), ops = structuredClone(operations);
  const g = structuredClone(grant), route = next ? structuredClone(next) : null;
  if (typeof jobId !== 'string' || typeof localNodeId !== 'string' ||
      !ID.test(jobId) || !ID.test(localNodeId) ||
      p?.status !== 'PLANNED' || !Array.isArray(p.operations) ||
      !Array.isArray(p.topological_order) || !Array.isArray(ops) || !ops.length ||
      p.operations.length !== ops.length || p.topological_order.length !== ops.length ||
      typeof replayStore?.reserve !== 'function' || typeof onCompleted !== 'function') throw new Error('invalid planned stage configuration');
  const byId = new Map(), placements = new Map(), producers = new Map();
  for (const op of ops) {
    if (typeof op?.operation_id !== 'string' || !ID.test(op.operation_id) || byId.has(op.operation_id) ||
        !['mul_scalar', 'add_scalar'].includes(op.operator) || !Number.isFinite(op.scalar) ||
        !Array.isArray(op.input_tensor_ids) || op.input_tensor_ids.length !== 1 ||
        !Array.isArray(op.output_tensor_ids) || op.output_tensor_ids.length !== 1 ||
        !Array.isArray(op.dependency_ids) ||
        ![...op.input_tensor_ids, ...op.output_tensor_ids].every(x => typeof x === 'string' && ID.test(x))) {
      throw new Error('stage supports unique operations with one input and one output');
    }
    if (producers.has(op.output_tensor_ids[0])) throw new Error('duplicate tensor producer');
    producers.set(op.output_tensor_ids[0], op.operation_id);
    byId.set(op.operation_id, op);
  }
  for (const placement of p.operations) {
    const op = byId.get(placement.operation_id);
    if (!op || placements.has(placement.operation_id) || typeof placement.node_id !== 'string' || !ID.test(placement.node_id) ||
        placement.operator !== op.operator || !equal(placement.input_tensor_ids, op.input_tensor_ids) ||
        !equal(placement.output_tensor_ids, op.output_tensor_ids)) throw new Error('plan does not match graph');
    placements.set(placement.operation_id, placement);
  }
  const visited = new Set();
  for (const id of p.topological_order) {
    const op = byId.get(id);
    if (!op || visited.has(id) || op.dependency_ids.some(d => !visited.has(d))) throw new Error('invalid topological order');
    const producer = producers.get(op.input_tensor_ids[0]);
    if (producer && (!visited.has(producer) || !op.dependency_ids.includes(producer))) throw new Error('missing tensor dependency');
    if (!equal(op.dependency_ids, producer ? [producer] : [])) throw new Error('stage supports a linear tensor dependency chain');
    visited.add(id);
  }
  const assigned = p.operations.filter(x => x.node_id === localNodeId);
  if (assigned.length !== 1) throw new Error('v0.1 stage requires exactly one operation per node');
  const op = byId.get(assigned[0].operation_id);
  const producer = producers.get(op.input_tensor_ids[0]);
  if (!g || g.jobId !== jobId || g.operationId !== op.operation_id ||
      g.tensorId !== op.input_tensor_ids[0] ||
      (producer && g.senderNodeId !== placements.get(producer).node_id)) throw new Error('input grant does not match planned stage');
  const consumers = ops.filter(x => x.input_tensor_ids.includes(op.output_tensor_ids[0]));
  let channel;
  if (consumers.length > 1) throw new Error('fan-out requires a future multi-edge runtime');
  if (consumers.length === 1) {
    const target = consumers[0], node = placements.get(target.operation_id).node_id;
    if (!route || route.nodeId !== node || node === localNodeId ||
        route.grant?.jobId !== jobId || route.grant?.operationId !== target.operation_id ||
        route.grant?.tensorId !== op.output_tensor_ids[0] || route.grant?.senderNodeId !== localNodeId ||
        route.grant?.dtype !== 'float32' || !equal(route.grant?.shape, g.shape)) throw new Error('outgoing route does not match planned edge');
    channel = createHttpsTensorSender({ endpoint: route.endpoint, localNodeId, peerNodeId: node,
      accessToken: route.grant.token, sessionExpiresAt: route.grant.expiresAt, fetchImpl });
  } else if (route) throw new Error('terminal operation must not forward tensors');
  let state = { status: 'WAITING_FOR_TENSOR', job_id: jobId, operation_id: op.operation_id, node_id: localNodeId };
  const handler = createHttpsTensorReceiver({ localNodeId, grants: [g], replayStore, maxBytes,
    onTensor: async (tensor, context) => {
      state = { ...state, status: 'EXECUTING' };
      try {
        const bytes = Buffer.from(tensor.payload);
        const input = Array.from({ length: tensor.shape[0] }, (_, i) => bytes.readFloatLE(i * 4));
        const result = await executeBackendOperation(adapter, { operator: op.operator, scalar: op.scalar }, [input], context);
        const output = Buffer.alloc(result.output.length * 4);
        result.output.forEach((v, i) => {
          if (!Number.isFinite(Math.fround(v))) throw new Error('output exceeds Float32 range');
          output.writeFloatLE(v, i * 4);
        });
        if (channel) {
          state = { ...state, status: 'FORWARDING' };
          await sendTensorOverAuthenticatedChannel({ channel, sender_node_id: localNodeId,
            receiver_node_id: route.nodeId, tensor_id: op.output_tensor_ids[0], dtype: 'float32',
            shape: g.shape, payload: output, context: { job_id: jobId, operation_id: route.grant.operationId } });
        }
        // Float32 wire values, not the adapter's possibly higher-precision array.
        const outcome = { ...state, status: 'PLANNED_STAGE_COMPLETED', device_kind: result.device_kind,
          backend_id: result.backend_id, output_tensor_id: op.output_tensor_ids[0],
          output: Array.from({ length: result.output.length }, (_, i) => output.readFloatLE(i * 4)),
          downstream_receipt_verified: !!channel, physical_gpu: 'NOT VERIFIED' };
        await onCompleted(structuredClone(outcome));
        state = outcome;
      } catch (error) {
        state = { ...state, status: 'FAILED_REQUIRES_NEW_JOB' };
        throw error; // Durable input reservation stays consumed; no implicit retry.
      }
    } });
  return { handler, getState: () => structuredClone(state) };
}
