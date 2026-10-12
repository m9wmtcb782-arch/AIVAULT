# AIVAULT Android Native Compute Worker (phase 1)

This directory specifies the **native Android GPU contribution path** for devices where browser WebGPU is unavailable and WebGL2 is blocked or unreliable.

## Runtime contract

- User explicitly opts in to GPU contribution; default OFF.
- The worker must be a **foreground service** with a persistent notification and a Stop action. No covert/background mining.
- Default policy: Wi-Fi connected, device charging, thermal status below MODERATE, screen/user-visible opt-in. Pause immediately on user Stop, low battery, loss of charging/Wi-Fi, or thermal escalation.
- Probe Vulkan support first (native NDK), then OpenGL ES 3.0 compute-compatible fragment shader. GLES 3.0 **does not guarantee compute shaders**; GLES 3.1 compute is a separate capability. No GPU backend => register as unavailable, never claim GPU.
- A successful GPU proof must dispatch a fixed shader, read back GPU-produced data, compare against a CPU oracle, and report verified=true only after matching. CPU is a verifier, not a substitute execution backend.
- Server must independently validate every result and lease generation before crediting work. Never credit PGU based on hardware name, capability flags, or client-reported timing alone.
- Workloads are small, fixed, bounded, and signed/allowlisted by the coordinator. Never download arbitrary executable GPU shaders from jobs.
- Only advertise task types implemented and verified by that backend; never advertise tensor or video support from a basic checksum test.
- Device identifiers must be app-scoped, pseudonymous and revocable. No raw device serial or advertising ID.
- Native APK cannot be delivered through GitHub Pages; it requires an Android build, signing and installation process.

## Coordinator integration

Existing endpoint: `/functions/v1/aivault-compute-coordinator`. The existing browser worker uses `node.register`, `node.heartbeat`, `task.request`, `task.progress`, `task.result`, and `task.failure`.

Native integration **must not** reuse a browser node ID. It must use a distinct installation ID and explicit runtime (`android-vulkan` or `android-gles`), with capability and task allowlist validated by the server. Confirm the live coordinator schema and auth before implementing production requests. Never ship Supabase service-role secrets or privileged tokens in an APK.

## Acceptance criteria

1. Android phone with WebGPU disabled can perform a **native** GPU shader proof and readback.
2. GPU output matches the CPU oracle on device, and server independently verifies the returned result.
3. Worker stops on user request and on thermal/power/network policy failures.
4. A disconnected worker cannot keep its lease or count as available.
5. Actual native execution, energy/thermal behavior, task lease recovery and server crediting are verified on physical devices.

**Status:** architecture and safety contract only. No APK, native GPU runtime or deployed native worker exists yet. Do not label this as deployed.
