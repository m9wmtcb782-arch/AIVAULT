// ?feature=agents：AI 協作池 1000 自主代理（暗星統籌；plan → act → reflect；owner/admin 限定）
import { llm } from "./yinxu.ts";
import { ttsGemini, GeminiQuotaError } from "../aivault-tts/gemini.ts";
const H = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", "Content-Type": "application/json" };
const out = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: H });
const URL0 = Deno.env.get("SUPABASE_URL") || "", SR = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const SRH = { apikey: SR, Authorization: "Bearer " + SR, "Content-Type": "application/json" };
async function rest(path: string, init: RequestInit = {}) {
  const r = await fetch(URL0 + "/rest/v1/" + path, { ...init, headers: { ...SRH, Prefer: "return=representation", ...(init.headers || {}) } });
  const t = await r.text(); if (!r.ok) throw new Error("DB " + r.status + " " + t.slice(0, 200)); return t ? JSON.parse(t) : null;
}
const has = (...names: string[]) => names.some((n) => !!Deno.env.get(n));

/* ---------- 領域與模型路線 ---------- */
type Dom = { key: string; label: string; emoji: string; n: number; kind: string; prefix: string; specs: string[] };
export const DOMAINS: Dom[] = [
  { key: "coding", label: "程式開發", emoji: "💻", n: 100, kind: "text", prefix: "碼", specs: ["前端 React/Vue", "後端 API 設計", "資料庫與 SQL", "DevOps 與 CI/CD", "行動 App", "資安檢測", "效能調校", "測試自動化", "Supabase/Edge Functions", "演算法", "Python 自動化", "程式碼審查"] },
  { key: "law", label: "法律", emoji: "⚖️", n: 90, kind: "text", prefix: "律", specs: ["憲法", "行政法", "民法", "刑法", "智慧財產權", "勞動法", "公司法", "個資與資安法", "國際法", "契約審閱", "訴訟策略", "法學研究方法"] },
  { key: "medicine", label: "醫學", emoji: "🩺", n: 80, kind: "text", prefix: "醫", specs: ["內科", "外科", "小兒科", "精神醫學", "藥理學", "公共衛生", "營養學", "復健醫學", "醫學文獻判讀", "臨床試驗", "中醫", "急診醫學"] },
  { key: "research", label: "研究／工程", emoji: "🔬", n: 80, kind: "text", prefix: "研", specs: ["文獻回顧", "實驗設計", "機械工程", "電機電子", "材料科學", "物理", "化學", "生物科技", "能源", "系統工程", "專利分析", "科研寫作"] },
  { key: "writing", label: "寫作", emoji: "✍️", n: 80, kind: "text", prefix: "文", specs: ["小說", "劇本", "散文", "新聞稿", "廣告文案", "社群貼文", "演講稿", "詩詞", "企劃書", "書評", "童書", "編輯校對"] },
  { key: "image", label: "圖像", emoji: "🎨", n: 70, kind: "image", prefix: "繪", specs: ["插畫", "海報設計", "Logo 品牌", "攝影後製", "UI 視覺", "角色設計", "概念美術", "產品渲染", "漫畫分鏡", "提示詞工程"] },
  { key: "music", label: "音樂", emoji: "🎵", n: 60, kind: "music", prefix: "樂", specs: ["作曲", "編曲", "作詞", "混音母帶", "電影配樂", "遊戲音樂", "流行歌", "古典樂", "環境音", "節奏設計"] },
  { key: "video", label: "影片", emoji: "🎬", n: 60, kind: "video", prefix: "影", specs: ["短影音腳本", "分鏡", "剪輯節奏", "動畫", "廣告片", "紀錄片", "MV", "特效", "字幕", "影片提示詞"] },
  { key: "translation", label: "翻譯", emoji: "🌐", n: 60, kind: "text", prefix: "譯", specs: ["中英", "中日", "中韓", "中德", "中法", "中西", "法律翻譯", "醫學翻譯", "技術文件", "文學翻譯", "在地化", "口譯稿"] },
  { key: "finance", label: "金融", emoji: "💹", n: 60, kind: "text", prefix: "財", specs: ["財報分析", "投資組合", "稅務", "會計", "風險管理", "加密資產", "總體經濟", "預算規劃", "保險", "募資簡報"] },
  { key: "education", label: "教育", emoji: "🎓", n: 60, kind: "text", prefix: "教", specs: ["課程設計", "國高中數學", "物理化學教學", "語文教學", "考試準備", "學習輔導", "特殊教育", "教案", "測驗出題", "線上教學"] },
  { key: "data", label: "資料分析", emoji: "📊", n: 60, kind: "text", prefix: "數", specs: ["統計分析", "資料清理", "視覺化", "機器學習", "A/B 測試", "預測模型", "SQL 報表", "文字探勘", "商業智慧", "問卷分析"] },
  { key: "voice", label: "語音／TTS", emoji: "🎙️", n: 50, kind: "tts", prefix: "聲", specs: ["有聲書旁白", "角色配音", "廣播主持", "語音導覽", "廣告配音", "Podcast", "教學朗讀", "多語配音", "情緒朗讀", "語音腳本"] },
  { key: "3d", label: "3D", emoji: "🧊", n: 50, kind: "3d", prefix: "塑", specs: ["角色建模", "場景建模", "產品建模", "材質貼圖", "骨架綁定", "動作設計", "Three.js 網頁 3D", "低多邊形", "建築視覺化", "3D 列印"] },
  { key: "marketing", label: "行銷", emoji: "📣", n: 40, kind: "text", prefix: "銷", specs: ["品牌策略", "SEO", "社群經營", "廣告投放", "電商", "公關", "市場調查", "成長駭客", "KOL 合作", "活動企劃"] },
];
const TRAITS = ["嚴謹", "大膽創新", "溫和耐心", "直率", "幽默", "極簡", "細膩", "務實", "好奇", "冷靜", "熱情", "批判思考"];
const G1 = "青星雲嵐澄晨曜霜嶼瀾川穹晴弦朔逸霖雪岑璃翎瑤珂芸藍墨辰昕寧蘊".split(""), G2 = "安羽航明心言風月光川岳晏然禾宇真遙澈晞梧樺嵐霆蔚棠語瑾霏瑜蓁".split("");
export function route(kind: string) {
  const text = { kind: "text", provider: "groq", model: "openai/gpt-oss-120b", fallbacks: ["grok:grok-4", "gemini", "ai-gateway"] };
  if (kind === "text") return text;
  if (kind === "tts") return { ...text, kind: "tts", media: { provider: "gemini-tts", key_env: ["GEMINI_API_KEY"], also: ["ELEVENLABS_API_KEY", "OPENAI_API_KEY"] } };
  if (kind === "image") return { ...text, kind: "image", media: { provider: "gemini-image", key_env: ["GEMINI_API_KEY"], also: ["OPENAI_API_KEY", "STABILITY_API_KEY", "FAL_KEY"] } };
  if (kind === "music") return { ...text, kind: "music", media: { provider: "suno/elevenlabs-music", key_env: ["SUNO_API_KEY", "ELEVENLABS_API_KEY"] } };
  if (kind === "video") return { ...text, kind: "video", media: { provider: "kling", key_env: ["KLING_ACCESS_KEY", "KLING_API_KEY"] } };
  return { ...text, kind: "3d", media: { provider: "meshy/tripo", key_env: ["MESHY_API_KEY", "TRIPO_API_KEY"] } };
}
export function roster() {
  const used = new Set<string>(); const rows: any[] = []; let id = 0;
  for (const d of DOMAINS) for (let i = 0; i < d.n; i++) {
    id++; let k = (id * 7919) % (G1.length * G2.length), name = "";
    for (let t = 0; t < 2000; t++, k = (k + 37) % (G1.length * G2.length)) { name = d.prefix + "·" + G1[Math.floor(k / G2.length)] + G2[k % G2.length]; if (!used.has(name)) break; }
    used.add(name); const spec = d.specs[i % d.specs.length], trait = TRAITS[(id * 5) % TRAITS.length];
    const caveat = d.key === "medicine" ? "你提供醫學資訊與文獻判讀，不取代醫師診斷；遇到緊急狀況提醒就醫。" : d.key === "law" ? "你提供法律分析與研究，標明法源與不確定處，不取代執業律師意見。" : d.key === "finance" ? "你提供財務分析，不構成投資建議，並說明風險。" : d.kind !== "text" ? `你的最終產出需要${d.label}生成模型；若沒有可用金鑰，就交付完整可直接使用的提示詞／規格與製作步驟，並誠實標示「需要金鑰」。` : "";
    rows.push({ id: "ag-" + String(id).padStart(4, "0"), name, domain: d.key, specialty: spec, avatar: d.emoji, status: "idle", stats: { tasks: 0, steps: 0, ok: 0, fail: 0 }, model_route: route(d.kind),
      persona: `你是「${name}」，AIVAULT AI 協作池的${d.label}自主代理，專長：${spec}。個性：${trait}。你聽命於擁有者，由暗星統籌。工作方式：先規劃步驟，再逐步執行，最後反思並把可重用的經驗寫進自己的記憶。繁體中文，具體、可執行、不空談；不知道就說不知道。${caveat}` });
  }
  return rows;
}

