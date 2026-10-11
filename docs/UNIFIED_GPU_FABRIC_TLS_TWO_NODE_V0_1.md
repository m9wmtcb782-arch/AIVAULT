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
- With createFileReplayLedger supplied as replayStore, a stage reservation is
  written and fsynced before backend invocation. Atomic directory creation
  prevents two receiver processes from claiming the same logical stage.
  Logical identity excludes the token and message ID, so rotation cannot bypass
  an existing reservation. Incomplete claims remain blocked.
- The tests route x to endpoint A, execute mul_scalar there, transfer h through
  actual HTTPS sockets to endpoint B, execute add_scalar there, and compare y
  against a single-node reference using the existing planner/backend contracts.

## Evidence boundary

CONFIRMED locally: 65 Node tests passed, including two TLS endpoints with
certificate and hostname verification, invalid token, wrong job/header,
corruption, expiry, duplicate delivery, concurrent requests and backend failure.
The measured diagnostic is whole-run loopback elapsed time, not WAN performance.

The original endpoint test runs CPU adapters in one process. The new
gpu-fabric-durable-two-process test forks two independent CPU worker processes
on one host and transfers the intermediate Float32 tensor over TLS. It verifies
the same planned graph against a Float32 reference with distinct worker PIDs.
It also kills/restarts a receiver and checks that a new token/message cannot
repeat a reserved stage. A crash immediately after reservation, two competing
receiver processes, incomplete claims, and storage failure are covered.
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

Without replayStore, replay state is process-local: restart MUST revoke old
credentials and issue new grants/tokens. For restart protection, supply
createFileReplayLedger({ directory: absolutePrivateDurablePath }) to replayStore.
This requires a trusted local filesystem supporting atomic mkdir and file/
directory fsync. A missing/unwritable ledger fails closed; never delete stage
directories to make retries succeed. Disk usage grows with reserved stages.
No grant issuance, ledger retention/garbage collection, storage rollback
protection or power-loss testing is implemented. Copying/rolling back or deleting
the ledger invalidates its replay guarantee. This is not a distributed database.

Reservations provide at-most-one backend invocation per logical stage while
the ledger remains intact. A crash leaves RESERVED_OUTCOME_UNKNOWN, not proof of
completion. Scheduler reconciliation is still required before a recovery attempt
with a new operation identity. The tests cover process crashes, not power cuts.

Capacity exhaustion rejects new stages; no replay entry is evicted to make room.
The HTTP server owner must configure body/request timeouts. Initial scope is
one-dimensional contiguous Float32 tensors and single-input scalar operators.

Run: node --test tests/gpu-fabric-*.test.mjs (OpenSSL is required by TLS tests).

## Native Metal and HTTPS integration

AIVAULTTensorHTTPSV01.swift adds the native transport envelope and an explicit
URLSession HTTPS client. It uses normal system TLS trust, rejects redirects,
checks outgoing peer IDs and expiries, and reads at most 8192 receipt bytes.
Receipt message/tensor IDs, hash, status and receiver must match the sent wire.
It is compiled into the research iOS target without changing the app/WebBridge
behavior. No worker is automatically started and no credentials are embedded.

The macOS CI adds two distinct checks:

- Native client request/receipt conformance through a URLProtocol mock:
  this is not evidence of real native HTTPS I/O.
- Two actual Metal CLI invocations with a native Swift transport envelope
  transferred over Node HTTPS loopback sockets, then decoded and executed by
  the second Metal invocation. The expected result is [5, 8, -1], with replay
  rejected by the durable receiver ledger. Both invocations use one host/GPU.

Native results require inspection of the exact commit's iOS build workflow.
REQUIRES TEST: native URLSession over real TLS, native inbound authenticated
transport, and two physical GPU devices. There is no native HTTPS listener or
automatic model scheduler integration yet.
