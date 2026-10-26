import { assessMemoryCapture } from "./dark_star_memory_capture.ts";
function assert(ok: boolean, why: string) { if (!ok) throw new Error(why); }
const base = {
  text: "今天我們決定暗星要有自己的長期記憶",
  source: "owner_message" as const,
  ownerOptIn: true,
  isOwnerVerified: true,
};
Deno.test("owner consent is mandatory", () => {
  assert(!assessMemoryCapture({ ...base, ownerOptIn: false }).accepted, "consent");
  assert(!assessMemoryCapture({ ...base, isOwnerVerified: false }).accepted, "identity");
});
Deno.test("model output cannot become autobiographical fact", () => {
  assert(!assessMemoryCapture({ ...base, source: "model_output" }).accepted, "source");
});
Deno.test("secrets are rejected", () => {
  assert(!assessMemoryCapture({ ...base, text: "api_key: abcdefghijklmnop" }).accepted, "secret");
});
Deno.test("self memory cannot be auto-created", () => {
  const r = assessMemoryCapture({ ...base, requestedTier: "self", importance: 100 });
  assert(r.accepted && r.tier === "episodic" && r.importance === 10 && r.reviewRequired, "review");
});
Deno.test("valid capture requires review before persistence", () => {
  const r = assessMemoryCapture(base);
  assert(r.accepted && r.reviewRequired, "review required");
});
