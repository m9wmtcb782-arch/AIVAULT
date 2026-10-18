# AIVAULT ANCN ANN Learning Prototype

Status: IMPLEMENTED (core pipeline complete on construction branch).
Formal training: BLOCKED (insufficient credible VERIFIED_REAL data with verifier evidence).
Not PRODUCTION_READY.

## Completed core
- model.py: small MLP (16 → 32 → 16 → 1)
- features.py: 16-dim feature contract
- memory_convert.py: verifier evidence + feature integrity + dedup + synthetic isolation
- train.py: offline synthetic pipeline only
- export_onnx.py: ONNX export contract
- infer.py: no untrained scoring; always FALLBACK_RULE unless ACCEPTED model
- baseline_compare.py: comparison contract
- version.py: SHA-256 integrity
- acceptance.py: ACCEPTED status + rollback
- dataset.py: train/val/test split
- test_isolated.py: unit checks

## Learning loop contract
Dark Star creates task → ANN evaluates (or FALLBACK) → Dark Star decides → ANCN executes → independent verify → common memory → ANN later learning → acceptance → update suggestion model.

## Blocked
Formal training and PRODUCTION_READY remain BLOCKED until credible VERIFIED_REAL samples exist.
