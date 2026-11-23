// t286：前 100 位（大模型組）永不使用小模型；暗星不使用小模型；名單讀不到時 fail-closed；留言逐一指派。
Deno.env.set("SUPABASE_URL", "http://db.test"); Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-sr"); Deno.env.set("DARKSTAR_POOL_KEY", "test-pool-key"); Deno.env.set("DARKSTAR_SPACE_URL", "http://space.test");
const spaceCalls: any[] = []; const inserted: any[] = []; let rolesFail = false;
const AGENTS = Array.from({ length: 150 }, (_, i) => ({ id: "ag-" + String(i + 1).padStart(5, "0"), name: "代理" + (i + 1), specialty: ["資安", "行銷", "天文"][i % 3], zone: "z" + (i % 10) }));
const ROLES = AGENTS.slice(0, 100).map((a) => ({ agent_id: a.id }));
globalThis.fetch = (async (input: any, init: any = {}) => {
  const u = String(input); const json = (b: unknown, h: Record<string, string> = {}) => new Response(JSON.stringify(b), { status: 200, headers: { "content-type": "application/json", ...h } });
  if (u.startsWith("http://space.test/task")) { const b = JSON.parse(init.body); spaceCalls.push(b); return json({ ok: true, route: "local", output: "小模型的一句話留言，測試用內容" + spaceCalls.length + "。", model_key: "darkstar-qwen3-1.7b", version: "0.3.0", latency_ms: 1 }); }
  if (u.includes("aivault_floor_state")) return json([{ k: "pool_smallmodel", v: { enabled: true } }, { k: "bot_posts", v: { enabled: true, daily_batch: 150, per_run: 10, agent_cooldown_days: 7, sentence_mode: true } }]);
  if (u.includes("aivault_pool_agent_roles")) return rolesFail ? new Response("err", { status: 500 }) : json(ROLES);
  if (u.includes("rpc/aivault_pool_usage_bump")) return json(null);
  if (u.includes("aivault_bot_posts?created_at=gte") && u.includes("select=id")) return json([], { "content-range": "0-0/0" });
  if (u.includes("aivault_pool_agents?select=id") && !u.includes("offset")) return json([], { "content-range": "0-0/" + AGENTS.length });
  const m = u.match(/offset=(\d+)/); if (u.includes("aivault_pool_agents") && m) return json([AGENTS[Number(m[1])]]);
  if (u.includes("aivault_bot_posts") && init.method === "POST") { inserted.push(JSON.parse(init.body)); return new Response("", { status: 201 }); }
  if (u.includes("aivault_bot_posts")) return json([]);
  return json([]);
}) as typeof fetch;
const sm = await import("../../supabase/functions/dark-star-ebook-ingest/smallmodel.ts");
const bp = await import("../../supabase/functions/dark-star-ebook-ingest/botposts.ts");
const assert = (c: unknown, m: string) => { if (!c) throw new Error(m); };
Deno.test("first-100 agent can never reach the Space (spaceTask/smallJson)", async () => {
  const n0 = spaceCalls.length;
  assert(await sm.spaceTask({ task: "draft_sentence", agent_id: "ag-00001", text: "x" }) === null, "ag-00001 must be refused");
  assert(await sm.spaceTask({ task: "draft_sentence", agent_id: "ag-00100", text: "x" }) === null, "ag-00100 must be refused");
  assert(await sm.smallJson("s", "u", 300, "ag-00050") === null, "smallJson must refuse large group");
  assert(spaceCalls.length === n0, "no Space call for large group");
  assert((await sm.spaceTask({ task: "draft_sentence", agent_id: "ag-00101", text: "x" }))?.ok === true, "ag-00101 (small group) may use Space");
});
Deno.test("暗星 never uses the small model", async () => {
  const n0 = spaceCalls.length;
  assert(await sm.spaceTask({ task: "answer", agent_id: "technical-dark-star", text: "你好" }) === null, "technical-dark-star refused");
  assert(await sm.spaceTask({ task: "answer", agent_id: "darkstar", text: "你好" }) === null, "darkstar refused");
  assert(spaceCalls.length === n0, "no Space call for 暗星");
});
Deno.test("dispatch: large group uses large path only; when large unavailable it is skipped (no Space fallback); assignments are individual", async () => {
  const largeCalls: string[] = []; spaceCalls.length = 0; inserted.length = 0;
  const orig = Math.random; let seq = [0, 1, 2, 100, 101, 102, 3, 103, 4, 104].map((i) => (i + 0.5) / AGENTS.length); let k = 0; Math.random = () => seq[k++ % seq.length];
  try {
    const r: any = await bp.dispatchDrafts(async () => [], 10, true, async (id) => { largeCalls.push(id); return null; }); // 大模型不可用
    const large = r.results.filter((x: any) => Number(x.agent.slice(3)) <= 100), small = r.results.filter((x: any) => Number(x.agent.slice(3)) > 100);
    assert(large.length > 0 && large.every((x: any) => !x.ok && x.error === "large_model_unavailable_skipped"), "large group skipped");
    assert(spaceCalls.every((c) => Number(String(c.agent_id).slice(3)) > 100), "Space never called for first 100");
    assert(largeCalls.length === large.length, "large path attempted for each large agent");
    assert(small.length > 0 && small.every((x: any) => x.ok && x.group === "small"), "small group uses Space");
    const topics = spaceCalls.map((c) => c.text); assert(new Set(topics.map((t, i) => t + "|" + spaceCalls[i].agent_id)).size === spaceCalls.length, "individual tasks");
    assert(r.results.filter((x: any) => x.ok).every((x: any) => String(x.assignment).startsWith("ds-")), "assignment ids recorded");
  } finally { Math.random = orig; }
});
Deno.test("fail-closed: if the large-group list cannot be loaded, nobody uses the Space", async () => {
  rolesFail = true; await new Promise((r) => setTimeout(r, 10));
  // 強制重新讀設定（快取 60 秒）：用新的模組實例
  const fresh = await import("../../supabase/functions/dark-star-ebook-ingest/smallmodel.ts?fresh=" + Date.now());
  const n0 = spaceCalls.length;
  assert(await fresh.spaceTask({ task: "draft_sentence", agent_id: "ag-00120", text: "x" }) === null, "refused when roles unavailable");
  assert(spaceCalls.length === n0, "no Space call"); rolesFail = false;
});
Deno.test("post checks: one sentence, PII, banned words, URL allowlist, duplicates", () => {
  assert(bp.checkPost("今天學到一個資安小技巧，記得開兩步驟驗證。", [], [], true).ok, "normal sentence passes");
  assert(bp.checkPost("聯絡我 0912-345-678。", [], [], true).issues.includes("pii:phone"), "phone");
  assert(bp.checkPost("寫信到 abc@example.com 就好。", [], [], true).issues.includes("pii:email"), "email");
  assert(bp.checkPost("快來 https://evil.example.com 看看喔。", [], [], true).issues.some((i) => i.startsWith("url_not_allowed")), "url");
  assert(bp.checkPost("這是第一句。這是第二句。", [], [], true).issues.includes("not_one_sentence"), "one sentence");
  assert(bp.checkPost("加line私訊我拿穩賺名單。", [], [], true).issues.some((i) => i.startsWith("banned")), "banned");
  const n = bp.norm("資安很重要，大家要注意。"); assert(bp.checkPost("資安很重要，大家要注意。", [], [n], true).issues.includes("duplicate"), "dup");
});
