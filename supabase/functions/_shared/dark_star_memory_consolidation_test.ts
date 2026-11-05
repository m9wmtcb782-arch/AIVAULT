import { proposeConsolidation } from "./dark_star_memory_consolidation.ts";
function assert(ok: boolean, msg: string) { if (!ok) throw new Error(msg); }
Deno.test("consolidation excludes other owners and deleted memories", () => {
  const p = proposeConsolidation([
    { id: 1, ownerUid: "a", content: "first", importance: 9 },
    { id: 2, ownerUid: "a", content: "second", importance: 8 },
    { id: 3, ownerUid: "b", content: "secret", importance: 10 },
    { id: 4, ownerUid: "a", content: "deleted", importance: 10, deletedAt: "2026-10-25" },
  ], "a");
  assert(!!p && p.sourceIds.join(",") === "1,2", "scope");
  assert(!p!.draftSummary.includes("secret"), "no cross-owner disclosure");
  assert(p!.status === "needs_review" && p!.confidence === "unverified", "not fact");
});
Deno.test("insufficient evidence produces no proposal", () => {
  const p = proposeConsolidation([{ id: 1, ownerUid: "a", content: "only", importance: 9 }], "a");
  assert(p === null, "insufficient sources");
});
