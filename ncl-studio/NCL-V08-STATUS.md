# NCL v0.8 — Character Tokenizer & Embedding

## Implemented
- Character-level tokenizer built from supplied text corpus, deterministic vocabulary ordering by first appearance, unknown-token ID 0, encode/decode, versioned save/load.
- Trainable embedding lookup for [batch, sequence] integer token IDs; output [batch, sequence, dimension].
- Backpropagation accumulates gradients for repeated token IDs; SGD update and fixed mode.
- Embedding save/load with FNV-1a corruption checksum.
- 12 browser acceptance cases.

## Verification
- CONFIRMED: source, test page and status document committed to the first-base feature branch.
- REQUIRES TEST: browser test suite has not been run.
- NOT VERIFIED: tokenizer quality, Unicode normalization, large corpus performance, Safari memory, Metal/GPU.

## Limitations
- This is a character tokenizer, not BPE, WordPiece, or SentencePiece.
- Embedding is not yet integrated into Sequential v0.7 serialization/training orchestration.
- No positional encoding, attention, transformer block, dataset loader, or native GPU backend.
- CPU JavaScript reference only; not evidence of large-model capability.
