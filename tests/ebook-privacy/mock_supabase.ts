// 最小 PostgREST + GoTrue 假伺服器（只供離線測試；不連任何真實 Supabase）
export const OWNER = "11111111-1111-1111-1111-111111111111";
export const MEMBER = "22222222-2222-2222-2222-222222222222";
export const ADMIN = "33333333-3333-3333-3333-333333333333";
export const TOKENS: Record<string, any> = {
  "t.owner.self": { id: OWNER, app_metadata: { approved: true } },           // 書的擁有者（一般使用者）
  "t.member.other": { id: MEMBER, app_metadata: { approved: true } },       // 其他已核准會員
  "t.admin.role": { id: ADMIN, app_metadata: { role: "owner", approved: true } }, // AIVAULT owner 角色
  "t.pending.user": { id: "44444444-4444-4444-4444-444444444444", app_metadata: { approved: false } },
};
export const IDS = {
  pub: "aaaaaaaa-0000-0000-0000-000000000001",
  mem: "aaaaaaaa-0000-0000-0000-000000000002",
  own: "aaaaaaaa-0000-0000-0000-000000000003",
};
export function seed(nPublicExtra = 0) {
  const t0 = Date.parse("2026-10-01T00:00:00Z");
  const ebooks: any[] = [
    { id: IDS.pub, title: "公開憲法書", total_pages: 2, created_at: new Date(t0).toISOString(), metadata: {}, visibility: "public", owner_id: null },
    { id: IDS.mem, title: "會員書", total_pages: 2, created_at: new Date(t0 + 1000).toISOString(), metadata: { private: true }, visibility: "members", owner_id: null },
    { id: IDS.own, title: "只限本人憲法講義", total_pages: 2, created_at: new Date(t0 + 2000).toISOString(), metadata: { private: true, visibility: "owner", owner_id: OWNER }, visibility: "owner", owner_id: OWNER },
  ];
  for (let i = 0; i < nPublicExtra; i++) ebooks.push({ id: `bbbbbbbb-0000-0000-0000-${String(i).padStart(12, "0")}`, title: "新書" + i, total_pages: 1, created_at: new Date(t0 + 100000 + i * 1000).toISOString(), metadata: {}, visibility: "public", owner_id: null });
  const pages: any[] = [], toc: any[] = [];
  for (const b of ebooks.slice(0, 3)) for (const p of [1, 2]) {
    pages.push({ id: crypto.randomUUID(), ebook_id: b.id, page_number: p, content: `憲法 秘密內文 ${b.title} 第${p}頁`, title: null, chapter: null, section: null, article_number: null, metadata: {} });
    toc.push({ ebook_id: b.id, ordinal: p - 1, level: "chapter", title: `第${p}章`, page_number: p });
  }
  return { dark_star_ebooks: ebooks, dark_star_ebook_pages: pages, dark_star_ebook_toc: toc, dark_star_ebook_reading_progress: [] as any[], dark_star_study_books: [] as any[], dark_star_ebook_ingestion_jobs: [] as any[] } as Record<string, any[]>;
}
function vis(b: any) { const m = b.metadata || {}; if (b.visibility === "owner" || m.visibility === "owner") return "owner"; if (b.visibility === "members" || m.visibility === "members" || m.private === true || m.private === "true") return "members"; return "public"; }
function parseVal(v: string) { return v === "null" ? null : v; }
function applyFilters(rows: any[], params: URLSearchParams) {
  let out = rows.slice();
  for (const [k, raw] of params) {
    if (["select", "order", "limit", "offset", "on_conflict", "columns"].includes(k)) continue;
    const i = raw.indexOf("."); const op = raw.slice(0, i), val = raw.slice(i + 1);
    if (op === "eq") out = out.filter((r) => String(r[k]) === val);
    else if (op === "in") { const set = new Set(val.replace(/^\(|\)$/g, "").split(",").map((s) => s.replace(/^"|"$/g, ""))); out = out.filter((r) => set.has(String(r[k]))); }
    else if (op === "gte") out = out.filter((r) => Number(r[k]) >= Number(val));
    else if (op === "lte") out = out.filter((r) => Number(r[k]) <= Number(val));
    else if (op === "gt") out = out.filter((r) => Number(r[k]) > Number(val));
    else if (op === "lt") out = out.filter((r) => String(r[k]) < val);
    else if (op === "is") out = out.filter((r) => (r[k] ?? null) === parseVal(val));
  }
  const order = params.get("order");
  if (order) { const keys = order.split(",").map((s) => s.split(".")); out.sort((a, b) => { for (const [c, dir] of keys) { const x = a[c], y = b[c]; if (x === y) continue; const r = x > y ? 1 : -1; return dir === "desc" ? -r : r; } return 0; }); }
  const off = Number(params.get("offset") || 0), lim = params.get("limit") ? Number(params.get("limit")) : Infinity;
  return out.slice(off, off + lim);
}
export function startMock(db: Record<string, any[]>, port: number) {
  const calls: string[] = [];
  const server = Deno.serve({ port, onListen() {} }, async (req) => {
    const u = new URL(req.url); calls.push(req.method + " " + u.pathname + u.search);
    const json = (x: any, s = 200) => new Response(JSON.stringify(x), { status: s, headers: { "content-type": "application/json" } });
    if (u.pathname === "/auth/v1/user") { const t = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, ""); const usr = TOKENS[t]; return usr ? json(usr) : json({ msg: "invalid" }, 401); }
    const m = u.pathname.match(/^\/rest\/v1\/(rpc\/)?([a-z_]+)$/); if (!m) return json({ msg: "nf" }, 404);
    if (m[1]) { // rpc/dark_star_search_ebook_pages：模擬 migration 版（依 viewer 過濾）
      const b = await req.json(); const terms: string[] = b.terms || [];
      if (!("viewer_id" in b)) return json({ message: "old signature not allowed in test" }, 400);
      const can = (e: any) => { const v = vis(e); if (v === "public") return true; if (v === "members") return !!b.viewer_is_member; return !!b.viewer_is_admin || (!!b.viewer_is_member && b.viewer_id && b.viewer_id === (e.owner_id || e.metadata?.owner_id)); };
      const books = db.dark_star_ebooks.filter((e) => (!b.book_id || e.id === b.book_id) && can(e));
      const rows = db.dark_star_ebook_pages.filter((p) => books.some((e) => e.id === p.ebook_id) && terms.some((t) => p.content.includes(t)))
        .map((p) => ({ page_id: p.id, ebook_id: p.ebook_id, book_title: books.find((e) => e.id === p.ebook_id).title, page_number: p.page_number, chapter: null, section: null, excerpt: p.content, score: 1 }));
      return json(rows.slice(0, b.result_limit || 6));
    }
    const table = db[m[2]]; if (!table) return json({ message: "no table " + m[2] }, 404);
    const single = (req.headers.get("accept") || "").includes("vnd.pgrst.object");
    if (req.method === "GET") { const rows = applyFilters(table, u.searchParams); if (single) return rows.length === 1 ? json(rows[0]) : json({ code: "PGRST116", message: "0 rows" }, 406); return json(rows); }
    if (req.method === "POST") { const body = await req.json(); const arr = Array.isArray(body) ? body : [body]; const ins = arr.map((r) => ({ id: r.id || crypto.randomUUID(), created_at: new Date().toISOString(), ...r })); table.push(...ins); return single ? json(ins[0], 201) : json(ins, 201); }
    if (req.method === "PATCH" || req.method === "DELETE") { const rows = applyFilters(table, u.searchParams); if (req.method === "PATCH") { const body = await req.json(); rows.forEach((r) => Object.assign(r, body)); } else for (const r of rows) table.splice(table.indexOf(r), 1); return single ? (rows.length ? json(rows[0]) : json({ code: "PGRST116" }, 406)) : json(rows); }
    return json({}, 405);
  });
  return { server, calls };
}
