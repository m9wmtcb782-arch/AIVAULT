# Signed native stage configuration v0.1

## Scope

The coordinator-side Node primitive signs a bounded configuration using P-256/SHA-256. Native CryptoKit verifies the signature over the protocol domain, pinned key ID and exact payload bytes before decoding model configuration. The native caller supplies its expected node ID and an independently pinned enrollment key. Package-provided keys are not trusted.

The verifier checks node, issue/expiry times, a maximum ten-minute lifetime, model graph dimensions and grant scopes. The signed package expiry must equal the incoming execution grant expiry. An atomic private directory claim with fsync prevents repeated import after restart; failure after reservation consumes the package. Import prepares a session, but still requires foreground native consent before listening.

## CONFIRMED: interoperability evidence

The macOS Actions step tests a Node signature against CryptoKit, payload/key/key-ID substitution, wrong node, future/expired dates, expiry mismatch, malformed graph/grant, oversized envelope, and repeated package import. The signing keys exist only in memory. Source commit 4d6147454447ff33bdb354ea9de187c75eef7873 passed iOS GPU Fabric Source Build run 38132217225, including signed configuration interoperability and one-shot import. The protocol run 38132217314 passed 79 tests. The foreground timer test waits for its real callback with a bounded two-second deadline rather than assuming a fixed 100 ms scheduling window. These results do not establish deployment or physical device verification.

Evidence: https://github.com/m9wmtcb782-arch/AIVAULT/actions/runs/38132217225 and https://github.com/m9wmtcb782-arch/AIVAULT/actions/runs/38132217314.

## BLOCKED / NOT VERIFIED: delivery and deployment

Signatures do not encrypt bearer grants. A deployed issuer needs private key storage, authenticated enrollment and encrypted delivery. The native App currently defaults to BLOCKED; trusted configuration and TLS identity must be supplied through native provisioning. No enrollment/download/import UX, Apple distribution signing or physical iPhone pair is established by this change.

The existing deploy-compute-coordinator.yml deploys aivault-compute-coordinator to project clcddygkaaqqtsbswgdf; it does not create an isolated Fabric environment. It is not invoked here. Formal deployment and paid provider calls are outside this stage.

A research environment can be made accessible after isolated hosting, trusted issuer/enrollment and Apple app distribution are available. Successful local TLS or CI Metal execution alone does not establish physical multi-device model execution. No reliable public-use date can be inferred from the current evidence.
