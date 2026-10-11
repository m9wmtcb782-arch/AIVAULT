# AIVAULT self-hosted model services v0.1

## Goal and actual status

Dark Star calls AIVAULT model identities, with inference on AIVAULT-controlled workers and eventually one graph distributed across heterogeneous GPUs. No Grok, Kling, Magic Hour or other hosted generation API is called or used as fallback by these modules. Existing Dawn and Dark Star functions/pages are untouched.

Five generation capabilities require four candidate base-model bundles: text/image-to-video share Wan TI2V. These are named services based on attributed upstream open weights, not claims of AIVAULT training a foundation model from scratch. Model versions are AIVAULT interface versions; upstream weight revisions remain unset until selected, reviewed and checksummed.

| AIVAULT name | ID | Capability | Candidate source |
| --- | --- | --- | --- |
| 曙光·映像 | aivault-dawn-image-v0.1 | Text to image | Qwen/Qwen-Image |
| 流光·文生影片 | aivault-liuguang-t2v-v0.1 | Text to video | Wan-AI/Wan2.2-TI2V-5B |
| 流光·圖生影片 | aivault-liuguang-i2v-v0.1 | Image to video | Same Wan bundle |
| 弦音 | aivault-xianyin-music-v0.1 | Text to music | ACE-Step-1.5 project; exact component bundles not selected |
| 塑界 | aivault-sujie-3d-v0.1 | Image to 3D | tencent/Hunyuan3D-2.1 |

Dawn remains a visual agent. These model service identities do not rename the agent. Plastic-world 3D uses an image input because the referenced Hunyuan pipeline does; text-to-3D will need a tested image-generation dependency, not a falsely declared native text-to-3D capability. Video soundtrack/sound effects are not established by selecting Wan.

Official sources checked 2026-10-11:
- https://github.com/QwenLM/Qwen-Image
- https://github.com/Wan-Video/Wan2.2
- https://github.com/ace-step/ACE-Step-1.5
- https://github.com/Tencent-Hunyuan/Hunyuan3D-2.1

## Implemented research interfaces

`gpu-fabric-owned-models-v0.1.mjs` supplies immutable named identities and a trusted-coordinator request diagnostic. Request includes agent_id, model_id, capability, prompt and, for image-conditioned tasks, image_tensor_id. Request-supplied availability/runtime fields cannot activate a model. It uses the existing Fabric backend capability reader to report provisioned adapters and returns explicit blocking reasons. It does not expose HTTP, authenticate callers, launch inference or issue execution grants. Adapter declarations alone are not GPU verification.

`gpu-fabric-weight-verifier-v0.1.mjs` verifies a reviewed local installation lock: model_id, exact candidate bundle, 40-character source revision, unique relative file paths, exact byte lengths and SHA-256. It streams files without loading the bundle into memory, rejects symlinks and checks for file changes while hashing. Use a private immutable installation directory; checksums do not authenticate an untrusted manifest, prove a complete bundle, parse safetensors or prevent changes after verification. Model loading must independently bind to the reviewed bytes.

The lock is supplied by trusted installation tooling, not a browser request. CHECKSUMS_VERIFIED means only that the local bytes matched the supplied lock. It never means AVAILABLE, model_loaded or fabric_ready.

## Remaining work

All five services remain PLANNED/BLOCKED. No upstream weights are installed here. Actual model generation, licensing/resource fit, single-node reference inference, model graph import, operator coverage, tokenizer/encoder/VAE pipelines, artifact export and multi-device verification are NOT VERIFIED or REQUIRES TEST. The current bounded Dense/ReLU runtime is insufficient for these model architectures. An opaque full-model API call cannot substitute for graph partitioning.

A complete research capability catalogue currently has twelve routes (five language/vision tasks, two speech tasks and five generation tasks). That is a catalogue count, not twelve installed engines. This stage prioritizes the five requested generation routes. The independent tiny Dense model remains test-only and does not make any of the generation services available.

## Validation

Controlled-adapter tests check that all named requests stay blocked, adapters never execute, absent image/wrong capability/wrong route fail, and forged AVAILABLE/runtime fields have no effect. Temporary non-model fixture bytes test checksum success, tampering, traversal, duplicate paths, source mismatch and symlink rejection. These tests do not perform AI generation or use physical multi-device GPUs.
