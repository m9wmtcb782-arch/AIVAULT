// Offline source-contract tests. No API calls, no Supabase secrets, no paid quota.
import { strict as assert } from "node:assert";
import { validateFreeRequest } from "../_shared/openrouter_free_inference.ts";
import { createApprovedPublicTask } from "../_shared/aivault_public_task_allowlist.ts";

Deno.test("only explicitly free router is accepted", () => {
  assert.doesNotThrow(() => validateFreeRequest({ prompt: "OK", model: "openrouter/free" }));
  for (const model of ["openai/gpt-4o", "anthropic/claude", "openrouter/auto", "example:free"]) {
    assert.throws(() => validateFreeRequest({ prompt: "OK", model }), /FREE_MODEL_ONLY/);
  }
});

Deno.test("public task prompts are server-owned", () => {
  const a = createApprovedPublicTask("PUBLIC_CONNECTIVITY_CHECK");
  const b = createApprovedPublicTask("PUBLIC_GENERAL_KNOWLEDGE");
  assert.equal(a.egress.payload, a.prompt);
  assert.equal(b.egress.payload, b.prompt);
  assert.equal(a.egress.classification, "PUBLIC");
  assert.throws(() => createApprovedPublicTask("SECRET_DUMP" as never), /UNAPPROVED_PUBLIC_TASK/);
});

Deno.test("isolated entrypoint reads secrets and starts disabled", async () => {
  const source = await Deno.readTextFile(new URL("./index.ts", import.meta.url));
  assert.match(source, /Deno\.env\.get\("OPENROUTER_API_KEY"\)/);
  assert.match(source, /Deno\.env\.get\("AIVAULT_OPENROUTER_FREE_ENABLED"\) !== "true"/);
  assert.match(source, /Deno\.env\.get\("AIVAULT_OPENROUTER_INTERNAL_TOKEN"\)/);
  assert.match(source, /createApprovedPublicTask\(taskId/);
  assert.doesNotMatch(source, /["']sk-or-v1-[A-Za-z0-9_-]{10,}/);
});