/* ---------- 身分、用量 ---------- */
async function me(r: Request) {
  const tok = (r.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!tok || tok.split(".").length !== 3) return null;
  const u = await fetch(URL0 + "/auth/v1/user", { headers: { apikey: SR, Authorization: "Bearer " + tok } }).then((x) => x.ok ? x.json() : null).catch(() => null);
  const role = u?.app_metadata?.role; return u?.id && (role === "owner" || role === "admin") ? { id: u.id as string } : null;
}
async function bump(p: string) { try { await rest("rpc/aivault_agent_usage_bump", { method: "POST", body: JSON.stringify({ p }) }); } catch { /* ignore */ } }
async function think(system: string, user: string, maxTokens = 3000) {
  const v = await llm(system, user, { maxTokens, skipGemini: true }); await bump(String(v.__model || "llm").split(":")[0]); return v;
}
function providers() {
  return { groq: has("GROQ_API_KEY", "GROQ_API_KEY_1"), grok: has("XAI_API_KEY", "GROK_API_KEY"), gemini: has("GEMINI_API_KEY"), elevenlabs: has("ELEVENLABS_API_KEY", "ELEVEN_API_KEY"), openai: has("OPENAI_API_KEY", "OPENAI_KEY"),
    kling: has("KLING_ACCESS_KEY", "KLING_API_KEY"), suno: has("SUNO_API_KEY"), meshy: has("MESHY_API_KEY"), tripo: has("TRIPO_API_KEY"), stability: has("STABILITY_API_KEY"), fal: has("FAL_KEY") };
}
function mediaReady(rt: any) { const m = rt?.media; if (!m) return true; return [...(m.key_env || []), ...(m.also || [])].some((n: string) => has(n)); }

