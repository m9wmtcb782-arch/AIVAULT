// 本機 PGlite + pgvector 實測 common_memory_v4.sql。無任何線上連線。
import { test } from "node:test"; import assert from "node:assert/strict"; import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite"; import { vector } from "@electric-sql/pglite-pgvector";
const db = new PGlite({ extensions: { vector } });
await db.exec("CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;"); await db.exec(readFileSync(new URL("../sql/common_memory_v4.sql", import.meta.url), "utf8"));
const V = (seed) => "[" + Array.from({ length: 384 }, (_, i) => Math.sin(seed * 7.3 + i) ).join(",") + "]";
async function as(who, q, p = []) {
  const claims = who === "darkstar" ? { role: "service_role" } : { role: "authenticated", sub: who, app_metadata: { app_role: who.startsWith("ag-") ? "worker" : who } };
  await db.exec(`SET ROLE ${who === "darkstar" ? "service_role" : "authenticated"}; SELECT set_config('request.jwt.claims', '${JSON.stringify(claims)}', false);`);
  try { return (await db.query(q, p)).rows; } finally { await db.exec("RESET ROLE"); }
}
const prop = (who, q, ans, src, extra = {}) => as(who, `select cm_propose($1,$2,'text',$3,$4,$5,$6::jsonb,$7::jsonb,$8::vector,$9::jsonb,$10,$11::bigint[]) r`,
  [extra.scope || "common", extra.bank || "correct", extra.task || "qa", extra.sig || null, q, JSON.stringify(ans), JSON.stringify(extra.ctx || {}), V(extra.seed ?? q.length), JSON.stringify(extra.ev || { test_passed: true }), src, extra.from || []]).then((r) => r[0].r);
test("identity comes from JWT, not params: proposer recorded as token sub; worker cannot verify; self-verify blocked", async () => {
  const r = await prop("ag-0001", "台灣首都", "臺北", "groq");
  assert.equal((await db.query("select proposed_by from cm_entries where id=$1", [r.id])).rows[0].proposed_by, "ag-0001");
  await assert.rejects(as("ag-0002", `select cm_verify(${r.id}, '{"test_passed":true}')`), /DARKSTAR_OR_FOUNDER/);
  const d = await prop("darkstar", "x", "y", "darkstar-test"); await assert.rejects(as("darkstar", `select cm_verify(${d.id}, '{"test_passed":true}')`), /SELF_VERIFY/);
  await as("founder", `select cm_verify(${d.id}, '{"test_passed":true}')`);
});
test("multi-source verification: one source + agreement of 1 is insufficient; dedup adds sources", async () => {
  const r = await prop("ag-0003", "日本首都", "東京", "groq", { ev: { agreement: ["groq"] } });
  await assert.rejects(as("darkstar", `select cm_verify(${r.id}, '{"agreement":["groq"]}')`), /INSUFFICIENT/);
  const r2 = await prop("ag-0004", "日本首都", "東京", "gemini", { ev: { agreement: ["gemini"] } }); assert.equal(r2.dedup, true); assert.equal(r2.id, r.id);
  assert.equal(await as("darkstar", `select cm_verify(${r.id}, '{}')`).then((x) => x[0].cm_verify), "active");
});
test("contradiction → quarantined new version; context-aware resolve; loser revoked", async () => {
  const a = await prop("ag-0005", "沸點", "100", "groq", { ctx: { district: "lab" } }); await as("founder", `select cm_verify(${a.id}, '{"test_passed":true}')`);
  const b = await prop("ag-0006", "沸點", "90", "groq2", { ctx: { district: "mountain" } }); assert.equal(b.state, "quarantined"); assert.equal(b.version, 2);
  await as("darkstar", `select cm_resolve(${a.id}, ${b.id}, 'sea level context wins for district lab')`);
  const st = await db.query(`select entry_id, state from cm_status where entry_id in (${a.id},${b.id}) order by entry_id`); assert.deepEqual(st.rows.map((x) => x.state), ["active", "revoked"]);
});
test("revocation cascade: derived entries and adapter training rows invalidated", async () => {
  const p = await prop("ag-0007", "rule-35", "perm A", "groq", { task: "permute" }); await as("darkstar", `select cm_verify(${p.id}, '{"test_passed":true}')`);
  const c = await prop("ag-0008", "lesson from rule-35", "use perm A", "lab", { bank: "lesson", task: "permute", from: [p.id] }); await as("darkstar", `select cm_verify(${c.id}, '{"test_passed":true}')`);
  await as("darkstar", `select cm_link_training_row('sft-1', ARRAY[${p.id}]::bigint[]), cm_link_training_row('sft-2', ARRAY[${c.id}]::bigint[])`);
  assert.equal((await as("darkstar", "select * from cm_training_rows_valid where row_id in ('sft-1','sft-2')")).length, 2);
  const n = await as("darkstar", `select cm_revoke(${p.id}, 'poisoned') n`); assert.equal(n[0].n, 1);
  assert.equal((await as("darkstar", "select * from cm_training_rows_valid where row_id in ('sft-1','sft-2')")).length, 0);
  assert.equal((await db.query(`select state from cm_status where entry_id=${c.id}`)).rows[0].state, "revoked");
});
test("rate limit per proposer + anomaly quarantine", async () => {
  await db.exec("update cm_config set v=6 where k='rate_per_hour'").catch(() => {});
  for (let i = 0; i < 6; i++) { const r = await prop("ag-0666", "spam " + i, "x" + i, "s" + i); if (i < 3) await as("darkstar", `select cm_revoke(${r.id}, 'bad')`); }
  await assert.rejects(prop("ag-0666", "spam 7", "x", "s"), /RATE_LIMITED/);
  await db.exec("update cm_config set v=20 where k='rate_per_hour'");
  const r = await prop("ag-0666", "spam 8", "x", "s"); assert.equal(r.state, "quarantined"); // 3/6 已撤銷 ≥ 30%
});
test("RLS: worker cannot see darkstar_private; worker cannot write private; no direct INSERT/UPDATE", async () => {
  await prop("darkstar", "暗星私密", "s", "darkstar", { scope: "darkstar_private" });
  assert.equal((await as("ag-0009", "select * from cm_entries where scope='darkstar_private'")).length, 0);
  assert.ok((await as("darkstar", "select * from cm_entries where scope='darkstar_private'")).length >= 1);
  await assert.rejects(prop("ag-0009", "p", "q", "s", { scope: "darkstar_private" }), /PRIVATE_SCOPE/);
  await assert.rejects(as("ag-0009", "insert into cm_entries(entry_key,scope,bank,task_type,evidence,source,proposed_by) values ('k','common','lesson','x','{}','s','ag')"));
  await assert.rejects(db.query("update cm_entries set answer='\"z\"' where id=1"), /append-only/);
});
test("context-weighted search returns active entries only, one per key", async () => {
  const rows = await as("ag-0010", `select * from cm_search($1::vector, 'qa', '{"district":"lab"}'::jsonb, 5)`, [V("沸點".length)]);
  assert.ok(rows.length >= 1); assert.ok(rows.every((x) => x.answer !== "90"));
});
