// LOCAL tests: JS rules + the SQL migration on in-process Postgres (PGlite).
import test from "node:test"; import assert from "node:assert/strict";
import { LocalQuotaLedger, decide } from "../src/quota-guard.mjs";
import { PGlite } from "@electric-sql/pglite"; import { readFileSync } from "node:fs";
test("pool capped at 50%; Dark Star reserve protected; unknown source fails closed", async () => {
  const L = new LocalQuotaLedger({ totals: { gemini: 100 } });
  let ok = 0; for (let i = 0; i < 80; i++) if ((await L.reserve({ provider: "gemini", consumer: i % 2 ? "pool_learning" : "pool_discussion" })).allowed) ok++;
  assert.equal(ok, 50);                                   // 100 × 50% = 50
  assert.equal(L.rows.at(-1).reason, "POOL_HALF_EXHAUSTED");
  for (let i = 0; i < 50; i++) assert.ok((await L.reserve({ provider: "gemini", consumer: "darkstar" })).allowed);
  assert.equal((await L.reserve({ provider: "groq", consumer: "pool_learning" })).reason, "QUOTA_SOURCE_UNKNOWN");
  assert.throws(() => decide({ dailyTotal: 10, poolShare: 0.6, used: { pool: 0, darkstar: 0, total: 0 }, consumer: "pool_learning" }));
  // 'other' consumer eating into budget cannot steal Dark Star's half
  const M = new LocalQuotaLedger({ totals: { gemini: 10 } });
  for (let i = 0; i < 5; i++) await M.reserve({ provider: "gemini", consumer: "other" });
  assert.equal((await M.reserve({ provider: "gemini", consumer: "pool_learning" })).reason, "DARKSTAR_RESERVE_PROTECTED");
});
test("LOCAL Postgres: SQL reserve function enforces same split, ledger append-only", async () => {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role; create schema auth; create function auth.jwt() returns jsonb language sql as $$ select '{}'::jsonb $$;
    create table public.aivault_pool_agents(id text primary key); create table public.aivault_pool_agent_memory(id bigserial primary key, agent_id text, kind text, content text);`);
  await db.exec(readFileSync(new URL("../../../supabase/migrations/20261101010000_aivault_ai_quota_split_and_degree_learning.sql", import.meta.url), "utf8"));
  await db.exec(`insert into aivault_ai_quota_config(provider,daily_total,source_note) values ('gemini',20,'LOCAL test value')`);
  let allowed = 0; for (let i = 0; i < 15; i++) { const r = (await db.query(`select aivault_ai_quota_reserve('gemini','pool_discussion',1,null) j`)).rows[0].j; if (r.allowed) allowed++; }
  assert.equal(allowed, 10);
  const ds = (await db.query(`select aivault_ai_quota_reserve('gemini','darkstar',1,null) j`)).rows[0].j; assert.equal(ds.allowed, true);
  const v = (await db.query(`select * from aivault_ai_quota_today`)).rows[0];
  assert.equal(v.pool_cap, 10); assert.equal(v.darkstar_reserved, 10); assert.equal(Number(v.pool_used), 10); assert.equal(Number(v.denied), 5);
  await assert.rejects(db.exec(`delete from aivault_ai_quota_ledger`), /APPEND_ONLY/);
  await assert.rejects(db.exec(`update aivault_ai_quota_config set pool_share=0.6`));
  const unk = (await db.query(`select aivault_ai_quota_reserve('groq','pool_learning',1,null) j`)).rows[0].j; assert.equal(unk.reason, "QUOTA_SOURCE_UNKNOWN");
});
