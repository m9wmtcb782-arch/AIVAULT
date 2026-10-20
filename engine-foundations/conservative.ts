/** V0.3 conservative, contradiction-aware inference.
 * PROVEN only if there is positive support and no opposing evidence.
 * A conflicted premise cannot trigger a new rule. No paid APIs.
 */
import type { Evidence, Truth } from "./reasoner.ts";
import type { Rule, ChainResult, DerivedFact } from "./chain.ts";
export function inferConservatively(
  evidence: readonly Evidence[], rules: readonly Rule[],
  opts: { maxRounds?: number; maxFacts?: number; now?: Date } = {}
): ChainResult {
  const now = opts.now ?? new Date();
  const maxRounds = Math.min(100,Math.max(1,opts.maxRounds ?? 16));
  const maxFacts = Math.min(10000,Math.max(1,opts.maxFacts ?? 1000));
  const pos = new Map<string, Set<string>>();
  const neg = new Map<string, Set<string>>();
  const derivations = new Map<string, Set<string>>();
  const names = new Set<string>();
  const add = (map: Map<string,Set<string>>, key:string, id:string): boolean => {
    let values=map.get(key); if (!values) { values=new Set();map.set(key,values); }
    const before=values.size;values.add(id);return values.size!==before;
  };
  const validUrl = (url:string):boolean => { try { const u=new URL(url); return u.protocol==="https:" || u.protocol==="http:"; } catch { return false; } };
  for (const e of evidence) {
    if (!e.verified || !validUrl(e.sourceUrl) || (e.expiresAt && (!Number.isFinite(Date.parse(e.expiresAt)) || Date.parse(e.expiresAt)<=now.getTime()))) continue;
    names.add(e.proposition);
    add(e.supports?pos:neg,e.proposition,e.id);
  }
  const truth = (key:string): Truth => {
    const p=(pos.get(key)?.size??0)>0,n=(neg.get(key)?.size??0)>0;
    return p&&n?"CONFLICT":p?"PROVEN":n?"REFUTED":"UNKNOWN";
  };
  // Iteration is snapshot-based to avoid order-dependent chaining.
  let iterations=0, truncated=false, changed=true;
  while (changed && iterations<maxRounds) {
    changed=false; iterations++;
    const eligible=rules.filter(r=>r.verified && validUrl(r.sourceUrl) && r.premises.length>0 && r.premises.every(p=>truth(p)==="PROVEN"));
    for(const r of eligible) {
      if(!names.has(r.conclusion) && names.size>=maxFacts) { truncated=true;continue; }
      names.add(r.conclusion);
      if(add(r.supports?pos:neg,r.conclusion,"rule:"+r.id)) changed=true;
      add(derivations,r.conclusion,r.id);
    }
  }
  if(changed) truncated=true;
  const facts:DerivedFact[]=[...names].sort().map(proposition=>({
    proposition,truth:truth(proposition),
    evidenceIds:[...(pos.get(proposition)??[]),...(neg.get(proposition)??[])].filter(x=>!x.startsWith("rule:")),
    ruleIds:[...(derivations.get(proposition)??[])]
  }));
  return {facts,iterations,truncated};
}
