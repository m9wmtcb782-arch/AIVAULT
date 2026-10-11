# Tensor delivery and two endpoint conformance

Research branch only. No Supabase or production deployment.

## Implemented

- The existing channel sender now stamps unique message IDs and short expiries.
- The HTTPS receiver binds externally provisioned bearer credentials to the
  sender, receiver, job, operation, tensor ID, Float32 shape and contiguous layout.
- Incoming JSON has an encoded body limit; tensor bytes have a separate limit.
  SHA-256, canonical base64, descriptor size and expiry are checked before
  backend invocation. TLS must terminate directly on the receiver socket.
- A stage grant is consumed synchronously before invoking its backend.
  Concurrent delivery, a repeated message, or a fresh message for the same
  stage cannot execute the stage again. Backend failures require a new grant
  and explicit scheduler reconciliation, never an automatic retry.
- The tests route x to endpoint A, execute mul_scalar there, transfer h through
  actual HTTPS sockets to endpoint B, execute add_scalar there, and compare y
  against a single-node reference using the existing planner/backend contracts.

## Evidence boundary

CONFIRMED locally: 60 Node tests passed, including two TLS endpoints with
certificate and hostname verification, invalid token, wrong job/header,
corruption, expiry, duplicate delivery, concurrent requests and backend failure.
The measured diagnostic is whole-run loopback elapsed time, not WAN performance.

The two endpoints run CPU adapters in one test process on one host.
No physical-device GPU execution is claimed by these tests.

CI status must be checked against this exact commit in Actions; local test
results alone do not confirm CI.
REQUIRES TEST: two physical devices, native Metal integration with network
receipts, disconnect/reconnect, and a real model graph beyond scalar operations.
BLOCKED for physical validation in this environment: no two accessible physical
GPU workers or remotely provisioned TLS/credential sessions.

## Integration requirements

Mount createHttpsTensorReceiver on an HTTPS server. Provision a unique,
short-lived grant/token for every expected tensor edge/operation from the trusted
scheduler. Invoke the existing backend only in onTensor after receipt checks.
The sender adds context with job_id and operation_id matching that grant.

The receiver is a research component, not a public listening service. Provision
real certificates and credentials externally; test certificates/tokens are
ephemeral and test-only. Never bypass certificate or hostname checks.

Replay state is process-local. Restart MUST revoke old credentials and issue new
grants; do not reuse tokens after restart. No persistent replay ledger or grant
issuance is implemented. Capacity exhaustion rejects new stages; no replay entry
is evicted to make room. The HTTP server owner must configure body/request
timeouts. Initial scope is one-dimensional contiguous Float32 tensors.

Run: node --test tests/gpu-fabric-*.test.mjs (OpenSSL is required by TLS tests).
