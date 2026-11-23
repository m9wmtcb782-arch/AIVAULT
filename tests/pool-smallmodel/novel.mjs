// t295/t296 本機 PGlite 測試（假資料）：小說留言表、RLS、書評員名冊、作者不得書評（DB 觸發器）、暗星批次釋出、回滾。
import { PGlite } from "@electric-sql/pglite";
import fs from "fs";
const db = new PGlite(); const repo = "/workspace/collabfix/supabase/migrations/"; const rb = "/workspace/collabfix/supabase/rollback/";
const q = async (s, p) => (await db.query(s, p)).rows; let pass = 0, fail = 0;
const ok = (c, m, extra = "") => { if (c) { pass++; console.log("PASS", m, extra); } else { fail++; console.log("FAIL", m, extra); } };
const err = async (sql) => { try { await db.exec(sql); return null; } catch (e) { return e.message; } };
await db.exec(`
create role anon; create role authenticated; create role service_role;
create schema auth; grant usage on schema auth to anon, authenticated;
create or replace function auth.jwt() returns jsonb language sql as $$ select coalesce(nullif(current_setting('test.jwt', true), ''), '{}')::jsonb $$;
create or replace function auth.uid() returns uuid language sql as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
grant execute on all functions in schema auth to anon, authenticated; grant usage on schema public to anon, authenticated;
create table public.aivault_pool_agents (id text primary key, name text not null, zone text, spawned boolean not null default false);
create table public.aivault_floor_state (k text primary key, v jsonb, updated_at timestamptz default now());
create table public.aivault_audit_events (id bigserial primary key, actor text, action text not null, target text, detail jsonb, created_at timestamptz default now());
create table public.aivault_pool_agent_tasks (id uuid primary key default gen_random_uuid(), source text, status text, plan jsonb, result text);
create or replace function public.aivault_safe_name(t text) returns text language sql as $$ select nullif(left(t, 24), '') $$;`);
const town = fs.readFileSync(repo + "20261017120000_aivault_town_public.sql", "utf8"); await db.exec(town.slice(town.indexOf("create table if not exists public.aivault_world_chat"), town.indexOf("-- 3)")));
const names = fs.readFileSync(repo + "20261017200000_aivault_town_names.sql", "utf8"); const g0 = names.indexOf("create or replace function public.aivault_world_chat_guard("); await db.exec(names.slice(g0, names.indexOf("end $$;", g0) + 7));
await db.exec(fs.readFileSync(repo + "20261017100000_aivault_novel_books.sql", "utf8")); // 既有小說表（原檔）
let ids = []; for (let i = 1; i <= 3000; i++) ids.push(`('ag-${String(i).padStart(5, "0")}','代理${i}','z${i % 10}',${i > 2900})`);
await db.exec("insert into public.aivault_pool_agents(id,name,zone,spawned) values " + ids.join(","));
// 既有小說資料（假）：B1 已核准、B2 未核准；章節作者 ag-00150（非前 100）、大綱作者 ag-00200
const B1 = "11111111-1111-4111-8111-111111111111", B2 = "22222222-2222-4222-8222-222222222222";
await db.exec(`insert into aivault_novel_books(id,title,genre,approved,outline_agent) values ('${B1}','霧港來信','懸疑',true,'ag-00200'),('${B2}','未上架','奇幻',false,null);
 insert into aivault_novel_chapters(book_id,ch,title,text,chars,agent_id) values ('${B1}',1,'信','港口起霧的那天，林遙收到一封沒有署名的信。',22,'ag-00150'),('${B2}',1,'x','未核准書的章節',7,'ag-00151');`);
