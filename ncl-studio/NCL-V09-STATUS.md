# NCL v0.9 — Positional Encoding & Causal Self-Attention

## Implemented
- Sinusoidal positional encoding with identity gradient.
- Single-head scaled dot-product causal self-attention on [batch, sequence, dimension] Q/K/V tensors.
- Causal mask prevents position i from attending to positions after i.
- Manual backward gradients for query, key, and value.
- Bounds: sequence length 4096 and total attention cells 10,000,000.
- 10 browser acceptance cases.

## Limitations
- Single head only; no learned Q/K/V/O projection matrices.
- Not a complete Transformer block; no residual connection, layer normalization, MLP block, dropout, or KV cache.
- Attention is a standalone operation and is not yet integrated with Embedding/Sequential unified training and model serialization.
- CPU JavaScript reference only; no native Metal/GPU backend.
- Test page is authored; execution status pending.
