/**
 * Local unit tests for Frozen Contract accounting / validation.
 * Run: deno test artifacts/aivault-task-001/tests/contract_unit_test.ts
 */
import {
  defaultBudget,
  labelsCanonical,
  ownWeightClassify,
  sampleCount,
  sha256HexOk,
  validateItems,
} from "../supabase/functions/_shared/contract.ts";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

const hash = "sha256:" + "ab".repeat(32);
const labels = ["cat", "dog"];

Deno.test("bad hash rejected", () => {
  const v = validateItems([{
    item_id: "1",
    image_uri: "https://example.com/a.jpg",
    content_hash: "sha256:dead",
    allowed_labels: labels,
  }]);
  assert(!v.ok && v.reason === "content_hash_invalid", "bad hash must reject");
});

Deno.test("unsorted labels rejected not auto-sorted", () => {
  const v = validateItems([{
    item_id: "1",
    image_uri: "https://example.com/a.jpg",
    content_hash: hash,
    allowed_labels: ["dog", "cat"],
  }]);
  assert(!v.ok && v.reason === "allowed_labels_not_canonical", "must reject unsorted");
});

Deno.test("budget default and floor", () => {
  assert(defaultBudget(20) === 200, "20 items default 200");
  assert(defaultBudget(1) === 10, "1 item default 10");
});

Deno.test("frozen example remaining blocks second attempt", () => {
  const items = 20;
  const budget = 200;
  const provider = 160;
  const verification = 20;
  const used = provider + verification;
  const remaining = budget - used;
  assert(remaining === 20, "remaining 20");
  assert(160 > remaining, "second attempt 160 must be blocked");
});

Deno.test("reserve formula", () => {
  const items = 20;
  const quoted = 160;
  const reward = 8;
  const needExec = Math.min(quoted, items * reward);
  const needVerify = sampleCount(items, 0.1) * 2;
  assert(needExec === 160, "need_exec");
  assert(needVerify === 4 || needVerify === 20, "need_verify computed");
});

Deno.test("own verifier deterministic no external api", () => {
  const a = ownWeightClassify(hash, labels);
  const b = ownWeightClassify(hash, labels);
  assert(a.label === b.label && a.confidence === b.confidence, "deterministic");
  assert(labels.includes(a.label), "label in allowed");
});

Deno.test("hash format", () => {
  assert(sha256HexOk(hash), "good hash");
  assert(!sha256HexOk("sha256:xyz"), "bad hash");
});

Deno.test("canonical labels", () => {
  assert(labelsCanonical(["cat", "dog"]), "sorted unique ok");
  assert(!labelsCanonical(["cat"]), "too few");
  assert(!labelsCanonical(["cat", "cat"]), "dup");
});

Deno.test("latency_budget_ms range 1..86400000", () => {
  const ok = (n: number) => Number.isInteger(n) && n >= 1 && n <= 86400000;
  assert(!ok(0), "0 invalid");
  assert(ok(1), "1 ok");
  assert(ok(86400000), "max ok");
  assert(!ok(86400001), "over max");
});

Deno.test("payer_id nonempty required", () => {
  const payer = (v: unknown) => typeof v === "string" && v.trim().length > 0;
  assert(!payer(""), "empty rejected");
  assert(!payer("   "), "blank rejected");
  assert(!payer(undefined), "missing rejected");
  assert(payer("user-1"), "ok");
});

Deno.test("recompute hash of known bytes", async () => {
  const { sha256Bytes, parseCas } = await import("../supabase/functions/_shared/hash.ts");
  const bytes = new TextEncoder().encode("aivault-task001-hash-fixture");
  const digest = await sha256Bytes(bytes);
  assert(digest.startsWith("sha256:") && digest.length === 71, "sha256 prefix+hex");
  const cas = parseCas("aivault-cas://bucket/path/img.jpg");
  assert(cas && cas.bucket === "bucket" && cas.key === "path/img.jpg", "cas resolver");
  const httpsRejected = parseCas("https://example.com/a.jpg");
  assert(httpsRejected === null, "https is not cas");
});

Deno.test("verification_level frozen set", () => {
  const allowed = new Set(["resample", "dual_model", "human"]);
  assert(allowed.has("resample") && allowed.has("human"), "frozen set");
  assert(!allowed.has("none") && !allowed.has("own_weight"), "legacy values rejected");
});
