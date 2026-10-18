// ?feature=degree action=learn_round：每 10 分鐘的四區學習（ln10）。
// 重點課程：口語化即時語音模組。每位代理有學習鎖（25 分鐘逾時），學到一半的不會被重複排進來。
// 一次完整學習＝搜尋（arXiv／GitHub／一般搜尋）→ 真的抓網頁 → 讀 → 寫實作筆記；同主題最多讀 2 頁（第 2 頁會看到第 1 頁筆記做補充）。
// 額度：每日學習 token 上限 LEARN10_DAILY_TOKENS（預設 120000），保留額度給小說循環與考試；遇到 429 立刻停。關閉：函式 env LEARN10_OFF=1、repo var AGENT_LEARN_OFF=1。
import { callModel } from "./floor.ts";
import { webSearch } from "./web-search.ts";
import { districtOf, DIST } from "./degree.ts";
import { approvedTopics } from "./plans.ts";
const URL0 = Deno.env.get("SUPABASE_URL") || "", SR = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const SRH = { apikey: SR, Authorization: "Bearer " + SR, "Content-Type": "application/json" };
async function rest(path: string, init: RequestInit = {}) {
  const r = await fetch(URL0 + "/rest/v1/" + path, { ...init, headers: { ...SRH, Prefer: "return=representation", ...(init.headers || {}) } });
  const t = await r.text(); if (!r.ok) throw new Error("DB " + r.status + " " + t.slice(0, 200)); return t ? JSON.parse(t) : null;
}
// 口語化即時語音模組：子主題（中文名、英文搜尋詞、GitHub 搜尋詞）
export const VOICE: [string, string, string][] = [
  ["串流語音辨識 ASR", "streaming speech recognition low latency whisper", "streaming asr"],
  ["語音活動偵測 VAD", "voice activity detection silero vad real-time", "silero vad"],
  ["輪流發話與插話 barge-in", "turn-taking barge-in end-of-utterance detection voice agent", "turn detection voice agent"],
  ["低延遲語音合成 TTS", "low latency streaming text-to-speech", "streaming tts"],
  ["WebRTC 即時音訊", "WebRTC audio streaming voice agent latency", "webrtc voice agent"],
  ["WebSocket 音訊串流", "websocket audio streaming PCM opus realtime api", "websocket audio streaming"],
  ["全雙工語音大模型", "full-duplex spoken dialogue model moshi", "full duplex speech model"],
  ["中文／台語口語語音", "Taiwanese Mandarin Hokkien speech recognition dataset colloquial", "taiwanese speech"],
  ["瀏覽器 Web Audio／AudioWorklet", "AudioWorklet microphone streaming getUserMedia echo cancellation", "audioworklet"],
  ["開源語音代理框架 Pipecat／LiveKit", "pipecat livekit agents voice pipeline", "pipecat"],
  ["端側語音 sherpa-onnx／whisper.cpp", "sherpa-onnx whisper.cpp on-device streaming", "sherpa-onnx"],
  ["回音消除與降噪 AEC", "acoustic echo cancellation noise suppression real-time voice", "echo cancellation webrtc"],
  ["語音延遲預算與量測", "voice agent latency budget time to first audio measurement", "voice agent latency"],
];
const VW: Record<string, number> = { av: .4, code: .35, llm: .25, img: .2 }; // pd1：降低即時語音比重，讓四大領域模型課程變多
async function hdrFetch(u: string, accept = "text/html,*/*") { return fetch(u, { headers: { "User-Agent": "Mozilla/5.0 (compatible; AIVAULT-learner/1.1)", Accept: accept, "Accept-Language": "zh-TW,zh;q=0.9,en;q=0.8" }, redirect: "follow", signal: AbortSignal.timeout(10000) }); }
async function arxiv(q: string) { try { const t = await (await hdrFetch("https://export.arxiv.org/api/query?max_results=4&sortBy=relevance&search_query=all:" + encodeURIComponent(q), "application/atom+xml")).text();
  return [...t.matchAll(/<entry>[\s\S]*?<id>([^<]+)<\/id>[\s\S]*?<title>([\s\S]*?)<\/title>/g)].map((m) => ({ url: m[1].trim().replace("http://", "https://"), title: m[2].replace(/\s+/g, " ").trim(), src: "arxiv" })); } catch { return []; } }
