/** V0.5 evidence adapter: bridges existing research-engine/source-verification
 * through injected functions. No network access occurs unless caller supplies adapters.
 * Never trusts model-generated claims without a literal source quote.
 */
import { researchWorker0001, type ResearchDocument, type ResearchOutput } from "./worker-0001.ts";
import type { Rule } from "./chain.ts";
export type ResearchSource = { url:string; title:string; retrievedAt:string; sourceId:string; content:string };
export type ProposedClaim = { proposition:string; supports:boolean; exactQuote:string };
export type FetchSource = (url:string)=>Promise<ResearchSource>;
export type ExtractProposals = (source:ResearchSource)=>Promise<ProposedClaim[]>;
export type VerifySource = (source:ResearchSource, claim:ProposedClaim)=>Promise<boolean>;
export type ResearchAdapters = { fetchSource:FetchSource; extractProposals:ExtractProposals; verifySource:VerifySource };
export type WorkerResearchResult = ResearchOutput & { rejected:number; sourceUrl:string };
function permittedUrl(raw:string):boolean {
  try {const u=new URL(raw);return u.protocol==="https:" && !!u.hostname && !u.username && !u.password;} catch {return false;}
}
/** Caller must enforce host allowlists, DNS/IP SSRF checks, robots, auth, rate limits,
 * redirects, size limits and timeouts at the actual HTTP boundary.
 */
export async function researchWithAdapters(
  url:string, adapters:ResearchAdapters, rules:readonly Rule[]=[],
  limits:{maxClaims?:number;maxChars?:number}={}
):Promise<WorkerResearchResult> {
  if(!permittedUrl(url)) throw new Error("HTTPS_SOURCE_REQUIRED");
  const maxChars=Math.min(100000,Math.max(1,limits.maxChars??50000));
  const maxClaims=Math.min(100,Math.max(1,limits.maxClaims??30));
  const source=await adapters.fetchSource(url);
  if(!permittedUrl(source.url) || new URL(source.url).origin!==new URL(url).origin)
    throw new Error("SOURCE_ORIGIN_MISMATCH");
  if(source.content.length>maxChars) throw new Error("SOURCE_TOO_LARGE");
  if(!Number.isFinite(Date.parse(source.retrievedAt))) throw new Error("INVALID_RETRIEVAL_TIME");
  const proposals=(await adapters.extractProposals(source)).slice(0,maxClaims);
  let rejected=0;
  const lines:string[]=[];
  for(const claim of proposals) {
    const quote=claim.exactQuote.trim();
    if(!quote || quote.length<8 || !source.content.includes(quote) ||
       !claim.proposition.trim() || claim.proposition.length>300) {rejected++;continue;}
    if(!(await adapters.verifySource(source,claim))) {rejected++;continue;}
    // Encoded line carries a verified proposition, while quote anchoring stays in adapter result.
    lines.push("[CLAIM:"+(claim.supports?"+":"-")+"] "+claim.proposition.trim());
  }
  const document:ResearchDocument={
    url:source.url,title:source.title,retrievedAt:source.retrievedAt,
    sourceId:source.sourceId,content:lines.join("\n"),extractionVerified:lines.length>0
  };
  const result=researchWorker0001(document,rules);
  return {...result,rejected,sourceUrl:source.url};
}
