import { MEMORY_BUDGETS, selectMemories } from "./dark_star_memory_policy.ts";
function assert(ok: boolean, why: string) { if (!ok) throw new Error(why); }
Deno.test("memory tier budgets", () => {
  assert(MEMORY_BUDGETS.short === 1_000_000, "short-term target");
  assert(MEMORY_BUDGETS.long === 100_000_000, "long-term target");
});
Deno.test("recall respects character budget", () => {
  const now = Date.parse("2026-10-25T00:00:00Z");
  const data = [
    { id: 1, tier: "short" as const, content: "甲乙丙", importance: 9, confidence: 1, occurredAt: "2026-10-24T00:00:00Z" },
    { id: 2, tier: "short" as const, content: "丁戊己", importance: 8, confidence: 1, occurredAt: "2026-10-24T00:00:00Z" },
  ];
  const result = selectMemories(data, 3, now);
  assert(result.length === 1 && result[0].id === 1, "budget/ranking");
});
Deno.test("deleted and expired memories never recalled", () => {
  const now = Date.parse("2026-10-25T00:00:00Z");
  const base = { tier: "short" as const, content: "x", importance: 10, confidence: 1, occurredAt: "2026-10-24T00:00:00Z" };
  const result = selectMemories([
    { ...base, id: 1, deletedAt: "2026-10-24T00:00:00Z" },
    { ...base, id: 2, expiresAt: "2026-10-24T00:00:00Z" },
    { ...base, id: 3 },
  ], 100, now);
  assert(result.length === 1 && result[0].id === 3, "privacy exclusions");
});
