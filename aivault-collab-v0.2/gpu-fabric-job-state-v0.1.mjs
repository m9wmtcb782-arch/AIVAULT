/**
 * AIVAULT GPU Fabric job state machine v0.1.
 * Pure validation logic only; it does not persist state, authenticate workers,
 * schedule nodes, or independently attest hardware execution.
 */
const STATES = new Set(["CREATED", "PREPARING", "READY", "RUNNING", "VERIFYING", "COMPLETED", "FAILED", "CANCELLED"]);
const TERMINAL = new Set(["COMPLETED", "FAILED", "CANCELLED"]);
const NEXT = {
  CREATED: new Set(["PREPARING", "FAILED", "CANCELLED"]),
  PREPARING: new Set(["READY", "FAILED", "CANCELLED"]),
  READY: new Set(["RUNNING", "FAILED", "CANCELLED"]),
  RUNNING: new Set(["VERIFYING", "FAILED", "CANCELLED"]),
  VERIFYING: new Set(["COMPLETED", "FAILED", "CANCELLED"]),
  COMPLETED: new Set(), FAILED: new Set(), CANCELLED: new Set(),
};
const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/;

function requireId(value, name) {
  if (typeof value !== "string" || !ID.test(value)) throw new Error("invalid " + name);
}

export function createFabricJob({ job_id, model_manifest_sha256, required_output_tensor_ids, now = new Date().toISOString() }) {
  requireId(job_id, "job_id");
  if (typeof model_manifest_sha256 !== "string" || !/^[a-f0-9]{64}$/i.test(model_manifest_sha256)) {
    throw new Error("model_manifest_sha256 must be a SHA-256 hex digest");
  }
  if (!Array.isArray(required_output_tensor_ids) || required_output_tensor_ids.length === 0) {
    throw new Error("required_output_tensor_ids must be non-empty");
  }
  const ids = new Set();
  for (const id of required_output_tensor_ids) {
    requireId(id, "required output tensor ID");
    if (ids.has(id)) throw new Error("duplicate required output tensor ID: " + id);
    ids.add(id);
  }
  if (!Number.isFinite(Date.parse(now))) throw new Error("invalid timestamp");
  return {
    job_id, model_manifest_sha256: model_manifest_sha256.toLowerCase(),
    required_output_tensor_ids: [...required_output_tensor_ids],
    status: "CREATED", revision: 0, created_at: new Date(now).toISOString(),
    updated_at: new Date(now).toISOString(), events: [],
  };
}

export function transitionFabricJob(job, { next_status, event_id, attempt_id, evidence, now = new Date().toISOString() }) {
  if (!job || typeof job !== "object" || !STATES.has(job.status)) throw new Error("invalid job state");
  requireId(job.job_id, "job_id");
  requireId(event_id, "event_id");
  if (!STATES.has(next_status)) throw new Error("unknown next_status");
  if (!Number.isFinite(Date.parse(now))) throw new Error("invalid timestamp");
  if (job.events.some((event) => event.event_id === event_id)) {
    return { ...job, duplicate_event_ignored: true };
  }
  if (TERMINAL.has(job.status)) throw new Error("terminal job state cannot transition");
  if (!NEXT[job.status].has(next_status)) throw new Error("illegal job transition: " + job.status + " -> " + next_status);
  if (Date.parse(now) < Date.parse(job.updated_at)) throw new Error("event timestamp precedes last job update");

  if (next_status === "RUNNING") requireId(attempt_id, "attempt_id");
  if (next_status === "COMPLETED") {
    if (!evidence || evidence.independently_verified !== true) {
      throw new Error("completion requires independent verification evidence");
    }
    if (evidence.model_manifest_sha256 !== job.model_manifest_sha256) {
      throw new Error("verified model manifest hash mismatch");
    }
    if (!Array.isArray(evidence.output_tensors)) throw new Error("verified output_tensors are required");
    const outputs = new Map();
    for (const output of evidence.output_tensors) {
      if (!output || typeof output !== "object") throw new Error("invalid output tensor evidence");
      requireId(output.tensor_id, "output tensor ID");
      if (typeof output.sha256 !== "string" || !/^[a-f0-9]{64}$/i.test(output.sha256)) {
        throw new Error("output tensor SHA-256 is required");
      }
      if (outputs.has(output.tensor_id)) throw new Error("duplicate output tensor evidence");
      outputs.set(output.tensor_id, output.sha256.toLowerCase());
    }
    for (const id of job.required_output_tensor_ids) {
      if (!outputs.has(id)) throw new Error("required output tensor missing: " + id);
    }
  }

  const timestamp = new Date(now).toISOString();
  const event = {
    event_id, from_status: job.status, to_status: next_status,
    timestamp, attempt_id: attempt_id ?? null,
    evidence_digest: evidence?.evidence_digest ?? null,
  };
  return {
    ...job, status: next_status, revision: job.revision + 1,
    updated_at: timestamp, events: [...job.events, event],
    duplicate_event_ignored: false,
  };
}
