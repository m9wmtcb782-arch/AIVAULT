// 本機規模測試（PGlite = WASM 單執行緒 Postgres 17 + pgvector；比真實 Supabase Postgres 慢，結果是保守上界）
import { PGlite } from "@electric-sql/pglite"; import { vector } from "@electric-sql/pglite-pgvector"; import { readFileSync, writeFileSync } from "node:fs";
const N = Number(process.argv[2] || 1000000), NV = Number(process.argv[3] || 100000), DIM = 384;
const db = new PGlite({ dataDir: new URL("../.pgdata", import.meta.url).pathname, extensions: { vector } }); const R = { N, NV, DIM, engine: "PGlite 0.5.14 (WASM, single-thread) + pgvector" };
const t = async (label, q, p) => { const t0 = performance.now(); const r = await db.query(q, p); R[label] = +(performance.now() - t0).toFixed(1); console.log(label, R[label], "ms"); return r; };
await db.exec("DO $$ BEGIN CREATE ROLE anon; EXCEPTION WHEN duplicate_object THEN NULL; END $$; DO $$ BEGIN CREATE ROLE authenticated; EXCEPTION WHEN duplicate_object THEN NULL; END $$; DO $$ BEGIN CREATE ROLE service_role BYPASSRLS; EXCEPTION WHEN duplicate_object THEN NULL; END $$;");
await db.exec(readFileSync(new URL("../sql/common_memory_v4.sql", import.meta.url), "utf8"));
const have = (await db.query("select count(*)::int n from cm_entries")).rows[0].n;
if (have < N) {
  // 1) N 筆中繼資料（100 個 task_type、10 萬個 AI 提案者），其中前 NV 筆有 384 維向量
  await t("insert_meta_ms", `INSERT INTO cm_entries(entry_key, scope, bank, task_type, question_norm, answer, evidence, source, proposed_by, created_at)
    SELECT md5(g::text), 'common', (ARRAY['correct','error','lesson'])[1 + g % 3], 'task' || (g % 100), 'q' || g, to_jsonb(g), '{"test_passed":true}', 'src' || (g % 7), 'ag-' || lpad((g % 100000)::text, 6, '0'), now() - (g % 1000) * interval '1 hour'
    FROM generate_series(1, ${N}) g`);
  await t("insert_events_ms", `INSERT INTO cm_events(entry_id, kind, actor) SELECT id, 'verify', 'darkstar' FROM cm_entries`);
  await t("insert_vectors_ms", `INSERT INTO cm_entries(entry_key, scope, bank, task_type, question_norm, answer, evidence, source, proposed_by, embedding)
    SELECT md5('v' || g), 'common', 'correct', 'task' || (g % 100), 'vq' || g, to_jsonb(g), '{"test_passed":true}', 'src', 'ag-' || lpad((g % 100000)::text, 6, '0'),
           (SELECT array_agg(random() - 0.5)::vector FROM generate_series(1, ${DIM}) i WHERE i > -g) FROM generate_series(1, ${NV}) g`);
  await db.exec(`INSERT INTO cm_events(entry_id, kind, actor) SELECT id, 'verify', 'darkstar' FROM cm_entries WHERE embedding IS NOT NULL`);
  await t("analyze_ms", "ANALYZE");
}
R.rows_total = (await db.query("select count(*)::int n from cm_entries")).rows[0].n;
const q0 = (await db.query("select embedding::text e from cm_entries where embedding is not null and task_type = 'task42' limit 1")).rows[0].e; const q = "[" + JSON.parse(q0).map((x) => x + (Math.random() - 0.5) * 0.05).join(",") + "]"; // 附近的查詢向量
await db.exec("SET ROLE service_role; SELECT set_config('request.jwt.claims','{\"role\":\"service_role\"}',false)");
const rep = async (label, sql, p, n = 20) => { const xs = []; for (let i = 0; i < n; i++) { const t0 = performance.now(); await db.query(sql, p); xs.push(performance.now() - t0); } xs.sort((a, b) => a - b); R[label] = { p50: +xs[n >> 1].toFixed(2), p95: +xs[Math.floor(n * 0.95)].toFixed(2) }; console.log(label, R[label]); };
await rep("key_lookup_ms", "select e.id from cm_entries e where entry_key = $1", ["" + "c4ca4238a0b923820dcc509a6f75849b"]);
await rep("status_one_ms", "select * from cm_status where entry_id = $1", [123456]);
await rep("proposer_ratelimit_query_ms", "select count(*) from cm_entries where proposed_by = $1 and created_at > now() - interval '1 hour'", ["ag-004242"]);
await rep("search_exact_scan_ms", "select * from cm_search($1::vector, 'task42', '{}'::jsonb, 5)", [q], 5);
await db.exec("RESET ROLE"); const t0 = performance.now();
await db.exec("CREATE INDEX IF NOT EXISTS cm_entries_hnsw ON cm_entries USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64)"); R.hnsw_build_ms = +(performance.now() - t0).toFixed(0); console.log("hnsw", R.hnsw_build_ms);
await db.exec("SET hnsw.ef_search = 100; SET ROLE service_role; SELECT set_config('request.jwt.claims','{\"role\":\"service_role\"}',false)");
await rep("search_hnsw_ms", "select * from cm_search($1::vector, 'task42', '{}'::jsonb, 5)", [q]);
await rep("raw_knn_hnsw_ms", "select id from cm_entries order by embedding <=> $1::vector limit 10", [q]);
// 召回率：HNSW 前 10 vs 精確前 10
await db.exec("RESET ROLE"); await db.exec("SET enable_indexscan = off"); const exact = (await db.query("select id from cm_entries where embedding is not null order by embedding <=> $1::vector limit 10", [q])).rows.map((r) => r.id);
await db.exec("SET enable_indexscan = on"); const ann = (await db.query("select id from cm_entries order by embedding <=> $1::vector limit 10", [q])).rows.map((r) => r.id);
R.hnsw_recall_at10 = exact.filter((x) => ann.includes(x)).length / 10; R.db_size = (await db.query("select pg_size_pretty(pg_database_size(current_database())) s")).rows[0].s;
console.log(R); writeFileSync(new URL("./scale-results.json", import.meta.url), JSON.stringify(R, null, 1)); await db.close();
