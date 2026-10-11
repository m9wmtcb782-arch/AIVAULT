# AIVAULT Float32 Tensor Envelope v0.1 (Swift)

## Status

- Swift source added: **CONFIRMED** in the research branch.
- Swift compilation / XCTest: **NOT VERIFIED**; this repository path has not been shown to belong to an Xcode target.
- Physical iPhone/iPad serialization test: **NOT VERIFIED**.
- Network transfer, peer authentication, encryption, remote dispatch: **NOT IMPLEMENTED**.
- Dark Star integration: **NOT IMPLEMENTED**.
- Production deployment: **NOT PERFORMED**.

## Purpose

`AIVAULTFloat32TensorV01.swift` bridges a local Swift Float32 vector to the descriptor fields used by the JavaScript tensor-transfer helper:

- protocol version: `aivault.gpu-fabric-tensor/0.1`
- tensor ID, sender node ID, receiver node ID
- dtype `float32`, one-dimensional shape, contiguous layout
- byte length and SHA-256 over payload bytes
- base64 payload for JSON-safe transport representation

Payload bytes are encoded explicitly in little-endian Float32 order. The receiver validates the expected receiver ID, descriptor shape/length, maximum size, finite values, and SHA-256 before returning values.

## Important wire-format note

The JavaScript helper holds its local payload as a `Uint8Array`; JSON does not serialize that type as a portable raw-byte field. The Swift type therefore uses `payload_base64` as the JSON transport representation. A future authenticated transport adapter must explicitly decode that base64 string into bytes and map it to the JavaScript helper's local `payload` field. Do not assume the two in-memory object shapes are interchangeable without this mapping.

## Manual acceptance test

When an Xcode target is available:

1. Add this file to the same iOS target as `AIVAULTMetalCompute.swift` and link CryptoKit (available on supported Apple OS SDKs).
2. Execute Metal `mul_scalar` on `[1, 2, -1]` with scalar `3`; expected local result is approximately `[3, 6, -3]`.
3. Build a tensor envelope with distinct sender/receiver IDs from that result.
4. Decode it with the intended receiver ID and confirm values match.
5. Change one base64 payload byte without updating the hash; validation must reject it.
6. Try a wrong receiver ID, same sender/receiver IDs, empty vector, NaN/infinity, invalid shape, and an over-limit payload; each must be rejected.
7. Compare the Swift SHA-256 of the raw payload bytes with an independent implementation and record device model, OS version, payload hash, and test output.

Passing this manual test would establish local serialization/integrity only. It would not establish peer identity, confidentiality, physical network transfer, or multi-device GPU execution.
