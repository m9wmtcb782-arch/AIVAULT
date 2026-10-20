/** V0.4 Worker-0001 evidence intake: no fetching or paid API calls.
 * Only accepts externally supplied source excerpts, not invented claims.
 * Extracts explicit marked propositions, leaving ambiguous prose for review.
 */
import { inferConservatively } from "./conservative.ts";
import type { Evidence } from "./reasoner.ts";
import type { Rule } from "./chain.ts";
export type ResearchDocument = {
  url: string; title: string; retrievedAt: string; content: string;
  sourceId: string; extractionVerified: boolean;
};
export type IntakeClaim = { proposition: string; supports: boolean; quote: string; sourceId: string; sourceUrl: string; verified: boolean };
export type ResearchOutput = {
  workerId: string; status: "NEEDS_REVIEW" | "EVIDENCE_READY" | "BLOCKED";
  claims: IntakeClaim[]; findings: ReturnType<typeof inferConservatively>;
  errors: string[];
};
function safeUrl(raw:string):boolean {
  try {const u=new URL(raw);return ["https:","http:"].includes(u.protocol)&&!!u.hostname;}catch{return false;}
}
/** Explicit claim syntax: [CLAIM:+] proposition or [CLAIM:-] proposition.
 * The markers must be present in supplied material. No automatic NLP claim invention.
 */
export function extractClaims(document: ResearchDocument): IntakeClaim[] {
  if (!safeUrl(document.url) || !Number.isFinite(Date.parse(document.retrievedAt))) return [];
  const claims: IntakeClaim[] = [];
  for (const line of document.content.split(/\r?\n/).slice(0,1000)) {
    const match = /^\s*\[CLAIM:([+-])\]\s*(.{1,300})\s*$/.exec(line);
    if (!match) continue;
    claims.push({
      proposition:match[2].trim(),supports:match[1]==="+",quote:line.trim(),
      sourceId:document.sourceId,sourceUrl:document.url,
      verified:document.extractionVerified
    });
    if (claims.length>=100) break;
  }
  return claims;
}
export function researchWorker0001(
  document: ResearchDocument, rules: readonly Rule[] = []
): ResearchOutput {
  const workerId="Worker-0001";
  const errors:string[]=[];
  if (!safeUrl(document.url)) errors.push("INVALID_SOURCE_URL");
  if (!Number.isFinite(Date.parse(document.retrievedAt))) errors.push("INVALID_RETRIEVAL_TIME");
  if (!document.content.trim()) errors.push("EMPTY_SOURCE");
  if (errors.length) return {workerId,status:"BLOCKED",claims:[],findings:inferConservatively([],[]),errors};
  const claims=extractClaims(document);
  if (!claims.length) errors.push("NO_EXPLICIT_CLAIMS: requires verified extraction or manual review");
  if (!document.extractionVerified) errors.push("UNVERIFIED_EXTRACTION");
  const evidence:Evidence[]=claims.map((c,i)=>({
    id:c.sourceId+":"+i,proposition:c.proposition,supports:c.supports,
    sourceUrl:c.sourceUrl,verified:c.verified
  }));
  const findings=inferConservatively(evidence,rules);
  return {workerId,status:claims.length&&document.extractionVerified?"EVIDENCE_READY":"NEEDS_REVIEW",claims,findings,errors};
}