const before = await q("select (select count(*) from aivault_novel_books) b, (select count(*) from aivault_novel_chapters) c, (select md5(string_agg(text,'|' order by book_id,ch)) from aivault_novel_chapters) h");
let t0 = Date.now(); await db.exec(fs.readFileSync(repo + "20261123100000_aivault_pool_smallmodel.sql", "utf8"));
await db.exec(fs.readFileSync(repo + "20261123110000_aivault_novel_comments.sql", "utf8"));
await db.exec(`create table public.dark_star_ebooks (id uuid primary key, title text, created_at timestamptz default now()); create table public.dark_star_ebook_pages (ebook_id uuid, page_number int, content text, created_at timestamptz default now());`);
await db.exec(fs.readFileSync(repo + "20261123120000_aivault_comment_retention.sql", "utf8")); console.log("MIGRATIONS applied ms", Date.now() - t0);
// 名冊
const R = await q("select count(*)::int n, count(*) filter (where agent_id in (select agent_id from aivault_pool_agent_roles))::int top100, count(*) filter (where agent_id in ('ag-00150','ag-00200','ag-00151'))::int authors, count(*) filter (where a.spawned)::int spawned from aivault_novel_reviewers v join aivault_pool_agents a on a.id=v.agent_id");
ok(R[0].n === 1000 && R[0].top100 === 0 && R[0].authors === 0 && R[0].spawned === 0, "roster: 1000 reviewers, none in top-100, none authors, none spawned", JSON.stringify(R[0]));
const exp = await q("select string_agg(id, ',' order by md5(id), id) s from (select id from aivault_pool_agents where not spawned and id > 'ag-00100' and id not in ('ag-00150','ag-00151','ag-00200') order by md5(id), id limit 1000) x");
const got = await q("select string_agg(agent_id, ',' order by rank) s from aivault_novel_reviewers");
ok(exp[0].s === got[0].s, "roster deterministic (md5(id) order, re-computable)");
ok((await q("select public.aivault_novel_reviewers_fill(1000) n"))[0].n === 1000, "fill is idempotent (still 1000)");
const T = (await q("select count(*) filter (where model_tier='large')::int large, count(*) filter (where model_tier='small')::int small, count(*) filter (where model_tier='large' and agent_id <= 'ag-00100')::int large_in_top100 from aivault_novel_reviewers"))[0];
ok(T.large === 100 && T.small === 900 && T.large_in_top100 === 0, "t297 mixed roster: 100 large-model + 900 small-model reviewers, no top-100 writers", JSON.stringify(T));
const rv = (await q("select agent_id from aivault_novel_reviewers order by rank limit 3")).map((r) => r.agent_id);
const ins = (ag, i) => `insert into aivault_bot_posts(agent_id,target,body,status,body_hash,ref,model) values ('${ag}','novel','第一章的霧港氣氛寫得很濃，讓人想追下去。','pending','h${i}','{"book_id":"${B1}","ch":1,"quote":"港口起霧的那天"}','space:test')`;
ok(/NOVEL_AUTHOR_CANNOT_REVIEW/.test(await err(ins("ag-00001", 1)) || ""), "DB rejects review by top-100 large-model novel writer (ag-00001)");
ok(/NOVEL_AUTHOR_CANNOT_REVIEW/.test(await err(ins("ag-00150", 2)) || ""), "DB rejects review by chapter author (ag-00150)");
ok(/NOVEL_AUTHOR_CANNOT_REVIEW/.test(await err(ins("ag-00200", 3)) || ""), "DB rejects review by outline author (ag-00200)");
const outsider = (await q("select id from aivault_pool_agents a where not spawned and id > 'ag-00100' and not exists (select 1 from aivault_novel_reviewers v where v.agent_id=a.id) and id not in ('ag-00150','ag-00151','ag-00200') limit 1"))[0].id;
ok(/NOT_A_DESIGNATED_REVIEWER/.test(await err(ins(outsider, 4)) || ""), "DB rejects review by non-roster agent " + outsider);
ok(await err(ins(rv[0], 5)) === null, "roster reviewer can submit a pending review " + rv[0]);
ok(/NOVEL_AUTHOR_CANNOT_REVIEW/.test(await err(`insert into aivault_novel_comments(book_id,ch,author_kind,agent_id,display_name,body,ai_label,model,status) values ('${B1}',1,'ai','ag-00001','x','直接寫入','🤖 AI 書評','m','approved')`) || ""), "DB rejects direct AI comment by author in comments table");
ok(/novel_comment_author/.test(await err(`insert into aivault_novel_comments(book_id,ch,author_kind,agent_id,display_name,body,status) values ('${B1}',1,'ai','${rv[0]}','x','沒有 AI 標記','approved')`) || ""), "DB rejects AI comment without AI label/model");
// 書評員寫了章節 → 自動移出名冊 → 之後不能書評
await db.exec(`insert into aivault_novel_chapters(book_id,ch,title,text,chars,agent_id) values ('${B1}',2,'二','第二章',3,'${rv[1]}')`);
ok((await q(`select count(*)::int n from aivault_novel_reviewers where agent_id='${rv[1]}'`))[0].n === 0, "reviewer who writes a chapter leaves the roster");
ok(/NOVEL_AUTHOR_CANNOT_REVIEW/.test(await err(ins(rv[1], 6)) || ""), "…and can no longer review");
ok((await q("select public.aivault_novel_reviewers_fill(1000) n"))[0].n === 1000, "roster refilled back to 1000 by fill()");
// 釋出：60 則已核准（不同書評員），B2（未核准書）1 則
const rs = (await q("select agent_id from aivault_novel_reviewers order by rank limit 62")).map((r) => r.agent_id);
for (let i = 0; i < 61; i++) await db.exec(`insert into aivault_bot_posts(agent_id,target,body,status,body_hash,ref,model,reviewed_at) values ('${rs[i + 1]}','novel','書評第${i}則：霧港的開場很有畫面感。','approved','r${i}','{"book_id":"${i === 60 ? B2 : B1}","ch":1,"quote":"港口起霧的那天"}','space:darkstar-qwen3-1.7b@0.3.0', now())`);
const wc0 = (await q("select count(*)::int n from aivault_world_chat"))[0].n;
const wr = (await q("select public.aivault_bot_post_release(500,'test') r"))[0].r;
ok((await q("select count(*)::int n from aivault_world_chat"))[0].n === wc0, "world-chat release never takes novel reviews", JSON.stringify(wr));
t0 = Date.now(); const r1 = (await q("select public.aivault_novel_review_release(1000,'technical-dark-star:test') r"))[0].r; const ms = Date.now() - t0;
ok(r1.released === 50 && r1.limit === 50, "release capped at max_release_per_command=50", JSON.stringify(r1) + " ms " + ms);
const r2 = (await q("select public.aivault_novel_review_release(1000,'technical-dark-star:test') r"))[0].r;
ok(r2.released === 10, "second command releases remaining 10 (unapproved book B2 never released)", JSON.stringify(r2));
const lab = await q("select count(*)::int n, count(*) filter (where author_kind='ai' and ai_label='🤖 AI 書評' and model like 'space:%' and quote is not null and status='approved')::int labelled from aivault_novel_comments");
ok(lab[0].n === 60 && lab[0].labelled === 60, "released rows are labelled AI with model + quote", JSON.stringify(lab[0]));
// 人類留言（服務端寫入）：一則 approved、一則 pending
await db.exec(`insert into aivault_novel_comments(book_id,ch,author_kind,user_id,display_name,body,status) values ('${B1}',1,'human','33333333-3333-4333-8333-333333333333','會員甲','好看！','approved'),('${B1}',1,'human','33333333-3333-4333-8333-333333333333','會員甲','待審留言','pending')`);
// RLS
await db.exec("set role anon"); const an = await q("select author_kind, status, book_id from aivault_novel_comments");
ok(an.length === 61 && an.every((r) => r.status === "approved" && r.book_id === B1), "anon sees only approved comments of approved books", "rows " + an.length);
ok(/permission denied/.test(await err(`insert into aivault_novel_comments(book_id,author_kind,user_id,display_name,body,status) values ('${B1}','human','33333333-3333-4333-8333-333333333333','x','y','approved')`) || ""), "anon cannot insert");
ok(/permission denied/.test(await err("select * from aivault_novel_reviewers") || ""), "anon cannot read roster");
await db.exec("reset role; set role authenticated"); await db.exec(`set test.jwt = '{"app_metadata":{"role":"member"}}'`);
ok((await q("select count(*)::int n from aivault_novel_comments"))[0].n === 61, "member sees the same 61 approved");
ok(/permission denied/.test(await err(`update aivault_novel_comments set status='approved'`) || ""), "member cannot approve/update");
await db.exec(`set test.jwt = '{"app_metadata":{"role":"owner"}}'`);
ok((await q("select count(*)::int n from aivault_novel_comments"))[0].n === 62, "owner sees pending too (62)");
await db.exec("reset role; set test.jwt = ''");
ok((await q("select count(*)::int n from aivault_audit_events where action='novel_review_release'"))[0].n === 2, "audit log written for each release");
// t297 留言保留 7 天：只刪過期留言列
await db.exec(`set test.uid = '44444444-4444-4444-8444-444444444444'`);
await db.exec(`insert into aivault_world_chat(body) values ('人類舊訊息')`); await db.exec(`set test.uid = ''`);
await db.exec(`update aivault_world_chat set created_at = now() - interval '30 days' where body = '人類舊訊息'`);
await db.exec(`begin; select set_config('aivault.ai_release','on',true); insert into aivault_world_chat(body) values ('【AI 生成】舊 AI 留言'),('【AI 生成】新 AI 留言'); commit;`);
await db.exec(`update aivault_world_chat set created_at = now() - interval '8 days' where body = '【AI 生成】舊 AI 留言'`);
await db.exec(`update aivault_novel_comments set created_at = now() - interval '8 days' where id in (select id from aivault_novel_comments order by id limit 20)`);
await db.exec(`update aivault_bot_posts set created_at = now() - interval '8 days' where id in (select id from aivault_bot_posts order by id limit 30)`);
await db.exec(`update aivault_novel_books set created_at = now() - interval '90 days'; update aivault_novel_chapters set created_at = now() - interval '90 days';
  insert into dark_star_ebooks values ('${B1}','霧港來信', now() - interval '90 days'); insert into dark_star_ebook_pages values ('${B1}',1,'港口起霧的那天', now() - interval '90 days');`);
