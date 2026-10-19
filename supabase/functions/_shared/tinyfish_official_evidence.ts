// Strictly passive evidence collection: only an explicitly approved official URL.
// A fetched document is evidence for human review, never permission to use an API.
export type PageEvidence = {
 url: string;
 fetchedAt: string;
 httpStatus: number;
 title: string;
 excerpt: string;
 sourceVerified: boolean;
 freeCapacityVerified: false;
};
const approvedHosts = new Set(["openrouter.ai","huggingface.co","ai.google.dev","developers.cloudflare.com"]);
export function isApprovedOfficialUrl(raw: string): boolean {
 try {
  const u = new URL(raw);
  return u.protocol === "https:" && !u.username && !u.password && !u.port &&
    approvedHosts.has(u.hostname.toLowerCase()) && !u.hash && u.pathname.length <= 512 && u.search.length <= 512;
 } catch { return false; }
}
export async function collectOfficialEvidence(
 url: string, fetcher: typeof fetch = fetch
): Promise<PageEvidence> {
 if (!isApprovedOfficialUrl(url)) throw Error("OFFICIAL_URL_NOT_APPROVED");
 const response = await fetcher(url, {
  method: "GET", redirect: "error",
  headers: { accept: "text/html, text/plain" },
  signal: AbortSignal.timeout(6000)
 });
 if (response.redirected || (response.url && response.url !== url)) throw Error("OFFICIAL_DESTINATION_MISMATCH");
 const kind = response.headers.get("content-type") ?? "";
 if (!response.ok || !/^(text\/html|text\/plain)(;|$)/i.test(kind))
  throw Error("OFFICIAL_PAGE_UNAVAILABLE");
 const declared = Number(response.headers.get("content-length") ?? 0);
 if (declared > 65536) throw Error("OFFICIAL_PAGE_TOO_LARGE");
 const reader = response.body?.getReader();
 if (!reader) throw Error("OFFICIAL_PAGE_EMPTY");
 let total = 0;
 const chunks: Uint8Array[] = [];
 try {
  while (true) {
   const next = await reader.read();
   if (next.done) break;
   total += next.value.byteLength;
   if (total > 65536) throw Error("OFFICIAL_PAGE_TOO_LARGE");
   chunks.push(next.value);
  }
 } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
 const bytes = new Uint8Array(total);
 let offset = 0;
 for (const chunk of chunks) { bytes.set(chunk,offset); offset += chunk.byteLength; }
 const html = new TextDecoder().decode(bytes);
 const title = (html.match(/<title[^>]*>([^<]{1,200})<\/title>/i)?.[1] ?? "").trim();
 const excerpt = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi," ")
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi," ")
  .replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim().slice(0,1500);
 return { url, fetchedAt: new Date().toISOString(), httpStatus: response.status,
  title, excerpt, sourceVerified: true, freeCapacityVerified: false };
}
