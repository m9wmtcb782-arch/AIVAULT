# Compute pool access policy and aquarium

The Owner's persistent rules are in AIVAULT-COMPUTE-POLICY.md.

The Coordinator gates both task creation and queued task dispatch. Model references must pass a protected server RPC. Approval requires a first_party allowlist record, explicit pool approval, passed inference testing, AVAILABLE registry status, and is_simulated=false. All existing five PLANNED models retain their original availability and are not approved by this migration. External models, providers, arbitrary artifacts and mismatched references are closed. Fixed arithmetic/WebGPU validation tasks remain allowed; no paid inference calls are made for verification.

The new read-only mesh.pool action returns sanitized node inventory from the existing registered-node and coordinator-node tables, preserving offline rows, hiding account IDs, and merging records only when their node IDs match. Browser nodes are not a count of unique physical devices. It reads up to the latest 1000 rows from each source and explicitly marks truncation. Registration remains uncapped.

Aquarium: U-shaped tank, seated fisherman, waves, six device fish species, offline catch animations with size-specific tools. Species derive only from reported hardware/platform; unknowns are not guessed as premium cards. Water uses online reported-GPU node count divided by a user-adjustable display reference (default 20). The reference is not a registration quota or measured TFLOPS capacity. Graphical fish size is symbolic, not a performance claim.

First snapshots do not catch offline inventory. Poll failures retain the last snapshot and do not create departure events. Missing data is shown as unknown; illustrative mode is opt-in and labeled separately. Rendering is capped at 20 FPS and stops when hidden or offscreen, with reduced-motion support. No GPU workloads run merely to show the scene.

Verification: 33/33 policy, classification, water and actual Coordinator-handler tests passed. Existing page and new script syntax checked. The real canvas module also passed an initialization/demo/catch/return-to-live runtime smoke test using a minimal DOM/canvas API stub; this is not visual rendering QA. Browser rendering QA was unavailable in this session; the canvas scene still needs visual confirmation on the user's phone. Live hardware authenticity, GPU inference and checkpoint continuation are not established by this dashboard.

Recovery: original Coordinator v16 source is saved in backups/compute-pool/coordinator-v16.ts. Preserve the private policy table and deny rules if rolling back the visualization; do not automatically reopen external model access. Original front page and assets are available through Git history.
