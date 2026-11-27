# NCL v0.4 Tensor Core — 2026-11-27

## Scope
- First base only: m9wmtcb782-arch/AIVAULT
- Branch: feat/ncl-v03-runtime-hardening-20261127
- No merge, production deployment, Supabase changes, secrets, paid APIs, or second-base access.

## Implemented in source
- Added `ncl-tensor-v04.js`, a deterministic JavaScript CPU reference tensor module.
- Supported shapes: rank 1–4; maximum 10,000,000 elements.
- Supported operations: zeros, ones, add, subtract, scalar scale, ReLU, 2D transpose, 2D matrix multiplication, vector/2D row-wise softmax, and mean squared error.
- Includes shape, data-length, finite-number, type, and matrix-dimension validation.
- Added `ncl-tensor-v04-tests.html` with 18 browser acceptance cases.

## Status
- CONFIRMED: both source and test page are committed to the feature branch.
- REQUIRES TEST: open the test page in a browser and confirm 18/18 actual passes. No runtime test execution is claimed in this handoff.
- CONFIRMED LIMITATION: this is a JavaScript CPU reference implementation, not native NCL machine code, Metal, GPU acceleration, or a trained neural network.
- NOT VERIFIED: performance, large tensor memory behavior, numerical parity with a production framework, and device thermal behavior.

## Next gates
1. Run v0.3 and v0.4 browser acceptance pages on desktop and iPhone Safari.
2. Add deterministic gradient tests and implement a minimal dense-layer forward/backward reference.
3. Add seeded initialization and a tiny end-to-end training example with loss-decrease comparison against a baseline.
4. Specify tensor layout, dtype policy, serialization, and a stable NCL IR.
5. Prototype Metal only after CPU correctness and benchmark baselines are recorded.
