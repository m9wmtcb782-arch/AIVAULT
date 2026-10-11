/** AIVAULT offline test harness for Node.js 22+.
 * Runs existing Deno.test() suites without installing Deno.
 * No paid providers, database, or network calls.
 * Invoke: node --experimental-transform-types run-offline-tests-node.mjs
 */
import { strict as assert } from "node:assert";
const tests = [];
globalThis.Deno = { test(name, fn) { tests.push({ name, fn }); } };
await import("./agent-runtime-v0.1.test.ts");
await import("./agent-runtime-v0.2.test.ts");
await import("./guarded-runtime-factory-v0.1.test.ts");
await import("./postgres-approval-store-v0.1.test.ts");
let failed = 0;
for (const { name, fn } of tests) {
  try {
    await fn();
    process.stdout.write("PASS " + name + "\n");
  } catch (error) {
    failed++;
    process.stderr.write("FAIL " + name + ": " + (error?.stack ?? String(error)) + "\n");
  }
}
assert(tests.length > 0, "No tests registered");
process.stdout.write("RESULT " + (tests.length - failed) + "/" + tests.length + " passed\n");
if (failed) process.exitCode = 1;
