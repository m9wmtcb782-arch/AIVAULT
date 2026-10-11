# AIVAULT Unified GPU Fabric — Design v0.1

Status: DESIGN / NOT IMPLEMENTED  
Owner: AIVAULT  
Primary consumer: Dark Star (暗星)  
Purpose: let Dark Star use heterogeneous, opt-in compute devices through one AIVAULT-controlled runtime, with a path toward executing one model across multiple GPUs rather than relying only on independent task splitting.

## 1. Core product decision

The compute pool is intended to behave like Dark Star's expandable compute hardware, not an external AI that takes over Dark Star's identity or memory.

Dark Star keeps control of its identity, conversation state, long-term memory, model policy, and final response. The fabric supplies execution capacity. A node provider contributes hardware and runs a constrained worker runtime; it does not gain authority over Dark Star's control plane.

The system must not claim that a collection of devices is literally one physical GPU. It exposes one logical compute interface while managing distributed devices and their separate memory spaces underneath.

## 2. Critical distinction: semantic task splitting vs. model-parallel execution

The first release must not depend on sending unrelated subtasks to separate AI agents and merging their answers.

Instead, the long-term target is **single-model distributed execution**: one model graph runs across multiple devices. Depending on the model and hardware, the runtime may shard tensors/weights, assign graph stages to devices, or use pipeline/data parallel execution. The runtime must preserve the model's defined dependencies and numerical semantics as far as the selected backend allows.

This still requires internal partitioning of tensors or graph operations. It is not possible to avoid all partitioning and communication while distributing a model across physically separate GPUs. The distinction is that the system partitions computation, not the user's question into independent interpretations.

## 3. Architecture

### A. Dark Star Compute API

A stable API that Dark Star calls without knowing vendor-specific GPU details.

Initial conceptual operations:
- discover_capabilities()
- load_model(model_manifest, placement_policy)
- submit_inference(model_id, input, options)
- get_job_status(job_id)
- cancel_job(job_id)
- get_execution_report(job_id)

These are design-level names, not implemented endpoints.

### B. Control plane

Responsibilities:
- authenticate nodes and enforce explicit opt-in;
- register device capabilities, availability, thermal/power limits, backend, memory, and measured performance;
- select compatible devices and a communication topology;
- place model weights, graph stages, and buffers;
- manage job state, retries, checkpoints, and node departure;
- report measured performance and errors without inventing capacity.

The control plane chooses placement; it does not reinterpret the user's task.

### C. Distributed execution runtime

Responsibilities:
- execute a compatible model graph across selected devices;
- manage per-device buffers and explicit transfers;
- coordinate synchronization and dependencies;
- use supported collectives when the backend and network support them;
- detect incompatible operations and reject unsupported placements;
- return outputs and an execution trace.

Do not promise one globally addressable physical VRAM pool. Implement a logical memory manager over separately allocated device memories, with explicit ownership, transfer, and lifetime rules.

### D. Node worker

A provider runs a small, versioned worker with explicit consent. It:
- reports real hardware and runtime capabilities;
- downloads only signed, authorized runtime/model artifacts;
- executes approved workloads inside a constrained process;
- enforces resource, time, and thermal limits;
- reports output, metrics, and errors;
- can leave the pool without pretending to remain available.

Never execute arbitrary model-generated code on a provider's device. Require signed artifacts, least privilege, quotas, and revocable node credentials.

### E. Backend adapters

Keep the runtime vendor-neutral at the API boundary, but use existing device APIs rather than attempting to write every driver from scratch.

Potential adapters, subject to actual device support:
- NVIDIA: CUDA-based backend where available;
- AMD: ROCm or another supported backend for the target platform;
- Apple devices: Metal / Metal Performance Shaders, subject to OS foreground/background restrictions;
- Android devices: supported Vulkan or vendor/runtime-specific APIs;
- CPU fallback: only when permitted and reported honestly.

CUDA is optional, not the universal system contract. Hardware with no compatible execution backend must be reported as unavailable for that workload.

## 4. Network and topology reality

