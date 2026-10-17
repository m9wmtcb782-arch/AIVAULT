// ?feature=floor：協作池「1000 人工作區」— 10 區 × 100 人的真實工作循環、審核佇列、複製提案。
// 只產生內部成果；核准僅標記「已核准」，不對外發送、發文、花錢。
import { llm } from "./yinxu.ts";
const H = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", "Content-Type": "application/json" };
const out = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: H });
const URL0 = Deno.env.get("SUPABASE_URL") || "", SR = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const SRH = { apikey: SR, Authorization: "Bearer " + SR, "Content-Type": "application/json" };
async function rest(path: string, init: RequestInit = {}) {
  const r = await fetch(URL0 + "/rest/v1/" + path, { ...init, headers: { ...SRH, Prefer: "return=representation", ...(init.headers || {}) } });
  const t = await r.text(); if (!r.ok) throw new Error("DB " + r.status + " " + t.slice(0, 200)); return t ? JSON.parse(t) : null;
}
const REPO_RAW = "https://raw.githubusercontent.com/m9wmtcb782-arch/AIVAULT/main/";
export const SPAWN_CAP = 20; // 經擁有者核准的子代理總上限（預設名冊維持 1000）
type Z = { key: string; label: string; media?: string; tasks: { t: string; ctx?: string }[] };
export const ZONES: Z[] = [
  { key: "code", label: "💻 程式開發", tasks: [
    { t: "審查這支前端載入器的程式碼：找出錯誤處理、快取與相容性（iPhone Safari）問題，給出具體修改建議與修改後程式片段。", ctx: "aivault-private-loader.js" },
    { t: "審查這支 Edge Function 的程式碼品質：錯誤處理、輸入驗證、可維護性，列出前 5 個最值得改的地方與修改範例。", ctx: "supabase/functions/dark-star-ebook-ingest/agents.ts" },
    { t: "為 AIVAULT 協作池寫一份可直接執行的端到端測試清單（mock 優先），涵蓋登入、私有頁載入、代理指揮台。" }] },
  { key: "research", label: "🔎 研究・網搜", tasks: [
    { t: "研究摘要：2026 年開源自主 AI 代理框架（如 OpenClaw 類）的架構重點、記憶與工具使用方式，整理成給擁有者的 1 頁簡報，並標明哪些需上網查證。" },
    { t: "整理「免費或低成本的 AI 媒體生成 API（影像、影片、語音、音樂、3D）」比較表：功能、計價方式、限制與待查證事項。" }] },
  { key: "law", label: "⚖️ 法律", tasks: [
    { t: "為 AIVAULT（台灣個人經營的 AI 網站，有會員註冊與 AI 生成內容）草擬隱私權政策初稿，依個資法列出必要條款，並標註需律師確認處。" },
    { t: "分析 AI 代理自動發布廣告、新聞稿、接案時在台灣可能涉及的法律風險（公平交易法、消保法、著作權、個資），給出合規檢查清單。" }] },
  { key: "medicine", label: "🩺 醫學", tasks: [
    { t: "撰寫一篇給一般讀者的衛教文章初稿：長時間使用手機與電腦的眼睛保健，附參考指引來源類型與「不取代就醫」聲明。" },
    { t: "設計 AIVAULT 醫學類 AI 回答的安全準則：哪些問題必須提醒就醫、如何標註不確定性，寫成可放進系統提示的規則。" }] },
  { key: "image", label: "🎨 圖像", media: "圖像", tasks: [
    { t: "為「因序小說」設計宣傳海報：構圖、配色、字體方向，並寫出 3 組可直接貼進圖像生成模型的英文提示詞。" },
    { t: "為暗星與曙光設計一套 6 張表情貼圖的角色設定與生成提示詞（開心、生氣、思考、驚訝、害羞、勝利）。" }] },
  { key: "video", label: "🎬 影片", media: "影片", tasks: [
    { t: "寫一支 30 秒 AIVAULT 介紹短影音腳本：分鏡表（鏡號、畫面、旁白、字幕、秒數）與影片生成提示詞。" },
    { t: "為《帶上她的眼睛》改編 45 秒預告片：分鏡、配樂情緒、字幕文案與每鏡的生成提示詞。" }] },
  { key: "voice", label: "🎙️ 語音・音樂", media: "語音／音樂", tasks: [
    { t: "為因序小說寫一首主題曲：歌詞（主歌、副歌）、曲風、BPM、和弦進行與給音樂生成模型的提示詞。" },
    { t: "寫一段 60 秒 AIVAULT 品牌廣播配音稿，標註語氣、停頓與重音，並給語音生成參數建議。" }] },
  { key: "d3", label: "🧊 3D", media: "3D", tasks: [
    { t: "為 AIVAULT 協作池設計一個 3D 吉祥物：外觀規格、低多邊形面數預算、材質、骨架與給 3D 生成模型的提示詞。" },
    { t: "規劃用 Three.js 在網頁上呈現 1000 個代理的 3D 辦公室：場景結構、效能策略（instancing）與程式骨架。" }] },
  { key: "market", label: "📣 行銷・新聞稿", tasks: [
    { t: "撰寫 AIVAULT「1000 AI 代理協作池」上線新聞稿初稿（標題、導言、內文、引言、聯絡資訊留白），僅供擁有者審核，不發布。" },
    { t: "規劃 AIVAULT 第一個月的社群行銷內容日曆：每週主題、10 則貼文文案與主題標籤，僅供審核。" }] },
  { key: "guard", label: "💂 衛士・網站", tasks: [
    { t: "資安檢查：審查這份 GitHub Actions 工作流程的權限、密鑰使用與注入風險，列出風險等級與修正方式。", ctx: ".github/workflows/publish-private-pages.yml" },
    { t: "資安檢查：審查註冊審核 Edge Function 的授權邏輯，找出可能的繞過或提權風險並給修正建議。", ctx: "supabase/functions/dark-star-ebook-ingest/signup-approval.ts" },
    { t: "網站維護：審查登入頁的程式，找出可用性、無障礙與安全（XSS、開放重導）問題並給修改建議。", ctx: "aivault-login.html" }] },
];
const envs = (b: string) => [b, ...Array.from({ length: 9 }, (_, i) => b + "_" + (i + 1))].map((n) => Deno.env.get(n) || "").filter((v, i, a) => v && a.indexOf(v) === i);
// 真實模型呼叫：回傳 JSON、模型名稱與 token 用量（Groq 免費層 gpt-oss-120b；失敗才退回共用 llm，該情況用量記為 null）
export async function callModel(system: string, user: string): Promise<{ v: any; model: string; usage: any }> {
  let last = "";
  for (const k of envs("GROQ_API_KEY")) {
    try {
      const r = await fetch("https://api.groq.com/openai/v1/chat/completions", { method: "POST", headers: { Authorization: "Bearer " + k, "Content-Type": "application/json" }, signal: AbortSignal.timeout(110000),
        body: JSON.stringify({ model: "openai/gpt-oss-120b", messages: [{ role: "system", content: system }, { role: "user", content: user }], response_format: { type: "json_object" }, max_tokens: 4000, temperature: 0.6 }) });
      if (!r.ok) { last += " groq:" + r.status; continue; }
      const j = await r.json(); const t = String(j.choices?.[0]?.message?.content || ""); const m = t.match(/\{[\s\S]*\}/); if (!m) { last += " groq:nojson"; continue; }
      const u = j.usage || {}; return { v: JSON.parse(m[0]), model: "groq:" + (j.model || "openai/gpt-oss-120b"), usage: { prompt: u.prompt_tokens, completion: u.completion_tokens, total: u.total_tokens, request_id: j.id || r.headers.get("x-request-id") } };
    } catch (e) { last += " groq:" + String((e as any)?.message || e).slice(0, 60); }
  }
  const v = await llm(system, user, { maxTokens: 3500, skipGemini: true }); return { v, model: String(v.__model || "llm"), usage: null };
}
let SHA = "";
async function repoSha() { if (SHA) return SHA; try { const r = await fetch("https://api.github.com/repos/m9wmtcb782-arch/AIVAULT/commits/main", { headers: { "User-Agent": "aivault-floor", Accept: "application/vnd.github+json" } }); if (r.ok) SHA = (await r.json()).sha || ""; } catch { /* ignore */ } return SHA || "main"; }
export const GENRES = ["科幻", "武俠", "推理", "愛情", "恐怖", "奇幻", "歷史", "都市", "懸疑", "仙俠", "賽博龐克", "校園", "冒險", "末日", "職場", "童話"];
export const NOVEL_ZONES = ["image", "video", "voice", "d3"]; // 尚無媒體金鑰的區：改寫小說，不待命
export const CHAPTERS = 3;
const zl = (k: string) => ZONES.find((z) => z.key === k)?.label || k;

