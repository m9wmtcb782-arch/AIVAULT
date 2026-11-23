// t310–t312 封面佇列測試（mock fetch；不呼叫真實 Gemini、不碰正式站）
Deno.env.set("SUPABASE_URL", "https://x.supabase.co"); Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "sr"); Deno.env.set("GEMINI_API_KEY", "k");
const C = await import("../../supabase/functions/dark-star-ebook-ingest/covers.ts");
import { Image } from "https://deno.land/x/imagescript@1.3.0/mod.ts";
const png = btoa(String.fromCharCode(...await new Image(8, 12).fill(0xff0000ff).encode()));
function world(o: { enabled: boolean; cap: number; quotaAt?: number; jobs: number }) {
  const st = { gemini: 0, uploads: [] as string[], patches: [] as any[], paused: null as any, other: 0 };
  const jobs = Array.from({ length: o.jobs }, (_, i) => ({ book_id: `00000000-0000-0000-0000-00000000000${i}`, attempts: 0 }));
  C._setFetch((async (u: any, init: any = {}) => {
    const url = String(u); const ok = (b: unknown) => new Response(JSON.stringify(b), { status: 200 });
    if (url.includes("generativelanguage")) { st.gemini++; if (o.quotaAt && st.gemini >= o.quotaAt) return new Response('{"error":{"status":"RESOURCE_EXHAUSTED"}}', { status: 429 });
      return ok({ candidates: [{ content: { parts: [{ inlineData: { mimeType: "image/png", data: png } }] } }] }); }
    if (url.includes("/storage/v1/object/")) { st.uploads.push(url); return ok({}); }
    if (url.includes("aivault_novel_cover_config") && init.method === "PATCH") { st.paused = JSON.parse(init.body); return ok([]); }
    if (url.includes("aivault_novel_cover_config")) return ok([{ enabled: o.enabled, daily_cap: o.cap, model: "gemini-3.1-flash-lite-image" }]);
    if (url.includes("rpc/aivault_novel_cover_enqueue_missing")) return ok(0);
    if (url.includes("aivault_novel_cover_jobs?status=in.")) return ok(jobs);
    if (url.includes("attempt_day=eq.")) return ok([]);
    if (url.includes("image_sha=eq.")) return ok([]);
    if (url.includes("aivault_novel_books?id=eq.")) return ok([{ id: "x", title: "星海之戀", genre: "愛情", outline: "大綱" }]);
    if (url.includes("aivault_novel_chapters")) return ok([{ text: "第一章" }]);
    if (url.includes("aivault_novel_cover_attempts")) { (st as any).logs = [...((st as any).logs || []), JSON.parse(init.body)]; return ok([]); }
    if (init.method === "PATCH") { st.patches.push([url, JSON.parse(init.body)]); return ok([]); }
    st.other++; return ok([]);
  }) as typeof fetch);
  return st;
}
const eq = (a: unknown, b: unknown, m: string) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(m + " got " + JSON.stringify(a)); };
Deno.test("關閉時不呼叫 Gemini", async () => { const s = world({ enabled: true, cap: 5, jobs: 3 }); Deno.env.delete("NOVEL_COVER_GEMINI_ENABLED"); const r = await C.runCoverJobs(); eq(s.gemini, 0, "gemini"); eq(r.enabled, false, "enabled"); });
Deno.test("每日上限 2：只畫 2 本並轉 JPG 上傳、綁 cover_source=gemini", async () => { Deno.env.set("NOVEL_COVER_GEMINI_ENABLED", "1"); const s = world({ enabled: true, cap: 2, jobs: 4 }); const r: any = await C.runCoverJobs();
  eq(s.gemini, 2, "gemini calls"); eq(s.uploads.length, 2, "uploads"); eq(s.uploads.every((u) => u.endsWith(".jpg")), true, "jpg"); eq(r.results.at(-1).stop, "daily_cap", "stop");
  eq(s.patches.filter((p) => p[0].includes("dark_star_ebooks")).map((p) => Object.keys(p[1]).sort()), [["cover_source", "cover_storage_path", "cover_url"], ["cover_source", "cover_storage_path", "cover_url"]], "only cover fields"); });
Deno.test("429 配額：立即停止、退回佇列、暫停到今天結束，不改用其他模型", async () => { Deno.env.set("NOVEL_COVER_GEMINI_ENABLED", "1"); const s = world({ enabled: true, cap: 10, jobs: 4, quotaAt: 2 }); const r: any = await C.runCoverJobs();
  eq(s.gemini, 2, "stopped after quota"); eq(r.results.at(-1).stop, "quota", "stop"); eq(!!s.paused?.quota_paused_until, true, "paused"); eq(s.patches.some((p) => p[1].status === "quota_wait"), true, "requeued"); eq((s as any).logs.map((l: any) => l.category), ["ok", "quota_exhausted"], "attempt log"); });
Deno.test("PNG→JPEG 轉檔", async () => { const j = await C.toJpeg(png, "image/png"); eq([j[0], j[1]], [0xff, 0xd8], "jpeg magic"); });
Deno.test("錯誤分類與去除金鑰", () => {
  eq(C.classify(429, '{"error":{"status":"RESOURCE_EXHAUSTED","message":"Quota exceeded for metric generate_content_free_tier_requests, limit: 0"}}'), "model_not_allowed", "free tier limit 0");
  eq(C.classify(429, '{"error":{"status":"RESOURCE_EXHAUSTED","message":"Quota exceeded, limit: 25"}}'), "quota_exhausted", "quota");
  eq(C.classify(404, "models/x is not found for API version v1beta"), "model_not_allowed", "404");
  eq(C.classify(200, '{"f":"IMAGE_SAFETY"}'), "safety_block", "safety");
  eq(C.classify(500, "internal"), "other", "other");
  eq(C.redact("bad key AIzaSyA1234567890abcdefghijklmnop and k"), "bad key [REDACTED] and k", "redact");
});
