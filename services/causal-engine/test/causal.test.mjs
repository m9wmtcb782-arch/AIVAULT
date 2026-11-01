// LOCAL ONLY: mocked provider, no network, no DB, no secrets.
import { test } from "node:test"; import assert from "node:assert/strict"; import { readFileSync } from "node:fs";
import { classify, recordOutcome, guidance, guardedCall, MemoryStore } from "../../../supabase/functions/dark-star-ebook-ingest/causal-core.mjs";
import { LocalQuotaLedger } from "./quota-guard.copy.mjs";
const LAB = new URL("../../../supabase/functions/dark-star-ebook-ingest/lab.ts", import.meta.url);

test("classify", () => {
  assert.equal(classify(new Error("LLM_FAILED 429 groq:429:rate limit")), "rate_limit_429");
  assert.equal(classify("AbortError timeout"), "timeout");
  assert.equal(classify("groq:nojson"), "parse_error");
  assert.equal(classify("tests failed: assert.equal"), "quality_fail");
  assert.equal(classify("weird"), "other");
});
test("lesson redacts key-like strings", async () => {
  const s = new MemoryStore(); await recordOutcome(s, { task_type: "lab", input: "x", pass: false, error: "tests failed", detail: "gsk_ABCDEFGHIJ leaked" });
  assert.ok(!JSON.stringify(s.rows).includes("ABCDEFGHIJ"));
});
test("quota fail-closed: no guard / unknown total / pool half exhausted → no provider call", async () => {
  let calls = 0; const call = async () => { calls++; return { v: {} }; };
  await assert.rejects(guardedCall({ call, system: "", user: "", quota: null, g: null }), /QUOTA_DENIED/);
  await assert.rejects(guardedCall({ call, system: "", user: "", quota: new LocalQuotaLedger({ totals: {} }), g: null }), /QUOTA_SOURCE_UNKNOWN/);
  const q = new LocalQuotaLedger({ totals: { groq: 4 } }); // pool cap = 2
  await guardedCall({ call, system: "", user: "", quota: q, g: null }); await guardedCall({ call, system: "", user: "", quota: q, g: null });
  await assert.rejects(guardedCall({ call, system: "", user: "", quota: q, g: null }), /POOL_HALF_EXHAUSTED/);
  assert.equal(calls, 2);
});
test("flag-off hook: lab.ts delegates straight to original callModel", () => {
  const s = readFileSync(LAB, "utf8");
  assert.match(s, /const callModel = \(s: string, u: string, m\?: number\) => causalOn\(\) \? causalCallModel\(callModel0, s, u, m\) : callModel0\(s, u, m\);/);
  assert.match(s, /if \(causalOn\(\)\) await causalRecord/);
});

// ---- Replay of the recorded failure pattern (30 runs: 17 x 429, 3 passed, 10 quality fails) ----
function rng(seed) { return () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648); }
// Mock provider: first attempt of a run hits 429 per recorded pattern; a retry after backoff succeeds with p=0.6.
// Quality: base pass p=0.15 (≈3/13 non-429 runs observed); if prompt carries ≥1 matching lesson, p=0.35 (MODEL ASSUMPTION, not measured).
async function simulate(engineOn, seed = 7, lessonP = 0.35) {
  const r = rng(seed); const store = new MemoryStore(); const quota = new LocalQuotaLedger({ totals: { groq: 400 } }); let passed = 0, calls = 0;
  const pattern = Array.from({ length: 30 }, (_, i) => i % 30 < 17 ? (i * 7) % 30 < 17 : false); // deterministic 17/30 first-attempt 429
  const p429 = pattern.map((_, i) => ((i * 7) % 30) < 17);
  for (let run = 0; run < 30; run++) {
    let attempt = 0;
    const call = async (sys) => { calls++; attempt++; if (p429[run] && (attempt === 1 || r() > 0.6)) throw new Error("LLM_FAILED 429 groq:429"); return { v: { lessons: (sys.match(/避免重犯/g) || []).length } }; };
    try {
      let res;
      if (engineOn) { const g = await guidance(store, "lab"); res = await guardedCall({ call, system: "sys", user: "brief" + run, quota, g, sleep: async () => {} }); }
      else res = await call("sys");
      const ok = r() < (res.v.lessons > 0 ? lessonP : 0.15);
      if (ok) passed++;
      if (engineOn) await recordOutcome(store, { task_type: "lab", input: "brief" + run, pass: ok, error: "tests failed", detail: "assert failed on edge case #" + (run % 4) });
    } catch (e) { if (engineOn && !e.quotaDenied) await recordOutcome(store, { task_type: "lab", input: "brief" + run, pass: false, error: e }); }
  }
  return { passed, calls, quotaUsed: quota.used("groq").pool };
}
test("replay: engine ON yields more passed works than OFF, within 50% quota", async () => {
  const off = [], on = [];
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) { off.push(await simulate(false, seed)); on.push(await simulate(true, seed)); }
  const sum = (a, k) => a.reduce((x, y) => x + y[k], 0);
  console.log(`REPLAY 10 seeds x 30 runs: OFF passed=${sum(off, "passed")} ON passed=${sum(on, "passed")} ON calls=${sum(on, "calls")} OFF calls=${sum(off, "calls")} max pool quota used per seed=${Math.max(...on.map((x) => x.quotaUsed))}/200`);
  assert.ok(sum(on, "passed") > sum(off, "passed"));
  for (const x of on) assert.ok(x.quotaUsed <= 200);
});
test("replay, conservative: lessons give NO quality gain (429 handling only) → ON still >= OFF", async () => {
  let off = 0, on = 0; for (let s = 1; s <= 10; s++) { off += (await simulate(false, s)).passed; on += (await simulate(true, s, 0.15)).passed; }
  console.log(`REPLAY-CONSERVATIVE 10x30: OFF passed=${off} ON passed=${on}`); assert.ok(on > off);
});
