/** Tiered Dark Star memory policy: logical budgets measured in Unicode code points.
 * These are targets for retrieval/retention, NOT model context lengths.
 */
export type MemoryTier = "working" | "short" | "episodic" | "long" | "self";
export const MEMORY_BUDGETS: Record<MemoryTier, number | null> = {
  working: 100_000,
  short: 1_000_000,
  episodic: 10_000_000,
  long: 100_000_000,
  self: null, // durable, not unlimited disclosure or retention
};
export type MemoryCandidate = {
  id: number;
  tier: MemoryTier;
  content: string;
  importance: number;
  confidence: number;
  occurredAt: string;
  expiresAt?: string | null;
  deletedAt?: string | null;
  protected?: boolean;
};
export function rankMemory(candidate: MemoryCandidate, nowMs: number): number {
  const ageDays = Math.max(0, (nowMs - Date.parse(candidate.occurredAt)) / 86400000);
  return Math.max(0, Math.min(10, candidate.importance)) * 10 +
    Math.max(0, Math.min(1, candidate.confidence)) * 15 +
    (candidate.protected ? 5 : 0) - Math.log1p(ageDays) * 3;
}
export function selectMemories(
  items: MemoryCandidate[], maxChars: number, nowMs: number,
): MemoryCandidate[] {
  const selected: MemoryCandidate[] = [];
  let used = 0;
  for (const m of [...items].filter((x) =>
    !x.deletedAt && (!x.expiresAt || Date.parse(x.expiresAt) > nowMs)
  ).sort((a, b) => rankMemory(b, nowMs) - rankMemory(a, nowMs) || a.id - b.id)) {
    const size = Array.from(m.content).length;
    if (size + used > maxChars) continue;
    selected.push(m);
    used += size;
  }
  return selected;
}
