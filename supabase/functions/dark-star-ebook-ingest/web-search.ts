// ?feature=web-search：免費網路搜尋（Google 新聞 RSS＋維基百科＋DuckDuckGo＋Bing，並行、過濾不相干），只回標題／網址／摘要，不呼叫付費 AI。
import { parseResults } from "../dark-star-photo-solve/legal-research.ts";
const H = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", "Content-Type": "application/json" };
const out = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: H });
async function get(url: string) {
  const r = await fetch(url, { headers: { "Accept": "text/html,application/rss+xml", "Accept-Language": "zh-TW,zh;q=0.9", "User-Agent": "Mozilla/5.0 AIVAULT" }, signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw Error("HTTP " + r.status);
  return (await r.text()).slice(0, 700000);
}
// 結果至少要含查詢中的一個詞（中文取 2 字片段），避免搜尋引擎依伺服器所在地回不相干的結果
function relevant(q: string, t: string) {
  const keys: string[] = [];
  for (const w of q.toLowerCase().split(/[\s，。、？！?!,.]+/)) { if (/[\u3400-\u9fff]/.test(w)) { for (let i = 0; i + 2 <= w.length; i++) keys.push(w.slice(i, i + 2)); } else if (w.length >= 3) keys.push(w); }
  if (!keys.length) return true; t = t.toLowerCase();
  const hit = keys.filter((k) => t.includes(k)).length;
  return hit >= Math.max(1, Math.ceil(keys.length / 2));
}
export async function webSearch(r: Request) {
  if (r.method === "OPTIONS") return new Response("ok", { headers: H });
  try {
    const b = await r.json().catch(() => ({}));
    const q = String(b.q || "").trim().slice(0, 200);
    if (q.length < 2) return out({ error: "q required" }, 400);
    let rows: { title: string; url: string; snippet: string }[] = [], engines: string[] = [];
    const enc = encodeURIComponent(q);
    const srcs: [string, () => Promise<{ title: string; url: string; snippet: string }[]>][] = [
      ["google-news", async () => parseResults(await get("https://news.google.com/rss/search?hl=zh-TW&gl=TW&ceid=TW:zh-Hant&q=" + enc)).slice(0, 4)],
      ["wikipedia", async () => { const j = JSON.parse(await get("https://zh.wikipedia.org/w/api.php?action=query&list=search&format=json&utf8=1&srlimit=3&variant=zh-tw&srsearch=" + enc)); return ((j.query && j.query.search) || []).map((x: any) => ({ title: x.title + "（維基百科）", url: "https://zh.wikipedia.org/zh-tw/" + encodeURIComponent(x.title), snippet: String(x.snippet || "").replace(/<[^>]+>/g, "") })); }],
      ["duckduckgo", async () => parseResults(await get("https://html.duckduckgo.com/html/?kl=tw-tzh&q=" + enc))],
      ["bing", async () => parseResults(await get("https://www.bing.com/search?format=rss&mkt=zh-TW&setlang=zh-Hant&cc=TW&q=" + enc))],
    ];
    const got = await Promise.allSettled(srcs.map(([, f]) => f()));
    got.forEach((g, i) => { if (g.status !== "fulfilled") return; const ok = g.value.filter((x) => /^https?:\/\//.test(x.url) && (srcs[i][0] === "wikipedia" || relevant(q, x.title + " " + x.snippet))); if (ok.length) { engines.push(srcs[i][0]); rows.push(...ok); } });
    const engine = engines.join(",");
    const seen = new Set<string>();
    rows = rows.filter((x) => !seen.has(x.url) && seen.add(x.url)).slice(0, Math.min(8, Number(b.n) || 5)).map((x) => ({ title: x.title.slice(0, 160), url: x.url, snippet: x.snippet.slice(0, 400) }));
    return out({ q, engine, results: rows, checked_at: new Date().toISOString() });
  } catch (e) { return out({ error: String((e as any)?.message || e) }, 500); }
}
