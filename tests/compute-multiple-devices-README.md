# Multiple devices per registered account

Scope: the authenticated `aivault-compute-mesh` route used by `compute-node.html`.
The separate `aivault-compute-coordinator` GPU test route is unchanged and is not covered by these authentication claims.

## Changes

- Remove the unique user_id index on aivault_compute_nodes; retain primary-key node UUID uniqueness, foreign key ownership, RLS and battery/contribution safeguards.
- Use verified Supabase Auth identity plus an explicit node_id for device lookup. Reject anonymous Auth accounts.
- Each device sends its persisted node UUID on registration, heartbeat, pause, resume, claim-task and submit-result.
- Registering a different UUID creates a separate node for the same account; re-registering one owned UUID updates it. Foreign-account UUID collisions return 409 and cannot overwrite ownership.
- Legacy callers without a node_id work only when their account has zero or one node. Multiple-node ambiguity fails closed and requests an explicit node_id.
- Node UI links to existing AIVAULT login/registration and reads the existing local Supabase session. No new key, auth provider or automatic compute-start behavior is added.
- Different registered accounts contribute to the common task pool; account ownership does not fence tasks into a private per-user queue. Expired assignments can be reclaimed by another account's node using the existing lease lifecycle. This test establishes restart/reassignment, not checkpoint continuation or live GPU failover.
- Device count has no quota. The mocked 120-device test is an example, not a limit. Browser installations are identified by persisted UUIDs, not physical hardware attestation.

## Validation

`node --test tests/compute-multiple-devices.test.mjs`: 16/16 passed, including cross-account expired-task reassignment without replacing either node and rejection of the old node's stale result.
Inline frontend JavaScript parsed successfully.
No paid AI providers called. No live GPU inference verified.

## Deployment/recovery

Before changing the database, deploy the updated mesh handler with its existing verify_jwt=true setting. Then apply the migration removing the single-user unique index. Publish the node frontend with the same registration contract. Preserve existing node IDs and task/result links.

Original live mesh version 10 source is saved at backups/compute-registration/mesh-v10.ts. Original frontend remains in main history. After multiple devices are registered, do NOT automatically restore the user_id unique index or delete duplicate-owner rows; that would discard legitimate devices. The old v10 handler assumes one device per user, so it cannot safely be restored for accounts with multiple devices. Retain the new owner-plus-node lookup if other changes must be reverted.

Live authenticated registration requires a real user's session and is pending until supplied by the user through the normal login UI. Offline tests are not proof of live GPU availability.