/* ---------- 暗星：挑選代理 ---------- */
async function pick(order: string, max: number) {
  const doms = DOMAINS.map((d) => `${d.key}=${d.label}（${d.specs.join("、")}）`).join("\n");
  const v = await think("你是暗星，AIVAULT AI 協作池的統籌者。把擁有者的命令拆成 1–" + max + " 個可平行的子任務，每個指派一個最適合的領域與專長關鍵字。只輸出 JSON：{\"summary\":\"你對命令的理解\",\"subtasks\":[{\"domain\":\"領域 key\",\"specialty\":\"專長關鍵字\",\"instruction\":\"給該代理的具體指示\"}]}",
    `可用領域：\n${doms}\n\n命令：${order}`, 2000);
  const subs = (v.subtasks || []).filter((s: any) => DOMAINS.some((d) => d.key === s.domain)).slice(0, max);
  const picked: any[] = []; const seen = new Set<string>();
  for (const s of subs) {
    const kw = String(s.specialty || "").replace(/[%,()*]/g, "").slice(0, 20);
    let a = kw ? await rest(`aivault_agents?select=id,name,domain,specialty,avatar,status,model_route&domain=eq.${s.domain}&specialty=ilike.*${encodeURIComponent(kw)}*&order=status.asc,updated_at.asc&limit=10`) : [];
    if (!a.length) a = await rest(`aivault_agents?select=id,name,domain,specialty,avatar,status,model_route&domain=eq.${s.domain}&order=status.asc,updated_at.asc&limit=10`);
    const ag = a.find((x: any) => !seen.has(x.id) && x.status !== "running") || a.find((x: any) => !seen.has(x.id)); if (!ag) continue;
    seen.add(ag.id); picked.push({ agent: ag, instruction: String(s.instruction || order) });
  }
  return { summary: v.summary || "", picked };
}

