# AIVAULT ANCN ANN Learning Prototype

Status: IMPLEMENTED (core safety fixes applied).
Training: SYNTHETIC ONLY. Formal training BLOCKED (insufficient credible verified data).
Must not claim PRODUCTION_READY.

## Safety fixes (this commit series)
- infer.py: no model file or non-ACCEPTED status → always FALLBACK_RULE. Never score with random weights.
- memory_convert.py: requires verifier_id + evidence_reference + valid 16-dim features + explicit success label. Deduplicates. Isolates synthetic. Missing evidence → BLOCKED.
- Acceptance / rollback contract: only ACCEPTED model may give formal suggestions. Previous accepted version kept on failure.

## Files
- model.py: small MLP (input 16, ~1-2k params)
- features.py: feature contract
- memory_convert.py: credible verification gate
- train.py: offline synthetic pipeline only
- export_onnx.py: ONNX export
- infer.py: suggestion interface (Dark Star decides)
- baseline_compare.py: comparison contract

## Data flow
Dark Star creates task → ANN evaluates (or FALLBACK) → Dark Star decides → ANCN executes → independent verify → common memory → ANN later learning.

## Current limitation
Credible VERIFIED_REAL samples with verifier evidence are insufficient. Formal training and PRODUCTION_READY remain BLOCKED.
