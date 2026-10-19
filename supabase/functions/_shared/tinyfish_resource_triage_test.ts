import { triageCandidate, triageCandidates } from "./tinyfish_resource_triage.ts";
import { strict as assert } from "node:assert";
Deno.test("official docs remain unverified and unusable", () => {
 const x = triageCandidate({title:"OpenRouter",url:"https://openrouter.ai/docs/api/reference/limits",snippet:"Free"});
 assert.equal(x.classification,"OFFICIAL_DOCS");
 assert.equal(x.verifiedFreeCapacity,false);
 assert.equal(x.usableForInference,false);
});
Deno.test("third-party posts are leads, never capacity", () => {
 for (const url of ["https://medium.com/example","https://github.com/example/free-ai","https://youtube.com/watch?v=abc"]) {
  const x = triageCandidate({title:"Free AI",url,snippet:"free"});
  assert.equal(x.classification,"THIRD_PARTY_LEAD");
  assert.equal(x.verifiedFreeCapacity,false);
  assert.equal(x.usableForInference,false);
 }
});
Deno.test("invalid urls rejected", () => {
 for (const url of ["http://openrouter.ai/docs", "javascript:alert(1)", "https://user:pass@openrouter.ai/docs"]) {
  assert.equal(triageCandidate({title:"x",url,snippet:""}).classification,"REJECTED");
 }
});
Deno.test("duplicates suppressed", () => {
 const x = {title:"x",url:"https://openrouter.ai/docs",snippet:""};
 assert.equal(triageCandidates([x,x]).length,1);
});