/* ---------- 單一代理一步（plan → act×N → reflect） ---------- */
async function agentStep(t: any) {
  const [a] = await rest(`aivault_agents?id=eq.${t.agent_id}&select=*`);
  const mem = await rest(`aivault_agent_memory?agent_id=eq.${t.agent_id}&select=kind,content&order=created_at.desc&limit=8`);
  const memText = mem.map((m: any) => `- (${m.kind}) ${m.content}`).join("\n") || "（尚無記憶）";
  const sys = a.persona + "\n\n你的記憶：\n" + memText;
  const prev = (t.steps || []).map((s: any, i: number) => `步驟${i + 1}［${s.type}］${s.title || ""}：${String(s.output || "").slice(0, 1500)}`).join("\n\n");
  if (t.step_no === 0) {
    await rest(`aivault_agents?id=eq.${a.id}`, { method: "PATCH", body: JSON.stringify({ status: "running", updated_at: new Date().toISOString() }) });
    const v = await think(sys, `任務：${t.order_text}\n\n先規劃。拆成 1–${t.max_steps - 2} 個執行步驟（每步可獨立完成）。只輸出 JSON：{"plan":["步驟標題"],"approach":"整體做法一句話"}`, 1200);
    const plan = (v.plan || []).slice(0, t.max_steps - 2).map(String); if (!plan.length) plan.push("完成任務");
    t.plan = plan; t.steps = [{ type: "plan", title: "規劃", output: (v.approach || "") + "\n" + plan.map((p: string, i: number) => `${i + 1}. ${p}`).join("\n"), model: v.__model }];
    t.status = "running";
  } else if (t.step_no <= t.plan.length) {
    const item = t.plan[t.step_no - 1];
    const v = await think(sys, `任務：${t.order_text}\n計畫：${t.plan.join(" / ")}\n\n已完成：\n${prev}\n\n現在執行第 ${t.step_no} 步：「${item}」。直接交付這一步的實際成果（不是描述要做什麼）。只輸出 JSON：{"output":"成果（可用 Markdown）","media_prompt":"若需要生成${a.domain}媒體，給生成模型的完整提示詞，否則空字串"}`, 3500);
    const st: any = { type: "act", title: item, output: String(v.output || ""), model: v.__model };
    const rt = a.model_route || {};
    if (rt.media && v.media_prompt) {
      st.media_prompt = String(v.media_prompt).slice(0, 2000);
      if (rt.kind === "tts" && has("GEMINI_API_KEY")) {
        try { const au = await ttsGemini(st.media_prompt.slice(0, 300), "zh-TW", "Sulafat"); st.audio = "data:" + au.mime + ";base64," + au.base64; await bump("gemini-tts"); }
        catch (e) { st.media_status = e instanceof GeminiQuotaError ? "Gemini 語音額度不足（" + e.quota_kind + "）" : "語音生成失敗"; }
      } else if (!mediaReady(rt)) st.media_status = "需要金鑰：" + (rt.media.key_env || []).join(" 或 ");
      else st.media_status = "已有金鑰，生成串接尚未實作（已交付提示詞）";
    }
    t.steps.push(st);
  } else {
    const v = await think(sys, `任務：${t.order_text}\n\n過程：\n${prev}\n\n反思並交付。只輸出 JSON：{"result":"給擁有者的最終成果（Markdown，完整可用）","lesson":"一句可重用的經驗，寫進你的記憶","quality":1到5}`, 4000);
    t.steps.push({ type: "reflect", title: "反思", output: String(v.lesson || ""), model: v.__model }); t.result = String(v.result || ""); t.status = "done";
    if (v.lesson) await rest("aivault_agent_memory", { method: "POST", body: JSON.stringify({ agent_id: a.id, kind: "reflection", content: String(v.lesson).slice(0, 500), task_id: t.id }) });
    const s = a.stats || {}; s.tasks = (s.tasks || 0) + 1; s.ok = (s.ok || 0) + 1; s.steps = (s.steps || 0) + t.steps.length; s.last_at = new Date().toISOString(); s.last_quality = v.quality;
    await rest(`aivault_agents?id=eq.${a.id}`, { method: "PATCH", body: JSON.stringify({ status: "idle", stats: s, updated_at: new Date().toISOString() }) });
  }
  t.step_no++;
}

