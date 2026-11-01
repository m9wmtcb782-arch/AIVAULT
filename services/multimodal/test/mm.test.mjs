import { test } from "node:test"; import assert from "node:assert/strict";
import { REGISTRY, validate } from "../src/registry.mjs"; import { plan, route, run } from "../src/orchestrator.mjs";
test("registry contracts valid", () => { for (const c of REGISTRY) assert.deepEqual(validate(c), [], c.id); });
test("text routes to real local model first", () => assert.equal(route("text>text").model, "tiny-router-lora"));
test("paid models blocked without approval", () => assert.equal(route("text>music").status, "blocked"));
test("pipeline planned, not executed when flag off", async () => {
  const p = plan("script_music_video_short", { maxQuota: "paid_approval" }); assert.equal(p.steps.length, 4); assert.equal(p.executable, false);
  assert.equal((await run("script_music_video_short", { maxQuota: "paid_approval" })).ran, false);
});
