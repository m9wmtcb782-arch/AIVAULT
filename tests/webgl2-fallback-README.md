# WebGL2 GPU fallback for older phones

Existing compute-mesh-gpu-test.html now tries native WebGPU first, then a genuine WebGL2 integer-fragment GPU runner. Its calibration renders to an RGBA32UI framebuffer, reads pixels and compares the output to a CPU oracle. CPU code never substitutes for missing GPU output. The page records the device first with gpu=false and available=false. If both GPU paths fail, the device record remains while no GPU capacity is claimed. Successful initialization upgrades that same node record to the actual GPU runtime.

WebGL2 registers runtime=webgl2 and can receive only the fixed gpu-u32-mix workload, within 4096 elements and 16 iterations. The small validation button creates a 256-element, one-iteration task targeted to the current node. The backend checks dimensions, sample count and checksum before accepting portable benchmark completion. Legacy WebGPU task behavior remains available to WebGPU workers. No external models, arbitrary shaders or paid providers are admitted.

This is a compatibility foundation for small GPU arithmetic, not general AI-model inference, WebGPU emulation or same-model cross-device execution. Hardware attestation is not provided. WebGL2's reported duration includes draw/readback wall time; it is not GPU timestamp-query timing.

Pool view separately shows recorded nodes and currently online reported-GPU nodes, and lists the actual runtime. Offline nodes retain their registration; they do not fill the available-GPU water level. Browser node records are not guaranteed distinct physical devices.

Verification: 49/49 offline coordinator/policy/view/fallback tests pass, plus canvas smoke and frontend syntax checks. WebGL API stub tests validate data flow and reject incorrect pixels; they do not execute actual GPU shaders. iPhone X's actual WebGL2 calibration and remote task still need validation after the user reloads the Worker page in Safari and leaves it foreground. No real GPU result is fabricated or marked complete.

Sources: WebKit Safari 15 release notes https://webkit.org/blog/11989/new-webkit-features-in-safari-15/ and Khronos WebGL2 specification https://registry.khronos.org/webgl/specs/latest/2.0/ .

## Automatic pool entrance

The main aivault-compute-mesh.html entrance now registers the current browser device, detects WebGPU then WebGL2, calibrates actual GPU readback, and creates a tiny targeted remote proof automatically. It has a visible stop/resume control. Unsupported devices remain registered with the explicit GPU failure reason; they are not counted as currently contributing GPU capacity. Basic monitoring uses 30-second heartbeats and idle polling, while registration events refresh the aquarium immediately. Legacy engineering controls are collapsed.

Counters distinguish current connected device IDs, actively providing GPUs, idle GPUs and historical registration IDs. Pale water represents stored GPU reports; bright water represents active capacity. A stopped provider is removed from active water. IDs are stable within the browser origin and shared with the dedicated GPU Worker page. Different browser installations can still create different IDs for one physical device; physical-device uniqueness cannot be guaranteed by this web client. No device count is invented from the user's stated number of phones.

Updated verification: 53/53 offline tests passed, including three automatic entrance/unsupported-device/stop-flow tests. Actual GPU initialization in iPhone X/iPhone 17 and phone visual rendering remain pending until those devices reload the new main entrance. Pricing and reward settlement are not enabled; this entrance currently accepts only fixed small GPU verification tasks.

Pool participation unit: one online browser/device ID equals one pool node. All online devices swim, including GPU-unavailable phones. Water percentage counts participation, separately from active GPU count; minimum visible water height is 18% with any online member. No phone-to-5090 compute conversion is claimed before comparable hardware benchmarks.

## GPU-only visual tiers (supersedes all device/model-based fish tiers)
All form factors use one fixed benchmark: 4096 u32 elements, 16 mixing rounds, five GPU runs and median browser wall time. One PGU equals one million rounds per second. Boundaries: 1, 10, 100, 500, 1000 PGU for medium, large, shark, whale, giant whale. No usable rating means unrated fish, never disappearance. GPU model and Apple Pro/Max/Ultra no longer determine size. Pool snapshots derive ratings from completed assignment outputs, validate checksum/dimensions/timing samples, and discard ratings older than seven days. Client timing is not attested; PGU includes dispatch/readback overhead, is an estimate and is not used for billing.

## PGU water (supersedes device-participation water)
Default full water = 500 PGU. Sum valid rated GPU throughput for online enabled nodes that are available or RUNNING; exclude paused/stopped/offline/unrated nodes. Fish remain visible for all online devices. No minimum invented water height. Display raw percentage even above 100%, while canvas height caps at full water. A new local preference key prevents old device-count scales leaking into the PGU scale. The 500 PGU reference is independent of any card model score.

## Video ocean contract (supersedes PGU water and PGU fish size)
PGU is diagnostic only. Current backend returns UNVALIDATED video_capacity with null workload/throughput and closed external billing, and null node video_rating. All online nodes remain fish. No fixed 500 scale, no synthetic video capacity. Future water requires an authoritative validated whole-pool benchmark; standalone device results must never be summed as distributed inference capacity. The ocean display scale expands automatically. Video contribution tiers use the same workload and tentative VCU/h boundaries 1/10/100/1000/10000; no device/model-name inference.