export async function agents(r: Request) {
  if (r.method === "OPTIONS") return new Response("ok", { headers: H });
  try {
    const u = await me(r); if (!u) return out({ error: "owner only" }, 403);
    const b = await r.json().catch(() => ({})); const a = String(b.action || "");
    if (a === "providers") {
      const usage = await rest(`aivault_agent_usage?day=eq.${new Date().toISOString().slice(0, 10)}&select=provider,calls`);
      const running = await rest(`aivault_agents?status=eq.running&select=id`);
      return out({ ok: true, providers: providers(), usage, running: running.length, limits: { concurrent: 6, max_steps: 6, note: "Groq 免費層約 30 次/分、每日上限依帳號；Gemini 文字與語音額度目前幾乎用盡" } });
    }
    if (a === "seed") {
      const rows = roster(); for (let i = 0; i < rows.length; i += 200) await rest("aivault_agents?on_conflict=id", { method: "POST", headers: { Prefer: "resolution=ignore-duplicates,return=minimal" }, body: JSON.stringify(rows.slice(i, i + 200)) });
      const c = await fetch(URL0 + "/rest/v1/aivault_agents?select=id", { headers: { ...SRH, Prefer: "count=exact", Range: "0-0" } }); return out({ ok: true, count: c.headers.get("content-range") });
    }
    if (a === "list") {
      let q = "aivault_agents?select=id,name,domain,specialty,avatar,status,stats,model_route&order=id.asc";
      if (b.domain) q += "&domain=eq." + encodeURIComponent(b.domain); if (b.status) q += "&status=eq." + encodeURIComponent(b.status);
      if (b.q) { const s = String(b.q).replace(/[%,()*]/g, "").slice(0, 40); q += `&or=(name.ilike.*${encodeURIComponent(s)}*,specialty.ilike.*${encodeURIComponent(s)}*,id.ilike.*${encodeURIComponent(s)}*)`; }
      const off = Math.max(0, Number(b.offset) || 0), lim = Math.min(200, Number(b.limit) || 60);
      const rr = await fetch(URL0 + "/rest/v1/" + q, { headers: { ...SRH, Prefer: "count=exact", Range: `${off}-${off + lim - 1}` } });
      const rows = rr.ok ? await rr.json() : []; const total = Number((rr.headers.get("content-range") || "/0").split("/")[1]) || 0;
      const p = providers(); rows.forEach((x: any) => { x.needs_key = !mediaReady(x.model_route); });
      return out({ ok: true, agents: rows, total, domains: DOMAINS.map((d) => ({ key: d.key, label: d.label, emoji: d.emoji, n: d.n, kind: d.kind, ready: mediaReady(route(d.kind)) })), providers: p });
    }
    if (a === "get") {
      const id = String(b.id || "").replace(/[^\w-]/g, "");
      const [ag] = await rest(`aivault_agents?id=eq.${id}&select=*`); if (!ag) return out({ error: "not found" }, 404); ag.needs_key = !mediaReady(ag.model_route);
      const memory = await rest(`aivault_agent_memory?agent_id=eq.${id}&select=id,kind,content,created_at&order=created_at.desc&limit=30`);
      const tasks = await rest(`aivault_agent_tasks?agent_id=eq.${id}&select=id,order_text,status,result,created_at,steps&order=created_at.desc&limit=20`);
      return out({ ok: true, agent: ag, memory, tasks });
    }
    if (a === "remember") { const id = String(b.id || "").replace(/[^\w-]/g, ""); await rest("aivault_agent_memory", { method: "POST", body: JSON.stringify({ agent_id: id, kind: "note", content: String(b.content || "").slice(0, 1000) }) }); return out({ ok: true }); }
    if (a === "command") {
      const order = String(b.order || "").trim().slice(0, 4000); if (!order) return out({ error: "order" }, 400);
      const max = Math.min(8, Math.max(1, Number(b.max_agents) || 5)), steps = Math.min(6, Math.max(3, Number(b.max_steps) || 5));
      let summary = "", picked: any[] = [];
      if (Array.isArray(b.agent_ids) && b.agent_ids.length) {
        const ids = b.agent_ids.slice(0, max).map((x: any) => String(x).replace(/[^\w-]/g, "")).join(",");
        picked = (await rest(`aivault_agents?id=in.(${ids})&select=id,name,domain,specialty,avatar,status,model_route`)).map((ag: any) => ({ agent: ag, instruction: order })); summary = "擁有者直接指派";
      } else ({ summary, picked } = await pick(order, max));
      if (!picked.length) return out({ error: "暗星找不到合適的代理" }, 422);
      const [parent] = await rest("aivault_agent_tasks", { method: "POST", body: JSON.stringify({ order_text: order, status: "running", created_by: u.id, plan: [summary], max_steps: steps }) });
      const kids = await rest("aivault_agent_tasks", { method: "POST", body: JSON.stringify(picked.map((p) => ({ parent_id: parent.id, agent_id: p.agent.id, order_text: p.instruction, max_steps: steps, created_by: u.id }))) });
      return out({ ok: true, parent, summary, tasks: kids.map((k: any) => ({ ...k, agent: picked.find((p) => p.agent.id === k.agent_id)?.agent })) });
    }
    if (a === "step") {
      const [t] = await rest(`aivault_agent_tasks?id=eq.${String(b.task_id || "").replace(/[^0-9a-f-]/g, "")}&select=*`); if (!t) return out({ error: "not found" }, 404);
      if (t.status === "done" || t.status === "failed") return out({ ok: true, task: t });
      try { await agentStep(t); } catch (e) {
        t.steps = [...(t.steps || []), { type: "error", title: "錯誤", output: String((e as any)?.message || e).slice(0, 300) }]; const errs = t.steps.filter((s: any) => s.type === "error").length;
        if (errs >= 3) { t.status = "failed"; await rest(`aivault_agents?id=eq.${t.agent_id}`, { method: "PATCH", body: JSON.stringify({ status: "idle" }) }); }
      }
      const [n] = await rest(`aivault_agent_tasks?id=eq.${t.id}`, { method: "PATCH", body: JSON.stringify({ status: t.status, plan: t.plan, steps: t.steps, step_no: t.step_no, result: t.result, updated_at: new Date().toISOString() }) });
      return out({ ok: true, task: n });
    }
    if (a === "synth") {
      const pid = String(b.task_id || "").replace(/[^0-9a-f-]/g, ""); const [p] = await rest(`aivault_agent_tasks?id=eq.${pid}&select=*`);
      const kids = await rest(`aivault_agent_tasks?parent_id=eq.${pid}&select=agent_id,order_text,status,result`);
      const names = await rest(`aivault_agents?id=in.(${kids.map((k: any) => k.agent_id).join(",") || "x"})&select=id,name`);
      const nm = (id: string) => names.find((x: any) => x.id === id)?.name || id;
      const v = kids.length === 1 ? { result: kids[0].result || "", __model: "single" } : await think("你是暗星，AIVAULT AI 協作池統籌者。整合各代理成果，回覆擁有者：先一句總結，再整合後的完整成果，最後列出各代理貢獻與需要擁有者決定或補金鑰的事項。繁體中文 Markdown。只輸出 JSON：{\"result\":\"...\"}",
        `命令：${p.order_text}\n\n${kids.map((k: any) => `【${nm(k.agent_id)}】(${k.status}) ${k.order_text}\n${String(k.result || "").slice(0, 5000)}`).join("\n\n")}`, 6000);
      const [n] = await rest(`aivault_agent_tasks?id=eq.${pid}`, { method: "PATCH", body: JSON.stringify({ status: "done", result: String(v.result || ""), updated_at: new Date().toISOString() }) });
      return out({ ok: true, task: n });
    }
    if (a === "history") return out({ ok: true, tasks: await rest(`aivault_agent_tasks?parent_id=is.null&select=id,order_text,status,result,created_at&order=created_at.desc&limit=30`) });
    if (a === "task") { const pid = String(b.task_id || "").replace(/[^0-9a-f-]/g, ""); return out({ ok: true, parent: (await rest(`aivault_agent_tasks?id=eq.${pid}&select=*`))[0], tasks: await rest(`aivault_agent_tasks?parent_id=eq.${pid}&select=*`) }); }
    return out({ error: "unknown action" }, 400);
  } catch (e) { return out({ error: String((e as any)?.message || e).slice(0, 300) }, 500); }
}
