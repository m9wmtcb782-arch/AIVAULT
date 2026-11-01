import { test } from "node:test"; import assert from "node:assert/strict"; import { readFileSync } from "node:fs"; import vm from "node:vm";
const src = readFileSync(new URL("../sdk/neural-bus.js", import.meta.url), "utf8");
function env(on) { const listeners = []; const ctx = { window: {}, localStorage: { getItem: () => (on ? "1" : null) }, document: { currentScript: { getAttribute: () => "base1:x.html" }, referrer: "", addEventListener: (...a) => listeners.push(a) }, location: { pathname: "/x" }, navigator: {} };
  ctx.window.addEventListener = (...a) => listeners.push(a); ctx.window.localStorage = ctx.localStorage; vm.runInNewContext(src, ctx); return { ctx, listeners }; }
test("flag OFF: no listeners, no queue, no network", () => { const { ctx, listeners } = env(false); assert.equal(ctx.window.NeuralBus.on, false); assert.equal(listeners.length, 0); assert.equal(ctx.window.NeuralBus.queue, undefined); });
test("flag ON: page_view emitted locally, no endpoint → no network", () => { const { ctx, listeners } = env(true); assert.equal(ctx.window.NeuralBus.queue[0].kind, "page_view"); assert.ok(listeners.length >= 3); });
