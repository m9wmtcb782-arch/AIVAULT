// Run with Node 22+: node --experimental-strip-types tinyfish_node_test_runner.mjs
// Compatibility shim for existing Deno.test cases. No network permission is needed.
import { test } from "node:test";
globalThis.Deno = { test: (name, fn) => test(name, fn) };
await import("./tinyfish_search_adapter_test.ts");
