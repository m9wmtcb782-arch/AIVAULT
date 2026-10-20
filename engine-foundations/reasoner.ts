/** CPU-first evidence reasoner V0.1. Does not invoke models or paid APIs. */
export type Truth = "PROVEN" | "REFUTED" | "CONFLICT" | "UNKNOWN";
export type Evidence = { id: string; proposition: string; supports: boolean; sourceUrl: string; verified: boolean; expiresAt?: string };
export type Finding = { proposition: string; truth: Truth; evidenceIds: string[]; sourceUrls: string[] };
export function reason(proposition: string, items: readonly Evidence[], now = new Date()): Finding {
  const valid = items.filter(e => e.proposition === proposition && e.verified && /^https?:\/\//.test(e.sourceUrl) && (!e.expiresAt || new Date(e.expiresAt).getTime() > now.getTime()));
  const positive = valid.some(e => e.supports);
  const negative = valid.some(e => !e.supports);
  const truth: Truth = positive && negative ? "CONFLICT" : positive ? "PROVEN" : negative ? "REFUTED" : "UNKNOWN";
  return { proposition, truth, evidenceIds: valid.map(e => e.id), sourceUrls: [...new Set(valid.map(e => e.sourceUrl))] };
}
export function normalizeResearchUrl(input: string): string {
  const url = new URL(input);
  if (!["http:","https:"].includes(url.protocol)) throw new Error("UNSUPPORTED_PROTOCOL");
  url.hash = "";
  url.hostname = url.hostname.toLowerCase();
  for (const k of [...url.searchParams.keys()]) if (/^(utm_|fbclid$|gclid$)/i.test(k)) url.searchParams.delete(k);
  url.searchParams.sort();
  return url.toString();
}
export type ResearchLease = { normalizedUrl: string; workerId: string; expiresAt: number };
/** Local scheduler prototype; production must use an atomic DB transaction and durable leases. */
export class LocalResearchScheduler {
  private leases: ResearchLease[] = [];
  constructor(private readonly maxPerUrl = 5) {}
  acquire(url: string, workerId: string, now = Date.now(), ttlMs = 60000): ResearchLease | null {
    const normalizedUrl = normalizeResearchUrl(url);
    this.leases = this.leases.filter(l => l.expiresAt > now);
    if (this.leases.some(l => l.normalizedUrl === normalizedUrl && l.workerId === workerId)) return null;
    if (this.leases.filter(l => l.normalizedUrl === normalizedUrl).length >= this.maxPerUrl) return null;
    const lease = { normalizedUrl, workerId, expiresAt: now + ttlMs };
    this.leases.push(lease);
    return lease;
  }
  release(workerId: string, url: string): void {
    const normalizedUrl = normalizeResearchUrl(url);
    this.leases = this.leases.filter(l => !(l.workerId === workerId && l.normalizedUrl === normalizedUrl));
  }
}
