# AIVAULT ANCN ANN Learning Prototype

Status: IMPLEMENTED (code complete on construction branch).
Training: SYNTHETIC ONLY. No real verified data available.
Must not claim formal ANN capability.

## Files
- model.py: small MLP (input 16, ~1-2k params)
- features.py: feature contract
- memory_convert.py: only VERIFIED_REAL records
- train.py: offline synthetic pipeline
- export_onnx.py: ONNX export
- infer.py: suggestion interface for Dark Star (fallback if insufficient)
- baseline_compare.py: comparison contract

## Data flow
Dark Star creates task → ANN scores candidates → Dark Star decides → ANCN executes → independent verify → common memory → ANN later learning.

## Current limitation
Live verified task results are insufficient. Formal training remains blocked until VERIFIED_REAL samples exist.
