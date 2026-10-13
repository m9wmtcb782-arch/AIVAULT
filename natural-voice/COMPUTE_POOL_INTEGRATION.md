# AIVAULT Mandarin voice ↔ Compute Mesh integration gate

The owner has authorized using the AIVAULT compute pool for the **first-party** Mandarin speech engine. This is authorization to build the integration, **not** proof that voice inference is available or permission to bypass existing pool controls.

## Current verified boundary
The current Coordinator implements fixed GPU arithmetic and cross-device tensor proofs, **not** arbitrary Piper/ONNX model execution. Its `task-access.ts` rejects model tasks unless the protected first-party approval RPC permits the model. No speech model weights, real speech-capable browser runtime, or authenticated voice worker registration has been verified. Historical live pool snapshot had zero online GPU nodes; recheck current status before any inference claim.

## Admission (implemented, isolated)
`compute-pool-admission.mjs` evaluates an explicitly normalized status snapshot. It fails closed unless all are true:
1. The requested first-party voice model has passed the existing server-side approval process.
2. The licensed Mandarin model weights are installed on a compatible worker.
3. A worker is online, available and reports a GPU plus matching `voice_tts_runtime`, `voice_model_id`, `voice_model_loaded` and `voice_inference_verified` capabilities.

These fields describe the **proposed normalized worker contract**, not currently guaranteed fields from `mesh.pool`. A future trusted backend adapter must derive `online` from heartbeat freshness and verify worker attestations rather than trusting browser self-reports. No model submission is wired up by this module.

## Implementation required before dispatch
- Create a native GPU/CPU model worker running actual licensed Mandarin speech weights. Browser WebGPU benchmarks do not mean ONNX/Piper can run on the browser GPU.
- Register an authenticated worker capability and use a server-side adapter to normalize live `mesh.pool` status; never expose service-role credentials or privileged pool RPC to mobile clients.
- Require protected model approval, job ownership, quotas, model checksum, verified output, lease fencing, cancellation and retries. Do not weaken the existing first-party restrictions.
- For streamed TTS, use model-aware routing and retain sequential PCM frames and original source-text offsets. Preserve audio quality if a worker disappears mid-sentence; only resume from verified clause boundaries.
- Run a real WAV generation and listening test on an actual worker, then iPhone end-to-end playback QA.

## Explicit non-goals
No changes to production Coordinator, Compute Mesh, Dark Star, Dawn or ebook. No paid API usage. No fake READY state, no model auto-download, no assertion that pooled phone VRAM is shared or that a browser tensor proof is speech inference.
