import {strict as assert} from "node:assert";
import {researchWithAdapters} from "./research-adapter.ts";
const source={url:"https://example.org/report",title:"Report",retrievedAt:"2026-10-20T00:00:00Z",sourceId:"source1",content:"The report states that the river level rose on Monday."};
const adapters={
 fetchSource:async()=>source,
 extractProposals:async()=>[
 {proposition:"river level rose",supports:true,exactQuote:"river level rose on Monday"},
 {proposition:"fabricated",supports:true,exactQuote:"this quote does not exist"}
 ],
 verifySource:async()=>true
};
const result=await researchWithAdapters(source.url,adapters);
assert.equal(result.status,"EVIDENCE_READY");
assert.equal(result.rejected,1);
assert.equal(result.findings.facts.find(f=>f.proposition==="river level rose")?.truth,"PROVEN");
await assert.rejects(()=>researchWithAdapters("http://example.org",adapters),/HTTPS_SOURCE_REQUIRED/);
await assert.rejects(()=>researchWithAdapters(source.url,{...adapters,fetchSource:async()=>({...source,url:"https://other.org"})}),/SOURCE_ORIGIN_MISMATCH/);
console.log("research adapter V0.5 tests passed");
