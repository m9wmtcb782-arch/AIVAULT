// ?feature=yinxu：因序小說（編譯管線＝暗星統籌、劇情導演、語音快取）。
// 製作（ebooks/compile_*）限 owner/admin；閱讀（list/get/direct/tts/novelize）限登入者；不輸出任何金鑰。
import { ttsGemini, GeminiQuotaError } from "../aivault-tts/gemini.ts";
const H = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", "Content-Type": "application/json" };
const out = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: H });
const URL0 = Deno.env.get("SUPABASE_URL") || "", SR = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const KEYS = () => ["GEMINI_API_KEY", ...Array.from({ length: 9 }, (_, i) => "GEMINI_API_KEY_" + (i + 1)), "GOOGLE_API_KEY"].map((n) => Deno.env.get(n) || "").filter((v, i, a) => v && a.indexOf(v) === i);
let keyIdx = 0;
const GKEY = () => { const k = KEYS(); return k.length ? k[keyIdx % k.length] : ""; };
const BUCKET = "yinxu";
const SRH = { apikey: SR, Authorization: "Bearer " + SR };

/* ---------- storage ---------- */
let bucketOk = false;
async function ensureBucket() {
  if (bucketOk) return;
  const r = await fetch(URL0 + "/storage/v1/bucket/" + BUCKET, { headers: SRH });
  if (!r.ok) await fetch(URL0 + "/storage/v1/bucket", { method: "POST", headers: { ...SRH, "Content-Type": "application/json" }, body: JSON.stringify({ id: BUCKET, name: BUCKET, public: false }) });
  bucketOk = true;
}
async function put(path: string, body: BodyInit, type = "application/json") {
  await ensureBucket();
  const r = await fetch(`${URL0}/storage/v1/object/${BUCKET}/${path}`, { method: "POST", headers: { ...SRH, "Content-Type": type, "x-upsert": "true" }, body });
  if (!r.ok) throw new Error("STORAGE_PUT_" + r.status);
}
async function getJSON(path: string): Promise<any> {
  const r = await fetch(`${URL0}/storage/v1/object/${BUCKET}/${path}`, { headers: SRH });
  if (!r.ok) return null; return await r.json().catch(() => null);
}
async function exists(path: string) { const r = await fetch(`${URL0}/storage/v1/object/info/${BUCKET}/${path}`, { headers: SRH }); return r.ok; }
async function sign(paths: string[], sec = 86400 * 7): Promise<Record<string, string>> {
  const m: Record<string, string> = {}; if (!paths.length) return m;
  for (let i = 0; i < paths.length; i += 200) {
    const r = await fetch(`${URL0}/storage/v1/object/sign/${BUCKET}`, { method: "POST", headers: { ...SRH, "Content-Type": "application/json" }, body: JSON.stringify({ expiresIn: sec, paths: paths.slice(i, i + 200) }) });
    const a = r.ok ? await r.json() : [];
    for (const x of a || []) if (x.signedURL) m[x.path] = (String(x.signedURL).startsWith("http") ? "" : URL0 + "/storage/v1") + x.signedURL;
  }
  return m;
}
async function sha(s: string) { const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)); return Array.from(new Uint8Array(d)).map((x) => x.toString(16).padStart(2, "0")).join("").slice(0, 32); }

