// ?feature=research（rs1）：手機小型 AI 模型研發＋四大模組升級設計。
// 誠實規則：AI 只做研究筆記／設計／審查（真實 Groq 呼叫，記錄 model/usage）；模型訓練是 AIVAULT 主機上的訓練腳本跑的（models/eot/）。
// 任務列 source=floor, kind=research（floor 工作迴圈只撿 kind=work，不會重跑；城裡看得到；owner=true 的成品進 🟡 待審）。關閉：函式 env RESEARCH_OFF=1
import { callModel } from "./floor.ts";
import { TIERS, DIST } from "./degree.ts";
const URL0 = Deno.env.get("SUPABASE_URL") || "", SR = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const SRH = { apikey: SR, Authorization: "Bearer " + SR, "Content-Type": "application/json" };
const H = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", "Content-Type": "application/json" };
const out = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: H });
async function rest(path: string, init: RequestInit = {}) {
  const r = await fetch(URL0 + "/rest/v1/" + path, { ...init, headers: { ...SRH, Prefer: "return=representation", ...(init.headers || {}) } });
  const t = await r.text(); if (!r.ok) throw new Error("DB " + r.status + " " + t.slice(0, 200)); return t ? JSON.parse(t) : null;
}
const EOT = "AIVAULT EOT v1（主機訓練腳本實際訓練結果）：輸入 1 秒 16kHz 原始音訊→內建 40 維對數梅爾前端（固定 DFT 卷積）→2 層 Conv1d(64)→GRU(64)→sigmoid，58,689 參數；資料 google/fleurs cmn_hans_cn（CC-BY 4.0，普通話朗讀），訓練 945 段/7,809 視窗，保留集 409 段/1,113 視窗；int8 QDQ 檔 821 KB；保留集準確率 80.3%、F1 0.727；難題（句中停頓≥0.1–0.3 秒 vs 句尾，同樣長度靜音）準確率 71.3%；onnxruntime-web wasm 單執行緒約 2 ms/次（主機量測，非 iPhone）。";
const NOW = "AIVAULT 現況：GitHub Pages 前端＋Supabase；文字用 Groq 免費層 gpt-oss-120b（每分鐘約 30 次、每日 token 上限）；Gemini 不可用；有 ElevenLabs、Kling、fal 金鑰但盡量不用付費；無 GPU；暗星有即時語音（雲端 TTS/ASR），沒有自有語音模型；圖像/影片多為企劃稿未串生成；協作池 1000 個 AI 皆共用同一底層模型。";
type T = { k: string; d: string; slot: number; owner: boolean; title: string; ask: string };
const D4: Record<string, string> = { llm: "大型語言模型", img: "圖像生成模型", av: "影片與語音模型", code: "程式與代理人工具" };
export const PLAN: T[] = [
  ...Object.keys(D4).map((d) => ({ k: "up-" + d, d, slot: 0, owner: true, title: `🧩 四大模組升級設計：${D4[d]}`, ask: `為 AIVAULT 的「${D4[d]}」模組寫升級版設計文件。章節：1.現況（依上方現況，不要編造不存在的功能）2.弱點 3.升級架構（模組圖用文字描述）4.可用開源元件（名稱＋授權，不確定就標「待查證」）5.分階段實作計畫 6.免費層成本與限制 7.手機端可行部分。` })),
  { k: "mm-roadmap", d: "llm", slot: 0, owner: true, title: "📱 手機小型 AI 模型路線圖", ask: "依 Grok Bot 的計畫（P1 語句結束偵測、P2 喚醒詞／意圖、P3 手機端中文小文字模型），寫給擁有者的路線圖：手機上可行與不可行的事、量化（int8/4-bit）與蒸餾方法、候選開放小模型（名稱與授權不確定就標待查證）、每階段可量測里程碑與風險。" },
  { k: "mm-p1-arch", d: "av", slot: 0, owner: false, title: "📱P1 研究：EOT v1 架構審查與 v2 提案（領導）", ask: "審查 EOT v1 的架構與數字，提出 v2 改良（例如音高特徵、視窗長度、因果串流 GRU 狀態），每項預估效益與對模型大小的影響。" },
  { k: "mm-p1-data", d: "av", slot: 1, owner: false, title: "📱P1 研究：台灣口語對話資料與授權清單", ask: "列出可用於台灣口語「說完了沒」偵測的開放語料，逐一標授權與是否允許商用、下載大小、需人工確認處；沒把握的標待查證。" },
  { k: "mm-p1-eval", d: "code", slot: 0, owner: false, title: "📱P1 檢查：評估方法與指標審閱", ask: "審閱 EOT v1 的評估方法（訓練用 FLEURS test、保留 dev、難題子集），指出可能的資料洩漏或偏差，提出更好的評估指標（例如偵測延遲、誤打斷率）與測試案例。" },
  { k: "mm-p1-web", d: "code", slot: 1, owner: false, title: "📱P1 開發：iPhone Safari onnxruntime-web 整合檢查清單", ask: "針對在 iPhone Safari 用 onnxruntime-web wasm 跑 0.8 MB 模型＋麥克風串流，寫整合檢查清單：AudioContext 取樣率、重取樣、權限、背景執行、記憶體、延遲量測方法。" },
  { k: "mm-p2-kws", d: "av", slot: 2, owner: false, title: "📱P2 研究：喚醒詞「暗星」與指令詞小模型", ask: "研究 P2：小型關鍵字偵測模型（< 300 KB）的架構選擇、資料蒐集方式（含合成語音的授權風險）、誤喚醒率量測方法。" },
  { k: "mm-p3-llm", d: "llm", slot: 1, owner: false, title: "📱P3 研究：手機端中文小文字模型可行性", ask: "評估在 iPhone Safari（WebGPU/wasm）跑開放小型語言模型的可行性：候選模型與授權（不確定標待查證）、量化後大小、記憶體上限、每秒 token 的預估方法；以及蒸餾單一任務小模型的方案。" },
  { k: "mm-p3-img", d: "img", slot: 0, owner: false, title: "📱P3 研究：手機端圖像小模型與量化經驗", ask: "研究手機端可跑的圖像小模型（分類、去背、超解析等）與量化經驗，哪些對 AIVAULT 有用、檔案大小與延遲預估。" },
  { k: "mm-lit", d: "av", slot: 5, owner: false, title: "📱 文獻筆記：語句結束偵測（turn-taking）方法整理", ask: "整理語句結束／換人說話偵測的主要方法類型（靜音門檻、聲學韻律、文字語意、多模態），各自優缺點與手機端適用性。只寫你有把握的，論文名稱不確定就不要寫。" },
];
async function topAgents(d: string) {
  const dg = await rest(`aivault_pool_agent_degree?district=eq.${d}&tier=not.is.null&select=agent_id,tier,level&order=tier.desc,level.desc,updated_at.asc&limit=12`);
  return dg;
}
async function who(r: Request) {
  const tok = (r.headers.get("authorization") || "").replace(/^Bearer\s+/i, ""); if (SR && tok === SR) return { id: null, cron: true };
  try { const pl = JSON.parse(atob(tok.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))); if (pl.role === "service_role") { const ck = await fetch(URL0 + "/rest/v1/aivault_pool_agents?select=id&limit=1", { headers: { apikey: tok, Authorization: "Bearer " + tok } }); return ck.ok ? { id: null, cron: true } : null; } } catch { /* */ }
  const u = await fetch(URL0 + "/auth/v1/user", { headers: { apikey: SR, Authorization: "Bearer " + tok } }).then((x) => x.ok ? x.json() : null).catch(() => null);
  const role = u?.app_metadata?.role; return u?.id && (role === "owner" || role === "admin") ? { id: u.id as string } : null;
}
export async function research(r: Request) {
  if (r.method === "OPTIONS") return new Response("ok", { headers: H });
  if (Deno.env.get("RESEARCH_OFF") === "1") return out({ ok: true, off: true });
  try {
    const u = await who(r); if (!u) return out({ error: "owner only" }, 403);
    const b = await r.json().catch(() => ({})); const a = String(b.action || "");
    const mine = async () => await rest("aivault_pool_agent_tasks?source=eq.floor&kind=eq.research&select=id,agent_id,status,review_status,order_text,plan,updated_at&order=created_at.asc&limit=200");
    if (a === "seed") { // 依學歷指派（同一 k 不重複建立）
      const have = new Set((await mine()).map((t: any) => t.plan?.mm?.k)); const made: any[] = [];
      for (const t of PLAN) { if (have.has(t.k)) continue; const tops = await topAgents(t.d); const g = tops[Math.min(t.slot, tops.length - 1)];
        if (!g) { made.push({ k: t.k, skipped: "該區沒有已鑑定學歷的 AI" }); continue; }
        const [ag] = await rest(`aivault_pool_agents?id=eq.${g.agent_id}&select=id,name,zone`); const lead = tops[0]?.agent_id;
        const rank = `${TIERS[g.tier - 1]} ${g.tier} 階 ${g.level} 級`;
        const [row] = await rest("aivault_pool_agent_tasks", { method: "POST", body: JSON.stringify({ agent_id: ag.id, zone: ag.zone, source: "floor", kind: "research", status: "queued", max_steps: 1, order_text: t.title, plan: { mm: { k: t.k, district: t.d, rank, lead_id: lead, owner: t.owner, by: "rs1" } } }) });
        made.push({ k: t.k, task: row.id, agent: ag.name, rank }); }
      return out({ ok: true, made }); }
    if (a === "run") { // 一次做 n 筆；遇到 429 就停（保持 queued，下一輪再做）
      const n = Math.min(4, Math.max(1, Number(b.n) || 2)); const q = (await mine()).filter((t: any) => t.status === "queued").slice(0, n); const res: any[] = [];
      for (const t of q) { const spec = PLAN.find((p) => p.k === t.plan?.mm?.k); if (!spec) continue;
        const [ag] = await rest(`aivault_pool_agents?id=eq.${t.agent_id}&select=id,name,persona`); const st = new Date().toISOString();
        await rest(`aivault_pool_agent_tasks?id=eq.${t.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ status: "running", updated_at: st }) });
        try {
          const call = await callModel(`${ag.persona || ""}\n你是 AIVAULT 協作池的 AI（${t.plan.mm.rank}，${DIST[spec.d] || spec.d}區），參與 Grok Bot 規劃的手機小型 AI 模型研發與模組升級。你只做研究、設計與審查；模型訓練由 AIVAULT 主機的訓練腳本執行，不可聲稱你訓練了模型、跑了實驗或查證了你沒查證的事。不確定的名稱、授權、數字一律標「待查證」。用繁體中文。`,
            `${NOW}\n${EOT}\n\n任務：${spec.title}\n${spec.ask}\n\n只輸出 JSON：{"doc":"Markdown 全文（${spec.owner ? "1500–3000" : "600–1500"} 字）","summary":"60 字內摘要","uncertain":["待查證事項"]}`, spec.owner ? 6000 : 3500);
          const doc = String(call.v?.doc || "").slice(0, 20000); if (doc.length < 200) throw new Error("輸出太短");
          const unc = (Array.isArray(call.v?.uncertain) ? call.v.uncertain : []).slice(0, 20).map(String);
          const result = `${spec.owner ? "【作品・待擁有者審核】" : "【研究筆記】"}作者：${ag.name}（${t.plan.mm.rank}）。此文由 AI 撰寫；模型訓練數字來自主機訓練腳本。\n\n${doc}${unc.length ? "\n\n### 待查證\n- " + unc.join("\n- ") : ""}`;
          await rest(`aivault_pool_agent_tasks?id=eq.${t.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ status: "done", result, review_status: spec.owner ? "pending" : null, plan: { ...t.plan, work: spec.owner, mm: { ...t.plan.mm, summary: String(call.v?.summary || "").slice(0, 200) } }, steps: [{ type: "act", title: "研究／設計", model: call.model, usage: call.usage, started_at: st, finished_at: new Date().toISOString() }], step_no: 1, updated_at: new Date().toISOString() }) });
          await rest("aivault_pool_agent_memory", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ agent_id: ag.id, kind: "research", task_id: t.id, content: `${spec.title}：${String(call.v?.summary || "").slice(0, 300)}` }) });
          res.push({ k: spec.k, agent: ag.name, ok: true, chars: doc.length, usage: call.usage?.total });
        } catch (e) { const m = String((e as any)?.message || e); const lim = /429|LLM_FAILED/.test(m);
          await rest(`aivault_pool_agent_tasks?id=eq.${t.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ status: lim ? "queued" : "failed", result: (lim ? "限流，稍後重試：" : "失敗：") + m.slice(0, 300), updated_at: new Date().toISOString() }) });
          res.push({ k: spec.k, agent: ag.name, ok: false, error: m.slice(0, 160) }); if (lim) return out({ ok: true, rate_limited: true, res }); }
      }
      return out({ ok: true, rate_limited: false, res, left: (await mine()).filter((t: any) => t.status === "queued").length }); }
    if (a === "status") { const ts = await mine(); return out({ ok: true, tasks: ts.map((t: any) => ({ id: t.id, k: t.plan?.mm?.k, title: t.order_text, status: t.status, review: t.review_status, rank: t.plan?.mm?.rank, agent_id: t.agent_id })) }); }
    return out({ error: "unknown action" }, 400);
  } catch (e) { return out({ error: String((e as any)?.message || e).slice(0, 300) }, 500); }
}
