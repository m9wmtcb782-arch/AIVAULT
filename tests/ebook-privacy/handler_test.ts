// deno test -A tests/ebook-privacy/handler_test.ts
// 以假 Supabase（mock_supabase.ts）啟動真正的 dark-star-ebook-ingest/index.ts（含 ?feature=photo-solve），
// 逐一用 訪客／被拒帳號／其他會員／擁有者本人／AIVAULT owner 角色 呼叫每個讀取 action。不連真實資料庫、不需任何密鑰。
import { assert, assertEquals } from "jsr:@std/assert@1";
import { startMock, seed, IDS, OWNER, ADMIN } from "./mock_supabase.ts";
const MOCK_PORT = 54399, FN = "http://127.0.0.1:8000";
const ANON = "t.anon.key";
const db = seed(250); // 3 本測試書 + 250 本公開書（測分頁 > 100）
const { server } = startMock(db, MOCK_PORT);
const fnUrl = new URL("../../supabase/functions/dark-star-ebook-ingest/index.ts", import.meta.url).pathname;
const proc = new Deno.Command(Deno.execPath(), { args: ["run", "-A", "--no-check", fnUrl], env: { SUPABASE_URL: `http://127.0.0.1:${MOCK_PORT}`, SUPABASE_SERVICE_ROLE_KEY: "service.role.test", SUPABASE_ANON_KEY: ANON, NEURAL_BUS_ON: "0" }, stdout: "null", stderr: "piped" }).spawn();
async function ready() { for (let i = 0; i < 300; i++) { try { const r = await fetch(FN, { method: "OPTIONS" }); await r.body?.cancel(); return; } catch { await new Promise((r) => setTimeout(r, 200)); } } throw new Error("function did not start"); }
async function call(token: string, body: any, q = "") {
  const r = await fetch(FN + "/" + q, { method: "POST", headers: { "content-type": "application/json", apikey: ANON, authorization: "Bearer " + token }, body: JSON.stringify(body) });
  return { status: r.status, data: await r.json().catch(() => ({})) };
}
const viewers: Record<string, string> = { anon: ANON, pending: "t.pending.user", member: "t.member.other", owner: "t.owner.self", admin: "t.admin.role" };
// 期望：public 全可；members 需登入核准會員；owner 只限本人與 admin
const expectRead: Record<string, Record<string, boolean>> = {
  pub: { anon: true, pending: true, member: true, owner: true, admin: true },
  mem: { anon: false, pending: false, member: true, owner: true, admin: true },
  own: { anon: false, pending: false, member: false, owner: true, admin: true },
};
const readActions = [
  (id: string) => ({ action: "book", ebook_id: id, page_number: 1 }),
  (id: string) => ({ action: "toc", ebook_id: id }),
  (id: string) => ({ action: "context", ebook_id: id, page_number: 1, radius: 1 }),
  (id: string) => ({ action: "lesson_units", ebook_id: id }),
  (id: string) => ({ action: "lesson_unit", ebook_id: id, ordinal: 0 }),
  (id: string) => ({ action: "progress", ebook_id: id }),
  (id: string) => ({ action: "book", book_id: id, page_number: 2 }), // 別名 book_id 也要擋
];
Deno.test({ name: "ebook privacy matrix", sanitizeOps: false, sanitizeResources: false, async fn(t) {
  try {
    await ready();
    for (const [bk, id] of Object.entries(IDS)) for (const [vn, tok] of Object.entries(viewers)) for (const mk of readActions) {
      const body: any = mk(id);
      await t.step(`${body.action}${body.book_id ? "(book_id)" : ""} ${bk} as ${vn}`, async () => {
        const r = await call(tok, body);
        const allowed = expectRead[bk][vn];
        if (allowed) { assertEquals(r.status, 200, JSON.stringify(r.data)); assert(r.data.ok !== false); }
        else {
          assert(r.status === 401 || r.status === 403 || r.status === 404, `${r.status} ${JSON.stringify(r.data)}`);
          assert(!JSON.stringify(r.data).includes("秘密內文"), "leaked content");
          if (bk === "own") assertEquals(r.status, 404); // 不透露 owner-only 書存在
        }
      });
    }
    await t.step("list：分頁讀完全部，且只含可讀的書；owner_id 不外流", async () => {
      for (const [vn, tok] of Object.entries(viewers)) {
        const seen: any[] = []; let off = 0;
        for (let i = 0; i < 10; i++) { const r = await call(tok, { action: "list", limit: 100, offset: off }); assertEquals(r.status, 200); seen.push(...r.data.books); assertEquals(r.data.data.has_more, r.data.has_more); if (!r.data.has_more) break; off = r.data.next_offset; }
        const ids = new Set(seen.map((b) => b.id));
        assertEquals(ids.size, seen.length, "no duplicates");
        assert(ids.has(IDS.pub), vn + " must see oldest public book (paging)");
        assertEquals(ids.has(IDS.mem), expectRead.mem[vn], vn + " mem");
        assertEquals(ids.has(IDS.own), expectRead.own[vn], vn + " own");
        assertEquals(seen.filter((b) => b.id.startsWith("bbbbbbbb")).length, 250);
        for (const b of seen) if (b.id === IDS.own && vn !== "owner" && vn !== "admin") throw new Error("own leaked");
        const o = seen.find((b) => b.id === IDS.own); if (o && vn === "owner") assertEquals(o.owner_id, OWNER);
        assertEquals(seen.find((b) => b.id === IDS.pub).visibility, "public");
      }
      const first = await call(ANON, { action: "list", limit: 100 });
      assertEquals(first.data.books.length, 100); assertEquals(first.data.has_more, true); assertEquals(first.data.next_offset, 100);
    });
    await t.step("study_set：不可讀的書不能加入", async () => {
      assertEquals((await call("t.member.other", { action: "study_set", ebook_id: IDS.own })).status, 400);
      assertEquals((await call("t.member.other", { action: "study_set", ebook_id: IDS.mem })).status, 200);
      assertEquals((await call("t.owner.self", { action: "study_set", ebook_id: IDS.own })).status, 200);
    });
    await t.step("photo-solve search / books：訪客與他人看不到私人書", async () => {
      const q = "?feature=photo-solve";
      for (const [vn, tok] of Object.entries(viewers)) {
        const r = await call(tok, { action: "search", question: "憲法", terms: ["秘密內文"] }, q);
        assertEquals(r.status, 200, JSON.stringify(r.data));
        const got = new Set((r.data.sources || []).map((s: any) => s.ebook_id));
        assertEquals(got.has(IDS.mem), expectRead.mem[vn], vn + " search mem");
        assertEquals(got.has(IDS.own), expectRead.own[vn], vn + " search own");
        const s2 = await call(tok, { action: "search", ebook_id: IDS.own, question: "憲法", terms: ["秘密內文"] }, q);
        if (!expectRead.own[vn]) { assertEquals(s2.status, 404); assert(!JSON.stringify(s2.data).includes("秘密內文")); }
        else assert((s2.data.sources || []).length > 0);
        const bks = await call(tok, { action: "books" }, q);
        const bids = new Set((bks.data.books || []).map((b: any) => b.id));
        assertEquals(bids.has(IDS.own), expectRead.own[vn], vn + " books own");
        assertEquals(bids.has(IDS.mem), expectRead.mem[vn], vn + " books mem");
      }
    });
    await t.step("create：visibility=owner 會寫入 owner_id 與 metadata.private；非 owner/admin 角色不能建立", async () => {
      const r = await call("t.admin.role", { action: "create", title: "私人測試", visibility: "owner" });
      assertEquals(r.status, 200, JSON.stringify(r.data)); assertEquals(r.data.ebook.visibility, "owner");
      const row = db.dark_star_ebooks.find((b) => b.id === r.data.ebook_id);
      assertEquals(row.visibility, "owner"); assertEquals(row.owner_id, ADMIN); assertEquals(row.metadata.private, true);
      const p = await call("t.admin.role", { action: "create", title: "公開測試" });
      assertEquals(db.dark_star_ebooks.find((b) => b.id === p.data.ebook_id).visibility, "public");
      assertEquals((await call("t.member.other", { action: "create", title: "x", visibility: "owner" })).status, 403);
      assertEquals((await call(ANON, { action: "create", title: "x" })).status, 403);
    });
  } finally { proc.kill(); await proc.status; await server.shutdown(); }
} });
