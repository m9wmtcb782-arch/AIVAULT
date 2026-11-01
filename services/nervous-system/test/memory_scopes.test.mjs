// 在 PGlite（本機 Postgres/WASM）實跑 memory_scopes.sql，驗證 RLS 與函式規則。無任何線上連線。
import { test } from "node:test"; import assert from "node:assert/strict"; import { readFileSync } from "node:fs";
import { PGlite } from "../../pool-learning/node_modules/@electric-sql/pglite/dist/index.js";
const sql = readFileSync(new URL("../sdk/memory_scopes.sql", import.meta.url), "utf8");
const db = new PGlite(); await db.exec("CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;"); await db.exec(sql);
const as = async (role, q, p = []) => { await db.exec(`SET ROLE authenticated; SELECT set_config('request.jwt.claims', '{"app_role":"${role}"}', false);`); try { return (await db.query(q, p)).rows; } finally { await db.exec("RESET ROLE"); } };
const ev = '{"test_passed":true}';
test("worker cannot write or read darkstar_private", async () => {
  await assert.rejects(as("worker", `select aivault_memory_propose('darkstar_private','lesson','lab',null,'q','"a"','${ev}','ag-0001')`), /PRIVATE_SCOPE_DARKSTAR_ONLY/);
  await as("darkstar", `select aivault_memory_propose('darkstar_private','lesson','lab',null,'secret','"x"','${ev}','darkstar')`);
  assert.equal((await as("worker", "select * from aivault_memory_entries where scope='darkstar_private'")).length, 0);
  assert.equal((await as("darkstar", "select * from aivault_memory_active where scope='darkstar_private'")).length, 1);
});
test("common write: pending until verified by someone else; self-verify & weak evidence rejected", async () => {
  const [{ aivault_memory_propose: id }] = await as("worker", `select aivault_memory_propose('common','error','lab','code|convert|string->int','q','"bad"','${ev}','ag-0002')`);
  assert.equal((await as("worker", `select * from aivault_memory_active where id=${id}`)).length, 0);
  await assert.rejects(as("worker", `select aivault_memory_verify(${id},'ag-0003','${ev}')`), /DARKSTAR_OR_FOUNDER/);
  await assert.rejects(as("darkstar", `select aivault_memory_verify(${id},'ag-0002','${ev}')`), /SELF_VERIFY/);
  await assert.rejects(as("darkstar", `select aivault_memory_verify(${id},'darkstar','{"agreement":["groq"]}')`), /INSUFFICIENT/);
  await as("darkstar", `select aivault_memory_verify(${id},'darkstar','{"agreement":["groq","gemini"]}')`);
  assert.equal((await as("worker", `select * from aivault_memory_active where id=${id}`)).length, 1);
});
test("revocation removes entry for everyone; history stays (append-only)", async () => {
  const [{ aivault_memory_propose: id }] = await as("darkstar", `select aivault_memory_propose('common','correct','qa',null,'q2','"wrong"','${ev}','darkstar')`);
  await as("founder", `select aivault_memory_verify(${id},'founder','${ev}')`); assert.equal((await as("worker", `select * from aivault_memory_active where id=${id}`)).length, 1);
  await assert.rejects(as("worker", `select aivault_memory_revoke(${id},'ag-1','bad')`), /REVOKE_DARKSTAR_OR_FOUNDER_ONLY/);
  await as("darkstar", `select aivault_memory_revoke(${id},'darkstar','verified wrong in lab #12')`);
  assert.equal((await as("worker", `select * from aivault_memory_active where id=${id}`)).length, 0);
  assert.equal((await db.query(`select * from aivault_memory_entries where id=${id}`)).rows.length, 1);
  await assert.rejects(db.query(`delete from aivault_memory_entries where id=${id}`), /append-only/);
});
test("no direct INSERT for workers", async () => { await assert.rejects(as("worker", `insert into aivault_memory_entries(scope,bank,task_type,evidence,proposed_by) values ('common','lesson','x','${ev}','ag')`)); });
