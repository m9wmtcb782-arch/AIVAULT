// deno test -A tests/ebook-privacy/sql_test.ts —— 用 PGlite（WASM Postgres，本機記憶體）套用 migration，驗證：
//  (1) 既有公開書維持 public（包含 e0bc8c57），metadata.private=true → members，其他不變
//  (2) dark_star_search_ebook_pages 依 viewer 過濾；預設（訪客）只搜得到 public
//  (3) anon/authenticated 無法執行搜尋函式
import { assertEquals } from "jsr:@std/assert@1";
import { PGlite } from "npm:@electric-sql/pglite@0.2.17";
const OWNER = "11111111-1111-1111-1111-111111111111", MEMBER = "22222222-2222-2222-2222-222222222222";
const E0 = "e0bc8c57-646d-474c-988e-d6cb3d4f8972", PRIV = "c22c6a4a-4339-4143-a1e9-e48a430ce823";
const migration = await Deno.readTextFile(new URL("../../supabase/migrations/20261118090000_ebook_owner_visibility.sql", import.meta.url));
const STUB = `
create role anon; create role authenticated; create role service_role;
create schema auth; create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('test.uid', true),'')::uuid $$;
create function auth.jwt() returns jsonb language sql as $$ select coalesce(nullif(current_setting('test.jwt', true),''),'{}')::jsonb $$;
create schema storage; create table storage.buckets(id text primary key, name text, public boolean);
create table storage.objects(id serial, bucket_id text, name text); alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql as $$ select (string_to_array(name,'/'))[1:array_length(string_to_array(name,'/'),1)-1] $$;
create table public.dark_star_ebooks(id uuid primary key, title text, metadata jsonb default '{}'::jsonb, created_at timestamptz default now(), total_pages int default 1);
create table public.dark_star_ebook_pages(id uuid primary key default gen_random_uuid(), ebook_id uuid references public.dark_star_ebooks(id), page_number int, content text, title text, chapter text, section text);
-- 舊版函式（3 參數）
create function public.dark_star_search_ebook_pages(terms text[], book_id uuid default null, result_limit integer default 6)
returns table(page_id uuid, ebook_id uuid, book_title text, page_number integer, chapter text, section text, excerpt text, score integer)
language sql stable as $$ select p.id,p.ebook_id,b.title,p.page_number,p.chapter,p.section,p.content,1 from public.dark_star_ebook_pages p join public.dark_star_ebooks b on b.id=p.ebook_id where strpos(p.content,terms[1])>0 $$;
insert into auth.users values ('${OWNER}'),('${MEMBER}');
insert into public.dark_star_ebooks(id,title,metadata) values
 ('${E0}','宪法学讲义（第四版）｜林来梵','{"category":"法律"}'),
 ('${PRIV}','带上她的眼睛｜劉慈欣','{"private":true}'),
 ('aaaaaaaa-0000-0000-0000-000000000009','字串 private','{"private":"true"}'),
 ('aaaaaaaa-0000-0000-0000-000000000010','明確 false','{"private":false}');
insert into public.dark_star_ebook_pages(ebook_id,page_number,content) select id,1,'憲法 測試 '||title from public.dark_star_ebooks;
`;
Deno.test("migration：可見度對應與搜尋過濾", async () => {
  const db = new PGlite();
  await db.exec(STUB);
  await db.exec(migration);
  const vis = Object.fromEntries((await db.query<any>("select id::text, visibility from public.dark_star_ebooks")).rows.map((r) => [r.id, r.visibility]));
  assertEquals(vis[E0], "public");                         // 《宪法学讲义》維持公開
  assertEquals(vis["aaaaaaaa-0000-0000-0000-000000000010"], "public");
  assertEquals(vis[PRIV], "members");                      // 既有私人書維持會員限定
  assertEquals(vis["aaaaaaaa-0000-0000-0000-000000000009"], "members");
  // 新增一本只限本人
  await db.exec(`insert into public.dark_star_ebooks(id,title,metadata,visibility,owner_id) values ('aaaaaaaa-0000-0000-0000-000000000003','只限本人','{"private":true,"visibility":"owner"}','owner','${OWNER}');
    insert into public.dark_star_ebook_pages(ebook_id,page_number,content) values ('aaaaaaaa-0000-0000-0000-000000000003',1,'憲法 只限本人內文');`);
  const search = async (args: string) => (await db.query<any>(`select ebook_id::text from public.dark_star_search_ebook_pages(array['憲法'] ${args})`)).rows.map((r) => r.ebook_id).sort();
  const pub = [E0, "aaaaaaaa-0000-0000-0000-000000000010"].sort();
  assertEquals(await search(""), pub);                                         // 訪客（預設）
  assertEquals(await search(", null, 10"), pub);                               // 舊呼叫方式 → 只有公開
  const mem = await search(`, null, 10, '${MEMBER}', true, false`);
  assertEquals(mem.includes(PRIV), true); assertEquals(mem.includes("aaaaaaaa-0000-0000-0000-000000000003"), false);
  const own = await search(`, null, 10, '${OWNER}', true, false`);
  assertEquals(own.includes("aaaaaaaa-0000-0000-0000-000000000003"), true);
  const adm = await search(`, null, 10, null, true, true`);
  assertEquals(adm.length, 5);
  assertEquals(await search(`, 'aaaaaaaa-0000-0000-0000-000000000003'::uuid, 10`), []); // 指定 owner-only 書，訪客仍空
  // 欄位限制：owner 必須有 owner_id
  let failed = false; try { await db.exec(`insert into public.dark_star_ebooks(id,title,visibility) values (gen_random_uuid(),'x','owner')`); } catch { failed = true; }
  assertEquals(failed, true);
  // 權限：anon/authenticated 不能執行搜尋函式
  const priv = (await db.query<any>(`select has_function_privilege('anon','public.dark_star_search_ebook_pages(text[],uuid,integer,uuid,boolean,boolean)','execute') a, has_function_privilege('authenticated','public.dark_star_search_ebook_pages(text[],uuid,integer,uuid,boolean,boolean)','execute') u, has_function_privilege('service_role','public.dark_star_search_ebook_pages(text[],uuid,integer,uuid,boolean,boolean)','execute') s`)).rows[0];
  assertEquals([priv.a, priv.u, priv.s], [false, false, true]);
  // 舊 3 參數版已移除
  assertEquals((await db.query<any>(`select count(*)::int n from pg_proc where proname='dark_star_search_ebook_pages'`)).rows[0].n, 1);
  // storage：ebook-owner 為私有 bucket，policy 存在
  assertEquals((await db.query<any>(`select public from storage.buckets where id='ebook-owner'`)).rows[0].public, false);
  assertEquals((await db.query<any>(`select count(*)::int n from pg_policies where policyname='ebook_owner_read_self'`)).rows[0].n, 1);
  // storage policy 實際生效：只有本人資料夾可讀；他人與 owner/admin 角色
  await db.exec(`grant usage on schema storage, auth to authenticated; grant select on storage.objects to authenticated; grant execute on all functions in schema storage, auth to authenticated;
    insert into storage.objects(bucket_id,name) values ('ebook-owner','${OWNER}/book/p1.jpg'),('ebook-owner','${MEMBER}/book2/p1.jpg'),('other','${OWNER}/x.jpg');`);
  const seeAs = async (uid: string, jwt = "{}") => { await db.exec(`set test.uid='${uid}'; set test.jwt='${jwt}'; set role authenticated;`); const r = (await db.query<any>(`select name from storage.objects where bucket_id='ebook-owner' order by name`)).rows.map((x) => x.name); await db.exec(`reset role;`); return r; };
  assertEquals(await seeAs(OWNER), [`${OWNER}/book/p1.jpg`]);
  assertEquals(await seeAs(MEMBER), [`${MEMBER}/book2/p1.jpg`]);
  assertEquals((await seeAs("99999999-9999-9999-9999-999999999999", '{"app_metadata":{"role":"owner"}}')).length, 2);
  assertEquals(await seeAs("99999999-9999-9999-9999-999999999999"), []);
  // 可重複執行（idempotent）
  await db.exec(migration);
  assertEquals((await db.query<any>(`select visibility from public.dark_star_ebooks where id='${E0}'`)).rows[0].visibility, "public");
  await db.close();
});
