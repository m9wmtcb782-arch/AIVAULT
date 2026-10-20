/** V0.2 deterministic forward chaining with provenance and explicit conflict.
 * A rule is valid only when all premises have independently verified support.
 * This does not parse natural language or establish real-world truth.
 */
import { reason, type Evidence, type Truth } from "./reasoner.ts";
export type Rule = { id: string; premises: readonly string[]; conclusion: string; supports: boolean; sourceUrl: string; verified: boolean };
export type DerivedFact = { proposition: string; truth: Truth; evidenceIds: string[]; ruleIds: string[] };
export type ChainResult = { facts: DerivedFact[]; iterations: number; truncated: boolean };
export function infer(evidence: readonly Evidence[], rules: readonly Rule[], opts: { maxRounds?: number; maxFacts?: number; now?: Date } = {}): ChainResult {
  const maxRounds = Math.min(Math.max(opts.maxRounds ?? 16, 1), 100);
  const maxFacts = Math.min(Math.max(opts.maxFacts ?? 1000, 1), 10000);
  const now = opts.now ?? new Date();
  const names = new Set(evidence.map(e => e.proposition));
  const support = new Map<string, Set<string>>();
  const oppose = new Map<string, Set<string>>();
  const derivations = new Map<string, Set<string>>();
  const validEvidence = evidence.filter(e => e.verified && /^https?:\/\//.test(e.sourceUrl) && (!e.expiresAt || Number.isFinite(Date.parse(e.expiresAt)) && Date.parse(e.expiresAt) > now.getTime()));
  for (const e of validEvidence) {
    const m = e.supports ? support : oppose;
    if (!m.has(e.proposition)) m.set(e.proposition,new Set());
    m.get(e.proposition)!.add(e.id);
  }
  let iterations = 0, truncated = false, changed = true;
  while (changed && iterations < maxRounds) {
    changed = false;
    iterations++;
    for (const r of rules) {
      if (!r.verified || !/^https?:\/\//.test(r.sourceUrl) || r.premises.length === 0) continue;
      if (!r.premises.every(p => (support.get(p)?.size ?? 0) > 0)) continue;
      if (!names.has(r.conclusion) && names.size >= maxFacts) { truncated = true; continue; }
      names.add(r.conclusion);
      const m = r.supports ? support : oppose;
      if (!m.has(r.conclusion)) m.set(r.conclusion,new Set());
      const set = m.get(r.conclusion)!;
      if (!set.has("rule:"+r.id)) { set.add("rule:"+r.id); changed = true; }
      if (!derivations.has(r.conclusion)) derivations.set(r.conclusion,new Set());
      derivations.get(r.conclusion)!.add(r.id);
    }
  }
  if (changed) truncated = true;
  return { iterations, truncated, facts:[...names].sort().map(proposition => {
    const pos = support.get(proposition)?.size ?? 0;
    const neg = oppose.get(proposition)?.size ?? 0;
    const truth: Truth = pos && neg ? "CONFLICT" : pos ? "PROVEN" : neg ? "REFUTED" : "UNKNOWN";
    return { proposition, truth, evidenceIds: [...(support.get(proposition) ?? []), ...(oppose.get(proposition) ?? [])].filter(x => !x.startsWith("rule:")), ruleIds: [...(derivations.get(proposition) ?? [])] };
  }) };
}
