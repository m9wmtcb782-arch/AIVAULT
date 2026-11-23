// t295–t297：程式端把關——作者不得書評；大模型書評員永不使用小模型（不可用就跳過）；小模型書評員走 Space；引用必須出自原文；留言只讀 7 天內。
Deno.env.set("SUPABASE_URL", "http://db.test"); Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-sr"); Deno.env.set("DARKSTAR_POOL_KEY", "test-pool-key"); Deno.env.set("DARKSTAR_SPACE_URL", "http://space.test");
const BOOK = "11111111-1111-4111-8111-111111111111";
const CH_TEXT = "港口起霧的那天，林遙收到一封沒有署名的信。\n信裡只有一句話：燈塔今晚不會亮。\n她握著信走到碼頭，看見老船長正在收網。";
let ROSTER: any[] = []; let chapterAuthors = new Set<string>(); const spaceCalls: any[] = []; const inserted: any[] = []; const urls: string[] = [];
const ROLES = Array.from({ length: 100 }, (_, i) => ({ agent_id: "ag-" + String(i + 1).padStart(5, "0") }));
globalThis.fetch = (async (input: any, init: any = {}) => {
  const u = decodeURIComponent(String(input)); urls.push(u); const json = (b: unknown) => new Response(JSON.stringify(b), { status: 200, headers: { "content-type": "application/json" } });
  if (u.startsWith("http://space.test/task")) { const b = JSON.parse(init.body); spaceCalls.push(b);
    if (b.task === "chunk_digest") return json({ ok: true, route: "local", output: "林遙收到匿名信。", model_key: "darkstar-qwen3-1.7b", version: "0.3.0" });
    return json({ ok: true, route: "local", output: ["開場的霧與匿名信把懸念鋪得很穩，讓人想追下去。", "燈塔不亮這句話很短卻讓整章都緊張起來。", "林遙走向碼頭那段節奏乾淨，畫面感十足。"][spaceCalls.length % 3], quote: "燈塔今晚不會亮", model_key: "darkstar-qwen3-1.7b", version: "0.3.0" }); }
  if (u.includes("aivault_floor_state?k=eq.novel_reviews")) return json([{ v: { enabled: true, per_run: 6, daily_batch: 120, full_text_max_chars: 2400, chunk_chars: 1200 } }]);
  if (u.includes("aivault_floor_state")) return json([{ k: "pool_smallmodel", v: { enabled: true } }]);
  if (u.includes("aivault_pool_agent_roles")) return json(ROLES);
  if (u.includes("rpc/aivault_pool_usage_bump")) return json(null);
  if (u.includes("aivault_novel_reviewers")) return json(ROSTER);
  if (u.includes("aivault_novel_books?outline_agent")) return json([]);
  if (u.includes("aivault_novel_books")) return json([{ id: BOOK, title: "霧港來信" }]);
  if (u.includes("aivault_novel_chapters?agent_id=eq.")) { const a = u.match(/agent_id=eq\.([^&]+)/)![1]; return json(chapterAuthors.has(a) ? [{ ch: 1 }] : []); }
  if (u.includes("aivault_novel_chapters") && u.includes("select=text")) return json([{ text: CH_TEXT }]);
  if (u.includes("aivault_novel_chapters")) return json([{ book_id: BOOK, ch: 1, chars: CH_TEXT.length }]);
  if (u.includes("aivault_novel_comments")) return json([]);
  if (u.includes("aivault_bot_posts") && init.method === "POST") { inserted.push(JSON.parse(init.body)); return new Response("", { status: 201 }); }
  if (u.includes("aivault_bot_posts")) return json([]);
  return json([]);
}) as typeof fetch;
const nr = await import("../../supabase/functions/dark-star-ebook-ingest/novelreviews.ts");
const assert = (c: unknown, m: string) => { if (!c) throw new Error(m); };
const reset = () => { spaceCalls.length = 0; inserted.length = 0; };
Deno.test("authors (top-100 writers / chapter authors) are refused even if they appear in the roster", async () => {
  reset(); ROSTER = [{ agent_id: "ag-00001", rank: 1, model_tier: "small" }, { agent_id: "ag-00500", rank: 2, model_tier: "small" }]; chapterAuthors = new Set(["ag-00500"]);
  const r: any = await nr.dispatchReviews(2, false);
  assert(r.results.every((x: any) => !x.ok && x.error === "author_cannot_review"), JSON.stringify(r.results));
  assert(spaceCalls.length === 0 && inserted.length === 0, "no Space call, nothing inserted");
});
Deno.test("large-model reviewers never use the Space; unavailable large model → skipped", async () => {
  reset(); chapterAuthors = new Set(); ROSTER = Array.from({ length: 4 }, (_, i) => ({ agent_id: "ag-0" + (2000 + i), rank: i + 1, model_tier: "large" }));
  const r: any = await nr.dispatchReviews(4, false, async () => null);
  assert(r.results.length === 4 && r.results.every((x: any) => x.tier === "large" && x.error === "large_model_unavailable_skipped"), JSON.stringify(r.results));
  assert(spaceCalls.length === 0, "Space never called for large tier");
  reset(); const r2: any = await nr.dispatchReviews(4, false, async () => ({ review: "老船長收網的細節很有生活感。", quote: "老船長正在收網", model: "groq:test" }));
  assert(r2.results.every((x: any) => x.ok && x.tier === "large") && spaceCalls.length === 0 && inserted.every((p) => p.model === "groq:test" && p.target === "novel"), "large path used");
});
Deno.test("small-model reviewers use the Space; each gets its own assignment; quote checked against the chapter", async () => {
  reset(); ROSTER = Array.from({ length: 3 }, (_, i) => ({ agent_id: "ag-0" + (3000 + i), rank: i + 1, model_tier: "small" }));
  const r: any = await nr.dispatchReviews(3, false);
  assert(r.results.every((x: any) => x.ok && x.tier === "small"), JSON.stringify(r.results));
  assert(spaceCalls.filter((c) => c.task === "review_sentence").length === 3, "3 review calls");
  assert(new Set(spaceCalls.map((c) => c.agent_id)).size === 3, "one call per agent");
  assert(inserted.length === 3 && inserted.every((p) => p.status === "pending" && p.ref.quote === "燈塔今晚不會亮" && p.ref.book_id === BOOK && p.ref.ch === 1), "pending, cites chapter + quote");
});
Deno.test("checkReview flags invented quotes and missing quotes", () => {
  assert(nr.checkReview("懸念鋪得很穩。", "燈塔今晚不會亮", CH_TEXT, []).ok, "real quote ok");
  assert(nr.checkReview("懸念鋪得很穩。", "月亮掉進海裡了", CH_TEXT, []).issues.includes("quote_not_in_text"), "fake quote");
  assert(nr.checkReview("懸念鋪得很穩。", "", CH_TEXT, []).issues.includes("no_quote"), "no quote");
  assert(nr.checkReview("懸念鋪得很穩。", "燈塔今晚不會亮", CH_TEXT, ["懸念鋪得很穩"]).issues.includes("duplicate"), "duplicate review blocked");
});
Deno.test("chunkText splits long chapters on paragraph boundaries", () => {
  const long = Array.from({ length: 12 }, (_, i) => `第${i}段：` + "霧".repeat(300)).join("\n");
  const cks = nr.chunkText(long, 1200); assert(cks.length >= 3 && cks.every((c) => c.length <= 1800) && cks.join("\n") === long, "chunks " + cks.map((c) => c.length));
});
Deno.test("public comment list only asks for the last 7 days", async () => {
  urls.length = 0; await nr.listComments(BOOK, 1);
  const u = urls.find((x) => x.includes("aivault_novel_comments"))!; const since = new Date(u.match(/created_at=gt\.([^&]+)/)![1]).getTime();
  assert(Math.abs(Date.now() - 7 * 86400e3 - since) < 60000, "7-day filter"); assert(u.includes("status=eq.approved"), "approved only");
});