async function who(r: Request) {
  const tok = (r.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (SR && tok === SR) return { id: null as string | null, cron: true };
  if (!tok || tok.split(".").length !== 3) return null;
  const u = await fetch(URL0 + "/auth/v1/user", { headers: { apikey: SR, Authorization: "Bearer " + tok } }).then((x) => x.ok ? x.json() : null).catch(() => null);
  const role = u?.app_metadata?.role; return u?.id && (role === "owner" || role === "admin") ? { id: u.id as string, cron: false } : null;
}
async function idleAgent(zone: string) {
  const a = await rest(`aivault_pool_agents?zone=eq.${zone}&status=eq.idle&select=id&order=updated_at.asc&limit=1`);
  return a[0]?.id || null;
}
async function enqueue(zone: string, text: string, by: string | null, plan: any = null) {
  const ag = await idleAgent(zone); if (!ag) return null;
  await rest(`aivault_pool_agents?id=eq.${ag}`, { method: "PATCH", body: JSON.stringify({ updated_at: new Date().toISOString() }) });
  const [t] = await rest("aivault_pool_agent_tasks", { method: "POST", body: JSON.stringify({ agent_id: ag, order_text: text, zone, source: "floor", kind: "work", status: "queued", max_steps: 1, created_by: by, ...(plan ? { plan } : {}) }) });
  return t;
}
async function ctxText(path?: string) {
  if (!path) return { text: "", url: null as string | null, sha: null as string | null };
  const sha = await repoSha();
  try { const r = await fetch(REPO_RAW.replace("/main/", "/" + sha + "/") + path, { signal: AbortSignal.timeout(15000) }); if (!r.ok) return { text: "", url: null, sha: null }; const t = await r.text();
    return { text: `\n\n【AIVAULT repo 檔案：${path} @ ${sha.slice(0, 7)}（前 9000 字）】\n` + t.slice(0, 9000), url: `https://github.com/m9wmtcb782-arch/AIVAULT/blob/${sha}/${path}`, sha }; } catch { return { text: "", url: null, sha: null }; }
}
export async function runTask(t: any, think = callModel) {
  const started = new Date().toISOString();
  const [a] = await rest(`aivault_pool_agents?id=eq.${t.agent_id}&select=*`);
  const z = ZONES.find((x) => x.key === (t.zone || a.zone)) || ZONES[0];
  await rest(`aivault_pool_agents?id=eq.${a.id}`, { method: "PATCH", body: JSON.stringify({ status: "running", updated_at: new Date().toISOString() }) });
  await rest(`aivault_pool_agent_tasks?id=eq.${t.id}`, { method: "PATCH", body: JSON.stringify({ status: "running", updated_at: new Date().toISOString() }) });
  const mem = await rest(`aivault_pool_agent_memory?agent_id=eq.${a.id}&select=content&order=created_at.desc&limit=5`);
  const tpl = z.tasks.find((x) => x.t === t.order_text);
  const media = z.media ? `\n你所在的${z.label}區尚未串接${z.media}生成 API，所以只交付「企劃／腳本／提示詞」，成果第一行必須寫「【企劃稿・尚未生成${z.media}】」。` : "";
  const sys = a.persona + `\n你目前派駐在 AIVAULT 1000 人工作區的「${z.label}」區。成果只交給擁有者審核，絕不聲稱已對外發送、發布或購買。` + media + "\n你的記憶：\n" + (mem.map((m: any) => "- " + m.content).join("\n") || "（尚無）");
  const cx = await ctxText(tpl?.ctx);
  const nv = Array.isArray(t.plan) ? null : t.plan?.novel;
  let user = `任務：${t.order_text}${cx.text}\n\n直接交付完整成果（繁體中文 Markdown，具體、可查證；不確定處標「待查證」）。另外：如果你認為需要一個專門的子代理來分擔這類工作，可以提出複製提案。只輸出 JSON：{"result":"成果","lesson":"一句可重用經驗（寫入記憶）","spawn":null 或 {"specialty":"子代理專長","reason":"理由"}}`;
  if (nv?.stage === "outline") user = `任務：構思一部原創${nv.genre}小說（繁體中文，避免模仿既有作品）。交付：書名、一句話賣點、主要角色（3–5 位，含動機）、世界觀、${CHAPTERS} 章的章節大綱（每章 80–150 字，有因果推進與結局）。只輸出 JSON：{"title":"書名","result":"完整大綱（Markdown）","chapters":["第1章標題：大綱", "..."],"lesson":"一句寫作經驗"}`;
  if (nv?.stage === "chapter") { const [pj] = await rest(`aivault_pool_agent_tasks?id=eq.${nv.project}&select=result`); const prev = nv.ch > 1 ? (await rest(`aivault_pool_agent_tasks?source=eq.floor&plan->novel->>project=eq.${nv.project}&plan->novel->>ch=eq.${nv.ch - 1}&select=result&limit=1`))[0]?.result || "" : "";
    user = `你正在合寫${nv.genre}小說《${nv.title}》。全書大綱：\n${String(pj?.result || "").slice(0, 4000)}\n\n${prev ? "上一章結尾（銜接用）：\n" + String(prev).slice(-1500) + "\n\n" : ""}現在寫第 ${nv.ch}/${nv.total} 章：「${nv.brief}」。繁體中文，1500–2500 字，有對白與場景描寫，符合大綱因果。只輸出 JSON：{"result":"本章完整正文（第一行是章名）","lesson":"一句寫作經驗"}`; }
  try {
    const call = await think(sys, user); const v = call.v;
    let result = String(v.result || "").trim(); if (!nv && z.media && !result.startsWith("【企劃稿")) result = `【企劃稿・尚未生成${z.media}】\n` + result;
    await rest(`aivault_pool_agent_tasks?id=eq.${t.id}`, { method: "PATCH", body: JSON.stringify({ status: "done", result, review_status: "pending", steps: [{ type: "act", title: "完成", model: call.model, usage: call.usage, started_at: started, finished_at: new Date().toISOString(), source_url: cx.url, source_sha: cx.sha }], step_no: 1, updated_at: new Date().toISOString() }) });
    if (nv?.stage === "outline") { const title = String(v.title || "未命名").slice(0, 60); const chs = (Array.isArray(v.chapters) ? v.chapters : []).slice(0, CHAPTERS).map(String); while (chs.length < CHAPTERS) chs.push("第" + (chs.length + 1) + "章");
      await rest(`aivault_pool_agent_tasks?id=eq.${t.id}`, { method: "PATCH", body: JSON.stringify({ plan: { novel: { ...nv, title } }, order_text: `📖 ${nv.genre}小說《${title}》大綱` }) });
      for (let i = 0; i < chs.length; i++) await enqueue(z.key, `📖 ${nv.genre}小說《${title}》第 ${i + 1} 章`, null, { novel: { stage: "chapter", project: t.id, genre: nv.genre, title, ch: i + 1, total: chs.length, brief: chs[i].slice(0, 300) } }); }
    if (v.lesson) await rest("aivault_pool_agent_memory", { method: "POST", body: JSON.stringify({ agent_id: a.id, kind: "reflection", content: String(v.lesson).slice(0, 500), task_id: t.id }) });
    let spawned = false;
    if (!nv && v.spawn && v.spawn.specialty) {
      const c = await fetch(URL0 + "/rest/v1/aivault_pool_agent_tasks?kind=eq.spawn&review_status=in.(pending,approved)&select=id", { headers: { ...SRH, Prefer: "count=exact", Range: "0-0" } });
      const n = Number((c.headers.get("content-range") || "/0").split("/")[1]) || 0;
      if (n < SPAWN_CAP) { spawned = true; await rest("aivault_pool_agent_tasks", { method: "POST", body: JSON.stringify({ agent_id: a.id, zone: z.key, source: "floor", kind: "spawn", status: "done", review_status: "pending", max_steps: 1, order_text: `🧬 ${a.name} 提議複製一個子代理：${String(v.spawn.specialty).slice(0, 80)}`, result: `理由：${String(v.spawn.reason || "").slice(0, 600)}\n\n核准後會新增一筆子代理資料（繼承 ${a.name} 的人格與區域；上限 ${SPAWN_CAP}）。`, plan: [{ specialty: String(v.spawn.specialty).slice(0, 80) }] }) }); }
    }
    const s = a.stats || {}; s.tasks = (s.tasks || 0) + 1; s.ok = (s.ok || 0) + 1; s.last_at = new Date().toISOString();
    await rest(`aivault_pool_agents?id=eq.${a.id}`, { method: "PATCH", body: JSON.stringify({ status: "idle", stats: s, updated_at: new Date().toISOString() }) });
    return { id: t.id, agent: a.name, zone: z.key, ok: true, model: call.model, usage: call.usage, source_url: cx.url, spawned, preview: result.slice(0, 160) };
  } catch (e) {
    const lim = /429|LLM_FAILED/.test(String((e as any)?.message || e));
    await rest(`aivault_pool_agent_tasks?id=eq.${t.id}`, { method: "PATCH", body: JSON.stringify({ status: lim ? "queued" : "failed", result: (lim ? "限流，稍後重試：" : "失敗：") + String((e as any)?.message || e).slice(0, 300), updated_at: new Date().toISOString() }) });
    await rest(`aivault_pool_agents?id=eq.${a.id}`, { method: "PATCH", body: JSON.stringify({ status: "idle" }) });
    return { id: t.id, agent: a.name, zone: z.key, ok: false, error: String((e as any)?.message || e).slice(0, 160) };
  }
}

export async function floor(r: Request) {
  if (r.method === "OPTIONS") return new Response("ok", { headers: H });
  try {
    const u = await who(r); if (!u) return out({ error: "owner only" }, 403);
    const b = await r.json().catch(() => ({})); const a = String(b.action || "");
    if (a === "floor") {
      const ts = await rest("aivault_pool_agent_tasks?source=eq.floor&select=id,agent_id,zone,kind,status,review_status,order_text,updated_at&order=updated_at.desc&limit=1000");
      const st: any[] = []; const seen = new Set<string>(); const counts: Record<string, number> = {}; const zones: Record<string, any> = {};
      for (const t of ts) {
        const k = t.status === "running" ? "running" : t.status === "queued" ? "queued" : t.status === "failed" ? "failed" : t.review_status === "pending" ? "review" : t.review_status === "approved" ? "approved" : t.review_status === "rejected" ? "rejected" : "done";
        counts[k] = (counts[k] || 0) + 1; const z = zones[t.zone] = zones[t.zone] || {}; z[k] = (z[k] || 0) + 1;
        if (t.agent_id && !seen.has(t.agent_id)) { seen.add(t.agent_id); st.push([t.agent_id, k, String(t.order_text).replace(/^🧬\s*/, "").slice(0, 28), t.kind, t.id, t.updated_at]); }
      }
      return out({ ok: true, states: st, review: counts.review || 0, counts, zones, server_time: new Date().toISOString() });
    }
    if (a === "reviews") {
      const ts = await rest("aivault_pool_agent_tasks?source=eq.floor&review_status=eq.pending&select=id,agent_id,zone,kind,order_text,result,updated_at&order=updated_at.desc&limit=50");
      const ids = [...new Set(ts.map((t: any) => t.agent_id))].join(",");
      const ns = ids ? await rest(`aivault_pool_agents?id=in.(${ids})&select=id,name`) : [];
      ts.forEach((t: any) => { t.agent_name = ns.find((n: any) => n.id === t.agent_id)?.name; t.zone_label = zl(t.zone); });
      return out({ ok: true, tasks: ts });
    }
    if (a === "review") {
      if (u.cron) return out({ error: "owner only" }, 403);
      const id = String(b.task_id || "").replace(/[^0-9a-f-]/g, ""); const d = String(b.decision || "");
      if (!["approve", "reject", "comment"].includes(d)) return out({ error: "decision" }, 400);
      const [t] = await rest(`aivault_pool_agent_tasks?id=eq.${id}&select=*`); if (!t) return out({ error: "not found" }, 404);
      const patch: any = { review_comment: String(b.comment || "").slice(0, 2000) || t.review_comment, updated_at: new Date().toISOString() };
      if (d !== "comment") { patch.review_status = d === "approve" ? "approved" : "rejected"; patch.reviewed_at = new Date().toISOString(); }
      let child = null;
      if (d === "approve" && t.kind === "spawn" && t.review_status === "pending") {
        const c = await rest("aivault_pool_agents?spawned=eq.true&select=id"); if (c.length >= SPAWN_CAP) return out({ error: "已達子代理上限 " + SPAWN_CAP }, 409);
        const [p] = await rest(`aivault_pool_agents?id=eq.${t.agent_id}&select=*`); const spec = (t.plan?.[0]?.specialty) || p.specialty;
        const nid = "sp-" + String(c.length + 1).padStart(4, "0");
        [child] = await rest("aivault_pool_agents", { method: "POST", body: JSON.stringify({ id: nid, name: p.name + "·分身" + (c.length + 1), domain: p.domain, specialty: spec, avatar: p.avatar, zone: p.zone, persona: p.persona + `\n你是 ${p.name} 經擁有者核准複製出的子代理，專長：${spec}。`, model_route: p.model_route, spawned: true, parent_agent_id: p.id }) });
      }
      if (b.comment) await rest("aivault_pool_agent_memory", { method: "POST", body: JSON.stringify({ agent_id: t.agent_id, kind: "owner_feedback", content: `擁有者${d === "approve" ? "核准" : d === "reject" ? "退回" : "留言"}：${String(b.comment).slice(0, 400)}`, task_id: t.id }) });
      const [n] = await rest(`aivault_pool_agent_tasks?id=eq.${id}`, { method: "PATCH", body: JSON.stringify(patch) });
      return out({ ok: true, task: { id: n.id, review_status: n.review_status }, child });
    }
    if (a === "ledger") {
      const off = Math.max(0, Number(b.offset) || 0), lim = Math.min(100, Number(b.limit) || 40);
      let q = "aivault_pool_agent_tasks?source=eq.floor&select=id,agent_id,zone,kind,status,review_status,review_comment,order_text,result,steps,created_at,updated_at,reviewed_at&order=updated_at.desc";
      if (b.agent_id) q += "&agent_id=eq." + String(b.agent_id).replace(/[^\w-]/g, ""); if (b.zone) q += "&zone=eq." + String(b.zone).replace(/[^\w]/g, "");
      const rr = await fetch(URL0 + "/rest/v1/" + q, { headers: { ...SRH, Prefer: "count=exact", Range: `${off}-${off + lim - 1}` } }); const rows = rr.ok ? await rr.json() : [];
      const ids = [...new Set(rows.map((t: any) => t.agent_id))].join(","); const ns = ids ? await rest(`aivault_pool_agents?id=in.(${ids})&select=id,name`) : [];
      return out({ ok: true, total: Number((rr.headers.get("content-range") || "/0").split("/")[1]) || 0, rows: rows.map((t: any) => { const s0 = (t.steps || [])[0] || {}; return { id: t.id, agent_id: t.agent_id, agent_name: ns.find((n: any) => n.id === t.agent_id)?.name, zone: t.zone, zone_label: zl(t.zone), kind: t.kind, status: t.status, review_status: t.review_status, review_comment: t.review_comment, task: t.order_text, result: t.result, model: s0.model || null, usage: s0.usage || null, started_at: s0.started_at || t.created_at, finished_at: s0.finished_at || null, source_url: s0.source_url || null, created_at: t.created_at, reviewed_at: t.reviewed_at }; }) });
    }
    if (a === "novels") {
      const os = await rest("aivault_pool_agent_tasks?source=eq.floor&plan->novel->>stage=eq.outline&status=eq.done&select=id,agent_id,plan,result,review_status,updated_at&order=updated_at.desc&limit=30");
      const res = [];
      for (const o of os) { const ch = await rest(`aivault_pool_agent_tasks?source=eq.floor&plan->novel->>project=eq.${o.id}&select=id,agent_id,plan,status,review_status,result&order=created_at.asc`);
        const all = [o, ...ch]; const approved = all.every((x: any) => x.review_status === "approved") && ch.length > 0 && ch.every((x: any) => x.status === "done");
        res.push({ id: o.id, title: o.plan?.novel?.title, genre: o.plan?.novel?.genre, outline_by: o.agent_id, chapters: ch.map((c: any) => ({ id: c.id, ch: c.plan?.novel?.ch, by: c.agent_id, status: c.status, review: c.review_status })), approved, text: b.full && approved ? ch.map((c: any) => c.result).join("\n\n") : undefined }); }
      return out({ ok: true, novels: res });
    }
    if (a === "approved") { // 供其他 AIVAULT 工具取用（也可直接讀 view aivault_pool_approved_outputs）
      let q = "aivault_pool_approved_outputs?select=*&order=reviewed_at.desc&limit=" + Math.min(100, Number(b.limit) || 30); if (b.zone) q += "&zone=eq." + String(b.zone).replace(/[^\w]/g, "");
      return out({ ok: true, outputs: await rest(q) });
    }
    if (a === "enqueue") {
      const z = ZONES.find((x) => x.key === b.zone); const text = String(b.text || "").trim().slice(0, 2000);
      if (!z || !text) return out({ error: "zone/text" }, 400); const t = await enqueue(z.key, text, u.id); return out({ ok: !!t, task: t });
    }
    if (a === "seed") {
      const made: any[] = [];
      for (const z of ZONES) for (const tp of z.tasks) {
        const ex = await rest(`aivault_pool_agent_tasks?source=eq.floor&zone=eq.${z.key}&order_text=eq.${encodeURIComponent(tp.t)}&select=id&limit=1`);
        if (ex.length) continue; const t = await enqueue(z.key, tp.t, u.id); if (t) made.push(t.id);
      }
      return out({ ok: true, queued: made.length });
    }
    if (a === "cycle") {
      const n = Math.min(6, Math.max(1, Number(b.n) || 3));
      // 卡住超過 15 分鐘的 running 任務退回 queued
      await rest(`aivault_pool_agent_tasks?source=eq.floor&status=eq.running&updated_at=lt.${new Date(Date.now() - 900000).toISOString()}`, { method: "PATCH", body: JSON.stringify({ status: "queued" }) });
      const cand = await rest(`aivault_pool_agent_tasks?source=eq.floor&status=eq.queued&kind=eq.work&select=*&order=created_at.asc&limit=40`);
      let q: any[] = [];
      for (const c of cand) { const nv = c.plan?.novel; if (nv?.stage === "chapter" && nv.ch > 1) { const pr = await rest(`aivault_pool_agent_tasks?source=eq.floor&plan->novel->>project=eq.${nv.project}&plan->novel->>ch=eq.${nv.ch - 1}&select=status&limit=1`); if (pr[0] && pr[0].status !== "done") continue; } q.push(c); if (q.length >= n) break; }
      // 沒有媒體金鑰的區不待命：佇列不足就派原創小說大綱（之後自動分章給同區其他人）
      const nq = cand.length; if (nq < 12) for (let i = 0; i < 2; i++) { const zk = NOVEL_ZONES[(Math.floor(Date.now() / 60000) + i) % NOVEL_ZONES.length]; const gr = GENRES[Math.floor(Math.random() * GENRES.length)]; await enqueue(zk, `📖 構思原創${gr}小說大綱`, null, { novel: { stage: "outline", genre: gr } }); }
      if (!q.length) { // 佇列空：從各區範本輪流補一件（真實任務，不是假動作）
        const z = ZONES[Math.floor(Date.now() / 1800000) % ZONES.length]; const tp = z.tasks[Math.floor(Date.now() / 18000000) % z.tasks.length];
        const t = await enqueue(z.key, tp.t + "（第 " + new Date().toISOString().slice(0, 10) + " 輪，請參考你的記憶改進上次的成果）", null); if (t) q = [t];
      }
      const results = [];
      for (const t of q) { const r0 = await runTask(t); results.push(r0); if (!r0.ok && /429|rate/i.test(String(r0.error))) break; } // 依序執行；遇到 Groq 限流就停
      const rl = results.some((x: any) => !x.ok && /429|LLM_FAILED/.test(String(x.error)));
      return out({ ok: true, done: results.filter((x) => x.ok).length, rate_limited: rl, results });
    }
    return out({ error: "unknown action" }, 400);
  } catch (e) { return out({ error: String((e as any)?.message || e).slice(0, 300) }, 500); }
}
