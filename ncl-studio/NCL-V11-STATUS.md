# NCL v1.1-alpha.1 — Trainable Multi-Head Attention

## Implemented
- Multi-head causal self-attention for [batch, sequence, dimension].
- Learned Q/K/V projection matrices and output projection matrix, including biases.
- Manual backward propagation through output projection, per-head causal attention, and Q/K/V projections.
- SGD-style parameter update with fixed/variable weight modes.
- Save/load with checksum validation.
- CPU JavaScript reference implementation.

## Verification
- Nine integration/acceptance tests are authored in `ncl-multihead-v11-tests.html`.
- Execution status is pending until the V8 harness is run.

## Limitations
- This module is not yet connected into TransformerCore v1.0's end-to-end backward/training pipeline.
- No Residual, LayerNorm, feed-forward/MLP block, dropout, KV cache, or Adam state serialization.
- CPU reference only; no Metal/GPU/iPhone performance claim.
