# AIVAULT Native Metal Compute v0.1 — implementation note

## Status

- Source implementation: added; not compiled in this repository's current Linux CI.
- Real iPhone/iPad execution: **NOT VERIFIED**.
- Coordinator registration or remote dispatch: **NOT IMPLEMENTED**.
- Cross-device tensor transfer: **NOT IMPLEMENTED**.
- Dark Star integration: **NOT IMPLEMENTED**.
- No production deployment or paid API calls.

## Scope

`AIVAULTMetalCompute.swift` is an isolated iOS Metal compute helper. It compiles two embedded allowlisted kernels at runtime and executes Float32 vector operations:

- `mul_scalar`: output[i] = input[i] * scalar
- `add_scalar`: output[i] = input[i] + scalar

It validates finite input values, rejects empty/oversized vectors and unsupported operator names, allocates local Metal buffers, waits for command-buffer completion, checks completion status, and returns the output plus the reported Metal device name.

It does not accept arbitrary shader source from a caller, open a network connection, register a node, persist results, or contact the Compute Coordinator. It must only be called by an explicit host-app action; this file does not itself request or manage user consent.

## Required device validation

1. Add this source to an iOS Xcode target that links Metal.
2. Build on a supported physical iPhone/iPad (not GitHub's Linux runner).
3. Call `AIVAULTMetalCompute().execute(operation: "mul_scalar", input: [1, 2, -1], scalar: 3)`; verify output approximately equals `[3, 6, -3]`.
4. Call `add_scalar` on that result with scalar 2; verify `[5, 8, -1]`.
5. Compare against a CPU reference using a tolerance appropriate for Float32.
6. Test unsupported operator, empty input, non-finite input, and command-buffer errors.
7. Record device model, iOS version, Metal device name, test input/output hashes, elapsed time, and failure logs. Do not label the node as executing GPU work until this evidence is captured.

This is a local single-device kernel, not yet the multi-node fabric. The next integration must connect the typed tensor transfer contract to authenticated, encrypted transport and then coordinate per-operation execution with independently verified results.
