# Cross-device GPU tensor proof v1

This is a fixed, untrained two-layer 16-dimensional FP32 affine/ReLU kernel test. It is not a trained video model, pooled VRAM, token throughput, or enterprise rental capacity.

## Execution

Main pool entry initializes the existing integer diagnostic and separately probes fixed FP32 tensor kernels. WebGPU compute and WebGL2 RGBA32F with EXT_color_buffer_float run real shaders and read GPU outputs; unsupported float targets retain ordinary GPU participation and explain the tensor restriction. CPU code is an output oracle only.

`pipeline.start` requires two ready tensor-capable browser node IDs and creates one deterministic fixed proof per global five-minute window, preserving existing tasks. Arbitrary pipeline inputs, code, shader URLs, model references and reserved task IDs cannot be created through task.create.

Layer 1 uses fixed input and AIVAULT-owned deterministic test coefficients; after all 16 outputs pass the numerical oracle, the coordinator persists the result and idempotently queues layer 2 with the actual output tensor. Layer 2 excludes layer 1's node ID. Transport is HTTPS JSON through the coordinator, 64 logical tensor bytes; this is not an RDMA or peer-to-peer link. There is no claim of measured network-only transfer latency, trained inference or speedup.

## Failures and fencing

Task claim uses a WAITING-state compare-and-set. Tasks store leased work as QUEUED; cancelled assignments use CANCELLED, matching the live CHECK constraints. The same task/node/slice assignment is renewed on reuse rather than violating its unique key. Paused browser nodes store OFFLINE. Every tensor attempt has a random generation and a hard three-minute lease. Heartbeats and progress cannot extend that hard deadline. Missing/expired node heartbeats (two minutes), expired lease, or stalled progress cause a compatible worker/status poll to atomically requeue only the unfinished stage, preserving its input. Completed upstream stages do not rerun. No available compatible distinct node means waiting.

Completion and progress are fenced by the current lease generation. An old worker cannot complete, fail, extend or overwrite a replacement attempt. Replay after successful completion is idempotent. Invalid outputs do not enqueue downstream work; failed workers are excluded from that proof, with at most two retries. This is a per-proof exclusion, not evidence of malicious intent or a global account ban. Permanent reputation and settlement controls are not implemented.

## Boundaries

Browser registrations and execution/timing reports are not hardware-attested identities. Two browser IDs do not prove two physical devices. This fixed public test route must not carry enterprise secrets or billable production tasks. Enterprise submissions remain HTTP 403, external model use closed, pricing unset, billing disabled. Production requires authenticated supplier/tenant identities, tested approved first-party weights/runtime, end-to-end video quality/performance and memory tests, pool capacity/SLA evidence and commercial approval.

Video capacity stays UNVALIDATED and Token/s stays unmeasured. A kernel proof does not change model availability, video capacity, rental readiness or rewards.

## Validation

Tests use an in-memory database and GPU API stubs. They cover dependent data flow, two distinct node IDs, reserved IDs, lease claims, late completion/progress/failure fencing, offline next-layer reassignment, bad-output retries, hard deadlines, idempotence, no CPU output substitution, absent FP32 support and closed enterprise submissions. Actual multi-device GPU execution requires real foreground browser nodes reloading the published page and completing the proof.
