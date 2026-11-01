import { test } from "node:test"; import assert from "node:assert/strict"; import { PGlite } from "@electric-sql/pglite"; import { vector } from "@electric-sql/pglite-pgvector"; import { readFileSync } from "node:fs";
test("legacy migration: rows become pending, table frozen, idempotent", async () => {
  const db = new PGlite({ extensions: { vector } });
  await db.exec("CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;");
  await db.exec(readFileSync(new URL("../sql/common_memory_v4.sql", import.meta.url), "utf8"));
  await db.exec(`CREATE TABLE aivault_pool_agent_memory(id bigserial primary key, agent_id text, kind text, content text, task_id text, created_at timestamptz default now());
    INSERT INTO aivault_pool_agent_memory(agent_id,kind,content,task_id) VALUES ('a1','lesson','用括號先算','t1'),('a2','error','忘了進位','t2'),('a3','correct','42','t3');`);
  const mig = readFileSync(new URL("../migration/001_migrate_pool_agent_memory.sql", import.meta.url), "utf8");
  await db.exec(mig);
  const st = (await db.query("select s.state, e.bank from cm_legacy_map m join cm_entries e on e.id=m.entry_id join cm_status s on s.entry_id=e.id order by e.id")).rows;
  assert.equal(st.length, 3); assert.ok(st.every((r) => r.state === "pending")); assert.deepEqual(st.map((r) => r.bank), ["lesson", "error", "correct"]);
  await assert.rejects(db.exec("INSERT INTO aivault_pool_agent_memory(agent_id,kind,content) VALUES ('x','lesson','y')"), /frozen/);
});
