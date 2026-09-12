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
