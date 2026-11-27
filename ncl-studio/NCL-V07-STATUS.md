# NCL v0.7 — Activation Layers & Adam Optimizer

## Scope
- First-base AIVAULT only.
- Branch: feat/ncl-v03-runtime-hardening-20261127.
- No Supabase, secrets, paid API, second base, merge, or production deployment.

## Implemented
- Activation layers: ReLU, numerically stable Sigmoid, and Tanh, with backward gradients.
- Dense + Activation sequential composition and dimension/type validation.
- Adam optimizer with per-layer first/second moments, bias correction, and finite-value checks.
- Adam supports Dense layers in variable/fixed weight modes. It explicitly rejects half-restore because that reversible experimental mode conflicts with Adam's persistent optimizer state.
- Versioned NCL-MODEL/2 serialization stores Dense and Activation layers and validates checksum and parameters.
- Browser acceptance page with 12 cases, including XOR loss-decrease experiment.

## Verification
- CONFIRMED: source and test files committed to the feature branch.
- REQUIRES TEST: all v0.7 browser tests are authored but have not been executed in a real browser.
- NOT VERIFIED: XOR convergence on Safari/iPhone, runtime performance, GPU acceleration, native Metal, large-model scaling.
- LIMITATION: CPU JavaScript reference only. No attention, embedding, tokenizer, autodiff graph, dataset pipeline, or native GPU backend yet.

## Semantics
- Adam moments live in memory and are not included in model save files. Saving a model preserves weights and layer structure, not optimizer training state.
- FNV-1a checksum remains corruption detection, not cryptographic authentication.
- XOR is a small acceptance experiment, not evidence of general reasoning ability.
