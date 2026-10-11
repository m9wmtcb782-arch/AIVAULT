# WebGL2 GPU fallback for older phones

Existing compute-mesh-gpu-test.html now tries native WebGPU first, then a genuine WebGL2 integer-fragment GPU runner. Its calibration renders to an RGBA32UI framebuffer, reads pixels and compares the output to a CPU oracle. CPU code never substitutes for missing GPU output. The page records the device first with gpu=false and available=false. If both GPU paths fail, the device record remains while no GPU capacity is claimed. Successful initialization upgrades that same node record to the actual GPU runtime.

WebGL2 registers runtime=webgl2 and can receive only the fixed gpu-u32-mix workload, within 4096 elements and 16 iterations. The small validation button creates a 256-element, one-iteration task targeted to the current node. The backend checks dimensions, sample count and checksum before accepting portable benchmark completion. Legacy WebGPU task behavior remains available to WebGPU workers. No external models, arbitrary shaders or paid providers are admitted.

This is a compatibility foundation for small GPU arithmetic, not general AI-model inference, WebGPU emulation or same-model cross-device execution. Hardware attestation is not provided. WebGL2's reported duration includes draw/readback wall time; it is not GPU timestamp-query timing.

Pool view separately shows recorded nodes and currently online reported-GPU nodes, and lists the actual runtime. Offline nodes retain their registration; they do not fill the available-GPU water level. Browser node records are not guaranteed distinct physical devices.

Verification: 49/49 offline coordinator/policy/view/fallback tests pass, plus canvas smoke and frontend syntax checks. WebGL API stub tests validate data flow and reject incorrect pixels; they do not execute actual GPU shaders. iPhone X's actual WebGL2 calibration and remote task still need validation after the user reloads the Worker page in Safari and leaves it foreground. No real GPU result is fabricated or marked complete.

Sources: WebKit Safari 15 release notes https://webkit.org/blog/11989/new-webkit-features-in-safari-15/ and Khronos WebGL2 specification https://registry.khronos.org/webgl/specs/latest/2.0/ .
