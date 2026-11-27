# NCL v1.1-alpha.1 — Trainable Multi-Head Attention

## Implemented
- Multi-head causal self-attention for [batch, sequence, dimension].
- Learned Q/K/V projection matrices and output projection matrix, including biases.
- Manual backward propagation through output projection, per-head causal attention, and Q/K/V projections.
- SGD-style parameter update with fixed/variable weight modes.
- Save/load with checksum validation.
- CPU JavaScript reference implementation.

## Verification
- 10/10 tests executed in isolated V8 harness: PASS.
- Central finite-difference checks cover Q/K/V/O projection weights and input gradients.
- Maximum observed parameter-gradient absolute error: approximately 5.9e-11.
- Maximum observed input-gradient absolute error: approximately 4.5e-11.
- Harness uses a minimal DOM stub; this is not a real browser or iPhone test.

## Limitations
- This module is not yet connected into TransformerCore v1.0's end-to-end backward/training pipeline.
- No Residual, LayerNorm, feed-forward/MLP block, dropout, KV cache, or Adam state serialization.
- CPU reference only; no Metal/GPU/iPhone performance claim.