async function github(q: string) { try { const j = await (await hdrFetch("https://api.github.com/search/repositories?per_page=4&sort=stars&q=" + encodeURIComponent(q), "application/vnd.github+json")).json();
  return (j.items || []).map((x: any) => ({ url: x.html_url, title: x.full_name + "：" + (x.description || ""), src: "github", readme: `https://api.github.com/repos/${x.full_name}/readme` })); } catch { return []; } }
async function general(q: string) { try { const sr = await (await webSearch(new Request("http://local", { method: "POST", body: JSON.stringify({ q, n: 8 }) }))).json(); return (sr.results || []).map((x: any) => ({ url: x.url, title: x.title, src: "web" })); } catch { return []; } }
const strip = (h: string) => h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<nav[\s\S]*?<\/nav>|<footer[\s\S]*?<\/footer>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();
async function sha(s: string) { const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)); return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join(""); }
async function readPage(c: any) {
  if (c.readme) { const r = await hdrFetch(c.readme, "application/vnd.github.raw"); if (!r.ok) return null; const raw = (await r.text()).slice(0, 400000); return { status: r.status, url: c.url, raw, text: raw.replace(/\s+/g, " ") }; }
  const r = await hdrFetch(c.url); const ct = r.headers.get("content-type") || ""; if (!r.ok || !/html|text|xml/.test(ct)) return null; const raw = (await r.text()).slice(0, 600000); return { status: r.status, url: r.url || c.url, raw, text: strip(raw) };
}
async function lock(id: string) { const k = "learnlock:" + id; const [x] = await rest(`aivault_floor_state?k=eq.${encodeURIComponent(k)}&select=v`); if (x && Date.parse(x.v?.until) > Date.now()) return false;
  await rest("aivault_floor_state", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ k, v: { until: new Date(Date.now() + 25 * 60e3).toISOString() }, updated_at: new Date().toISOString() }) }); return true; }
async function unlock(id: string) { await rest(`aivault_floor_state?k=eq.${encodeURIComponent("learnlock:" + id)}`, { method: "DELETE", headers: { Prefer: "return=minimal" } }).catch(() => {}); }
export async function tokensToday() { const d0 = new Date(Date.now() + 8 * 3600e3); d0.setUTCHours(0, 0, 0, 0); const since = new Date(d0.getTime() - 8 * 3600e3).toISOString();
  const rows = await rest(`aivault_pool_agent_learning?created_at=gte.${since}&select=usage&limit=5000`); return rows.reduce((s: number, x: any) => s + (Number(x.usage?.total) || 0), 0); }

