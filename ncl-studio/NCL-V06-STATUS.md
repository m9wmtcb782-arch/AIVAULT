# NCL v0.6 — Multi-layer Model, Gradient Check & Serialization

## Scope
- First-base AIVAULT repository only.
- Branch: feat/ncl-v03-runtime-hardening-20261127
- No Supabase, secrets, paid API, second base, merge, or production deployment.

## Implemented
- `ncl-model-v06.js`: Sequential Dense stack with dimension validation, forward propagation, reverse-order backpropagation, and per-layer optimizer updates.
- Numerical gradient checker compares analytical Dense gradients with central finite differences.
- Versioned JSON model format `NCL-MODEL/1`.
- FNV-1a checksum detects accidental/corrupt payload changes (not cryptographic authentication).
- Loader validates format, layer count, dimensions, finite weights, and checksum.
- Browser acceptance page with 10 test cases.

## Verification
- CONFIRMED: source and tests are committed.
- REQUIRES TEST: browser acceptance page has not been executed in this delivery.
- NOT VERIFIED: iPhone Safari behavior, large model performance, long-run training, adversarial file security.
- LIMITATION: CPU JavaScript reference; Dense-only stack without activation functions, convolution, attention, optimizer state, or native Metal.

## Important semantics
- Sequential currently composes Dense layers only; no nonlinear activation is inserted automatically.
- Gradient checker uses a scalar dot-product objective against supplied upstream gradient.
- Checksum is for integrity/error detection, not security signatures.