A thousand phones on ordinary internet connections cannot be assumed to behave like a single RTX 5090. Network latency, bandwidth, device heterogeneity, thermal throttling, OS restrictions, and node churn can dominate performance.

The placement engine must be topology-aware:
- prefer low-communication placements;
- avoid latency-sensitive cross-device tensor collectives across slow WAN links unless measurements justify them;
- consider pipeline/model-stage placement where appropriate;
- benchmark before expanding the number of nodes;
- publish effective throughput, latency, transfer overhead, memory use, and failure rate separately from theoretical peak FLOPS.

The success criterion is measured improvement for a defined workload, not the number of registered phones.

## 5. Security and privacy boundaries

- Node participation is opt-in and revocable.
- Node identity and job authorization use scoped, revocable credentials.
- Use encrypted transport and authenticated artifacts.
- Do not send private user data to third-party nodes unless the user/system policy explicitly permits it.
- Assume node providers may inspect data that reaches their device; encryption in transit does not hide plaintext during ordinary GPU execution.
- Separate control-plane secrets from workers.
- Record node/job provenance and validate results where practical.
- Do not allow workers to write to Dark Star's memory or production configuration directly.

## 6. Incremental implementation plan

### Phase 0 — repository and runtime inventory
Confirm the existing Compute Mesh, coordinator, worker protocol, database schema, authentication, and deployment paths before editing production components. Reuse existing infrastructure where it fits; do not rewrite tested core paths.

### Phase 1 — capability and protocol contract
Define versioned schemas for node registration, capability reports, job requests, job state, execution metrics, and results. Add contract tests. No production dispatch yet.

### Phase 2 — one-node end-to-end proof
Run one approved model or deterministic GPU workload through the unified API, worker, and result return path. Verify authentication, cancellation, metrics, and error handling.

### Phase 3 — two-node heterogeneous proof
Use two compatible but different devices. Verify the same model graph or supported model-parallel workload runs across both devices and produces a valid result. Compare single-node vs. two-node latency and throughput, including communication overhead.

### Phase 4 — fault tolerance
Disconnect one worker during a job. Confirm correct failure reporting and recovery only where the model/runtime supports checkpointing or safe replay. Never label an incomplete result as successful.

### Phase 5 — scale tests
Increase to 4, then 8, then larger groups only after each stage passes. Test topology-aware placement, resource limits, node churn, and measured scaling. Phone-node testing must account for foreground/background and thermal restrictions.

### Phase 6 — model-parallel expansion
Add more model formats and partitioning strategies only after backend compatibility, memory placement, synchronization, and numerical correctness are proven.

## 7. Acceptance criteria

Do not mark the system PASS until evidence demonstrates all applicable criteria:
1. A real node registers and its hardware capabilities are verified.
2. Dark Star submits a job through one stable API.
3. The worker actually executes the selected workload; a simulated node cannot count as a real GPU.
4. Output is returned and checked against a reference or defined tolerance.
5. Logs report actual execution time, transfer time, memory use, and failures.
6. A node departure is handled truthfully and does not produce a fake successful result.
7. For multi-GPU claims, at least two real devices demonstrably participate in the same model execution—not merely in separate unrelated jobs.
8. Scaling claims are supported by repeated measurements against a single-node baseline.

Evidence labels: CONFIRMED / NOT VERIFIED / REQUIRES TEST / BLOCKED. Never invent PASS results.

## 8. Explicit non-goals for v0.1

- Do not promise 1,000 phones equal one RTX 5090.
- Do not implement a new GPU driver stack from scratch.
- Do not merge physical VRAM into a literally shared hardware memory pool.
- Do not rewrite Dark Star's existing page, voice, identity, or memory systems as part of this effort.
- Do not call paid Grok or Kling APIs for this project.
- Do not dispatch jobs to users' devices without explicit opt-in.

## 9. Immediate next action

Inspect the current AIVAULT Compute Mesh and coordinator implementation, map existing tables/functions/protocols to this design, and produce a gap list before modifying production code. The GitHub code-search index was unavailable during the initial inspection, so the existing implementation has not yet been verified from source.
