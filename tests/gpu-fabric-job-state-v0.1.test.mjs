import test from "node:test";
import assert from "node:assert/strict";
import { createFabricJob, transitionFabricJob } from "../aivault-collab-v0.2/gpu-fabric-job-state-v0.1.mjs";

const HASH = "a".repeat(64);
const OUT_HASH = "b".repeat(64);
function job() {
  return createFabricJob({ job_id: "job-1", model_manifest_sha256: HASH, required_output_tensor_ids: ["out-1"], now: "2026-10-11T00:00:00.000Z" });
}
function step(j, next_status, event_id, extra = {}) {
  return transitionFabricJob(j, { next_status, event_id, now: new Date(Date.parse(j.updated_at) + 1000).toISOString(), ...extra });
}
function runningJob() {
  let j = step(job(), "PREPARING", "e1");
  j = step(j, "READY", "e2");
  return step(j, "RUNNING", "e3", { attempt_id: "attempt-1" });
}

test("enforces legal transitions and monotonic revisions", () => {
  const j1 = step(job(), "PREPARING", "e1");
  assert.equal(j1.status, "PREPARING");
  assert.equal(j1.revision, 1);
  assert.throws(() => step(j1, "COMPLETED", "bad"), /illegal job transition/);
});

test("requires independent evidence, matching manifest, and all required outputs before completion", () => {
  let j = step(runningJob(), "VERIFYING", "e4");
  assert.throws(() => step(j, "COMPLETED", "e5"), /independent verification/);
  assert.throws(() => step(j, "COMPLETED", "e6", { evidence: { independently_verified: true, model_manifest_sha256: HASH, output_tensors: [] } }), /required output tensor missing/);
  assert.throws(() => step(j, "COMPLETED", "e7", { evidence: { independently_verified: true, model_manifest_sha256: "c".repeat(64), output_tensors: [{ tensor_id: "out-1", sha256: OUT_HASH }] } }), /manifest hash mismatch/);
  j = step(j, "COMPLETED", "e8", { evidence: { independently_verified: true, model_manifest_sha256: HASH, output_tensors: [{ tensor_id: "out-1", sha256: OUT_HASH }], evidence_digest: "verify-1" } });
  assert.equal(j.status, "COMPLETED");
});

test("deduplicates event IDs and blocks changes after terminal states", () => {
  const j = step(job(), "PREPARING", "e1");
  const duplicate = step(j, "READY", "e1");
  assert.equal(duplicate.duplicate_event_ignored, true);
  let k = step(j, "FAILED", "e2");
  assert.throws(() => step(k, "PREPARING", "e3"), /terminal job state/);
});

test("rejects duplicate required outputs and invalid manifest digest", () => {
  assert.throws(() => createFabricJob({ job_id: "job-2", model_manifest_sha256: "bad", required_output_tensor_ids: ["out"] }), /SHA-256/);
  assert.throws(() => createFabricJob({ job_id: "job-2", model_manifest_sha256: HASH, required_output_tensor_ids: ["out", "out"] }), /duplicate/);
});
