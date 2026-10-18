# AIVAULT ANCN Worker Inference Adapter
Status: IMPLEMENTED (code written and pushed to construction branch).
Real EOT v1 ONNX load and inference: BLOCKED in this verification step.
Not merged to main. No formal deploy. No formal DB write.

## Files
- adapter.py : WorkerInferenceAdapter + isolation test harness

## Model reference
- EOT v1 int8 weights exist at models/eot/aivault-eot-v1-int8.onnx
- Blob SHA from prior fetch: 3ff2cff50e9ac183232d4567844e3fadb842f9a6
- Architecture: Mel + CNN + GRU + Linear, 58689 params (from metrics.json)
- Availability remains PLANNED

## Isolation test
Run: python adapter.py
Currently produces 5 FAILED records because real ONNX load is not executed here.
Do not claim MODEL_LOADED or VERIFIED_ISOLATED.

## Dependencies
Python 3 standard library only for this harness. Real ONNX would require onnxruntime.
