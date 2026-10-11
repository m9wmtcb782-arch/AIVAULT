# Research model capability catalogue v0.1

This is an additive, non-executing catalogue. It is not applied to Supabase model_registry and is not loaded into the production home page or Dark Star. Every slot is PLANNED; requests are BLOCKED until a verified runtime is bound. The inspection API cannot execute or promote models.

## CONFIRMED: repository inventory

Dawn Light is registered as a visual-agent in artifacts/aivault-011-agent-modules.sql. It is an agent, not a single short-video model. Capability registration alone is not runtime evidence.

| Capability | Research slot | Source evidence | Execution status |
| --- | --- | --- | --- |
| Image to video | planned-image-to-video | dawn-light-photo-video Edge Function, Magic Hour route | NOT VERIFIED live generation; BLOCKED Fabric |
| Text to video | planned-text-to-video | dawn-light-video Edge Function, Magic Hour route | NOT VERIFIED live generation; BLOCKED Fabric |
| Image generation | planned-image-generation | dawn-light-image delegates to existing image function | NOT VERIFIED live generation; BLOCKED Fabric |
| Vision | planned-vision | dawn-light-vision delegates to ai-gateway | NOT VERIFIED live inference; BLOCKED Fabric |
| Music generation | planned-music-generation | No runtime bound in this catalogue | BLOCKED |
| 3D generation | planned-3d-generation | Existing dawn-light-3d function explicitly returns BLOCKED | BLOCKED |
| Extraction, reasoning, coding, verification | Existing planned slots | 009_model_pool.sql | PLANNED; BLOCKED Fabric |
| Speech recognition and synthesis | Explicit catalogue slots | dawn-light-speech-to-text uses browser SpeechRecognition; live voice config names a WebSocket relay; no Fabric runtime bound | NOT VERIFIED live voice; BLOCKED Fabric |

Image-to-video is independent of text-to-video and requires an image request field. Music is not speech synthesis. 3D generation is not an ordinary image. These entries cover requested capability families, not every AI model in existence.

## REQUIRES TEST: enabling a model

Choose a runtime and a pinned model version, verify its licence and resources, implement the adapter, and test a real output of the stated type. For Fabric execution, additionally map supported graph operators, transfer model tensors safely, and compare against a single-node reference on physical devices. Provider API generation is separate from distributed model execution.

The current Metal graph only demonstrates a bounded tiny Dense/ReLU model. It cannot execute video, music or 3D generation models. No model weights were downloaded and no paid provider was called by this change.
