# AIVAULT Unified GPU Fabric — Execution Protocol Contract v0.1

Status: CONTRACT SPECIFICATION ONLY — NOT IMPLEMENTED OR EXECUTED
Branch: research/unified-gpu-fabric-v0.1
Scope: additive specification. No production deployment, database writes, API calls, or Dark Star changes.

## 1. Purpose and non-goals

Define a backend-neutral contract for a future runtime that can execute one model graph across multiple opted-in devices.

This protocol is not a prompt-splitting protocol. A job must carry one model manifest and an explicit dependency graph. Operations on different nodes must be linked by tensor inputs/outputs and dependency IDs.

This document does not claim that distributed execution exists. It is a contract to implement and test before enabling it.

## 2. Required identifiers

Every message must include:
- `protocol_version`: exact supported version, initially `aivault.gpu-fabric/0.1`
- `job_id`: unique ID for one model execution
- `session_id`: short-lived authenticated execution session
- `model_manifest_sha256`: digest of the immutable model manifest
- `message_id`: unique ID used to reject replayed messages
- `issued_at` and `expires_at`: timestamps checked against a bounded clock-skew policy
- `sender_node_id`: authenticated node identity for worker-originated messages

Unknown protocol versions, expired messages, missing identifiers, and duplicate message IDs must be rejected.

## 3. Model manifest

A manifest must identify:
- model name and immutable version
- artifact hashes and format
- supported operators and required numerical semantics
- input/output signatures
- graph nodes and directed dependency edges
- supported dtypes, layouts, and shape constraints
- allowed execution backends and minimum capability requirements
- verification method and numerical tolerance

Do not send a model to a node until the node is authorized for that artifact and its backend/capabilities pass compatibility checks. Artifact hashes identify content; they do not by themselves prove that a runtime executed it correctly.

## 4. Operation and tensor descriptors

Each operation descriptor must contain:
- `operation_id`
- `operator` and `operator_version`
- `dependency_ids[]`
- `input_tensors[]` and `output_tensors[]`
- `placement_constraint` (compatible backend/capability requirements, not a hard-coded vendor)
- `deadline` and `resource_budget`

Each tensor descriptor must contain:
- `tensor_id`
- `dtype`
- `shape[]`
- `layout`
- `byte_length`
- `content_sha256` when materialized
- `producer_operation_id`
- `owner_node_id` while resident
- `consumers[]`
- `lifetime` / release condition

The runtime must calculate expected byte length from dtype and shape using overflow-safe arithmetic, reject inconsistent descriptors, and verify the content hash after transfer. A hash detects content mismatch; it is not a substitute for authorization or transport encryption.

## 5. Minimum message types

### `capability.advertise`
Reports protocol versions, runtime/backend versions, supported operators, memory limits, accelerator details, and measured link properties. Values that cannot be measured must be marked unknown rather than fabricated.

### `job.prepare`
Includes job/session IDs, model-manifest hash, graph subset, input tensor descriptors, data policy, deadline, and resource limits. It must not include credentials or unrelated private conversation history.

### `job.accept` / `job.reject`
The node accepts only if the session is authorized, the manifest and operations are supported, resource limits permit execution, and data policy allows the input. Rejection includes a stable machine-readable reason.

### `tensor.transfer`
Identifies source and destination node, tensor ID, descriptor, byte count, integrity hash, encryption context, and expiry. Transfer acknowledgement is required before a consumer operation starts.

### `operation.start` / `operation.result`
Reports operation ID, input/output tensor IDs, runtime/backend, start/end timestamps, status, output hashes, and structured error. Worker-reported evidence is recorded as a claim until independently validated by the coordinator/runtime verification policy.

### `job.cancel`
Cancellation is idempotent. Nodes stop accepting new operations for the job, release eligible buffers, and acknowledge final state. Late results must not overwrite a cancelled or expired job.

### `job.report`
Returns final status, model-manifest hash, graph execution trace, participating node IDs, operation/tensor dependency trace, bytes transferred, timing breakdown, output hash, validation method, and any failures/retries.

## 6. State machine

Allowed high-level transitions:

```text
CREATED -> PREPARING -> READY -> RUNNING -> VERIFYING -> COMPLETED
    |          |         |         |             |
    +--------> FAILED <--+---------+-------------+
    +--------> CANCELLED <----------+
```

Rules:
- `COMPLETED` is allowed only after all required graph outputs exist and pass the configured verification policy.
- A node's self-reported `verified: true` is not sufficient on its own.
- A partial operation result must never complete the whole job.
- Retries must be idempotent or use new attempt IDs; late results from older attempts are ignored.
- A missing node must cause safe failure or an explicitly supported checkpoint/replan, not silent result substitution.

## 7. Security and privacy requirements

- Explicit opt-in and revocation for every contributed node.
- Short-lived, scoped credentials bound to node, session, and permitted operation set.
- Authenticated encrypted transport.
- Strict message size, tensor size, execution time, memory, and concurrency limits.
- No arbitrary code execution from a remote coordinator payload; workers execute only allowlisted runtime operations/artifacts.
- No worker write access to Dark Star memory, identity, provider settings, or production configuration.
- Data classification and consent policy checked before each transfer; default-deny private conversation data on third-party nodes.
- Audit records must avoid logging raw prompts, private tensors, credentials, or secrets.

## 8. First conformance test

Use a tiny deterministic graph, not a production Dark Star model:

1. Node A computes `h = f(x)`.
2. The runtime transfers tensor `h` to Node B and validates descriptor and content hash.
3. Node B computes `y = g(h)`.
4. The coordinator validates dependency order, manifest hash, operation trace, output signature, and output against a trusted single-device reference within a documented tolerance.
5. The report proves both nodes executed operations in the same `job_id`; it also records transfer and compute timings.
6. Repeat with corrupted hash, unsupported operator, expired session, duplicate message ID, cancellation, and Node B disconnect. Each negative case must fail safely.

Pass requires reproducible logs/artifacts and matching output within tolerance. Node registration, heartbeats, task dispatch, or two independent AI responses do not pass.

## 9. Implementation order

1. Implement schema/type validation and state-machine unit tests without connecting production services.
2. Implement a local in-process simulator to test dependency ordering and failure cases; label it SIMULATED.
3. Implement one real accelerator backend and validate the single-device reference.
4. Implement one authenticated node-to-node tensor transfer path.
5. Demonstrate a two-node graph on real devices.
6. Compare correctness and latency against the single-device baseline.
7. Only then consider larger models or more nodes.

## 10. Evidence labels

- `CONFIRMED FROM SOURCE`: directly visible in reviewed source.
- `SIMULATED`: generated by a simulator, not a physical device.
- `REQUIRES TEST`: implementation exists but has not passed a reproducible test.
- `NOT VERIFIED`: evidence is absent or insufficient.
- `BLOCKED`: a required dependency or permission prevents the test.
- Never label a design document as an implementation or a planned test as PASS.
