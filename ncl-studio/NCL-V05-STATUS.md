# NCL v0.5 Neural Core — 2026-11-27

## Scope
- Repository: m9wmtcb782-arch/AIVAULT (first base only)
- Branch: feat/ncl-v03-runtime-hardening-20261127
- No merge, production deployment, Supabase changes, secrets, paid APIs, or second-base access.

## Implemented in source
- Added `ncl-neural-v05.js`, a deterministic-seed Dense layer CPU reference implementation.
- Dense forward pass for batch × input matrices.
- Backpropagation for input gradients, weight gradients, and bias gradients.
- Mean-squared-error gradient helper.
- SGD parameter updates.
- Three explicit weight modes:
  - `fixed`: never updates parameters.
  - `variable`: applies SGD updates to all parameters.
  - `half-restore`: alternates between updating the first half of flattened parameters and restoring that half to its exact pre-update values on the next update call. This is an experimental reversible mode, not a standard optimizer.
- Added a browser test page with 12 acceptance cases, including a small linear-regression loss-decrease check.

## Status
- CONFIRMED: source and browser test page have been committed to the feature branch.
- REQUIRES TEST: run the browser page and confirm actual results; test code being present is not a passing test.
- NOT VERIFIED: numerical stability under large batches, performance, mobile memory/thermal behavior, and cross-framework parity.
- LIMITATION: JavaScript CPU reference only; not native NCL machine code, Metal/GPU acceleration, large-model training, or 70B execution.

## Important implementation notes
- Tensor inputs are copied into the layer cache; the layer maintains its own parameter arrays.
- The public weights accessor returns Tensor copies rather than mutable internal parameter storage.
- The half-restore mode is deliberately documented as a reversible experiment and must not be mistaken for a conventional training optimizer.

## Next engineering gates
1. Execute v0.3, v0.4, and v0.5 browser acceptance pages in desktop and iPhone Safari.
2. Add finite-difference gradient checking against analytical backpropagation.
3. Add model/weight serialization with versioning and checksum.
4. Define a stable NCL IR and connect NCL language syntax to the tensor/neural runtime.
5. Only after CPU correctness and benchmarks, evaluate a native Metal backend.
