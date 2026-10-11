# Native matrix operators v0.1

## Scope

Additive native methods on AIVAULTMetalCompute: executeMatmul(left:right:rows:inner:columns:transposeRight:) and executeRowSoftmax(input:rows:columns:). Existing scalar/Dense methods, native consent controls, WebBridge allowlist and production pages are unchanged.

Matrix storage is flattened row-major Float32. Ordinary multiplication takes A[M,K], B[K,N] and returns C[M,N]. transposeRight takes B stored as [N,K], allowing Q K^T without a CPU transposition. Row softmax subtracts each row's maximum before exponentiation and normalization. One GPU thread produces a matrix output element or a softmax row. Kernels are intentionally simple bounded conformance implementations, not optimized large-model kernels.

Dimensions are positive integers at most 4096. Matrix multiplication caps A+B+C at 1,048,576 Float32 elements; softmax caps input+output at that total. Shape, finite input and capacity checks occur before allocation/dispatch. Native host validation rejects non-finite results, including matmul accumulation overflow. Existing safe/precise Metal compiler math options apply to these kernels.

## Tests and evidence

Node CPU references use Float32 arithmetic. Hand-computed rectangular/transposed matrices and stable-softmax limits test their semantics. The macOS native harness tests twenty matrix/softmax cases against the references, including invalid dimensions/shapes and accumulation overflow. It separately tests NaN/Infinity inputs and an actual local GPU chain:

Q K^T -> scale by 1/sqrt(2) -> row softmax -> P V.

The attention fixture uses fixed 2x2 Q/K/V, has an independent analytic baseline, and does not insert CPU intermediates into its Metal chain. It has no causal mask, multi-head batching, training/backpropagation, tokenizer or installed generative-model weights.

CONFIRMED: source commit 884c06b5dfa4366ef03d5f3a4cc249c194ce1987 passed iOS build run 38133659890, including the new native matrix operators/attention chain, existing Metal/TLS stages, foreground lifecycle and signed configuration. Actual runner device was Apple Paravirtual device. Protocol run 38133659849 passed 85 Node tests. Node tests alone are CPU evidence.

Evidence: https://github.com/m9wmtcb782-arch/AIVAULT/actions/runs/38133659890 and https://github.com/m9wmtcb782-arch/AIVAULT/actions/runs/38133659849. This stage makes no API requests using keys and downloads no model weights.

## Remaining integration

These methods are native-local primitives. They are not advertised as supported operators by the existing Dense-only planned TLS stage, signing schema or WebBridge. Wiring into typed planned stages, signed graph/operator descriptors and cross-node tensor flow still requires implementation and tests. A full model's graph import and other operators (normalization, embeddings, convolution/decoder and model-specific attention) are not implemented here.

Physical iPhone installation and two physical-device execution remain NOT VERIFIED. The named image, video, music and 3D services remain PLANNED/BLOCKED. Local attention-kernel success cannot make any of those services AVAILABLE.