// vd1：看影片＝讀「公開逐字稿」。AI 不能看影片；YouTube 字幕在伺服器端沒有合規的免費取得方式（官方 captions API 需影片擁有者授權、timedtext 需瀏覽器 PO token），
// 所以只讀「主辦方公開發布逐字稿」的演講影片頁：InfoQ presentations（附 Transcript）、TED talks（/transcript）。抓不到就退回一般網頁學習。關閉：LEARN_VIDEO_OFF=1
async function videoCands(q: string) { const out: any[] = [];
  for (const sq of [`site:infoq.com/presentations ${q}`, `site:ted.com/talks ${q}`]) { for (const c of await general(sq)) { let u = String(c.url || ""); if (/ted\.com\/talks\/[^/?#]+/.test(u)) u = u.replace(/(ted\.com\/talks\/[^/?#]+).*/, "$1/transcript"); if (/infoq\.com\/presentations\/[^/?#]+|ted\.com\/talks\/[^/]+\/transcript/.test(u)) out.push({ url: u, title: c.title, src: /ted\.com/.test(u) ? "ted" : "infoq" }); } }
  return out; }
async function videoSession(agent: any, v: [string, string, string], topic: string, seen: Set<any>) {
  const d = districtOf(agent.domain); const cands = (await videoCands(v[1])).filter((c) => !seen.has(c.url));
  for (const c of cands.slice(0, 4)) { let r: Response; try { r = await hdrFetch(c.url); } catch { continue; } if (!r.ok) continue; const raw = (await r.text()).slice(0, 900000); const text = strip(raw);
    const i = text.search(/Transcript|逐字稿/i); if (i < 0) continue; const tr = text.slice(i, i + 60000); if (tr.length < 3000) continue;
    const lang = (raw.match(/<html[^>]*lang="([^"]+)"/i) || [])[1] || "en"; const excerpt = tr.slice(0, 5000); const fetched_at = new Date().toISOString();
    const call = await callModel(`${agent.persona || ""}\n你是 AIVAULT ${DIST[d]} 的 AI。你不能看影片，現在讀的是這部演講影片「主辦方公開的逐字稿」，為「口語化即時語音模組」學習「${v[0]}」。只能根據逐字稿內容寫，沒講到的不要編。`,
      `影片頁：${r.url || c.url}\n標題：${c.title}\n逐字稿節錄：\n${excerpt}\n\n只輸出 JSON：{"notes":"250–450 字繁體中文實作筆記：講者提到的架構、數字（延遲 ms 等）、工具與做法、可套用到 AIVAULT 暗星即時語音之處","relevant":true 或 false}`, 1400);
    const notes = String(call.v?.notes || "").trim(); if (!notes) continue;
    const row = { agent_id: agent.id, district: d, topic, query: v[1], url: r.url || c.url, title: ("🎬 讀字幕｜" + String(c.title || "")).slice(0, 200), http_status: r.status, bytes: tr.length, sha256: await sha(tr), excerpt: excerpt.slice(0, 600), notes: (call.v?.relevant === false ? "［自評：此影片與主題關聯低］" : "") + notes.slice(0, 1200), model: call.model, usage: call.usage, fetched_at, source_type: "video_subtitles", caption_lang: lang, transcript_chars: tr.length };
    await rest("aivault_pool_agent_learning", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify(row) });
    await rest("aivault_pool_agent_memory", { method: "POST", body: JSON.stringify({ agent_id: agent.id, kind: "learning", content: `讀影片逐字稿學習「${topic}」：${notes.slice(0, 300)}（${row.url}）` }) });
    return { agent: agent.id, kind: "learn", topic, video: true, pages: [{ url: row.url, src: c.src + "-transcript", chars: tr.length, lang }], usage: { total: Number(call.usage?.total) || 0 } };
  }
  return null; }
// sd1：自研課程——付費能力（Kling 影片／fal 圖與 3D／ElevenLabs 語音）不開，改學背後原理，目標日後做自己的免費開源版。關閉：LEARN_SELFDEV_OFF=1
export const SELFDEV: [string, string, string][] = [
  ["協作：交接協定 handoff（目標／範圍／禁止範圍／限制／成功標準／回報格式）", "task handoff protocol delegation brief success criteria definition of done", "multi-agent handoff"], // cm3：全體必修
  ["協作：多代理訊息協定、確認與重試、避免迴圈", "multi-agent communication protocol acknowledgement retry idempotency", "agent message protocol"],
  ["影片生成：擴散模型與時序一致性", "video diffusion model temporal consistency open source", "open-sora video generation"],
  ["影片生成：開源模型 Wan / HunyuanVideo / CogVideoX", "open video generation model Wan HunyuanVideo CogVideoX", "cogvideox"],
  ["圖像生成：潛在擴散與 Flow Matching", "latent diffusion flow matching text-to-image", "stable diffusion flux"],
  ["圖像生成：LoRA 微調與 ControlNet", "LoRA fine-tuning ControlNet image generation", "controlnet lora"],
  ["語音合成 TTS：開源模型與聲碼器", "open source text-to-speech vocoder VITS", "piper tts coqui"],
  ["聲音複製：說話人嵌入與倫理同意", "zero-shot voice cloning speaker embedding consent", "openvoice f5-tts"],
  ["3D 生成：NeRF 與 3D Gaussian Splatting", "image to 3D gaussian splatting NeRF", "gaussian splatting"],
  ["3D 生成：單圖轉網格 TripoSR / Hunyuan3D", "single image to 3D mesh TripoSR", "triposr"],
  ["視覺理解：開源 VLM 與圖文對齊", "open vision language model CLIP LLaVA Qwen-VL", "llava qwen-vl"],
  ["行動裝置推論：量化與蒸餾", "on-device inference quantization distillation diffusion mobile", "mlc llm gguf"],
];
// pd1：四大領域模型課程（架構、訓練、開源實作），權重提高；一樣受「學 3 筆就要做作品」規則約束。關閉：LEARN_DOMAIN_OFF=1
export const DOMAIN: Record<string, [string, string, string][]> = {
  llm: [["LLM 架構：Transformer、注意力與 KV cache", "transformer attention KV cache architecture explained", "nanogpt"], ["LLM 訓練：預訓練、SFT 與 RLHF/DPO", "LLM pretraining SFT DPO RLHF pipeline", "trl dpo"], ["開源 LLM 實作：Llama/Qwen 推論與量化", "llama qwen open source inference quantization", "llama.cpp"], ["MoE 與長上下文", "mixture of experts long context LLM", "mixtral moe"]],
  img: [["圖像模型架構：U-Net、DiT 與 VAE", "diffusion transformer DiT U-Net VAE architecture", "diffusers dit"], ["圖像模型訓練：擴散訓練與 LoRA", "diffusion model training LoRA fine-tune", "kohya lora"], ["開源圖像模型實作：SDXL / FLUX 推論", "SDXL FLUX open source inference pipeline", "diffusers flux"]],
  av: [["中文聲音複製 TTS：CosyVoice", "CosyVoice zero-shot voice cloning paper github", "FunAudioLLM CosyVoice"], ["中文聲音複製 TTS：GPT-SoVITS", "GPT-SoVITS few-shot voice cloning README", "GPT-SoVITS"], ["F5-TTS：flow matching 零樣本", "F5-TTS flow matching zero-shot TTS paper", "F5-TTS"], ["Fish Speech 與 Spark-TTS", "Fish Speech Spark-TTS LLM based TTS", "fish-speech"], ["MaskGCT：遮罩生成 codec TTS", "MaskGCT masked generative codec transformer TTS", "Amphion MaskGCT"], ["有聲書為何自然：韻律與停頓", "prosody modeling pause prediction expressive TTS audiobook", "prosody prediction mandarin"], ["即時語音串流延遲：streaming TTS", "streaming TTS first packet latency chunk", "streaming tts"], ["語音模型架構：Whisper 與 neural codec", "whisper architecture neural audio codec", "whisper"], ["TTS 訓練：VITS / F5-TTS", "VITS F5-TTS training text to speech", "f5-tts"], ["影片模型架構與開源實作：Wan / CogVideoX", "video diffusion architecture Wan CogVideoX open source", "cogvideox"]],
  code: [["程式模型架構與訓練：Code LLM、FIM", "code LLM fill in the middle training", "starcoder"], ["代理框架：工具呼叫、規劃與記憶", "LLM agent tool calling planning memory framework", "langgraph"], ["開源程式代理實作：SWE-agent / OpenHands", "SWE-agent OpenHands open source coding agent", "openhands"]],
};
let FORCE_VIDEO = false;
async function session(agent: any, ov?: [string, string, string], pre = "即時語音：") {
  const d = districtOf(agent.domain); const mine = await rest(`aivault_pool_agent_learning?agent_id=eq.${agent.id}&select=topic,url&limit=2000`); const seen = new Set(mine.map((x: any) => x.url));
  const cnt: Record<string, number> = {}; mine.forEach((x: any) => cnt[x.topic] = (cnt[x.topic] || 0) + 1);
  const v = ov || [...VOICE].sort((a, b) => (cnt["即時語音：" + a[0]] || 0) - (cnt["即時語音：" + b[0]] || 0) || Math.random() - .5)[0]; const topic = pre + v[0];
  if (Deno.env.get("LEARN_VIDEO_OFF") !== "1" && (FORCE_VIDEO || Math.random() < (districtOf(agent.domain) === "av" ? .45 : .25))) { const vr = await videoSession(agent, v, topic, seen); if (vr) return vr; }
  const [ax, gh, wb] = await Promise.all([arxiv(v[1]), github(v[2]), general(v[1])]);
  const cands: any[] = []; for (let i = 0; i < 4; i++) [gh[i], ax[i], wb[i]].forEach((c) => { if (c && !seen.has(c.url) && !/news\.google|wikipedia\.org/.test(c.url)) cands.push(c); });
  wb.filter((c: any) => /wikipedia/.test(c.url) && !seen.has(c.url)).forEach((c: any) => cands.push(c)); // 維基百科放最後
  const rows: any[] = []; let prev = "", usage = 0;
  for (const c of cands.slice(0, 6)) { if (rows.length >= 2) break; let pg: any = null; try { pg = await readPage(c); } catch { pg = null; } if (!pg || pg.text.length < 400) continue;
    const excerpt = pg.text.slice(0, 4500); const fetched_at = new Date().toISOString();
    const call = await callModel(`${agent.persona || ""}\n你是 AIVAULT ${DIST[d]} 的 AI，正在為「口語化即時語音模組」上網自學「${v[0]}」，目標是之後能親手開發。只能根據下面真的抓回來的內容寫筆記，內容沒寫的不要編。`,
      `來源（${c.src}）：${pg.url}\n標題：${c.title}\n內容節錄：\n${excerpt}\n${prev ? "\n你剛才在同一主題的上一頁筆記：\n" + prev + "\n請補充新的內容，不要重複。\n" : ""}\n只輸出 JSON：{"notes":"250–450 字繁體中文實作筆記：架構／元件、關鍵參數與數字（延遲 ms、取樣率、chunk 大小、模型名）、API 或程式庫用法、可以怎麼套用到 AIVAULT 暗星即時語音","relevant":true 或 false}`, 1400);
    const notes = String(call.v?.notes || "").trim(); if (!notes) continue; usage += Number(call.usage?.total) || 0;
    const [row] = await rest("aivault_pool_agent_learning", { method: "POST", body: JSON.stringify({ agent_id: agent.id, district: d, topic, query: v[1], url: pg.url, title: String(c.title || "").slice(0, 200), http_status: pg.status, bytes: pg.raw.length, sha256: await sha(pg.raw), excerpt: excerpt.slice(0, 600), notes: (call.v?.relevant === false ? "［自評：此頁與主題關聯低］" : "") + notes.slice(0, 1200), model: call.model, usage: call.usage, fetched_at }) });
    await rest("aivault_pool_agent_memory", { method: "POST", body: JSON.stringify({ agent_id: agent.id, kind: "learning", content: `上網學習「${topic}」：${notes.slice(0, 300)}（${pg.url}）` }) });
    rows.push({ url: row.url, src: c.src }); prev = notes.slice(0, 500); }
  return { agent: agent.id, kind: "learn", topic, pages: rows, usage: { total: usage }, error: rows.length ? undefined : "沒有抓到可用網頁" };
}

// eb1：讀 AIVAULT 書架上的公開電子書（和暗星讀書同一份資料 dark_star_ebook_pages；私人書不讀）。每次讀 3 頁，接著上次讀到的地方。關閉：LEARN_EBOOK_OFF=1
async function ebookSession(agent: any) {
  const d = districtOf(agent.domain); const books = (await rest("dark_star_ebooks?select=id,title,total_pages,metadata&order=created_at.desc&limit=100")).filter((x: any) => Number(x.total_pages) > 3 && !(x.metadata && (x.metadata.private === true || x.metadata.private === "true")) && !/Probe|使用說明/.test(x.title || ""));
  if (!books.length) return null; const bk = books[Math.floor(Math.random() * books.length)];
  const prev = await rest(`aivault_pool_agent_learning?agent_id=eq.${agent.id}&url=like.ebook:${bk.id}*&select=url&order=created_at.desc&limit=1`); const lastEnd = prev[0] ? Number((String(prev[0].url).match(/-(\d+)$/) || [])[1]) || 0 : 0;
  const start = lastEnd >= bk.total_pages ? 1 : lastEnd + 1, end = Math.min(bk.total_pages, start + 2);
  const pages = await rest(`dark_star_ebook_pages?ebook_id=eq.${bk.id}&page_number=gte.${start}&page_number=lte.${end}&select=page_number,content&order=page_number`); const text = pages.map((p: any) => `［第 ${p.page_number} 頁］${String(p.content || "").replace(/\[\[pimg:[^\]]*\]\]/g, "")}`).join("\n").slice(0, 7000);
  if (text.length < 300) return null;
  const call = await callModel(`${agent.persona || ""}\n你是 AIVAULT ${DIST[d]} 的 AI，正在讀 AIVAULT 書架上的電子書《${bk.title}》第 ${start}–${end} 頁（和暗星讀的是同一份書）。只能根據這幾頁內容寫，沒寫的不要編。`, `${text}\n\n只輸出 JSON：{"notes":"200–350 字繁體中文讀書筆記：本段重點、定義、條文或數字"}`, 1200);
  const notes = String(call.v?.notes || "").trim(); if (!notes) return null; const url = `ebook:${bk.id}#p${start}-${end}`;
  await rest("aivault_pool_agent_learning", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ agent_id: agent.id, district: d, topic: "讀書：" + String(bk.title).slice(0, 40), query: bk.title, url, title: ("📖 讀電子書｜《" + bk.title + "》第 " + start + "–" + end + " 頁").slice(0, 200), http_status: 200, bytes: text.length, sha256: await sha(text), excerpt: text.slice(0, 600), notes: notes.slice(0, 1000), model: call.model, usage: call.usage, fetched_at: new Date().toISOString(), source_type: "ebook" }) });
  await rest("aivault_pool_agent_memory", { method: "POST", body: JSON.stringify({ agent_id: agent.id, kind: "learning", content: `讀《${bk.title}》第 ${start}–${end} 頁：${notes.slice(0, 300)}` }) });
  return { agent: agent.id, kind: "learn", topic: "讀書：" + bk.title, pages: [{ src: "ebook", url }], usage: { total: Number(call.usage?.total) || 0 } };
}
// pb6：協作池書架必讀（基礎→入門→專業→資料選輯），讀下一個沒讀過的章節；紀錄 url='poolbook:<book>#ch<n>'。關閉：LEARN_POOLBOOK_OFF=1
async function poolBookSession(agent: any) {
  const d = districtOf(agent.domain); const books = await rest("aivault_pool_books?status=eq.published&select=id,title,tier&order=kind.desc,tier_order.asc,sort_order.asc"); if (!books.length) return null;
  const done = new Set((await rest(`aivault_pool_agent_learning?agent_id=eq.${agent.id}&url=like.poolbook:*&select=url&limit=2000`)).map((x: any) => x.url));
  const chs = await rest("aivault_pool_book_chapters?select=book_id,chapter_no,title&order=book_id,chapter_no&limit=5000"); let pick: any = null, bk: any = null;
  for (const b of books) { for (const c of chs.filter((x: any) => x.book_id === b.id)) if (!done.has(`poolbook:${b.id}#ch${c.chapter_no}`)) { pick = c; bk = b; break; } if (pick) break; }
  if (!pick) return null; const [c] = await rest(`aivault_pool_book_chapters?book_id=eq.${encodeURIComponent(bk.id)}&chapter_no=eq.${pick.chapter_no}&select=title,content`); const text = String(c?.content || "").slice(0, 6000); if (text.length < 200) return null;
  const call = await callModel(`${agent.persona || ""}\n你是 AIVAULT ${DIST[d]} 的 AI，正在讀協作池書架必讀書《${bk.title}》（${bk.tier}）的「${c.title}」。只能根據這一章內容寫，沒寫的不要編。`, `${text}\n\n只輸出 JSON：{"notes":"200–350 字繁體中文讀書筆記：本章重點、定義、可做的練習或實驗"}`, 1200);
  const notes = String(call.v?.notes || "").trim(); if (!notes) return null; const url = `poolbook:${bk.id}#ch${pick.chapter_no}`;
  await rest("aivault_pool_agent_learning", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ agent_id: agent.id, district: d, topic: "讀書：《" + String(bk.title).slice(0, 30) + "》", query: bk.title, url, title: ("📚 協作池書架《" + bk.title + "》" + bk.tier + "｜" + c.title).slice(0, 200), http_status: 200, bytes: text.length, sha256: await sha(text), excerpt: text.slice(0, 600), notes: notes.slice(0, 1000), model: call.model, usage: call.usage, fetched_at: new Date().toISOString(), source_type: "ebook" }) });
  return { agent: agent.id, kind: "learn", topic: "讀書：" + bk.title, pages: [{ src: "poolbook", url }], usage: { total: Number(call.usage?.total) || 0 } };
}
export async function learnRound(b: any, learnOne: (ag: any) => Promise<any>) {
  FORCE_VIDEO = !!b.force_video;
  if (Deno.env.get("LEARN10_OFF") === "1") return { ok: true, off: true, results: [] };
  // pc1：整輪鎖，pg_cron 與 GitHub 備援不會重複跑同一輪（8 分鐘內只跑一次）
  { const k = "learnround:lock"; const [x] = await rest(`aivault_floor_state?k=eq.${k}&select=v`); if (x && Date.parse(x.v?.until) > Date.now() && !b.force_round) return { ok: true, skipped_round: true, by: x.v?.src, results: [] };
    await rest("aivault_floor_state", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ k, v: { until: new Date(Date.now() + 8 * 60e3).toISOString(), src: String(b.src || "github"), at: new Date().toISOString() }, updated_at: new Date().toISOString() }) }); }
  const budget = Number(Deno.env.get("LEARN10_DAILY_TOKENS") || 400000), used = await tokensToday(); if (used >= budget) return { ok: true, budget_hit: true, used, budget, results: [] };
  const n = Math.min(16, Math.max(1, Number(b.n) || 8)); const PAR = Math.max(1, Math.min(6, Number(Deno.env.get("LEARN10_PAR")) || 4)); const all = await rest("aivault_pool_agents?or=(id.lt.ag-1,id.gte.ah)&select=id,domain,persona&order=id.asc&limit=1400");
  const locks = await rest("aivault_floor_state?k=like.learnlock:*&select=k,v&limit=2000"); const busy = new Set(locks.filter((x: any) => Date.parse(x.v?.until) > Date.now()).map((x: any) => x.k.slice(10)));
  const ln = await rest(`aivault_pool_agent_learning?created_at=gte.${new Date(Date.now() - 7 * 864e5).toISOString()}&select=agent_id&limit=5000`); const c: Record<string, number> = {}; ln.forEach((x: any) => c[x.agent_id] = (c[x.agent_id] || 0) + 1);
  const ds = ["av", "code", "llm", "img"]; const pick: any[] = []; const pools = ds.map((d) => all.filter((a: any) => districtOf(a.domain) === d && !busy.has(a.id)).sort((x: any, y: any) => (c[x.id] || 0) - (c[y.id] || 0) || Math.random() - .5));
  for (let i = 0; pick.length < n && i < 50; i++) { const p = pools[i % 4]; const a = p.shift(); if (a) pick.push(a); }
  const results: any[] = []; let skipped = busy.size;
  // pd2：一次 4 位代理平行學習（各自獨立；遇到限流或預算上限就停）
  const one = async (ag: any): Promise<any> => { if (!(await lock(ag.id))) { skipped++; return null; } const d = districtOf(ag.domain);
    try { const voice = !b.force_ebook && !b.force_selfdev && !b.force_domain && (FORCE_VIDEO || Math.random() < (VW[d] || .4)); let pt: string[] = []; if (!voice && Deno.env.get("PLAN_OFF") !== "1") pt = await approvedTopics(d).catch(() => []);
      let eb: any = null; if (!voice && Deno.env.get("LEARN_POOLBOOK_OFF") !== "1" && (b.force_poolbook || Math.random() < .3)) eb = await poolBookSession(ag).catch(() => null);
      if (!eb && !voice && Deno.env.get("LEARN_EBOOK_OFF") !== "1" && (b.force_ebook || Math.random() < .25)) eb = await ebookSession(ag);
      if (eb) results.push({ district: d, voice, ebook: true, ...eb });
      else if (!voice && Deno.env.get("LEARN_DOMAIN_OFF") !== "1" && DOMAIN[d] && (b.force_domain || Math.random() < .5)) { const L = DOMAIN[d]; const t = d === "av" && Math.random() < .7 ? L[Math.floor(Math.random() * 7)] : L[Math.floor(Math.random() * L.length)]; /* vc1：影音區優先研究中文聲音複製 TTS */ results.push({ district: d, voice, domain: true, ...(await session(ag, t, "模型：")) }); }
      else if (!voice && Deno.env.get("LEARN_SELFDEV_OFF") !== "1" && (b.force_selfdev || Math.random() < .2)) { const mine = await rest(`aivault_pool_agent_learning?agent_id=eq.${ag.id}&topic=like.自研*&select=topic&limit=500`); const c: Record<string, number> = {}; mine.forEach((x: any) => c[x.topic] = (c[x.topic] || 0) + 1); const t = [...SELFDEV].sort((a, z) => (c["自研：" + a[0]] || 0) - (c["自研：" + z[0]] || 0) || Math.random() - .5)[0]; results.push({ district: d, voice, selfdev: true, ...(await session(ag, t, "自研：")) }); }
      else if (pt.length) { const tp = pt[Math.floor(Math.random() * pt.length)]; results.push({ district: d, voice, plan: true, ...(await session(ag, [tp, tp, tp], "計畫：")) }); }
      else results.push({ district: d, voice, ...(voice ? await session(ag) : await learnOne(ag)) }); }
    catch (e) { const msg = String((e as any)?.message || e); results.push({ agent: ag.id, error: msg.slice(0, 200) }); if (/429|LLM_FAILED/.test(msg)) { await unlock(ag.id); return { ok: true, rate_limited: true, used, budget, skipped_locked: skipped, results }; } }
    await unlock(ag.id);
    if (used + results.reduce((s, r) => s + (Number(r.usage?.total) || 0), 0) >= budget) return { ok: true, budget_hit: true, used, budget, skipped_locked: skipped, results }; return null; };
  for (let k = 0; k < pick.length; k += PAR) { const rs = await Promise.all(pick.slice(k, k + PAR).map(one)); const stop = rs.find((x) => x); if (stop) return stop; }
  return { ok: true, used, budget, skipped_locked: skipped, results };
}