await db.exec("set role anon"); const vis = (await q("select count(*)::int n from aivault_novel_comments"))[0].n;
const wcv = (await q("select count(*) filter (where body like '【AI 生成】舊%')::int old_ai, count(*) filter (where body = '人類舊訊息')::int human_old from aivault_world_chat"))[0]; await db.exec("reset role");
ok(vis === 41 && wcv.old_ai === 0 && wcv.human_old === 1, "before purge: expired rows already hidden by restrictive RLS (human chat still visible)", JSON.stringify({ novel_visible: vis, ...wcv }));
const snap = async () => (await q(`select (select count(*) from aivault_novel_books)::int b, (select count(*) from aivault_novel_chapters)::int c, (select count(*) from dark_star_ebooks)::int e, (select count(*) from dark_star_ebook_pages)::int p,
  (select count(*) from aivault_pool_agents)::int ag, (select count(*) from aivault_novel_reviewers)::int rv, (select count(*) from aivault_world_chat where kind <> 'ai')::int human_chat,
  (select count(*) from aivault_novel_comments where created_at > now() - interval '7 days')::int nc_fresh, (select count(*) from aivault_bot_posts where created_at > now() - interval '7 days')::int bp_fresh,
  (select count(*) from aivault_world_chat where kind='ai' and created_at > now() - interval '7 days')::int wc_ai_fresh`))[0];
