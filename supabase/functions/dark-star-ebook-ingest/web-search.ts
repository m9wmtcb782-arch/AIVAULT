// ?feature=web-search：免費網路搜尋（Bing RSS → DuckDuckGo HTML 備援），只回標題／網址／摘要，不呼叫付費 AI。
import { parseResults } from "../dark-star-photo-solve/legal-research.ts";
const H = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", "Content-Type": "application/json" };
const out = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: H });
async function get(url: string) {
  const r = await fetch(url, { headers: { "Accept": "text/html,application/rss+xml", "Accept-Language": "zh-TW,zh;q=0.9", "User-Agent": "Mozilla/5.0 AIVAULT" }, signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw Error("HTTP " + r.status);
  return (await r.text()).slice(0, 700000);
}
export async function webSearch(r: Request) {
  if (r.method === "OPTIONS") return new Response("ok", { headers: H });
  try {
    const b = await r.json().catch(() => ({}));
    const q = String(b.q || "").trim().slice(0, 200);
    if (q.length < 2) return out({ error: "q required" }, 400);
    let rows: { title: string; url: string; snippet: string }[] = [], engine = "";
    for (const [name, url] of [["bing", "https://www.bing.com/search?format=rss&setlang=zh-Hant&cc=TW&q=" + encodeURIComponent(q)], ["duckduckgo", "https://html.duckduckgo.com/html/?kl=tw-tzh&q=" + encodeURIComponent(q)]]) {
      try { rows = parseResults(await get(url)).filter((x) => /^https?:\/\//.test(x.url)); if (rows.length) { engine = name; break; } } catch { /* next */ }
    }
    const seen = new Set<string>();
    rows = rows.filter((x) => !seen.has(x.url) && seen.add(x.url)).slice(0, Math.min(8, Number(b.n) || 5)).map((x) => ({ title: x.title.slice(0, 160), url: x.url, snippet: x.snippet.slice(0, 400) }));
    return out({ q, engine, results: rows, checked_at: new Date().toISOString() });
  } catch (e) { return out({ error: String((e as any)?.message || e) }, 500); }
}