/* ---------- LLM（Gemini 直連；較強模型優先，失敗依序退回） ---------- */
let modelList: string[] | null = null;
async function models(): Promise<string[]> {
  if (modelList) return modelList;
  const want = (Deno.env.get("YINXU_MODELS") || "gemini-2.5-pro,gemini-3.6-pro,gemini-3.6-flash,gemini-2.5-flash").split(",");
  let have: string[] = [];
  try { const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=200", { headers: { "x-goog-api-key": GKEY() } }); const j = await r.json(); have = (j.models || []).map((m: any) => String(m.name).replace(/^models\//, "")); } catch { /* ignore */ }
  modelList = have.length ? want.filter((m) => have.includes(m)) : want;
  if (!modelList.length) modelList = have.filter((m) => /^gemini-[0-9.]+-(pro|flash)$/.test(m)).sort().reverse().slice(0, 3);
  return modelList;
}
export async function llm(system: string, user: string, opts: { maxTokens?: number; fast?: boolean; skipGemini?: boolean } = {}): Promise<any> {
  const ms = opts.skipGemini ? [] : await models(); const order = opts.fast ? [...ms].reverse() : ms; let last = "";
  for (let ki = 0; ki < Math.max(1, KEYS().length); ki++, keyIdx++) for (const m of order) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`, {
        method: "POST", headers: { "x-goog-api-key": GKEY(), "Content-Type": "application/json" }, signal: AbortSignal.timeout(110000),
        body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents: [{ role: "user", parts: [{ text: user }] }], generationConfig: { responseMimeType: "application/json", temperature: 0.9, maxOutputTokens: opts.maxTokens || 8192 } }),
      });
      if (r.status === 404 && modelList) modelList = modelList.filter((x) => x !== m);
      if (!r.ok) { last += " " + m + ":" + r.status + ":" + (await r.text()).slice(0, 100).replace(/\s+/g, " "); continue; }
      const j = await r.json(); const t = (j.candidates?.[0]?.content?.parts || []).map((p: any) => p.text || "").join("");
      const mm = t.match(/\{[\s\S]*\}/); if (!mm) { last += " " + m + ":nojson(" + (j.candidates?.[0]?.finishReason || "") + "," + t.length + ")"; continue; }
      try { const v = JSON.parse(mm[0]); v.__model = m; return v; } catch { last += " " + m + ":badjson(" + (j.candidates?.[0]?.finishReason || "") + "," + t.length + ")"; continue; }
    } catch (e) { last += " " + m + ":" + String((e as any)?.message || e).slice(0, 60); }
  }
  // OpenAI 相容供應商（Grok 較強優先，Groq 次之；多金鑰）
  const envs = (base: string) => [base, ...Array.from({ length: 9 }, (_, i) => base + "_" + (i + 1))].map((n) => Deno.env.get(n) || "").filter((v, i, a) => v && a.indexOf(v) === i);
  const provs = [
    ...[...envs("XAI_API_KEY"), ...envs("GROK_API_KEY")].map((k) => ({ n: "grok", url: "https://api.x.ai/v1/chat/completions", k, model: Deno.env.get("YINXU_GROK_MODEL") || "grok-4" })),
    ...envs("GROQ_API_KEY").map((k) => ({ n: "groq", url: "https://api.groq.com/openai/v1/chat/completions", k, model: "openai/gpt-oss-120b" })),
  ];
  for (const p of provs) {
    try {
      const r = await fetch(p.url, { method: "POST", headers: { Authorization: "Bearer " + p.k, "Content-Type": "application/json" }, signal: AbortSignal.timeout(110000),
        body: JSON.stringify({ model: p.model, messages: [{ role: "system", content: system }, { role: "user", content: user }], response_format: { type: "json_object" }, max_tokens: Math.min(opts.maxTokens || 8192, 16000), temperature: 0.9 }) });
      if (!r.ok) { last += ` ${p.n}:${r.status}`; continue; }
      const j = await r.json(); const t = String(j.choices?.[0]?.message?.content || ""); const mm = t.match(/\{[\s\S]*\}/);
      if (!mm) { last += ` ${p.n}:nojson`; continue; }
      try { const v = JSON.parse(mm[0]); v.__model = p.n + ":" + p.model; return v; } catch { last += ` ${p.n}:badjson(${j.choices?.[0]?.finish_reason})`; }
    } catch (e) { last += ` ${p.n}:` + String((e as any)?.message || e).slice(0, 50); }
  }
  try { // 最後退回 ai-gateway（多金鑰／多供應商）
    const r = await fetch(URL0 + "/functions/v1/ai-gateway", { method: "POST", headers: { ...SRH, "Content-Type": "application/json" }, signal: AbortSignal.timeout(110000), body: JSON.stringify({ provider: "gemini", messages: [{ role: "system", content: system }, { role: "user", content: user }] }) });
    const d = await r.json(); const t = String(d.content || d.text || ""); const mm = t.match(/\{[\s\S]*\}/);
    if (mm) { const v = JSON.parse(mm[0]); v.__model = "gateway:" + (d.model || "?"); return v; } last += " | gateway:nojson";
  } catch (e) { last += " | gateway:" + String((e as any)?.message || e).slice(0, 60); }
  throw new Error("LLM_FAILED " + last);
}

/* ---------- 規格第三節硬約束 ---------- */
export const RULES = (ending: string) => [
  `【角色 AI】你知道原小說的最終結局是「${ending}」，但你絕對不可以因為知道這個結局而引導、暗示、或逼迫主角走回原時間線。你只根據當下角色性格與已發生的事件行動。`,
  "【旁白 AI】根據目前已確定的時間線敘事，不要預設未來會回到原結局。",
  "【時間線】已發生的決定不可撤銷，不能重來。",
  "【問主角】直接開放式提問，不要選擇題、不要列選項。",
].join("\n");
const VOICE_POOL: Record<string, string[]> = {
  narrator: ["Sulafat", "Charon", "Sadaltager"], old_male: ["Algenib", "Gacrux", "Rasalgethi"], old_female: ["Gacrux", "Vindemiatrix"],
  child: ["Leda", "Laomedeia", "Achernar"], male: ["Orus", "Fenrir", "Iapetus", "Alnilam", "Umbriel", "Schedar", "Achird", "Zubenelgenubi", "Sadachbia", "Algieba", "Enceladus"],
  female: ["Kore", "Despina", "Aoede", "Callirrhoe", "Autonoe", "Erinome", "Pulcherrima", "Zephyr"], protagonist: ["Puck"],
};
export function assignVoices(chars: any[]) {
  const used = new Set<string>();
  for (const c of chars) {
    const t = c.id === "narrator" ? "narrator" : c.voice_type === "old" ? (c.gender === "female" ? "old_female" : "old_male") : c.voice_type || "male";
    const pool = VOICE_POOL[t] || VOICE_POOL.male; const v = pool.find((x) => !used.has(x)) || [...VOICE_POOL.male, ...VOICE_POOL.female].find((x) => !used.has(x)) || pool[0];
    used.add(v); c.tts_voice = c.tts_voice || v;
    c.tts_style = c.tts_style || ({ narrator: "Storyteller narrating an audiobook, warm, measured, slight suspense.", old_male: "An old man in his seventies, slow, gravelly, a little stubborn but kind.", old_female: "An elderly woman, slow and gentle.", child: "A nine-year-old child, bright, quick, curious, higher pitch.", female: "A woman speaking naturally, expressive.", male: "A grown man speaking naturally, expressive.", protagonist: "A young man speaking naturally." } as any)[t];
  }
  return chars;
}

/* ---------- 身分 ---------- */
async function me(r: Request) {
  const tok = (r.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!tok || tok.split(".").length !== 3) return null;
  const u = await fetch(URL0 + "/auth/v1/user", { headers: { apikey: SR, Authorization: "Bearer " + tok } }).then((x) => x.ok ? x.json() : null).catch(() => null);
  if (!u?.id) return null; const role = u.app_metadata?.role; return { id: u.id as string, owner: role === "owner" || role === "admin" };
}

/* ---------- 編譯（分段、可續跑） ---------- */
function textPages(t: string) { const a: string[] = []; let buf = ""; for (const p of t.replace(/\r\n/g, "\n").split(/\n{2,}/)) { if ((buf + p).length > 900 && buf) { a.push(buf); buf = ""; } buf += (buf ? "\n\n" : "") + p; } if (buf) a.push(buf); return a; }
const PARSE_SYS = "你是因序小說編譯管線中的「小說解析 AI」，由暗星統籌。從給定小說片段提取資訊，繁體中文，只輸出 JSON：" +
  '{"summary":"本段劇情摘要（150字內）","characters":[{"name":"","gender":"male|female|unknown","age":"child|adult|old","traits":"性格線索","speech":"說話風格"}],"events":["關鍵事件"],"scenes":[{"place":"","mood":"calm|tense|sad|warm|mystery|storm|night|battle"}],"lines_to_protagonist":[{"speaker":"","line":"原文中對主角說的話"}],"protagonist":"推測的主角姓名"}';
async function pagesText(ebook: string, from: number, to: number) {
  const r = await fetch(`${URL0}/rest/v1/dark_star_ebook_pages?select=page_number,content&ebook_id=eq.${ebook}&page_number=gte.${from}&page_number=lte.${to}&order=page_number`, { headers: SRH });
  const a = r.ok ? await r.json() : []; return a.map((p: any) => p.content || "").join("\n");
}
async function compileStep(job: any) {
  if (job.stage === "parse") {
    const to = Math.min(job.total_pages, job.next_page + job.chunk_pages - 1);
    const text = (job.text_pages ? job.text_pages.slice(job.next_page - 1, to).join("\n") : await pagesText(job.ebook_id, job.next_page, to)).slice(0, 60000);
    const known = Object.keys(job.bible.characters).slice(0, 60).join("、");
    const v = await llm(PARSE_SYS, `書名：${job.title}\n已知角色：${known || "（無）"}\n前情：${job.bible.summaries.slice(-3).join(" / ") || "（開頭）"}\n\n片段（第 ${job.next_page}–${to} 頁）：\n${text}`, { maxTokens: 4096, fast: true });
    job.bible.summaries.push(`[p${job.next_page}-${to}] ${v.summary || ""}`);
    for (const c of v.characters || []) { if (!c?.name) continue; const o = job.bible.characters[c.name] || { name: c.name, mentions: 0 }; o.mentions++; o.gender = c.gender || o.gender; o.age = c.age || o.age; o.traits = [o.traits, c.traits].filter(Boolean).join("；").slice(-400); o.speech = c.speech || o.speech; job.bible.characters[c.name] = o; }
    job.bible.events.push(...(v.events || []).slice(0, 8)); job.bible.scenes.push(...(v.scenes || []).slice(0, 4));
    job.bible.lines.push(...(v.lines_to_protagonist || []).slice(0, 6)); if (v.protagonist) job.bible.protagonist_votes[v.protagonist] = (job.bible.protagonist_votes[v.protagonist] || 0) + 1;
    job.log.push(`解析第 ${job.next_page}–${to} 頁（${v.__model}）`); job.next_page = to + 1;
    if (job.next_page > job.total_pages) job.stage = "compose";
    return;
  }
  if (job.stage === "compose") {
    const bb = job.bible; const prot = Object.entries(bb.protagonist_votes).sort((a: any, c: any) => c[1] - a[1])[0]?.[0] || "";
    const cast = Object.values(bb.characters).sort((a: any, c: any) => c.mentions - a.mentions).slice(0, 12);
    const sys = "你是暗星，因序小說編譯協調 AI。整合解析結果，完成：角色分配（每個角色唯一 AI 人格與聲音類型）、音效/背景音樂規劃（依場景情緒）、結局知識封裝（加入不可誘導硬約束）。繁體中文，精簡。只輸出 JSON：" +
      '{"protagonist":{"name":"","voice_type":"male|female"},"opening":"給讀者的開場簡介（80字內，不劇透）","original_ending":"原結局（60字內）","characters":[{"id":"英文小寫id","name":"","voice_type":"male|female|old|child","gender":"male|female","personality":"40字內","speech_style":"20字內"}],"outline":[{"act":1,"title":"","summary":"60字內","mood":"calm|tense|sad|warm|mystery|storm|night|battle","sfx":["waves|rain|wind|fire|footsteps|door|bell|thunder|crowd|birds"],"original_turning_point":"30字內"}]}' +
      "\n主角不要放進 characters。outline 涵蓋全書 4–8 幕。";
    const v = await llm(sys, `書名：${job.title}\n主角推測：${prot}\n角色：${JSON.stringify(cast)}\n各段摘要：\n${bb.summaries.join("\n").slice(-30000)}\n關鍵事件：${bb.events.slice(-60).join("；")}`, { maxTokens: 8000 });
    const chars = [{ id: "narrator", name: "說書人", voice_type: "narrator", personality: "說書人" }, ...(v.characters || []).filter((c: any) => c?.id && c.id !== "narrator")].map((c: any) => ({ ...c, knows_original_ending: c.id !== "narrator", anti_railroad_constraint: true }));
    if (chars.length < 2) throw new Error("COMPOSE_NO_CAST");
    job.package = { book_id: "yx-" + job.ebook_id.slice(-8) + "-" + Date.now().toString(36), source_ebook_id: job.ebook_id, title: job.title, part: 1, compiled_by: "暗星", compiled_at: new Date().toISOString(), model: v.__model,
      protagonist: { id: "__me", ...(v.protagonist || {}), name: v.protagonist?.name || prot || "主角" }, opening: v.opening || "", original_ending: v.original_ending || "", characters: assignVoices(chars), outline: v.outline || [], nodes: [],
      timeline_state: { current_node: 0, decisions: [], irreversible: true }, audio: {} };
    job.stage = "script"; job.log.push(`暗星：角色分配與大綱完成（${chars.length - 1} 角色、${job.package.outline.length} 幕；${v.__model}）`); return;
  }
  if (job.stage === "script") {
    const pkg = job.package; const ids = pkg.characters.map((c: any) => `${c.id}=${c.name}（${c.personality}）`).join("；");
    const sys = "你是因序小說的「旁白腳本生成 AI」與「對話轉問答 AI」。寫開場段落：說書風格旁白 + 角色台詞；凡是原著中對主角說的話，一律改寫成角色直接問讀者（主角）的開放式問題（不要選擇題）。繁體中文，每句 60 字內。只輸出 JSON：" +
      '{"nodes":[{"type":"narrator|character|prompt","speaker":"narrator 或角色 id","text":"","original_answer":"僅 prompt：原著主角怎麼回答","sfx":"可空"}]}' + "\n12–18 個節點，至少 2 個 prompt，最後一個節點必須是 prompt。之後的劇情由執行期導演依讀者回答自由生成。";
    const v = await llm(sys, `書名：${pkg.title}\n主角：${pkg.protagonist.name}（讀者扮演，不可替他說話）\n角色 id：${ids}\n大綱：${JSON.stringify(pkg.outline.slice(0, 3))}\n開頭原文摘要：${job.bible.summaries.slice(0, 2).join("\n")}\n原文中對主角說的話（樣本）：${JSON.stringify(job.bible.lines.slice(0, 12))}`, { maxTokens: 8000 });
    const ok = new Set(pkg.characters.map((c: any) => c.id));
    pkg.nodes = (v.nodes || []).filter((n: any) => n && n.text && ok.has(n.speaker)).map((n: any) => ({ ...n, type: n.speaker === "narrator" ? "narrator" : (n.type === "prompt" || /[？?]\s*$/.test(n.text)) ? "prompt" : "character" }));
    const lastQ = pkg.nodes.map((n: any) => n.type).lastIndexOf("prompt"); if (lastQ >= 0) pkg.nodes = pkg.nodes.slice(0, lastQ + 1);
    if (pkg.nodes.length < 4 || lastQ < 0) throw new Error("SCRIPT_TOO_SHORT");
    job.stage = "publish"; job.log.push(`旁白腳本與問答完成：${pkg.nodes.length} 節點（${v.__model}）`); return;
  }
  if (job.stage === "publish") { await savePackage(job.package); job.stage = "audio"; job.audio_pos = 0; job.log.push("已上架因序小說書架"); return; }
  if (job.stage === "audio") {
    const pkg = job.package; let n = 0;
    while (job.audio_pos < pkg.nodes.length && n < 2) {
      const node = pkg.nodes[job.audio_pos]; const c = pkg.characters.find((x: any) => x.id === node.speaker) || pkg.characters[0];
      try { const key = await ttsCached(node.text, c.tts_voice, c.tts_style); pkg.audio[job.audio_pos] = key; } catch (e) {
        if (e instanceof GeminiQuotaError) { job.retry_after = e.retry_after_seconds; job.log.push(`語音額度用盡（${e.quota_kind}），${e.retry_after_seconds}s 後可續`); await savePackage(pkg); return; }
        job.log.push("語音失敗：" + String((e as any)?.message || e).slice(0, 80));
      }
      job.audio_pos++; n++;
    }
    await savePackage(pkg);
    if (job.audio_pos >= pkg.nodes.length) { job.stage = "done"; job.log.push("固定台詞語音預生成完成"); }
  }
}
async function savePackage(pkg: any) {
  await put(`books/${pkg.book_id}.json`, JSON.stringify(pkg));
  const idx = (await getJSON("index.json")) || { books: [] };
  idx.books = idx.books.filter((b: any) => b.book_id !== pkg.book_id);
  idx.books.unshift({ book_id: pkg.book_id, title: pkg.title, opening: pkg.opening, parent_id: pkg.parent_id || null, part: pkg.part || 1, compiled_at: pkg.compiled_at, cover: pkg.cover || null });
  await put("index.json", JSON.stringify(idx));
}
async function ttsCached(text: string, voice: string, style: string) {
  const key = `audio/${await sha(voice + "|" + style + "|" + text)}.wav`;
  if (await exists(key)) return key;
  const a = await ttsGemini(text.slice(0, 2000), "zh-TW", voice, style);
  await put(key, Uint8Array.from(atob(a.base64), (c) => c.charCodeAt(0)), a.mime); return key;
}

/* ---------- 執行期導演 ---------- */
const DIRECT_SYS = (pkg: any) => "你是因序小說的執行期導演，統籌說書人與各角色 AI，並兼任世界狀態管理與防誘導監督。繁體中文口語。\n" + RULES(pkg.original_ending || "") +
  "\n【理解讀者】先真正理解主角（讀者）剛剛說的話的意圖。不論多出乎意料，都要讓故事依照他的選擇分歧發展，絕對不要因為沒聽懂就照原劇情或原著主角的台詞走。若回答模糊到無法判斷意圖（例如只有「嗯」「不知道」或辨識亂碼），設 understood=false，並由剛才提問的角色用不同說法追問一次以確認（開放式，追問句裡也不可列舉選項）。" +
  "\n【自由生成】依角色性格、世界狀態與全書大綱（僅作背景，不是必經路線）自由生成接下來的場景：先讓角色對主角的回答做出真實反應，再由說書人推進，3–8 句，每句 60 字內，結尾通常由某角色向主角提出一個開放式問題。不要替主角說話。" +
  "\n只輸出 JSON：{\"understood\":true,\"auto_answer\":\"僅 by=auto 時\",\"interpretation\":\"你理解的主角意圖\",\"clarify\":\"若 understood=false：追問句\",\"lines\":[{\"speaker\":\"narrator 或角色 id\",\"text\":\"\",\"sfx\":\"可空：waves|rain|wind|fire|footsteps|door|bell|thunder|crowd|birds\"}],\"mood\":\"calm|tense|sad|warm|mystery|storm|night|battle\",\"prompt\":{\"speaker\":\"角色 id\",\"text\":\"開放式問題\"},\"world\":{\"facts\":[\"新增的不可逆事實\"],\"act\":1},\"ending\":false}" +
  "\n【主角 AI 代答】若標示讀者沉默（by=auto）且沒有回答內容，先在 auto_answer 欄位寫出主角依其性格與處境會說的一句話（不要照搬原著），再依這句話推進劇情。" +
  "\n當主角的選擇已讓故事自然走到一個結局（約 6–10 個回合後），設 ending=true、prompt=null，lines 寫收尾。";
async function direct(b: any) {
  const pkg = b.book || {}; const st = b.state || {};
  const cast = (pkg.characters || []).map((c: any) => `${c.id}=${c.name}（${c.personality || ""}；${c.speech_style || ""}）`).join("\n");
  const user = `書名：${pkg.title}\n主角（讀者扮演，不可替他說話）：${pkg.protagonist?.name || "主角"}\n角色：\n${cast}\n\n全書大綱（背景知識）：${JSON.stringify(pkg.outline || []).slice(0, 12000)}\n\n世界狀態（不可逆事實）：${JSON.stringify(st.facts || [])}\n目前幕：${st.act || 1}　回合：${st.turn || 0}\n已做的決定：${JSON.stringify((st.decisions || []).map((d: any) => ({ q: d.question, a: d.answer, by: d.by })))}\n\n最近發生：\n${String(st.recent || "").slice(-6000)}\n\n剛剛 ${b.asker || "角色"} 問主角：「${b.question || ""}」\n主角回答：「${b.answer || ""}」${b.by === "auto" ? (b.answer ? "（讀者沉默，由主角 AI 代答）" : "（讀者沉默，請先在 auto_answer 寫出主角 AI 的回答）") : ""}${b.clarified ? "（這是追問後的回答，請直接依此推進，不要再追問）" : ""}`;
  return await llm(DIRECT_SYS(pkg), user, { maxTokens: 6000, fast: b.fast !== false });
}

export async function yinxu(r: Request) {
  if (r.method === "OPTIONS") return new Response("ok", { headers: H });
  try {
    const b = await r.json().catch(() => ({})); const a = String(b.action || "");
    const u = await me(r);
    if (!u) return out({ error: "login required", login: false }, 401);
    if (["ebooks", "compile_start", "compile_step", "compile_jobs"].includes(a) && !u.owner) return out({ error: "owner only" }, 403);
    if (a === "ebooks") { const r2 = await fetch(`${URL0}/rest/v1/dark_star_ebooks?select=id,title,author,total_pages,total_characters,created_at&order=created_at.desc&limit=200`, { headers: SRH }); return out({ ok: true, books: await r2.json() }); }
    if (a === "compile_start") {
      let id = String(b.ebook_id || ""), tp: string[] | null = null;
      if (b.text) { tp = textPages(String(b.text).slice(0, 3000000)); id = "00000000-0000-0000-0000-" + (await sha(String(b.text))).slice(0, 12); }
      else if (!/^[0-9a-f-]{36}$/i.test(id)) return out({ error: "ebook_id" }, 400);
      const e = tp ? [{ id, title: String(b.title || "未命名"), total_pages: tp.length }] : await (await fetch(`${URL0}/rest/v1/dark_star_ebooks?select=id,title,total_pages&id=eq.${id}`, { headers: SRH })).json();
      if (!e?.[0]) return out({ error: "BOOK_NOT_FOUND" }, 404);
      const job = { job_id: crypto.randomUUID(), ebook_id: id, title: e[0].title, total_pages: Number(e[0].total_pages) || 1, chunk_pages: Math.min(80, Math.max(5, Number(b.chunk_pages) || 40)), next_page: 1, stage: "parse", created_at: new Date().toISOString(), log: ["暗星：開始編譯《" + e[0].title + "》（" + (Number(e[0].total_pages) || 1) + " 頁）"], text_pages: tp, bible: { characters: {}, summaries: [], events: [], scenes: [], lines: [], protagonist_votes: {} } };
      await put(`jobs/${job.job_id}.json`, JSON.stringify(job)); return out({ ok: true, job: slim(job) });
    }
    if (a === "compile_step") {
      const job = await getJSON(`jobs/${String(b.job_id || "").replace(/[^0-9a-f-]/g, "")}.json`); if (!job) return out({ error: "JOB_NOT_FOUND" }, 404);
      if (job.stage === "done") return out({ ok: true, job: slim(job) });
      job.retry_after = 0;
      try { await compileStep(job); job.error = null; } catch (e) { job.error = String((e as any)?.message || e).slice(0, 200); job.log.push("錯誤：" + job.error + "（可重試，會從這一步續跑）"); }
      job.updated_at = new Date().toISOString(); await put(`jobs/${job.job_id}.json`, JSON.stringify(job)); return out({ ok: true, job: slim(job) });
    }
    if (a === "diag" && u.owner) { modelList = null; return out({ ok: true, keys: KEYS().length, models: await models() }); }
    if (a === "list") { const idx = (await getJSON("index.json")) || { books: [] }; return out({ ok: true, books: idx.books, owner: u.owner }); }
    if (a === "get") {
      const pkg = await getJSON(`books/${String(b.book_id || "").replace(/[^\w-]/g, "")}.json`); if (!pkg) return out({ error: "BOOK_NOT_FOUND" }, 404);
      const keys = Object.values(pkg.audio || {}) as string[]; const s = await sign(keys); pkg.audio_urls = Object.fromEntries(Object.entries(pkg.audio || {}).map(([k, v]) => [k, s[v as string]]));
      return out({ ok: true, book: pkg });
    }
    if (a === "delete_book" && u.owner) { const id = String(b.book_id || "").replace(/[^\w-]/g, ""); const idx = (await getJSON("index.json")) || { books: [] }; idx.books = idx.books.filter((x: any) => x.book_id !== id); await put("index.json", JSON.stringify(idx)); return out({ ok: true }); }
    if (a === "compile_jobs") return out({ ok: true });
    if (a === "save_timeline") { const pkg = b.book; if (!pkg?.book_id || !pkg?.parent_id) return out({ error: "book" }, 400); pkg.book_id = String(pkg.book_id).replace(/[^\w-]/g, "").slice(0, 80); pkg.owner_id = u.id; pkg.audio = {}; await savePackage(pkg); return out({ ok: true }); }
    if (a === "direct") return out({ ok: true, ...(await direct(b)) });
    if (a === "novelize") return out({ ok: true, ...(await llm("你是小說家（遊玩記錄轉新小說 AI）。把互動紀錄整理成完整繁體中文短篇小說（600–1200 字，第三人稱），忠於紀錄中已發生的事，不要改回原結局。只輸出 JSON：{\"title\":\"新標題\",\"story\":\"...\",\"new_ending\":\"新結局一句話\"}", String(b.transcript || "").slice(-20000), { maxTokens: 6000, fast: true })) });
    if (a === "tts") {
      const text = String(b.text || "").trim(); if (!text) return out({ error: "text" }, 400);
      try { const key = await ttsCached(text, String(b.voice || "Sulafat"), String(b.style || "")); const s = await sign([key]); return out({ ok: true, url: s[key] }); }
      catch (e) { if (e instanceof GeminiQuotaError) return out({ ok: false, quota: e.quota_kind, retry_after: e.retry_after_seconds }, 429); throw e; }
    }
    return out({ error: "unknown action" }, 400);
  } catch (e) { return out({ error: String((e as any)?.message || e).slice(0, 300) }, 500); }
}
function slim(j: any) { const { bible, package: p, text_pages, ...rest } = j; return { ...rest, characters_found: Object.keys(bible?.characters || {}).length, book_id: p?.book_id || null, audio_total: p?.nodes?.length || 0, log: j.log.slice(-30) }; }