const s0 = await snap(); const pr = (await q("select public.aivault_comment_retention_purge() r"))[0].r; const s1 = await snap();
ok(pr.novel_comments === 20 && pr.bot_posts === 30 && pr.world_chat_ai === 1, "purge deletes exactly the expired comment rows", JSON.stringify(pr));
ok(JSON.stringify(s0) === JSON.stringify(s1), "purge leaves novels, chapters, ebooks, pages, agents, roster, human chat and fresh comments untouched", JSON.stringify(s1));
ok((await q("select count(*)::int n from aivault_novel_comments where created_at <= now() - interval '7 days'"))[0].n === 0 && (await q("select count(*)::int n from aivault_bot_posts where created_at <= now() - interval '7 days'"))[0].n === 0, "no expired comment rows remain");
ok((await q("select (public.aivault_comment_retention_purge()->>'novel_comments')::int n"))[0].n === 0, "second purge is a no-op");
// 回滾（先 retention，再 novel_comments，再 pool_smallmodel）
await db.exec(fs.readFileSync(rb + "20261123120000_aivault_comment_retention_down.sql", "utf8"));
await db.exec(fs.readFileSync(rb + "20261123110000_aivault_novel_comments_down.sql", "utf8"));
await db.exec(fs.readFileSync(rb + "20261123100000_aivault_pool_smallmodel_down.sql", "utf8"));
const left = await q("select count(*)::int n from pg_tables where tablename in ('aivault_novel_comments','aivault_novel_reviewers','aivault_novel_chapter_digests','aivault_bot_posts')");
await db.exec(`delete from aivault_novel_chapters where book_id='${B1}' and ch=2`); // 移除本測試加的假章節後比對
const after = await q("select (select count(*) from aivault_novel_books) b, (select count(*) from aivault_novel_chapters) c, (select md5(string_agg(text,'|' order by book_id,ch)) from aivault_novel_chapters) h");
ok(left[0].n === 0 && JSON.stringify(before) === JSON.stringify(after), "rollback removes new objects; existing novels/chapters unchanged", JSON.stringify(after[0]));
console.log(`RESULT ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
