// Applies the migration to an in-process real Postgres (PGlite, LOCAL) with a stub auth schema.
import test from "node:test"; import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite"; import { readFileSync } from "node:fs";
test("LOCAL Postgres: migration applies, constraints hold, honest counts", async () => {
  const db = new PGlite();
  await db.exec(`create role authenticated; create schema auth; create function auth.jwt() returns jsonb language sql as $$ select '{}'::jsonb $$;`);
  await db.exec(readFileSync(new URL("../../../supabase/migrations/20261101000000_aivault_agent_ops_phase1.sql", import.meta.url), "utf8"));
  await db.exec(`insert into agent_ops.agents(agent_no,agent_id,name_zh,surname_zh,given_zh,pinyin,rank_code) values (1,'Worker-001','凌安安','凌','安安','linganan','1U')`);
  const r = await db.query(`select mail_local from agent_ops.agents where agent_no=1`); assert.equal(r.rows[0].mail_local, "linganan1u");
  await assert.rejects(db.exec(`insert into agent_ops.agents(agent_no,agent_id,name_zh,surname_zh,given_zh,pinyin,rank_code) values (2,'ag-x','凌安','凌','安','linganan','1U')`));
  await assert.rejects(db.exec(`insert into agent_ops.mailboxes(agent_no,address,domain,provider,status) values (1,'linganan1u@aivault.net.eu.org','aivault.net.eu.org','x','VERIFIED')`), /verified_needs_evidence/);
  await db.exec(`insert into agent_ops.mailboxes(agent_no,address,domain,provider,status,is_test) values (1,'linganan1u@aivault.local.test','aivault.local.test','local-test','PENDING',true)`);
  const c = (await db.query(`select * from agent_ops.v_honest_counts`)).rows[0];
  assert.equal(Number(c.identities), 1); assert.equal(Number(c.real_verified_mailboxes), 0); assert.equal(Number(c.local_test_mailboxes), 1);
  await db.exec(`insert into agent_ops.audit_log(actor,action) values ('t','x')`);
  await assert.rejects(db.exec(`delete from agent_ops.audit_log`), /append-only/);
  const rls = await db.query(`select count(*)::int n from pg_class c join pg_namespace n on n.oid=c.relnamespace where nspname='agent_ops' and relrowsecurity`);
  assert.equal(rls.rows[0].n, 9);
});
