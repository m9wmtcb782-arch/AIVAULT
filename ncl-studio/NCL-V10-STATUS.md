# NCL v1.0-alpha.1 — Integrated Transformer Core

## Implemented
- Integrated token ID Tensor input → Embedding → sinusoidal positional encoding → single-head causal self-attention.
- Supports batch and sequence dimensions.
- Backward path combines Q/K/V gradients and propagates into Embedding.
- Embedding weights can be updated; fixed mode is respected.
- Save/load with checksum validation and deterministic inference round-trip.
- CPU JavaScript reference implementation.

## Verification
- 10 integration tests are provided in `ncl-transformer-v10-tests.html`.
- Test execution status must be reported only after running the test harness.
- This is an integration prototype, not a completed Transformer or LLM.

## Explicit limitations
- Single-head attention only.
- No learned Q/K/V/O projection matrices.
- No residual connections, LayerNorm, feed-forward/MLP block, dropout, or KV cache.
- Only Embedding weights are trainable in this alpha; attention has no learned projections.
- Character tokenizer remains the v0.8 tokenizer; no BPE/SentencePiece.
- CPU reference only; no Apple Metal, native iPhone acceleration, or large-model performance claims.
