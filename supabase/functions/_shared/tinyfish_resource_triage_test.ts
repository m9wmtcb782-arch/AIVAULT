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

Deno.test("local and numeric hosts cannot enter candidate pool", () => {
 for (const url of ["https://localhost/docs","https://127.0.0.1/docs","https://192.168.1.10/api","https://service.local/docs","https://[::1]/docs"]) {
  assert.equal(triageCandidate({title:"x",url,snippet:""}).classification,"REJECTED");
 }
});

Deno.test("mixed discovery candidates remain unverified", () => {
 const hits = triageCandidates([
  {title:"Official",url:"https://openrouter.ai/docs",snippet:"free"},
  {title:"Third party",url:"https://medium.com/example",snippet:"free"},
  {title:"Local",url:"https://127.0.0.1/docs",snippet:"free"},
 ]);
 assert.deepEqual(hits.map(h => h.classification),["OFFICIAL_DOCS","THIRD_PARTY_LEAD","REJECTED"]);
 assert(hits.every(h => !h.verifiedFreeCapacity && !h.usableForInference));
});

Deno.test("real discovery official provider blog is not official API documentation", () => {
 const x=triageCandidate({title:"Free LLM APIs compared",url:"https://openrouter.ai/blog/tutorials/free-llm-apis-compared/",snippet:"free access"});
 assert.equal(x.classification,"THIRD_PARTY_LEAD");
 assert.equal(x.verifiedFreeCapacity,false);
 assert.equal(x.usableForInference,false);
});

Deno.test("provider blog API article is not official documentation", () => {
 const x=triageCandidate({title:"API guide",url:"https://openrouter.ai/blog/api/free-models",snippet:"free"});
 assert.equal(x.classification,"THIRD_PARTY_LEAD");
});

Deno.test("five real TinyFish discovery leads are not verified official API docs", () => {
 const urls=[
  "https://github.com/OuterSpacee/free-ai-apis",
  "https://shaktiwadekar.medium.com/4-free-ai-apis-every-developer-should-know-to-build-llm-apps-4bd7d9fc095a",
  "https://openrouter.ai/blog/tutorials/free-llm-apis-compared/",
  "https://www.youtube.com/watch?v=XaDfy-sZ4tk",
  "https://www.edenai.co/post/top-free-generative-ai-apis-and-open-source-models",
 ];
 const results=triageCandidates(urls.map(url=>({title:"Real discovery lead",url,snippet:"free AI"})));
 assert.equal(results.length,5);
 assert(results.every(hit=>hit.classification==="THIRD_PARTY_LEAD"));
 assert(results.every(hit=>!hit.verifiedFreeCapacity && !hit.usableForInference));
});
