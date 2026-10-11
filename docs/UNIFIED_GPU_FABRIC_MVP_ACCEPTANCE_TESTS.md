# Unified GPU Fabric — MVP Acceptance Tests v0.1

Status: TEST PLAN ONLY — NOT IMPLEMENTED OR EXECUTED
Branch: research/unified-gpu-fabric-v0.1
Scope: additive research work; no production deployment, no Dark Star UI changes.

## Goal

Prove that one model execution can use two distinct devices while preserving model dependencies and producing a verifiable result. Registering two nodes or splitting a user prompt into two independent AI calls does not satisfy this goal.

## Gate 0 — Existing system baseline

- [ ] Record the exact coordinator endpoint/version and current task lifecycle.
- [ ] Confirm node identity, opt-in state, capability record, heartbeat expiry, and task authorization.
- [ ] Confirm an unverified worker result cannot mark a task COMPLETED.
- [ ] Record which parts are source-confirmed versus live-runtime-confirmed.

Exit: baseline is documented without modifying production.

## Gate 1 — Runtime contract

Define a versioned, backend-neutral contract before implementing device execution.

Required fields:
- protocol_version and runtime_version
- node_id, session_id, job_id, model_manifest_hash
- operation_id, dependency_ids, input/output tensor descriptors
- tensor dtype, shape, layout, byte length, and content hash
- explicit buffer owner and transfer destination
- deadline, cancellation, resource budget, and retry policy
- execution status, error code, timing, and verification evidence

Reject unknown protocol versions, invalid shapes, mismatched hashes, unsupported operators, and outputs from an expired or unauthorized session.

## Gate 2 — Single-device correctness

- [ ] Run a small deterministic model or graph on one supported accelerator.
- [ ] Compare output with a trusted reference within a documented numerical tolerance.
- [ ] Capture model hash, runtime/backend version, device capability, timings, and output hash.
- [ ] Test cancellation, malformed input, and worker disconnect.
- [ ] Do not report a pass without captured test evidence.

## Gate 3 — Two-device execution of the same graph

- [ ] Use two real, distinct devices with compatible supported operations.
- [ ] Partition a single model graph or its tensors; do not split the user prompt into independent model calls.
- [ ] Transfer an intermediate tensor from device A to device B with explicit ownership and hash/shape validation.
- [ ] Enforce dependency ordering and synchronization.
- [ ] Compare the final output with the single-device reference within the stated tolerance.
- [ ] Produce an execution trace showing both devices performed model operations in the same job.
- [ ] Measure transfer time, compute time, total latency, and bytes transferred.

Pass condition: all checks above have reproducible evidence. Merely seeing two online nodes is not a pass.

## Gate 4 — Fault and security tests

- [ ] Node leaves during execution; job fails safely or resumes from a verified checkpoint.
- [ ] Replayed, expired, or unauthorized job messages are rejected.
- [ ] A worker cannot write Dark Star memory, change model policy, or alter control-plane configuration.
- [ ] Sensitive user data is not sent to an external node unless the job policy explicitly permits it.
- [ ] Resource and thermal/power limits are enforced where the platform exposes them.

## Gate 5 — Performance decision

Compare the same workload on one device and on two devices. Report correctness, total latency, throughput, transfer overhead, memory use, failures, and energy/thermal observations where measurable.

Do not scale the node count until two-device correctness is repeatable. Distributed execution may be slower for small models or high-latency links; the scheduler must be allowed to choose one device when that is faster or safer.

## Current source-review baseline

- CONFIRMED FROM SOURCE: coordinator contains node registration and heartbeat/task lifecycle code.
- CONFIRMED FROM SOURCE: iOS native hardware collection scaffold includes Metal capability metadata.
- CONFIRMED FROM SOURCE: native iOS Metal task execution and coordinator registration are explicitly not implemented in the README.
- NOT VERIFIED: live deployment state, actual device registration, and real task execution.
- NOT IMPLEMENTED / NOT DEMONSTRATED BY REVIEWED SOURCES: distributed graph placement, cross-device tensor transfer and synchronization, and one model executing across multiple real GPUs.

## Change boundary

This document does not authorize deployment, schema changes, live database writes, paid API calls, or edits to Dark Star UI/voice/memory. Implement each runtime milestone as a small, separately reviewed change after the required prerequisites are established.
