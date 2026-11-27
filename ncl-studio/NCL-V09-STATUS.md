# NCL v0.9 — Positional Encoding & Causal Self-Attention

## Implemented
- Sinusoidal positional encoding with identity gradient.
- Single-head scaled dot-product causal self-attention on [batch, sequence, dimension] Q/K/V tensors.
- Causal mask prevents position i from attending to positions after i.
- Manual backward gradients for query, key, and value.
- Bounds: sequence length 4096 and total attention cells 10,000,000.
- 11 browser acceptance cases (actual test page count).

## Limitations
- Single head only; no learned Q/K/V/O projection matrices.
- Not a complete Transformer block; no residual connection, layer normalization, MLP block, dropout, or KV cache.
- v1.0-alpha.1 now integrates Embedding → positional encoding → single-head causal attention for inference and Embedding-only training; it is not a full trainable Transformer.
- CPU JavaScript reference only; no native Metal/GPU backend.
- v0.9 test page contains 11 cases; V8 harness execution is tracked in the main verification report.
