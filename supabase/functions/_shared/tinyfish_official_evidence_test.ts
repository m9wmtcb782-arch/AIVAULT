import { strict as assert } from "node:assert";
import { collectOfficialEvidence, isApprovedOfficialUrl } from "./tinyfish_official_evidence.ts";
Deno.test("official host must match exactly",()=>{
 assert(isApprovedOfficialUrl("https://openrouter.ai/docs"));
 assert(!isApprovedOfficialUrl("https://openrouter.ai.evil.example/docs"));
 assert(!isApprovedOfficialUrl("http://openrouter.ai/docs"));
 assert(!isApprovedOfficialUrl("https://openrouter.ai@evil.example/docs"));
});
Deno.test("bounded official page records evidence but never free capacity",async()=>{
 const fetcher = (async()=>new Response("<title>API docs</title><p>Free models</p>",{
  status:200,headers:{"content-type":"text/html"}
 })) as typeof fetch;
 const result=await collectOfficialEvidence("https://openrouter.ai/docs",fetcher);
 assert.equal(result.sourceVerified,true);
 assert.equal(result.freeCapacityVerified,false);
 assert.equal(result.title,"API docs");
});
Deno.test("oversize page is blocked",async()=>{
 const fetcher=(async()=>new Response("x".repeat(66000),{
  status:200,headers:{"content-type":"text/plain"}
 })) as typeof fetch;
 await assert.rejects(()=>collectOfficialEvidence("https://openrouter.ai/docs",fetcher),/TOO_LARGE/);
});

Deno.test("unapproved domain rejected before network request", async () => {
 let calls = 0;
 const fake = (async () => { calls++; return new Response("ok"); }) as typeof fetch;
 await assert.rejects(() => collectOfficialEvidence("https://example.org/docs", fake));
 assert.equal(calls, 0);
});

Deno.test("reject redirected official page response", async () => {
 const fake = (async () => {
  const response = new Response("<title>Moved</title>", {headers: {"content-type":"text/html"}});
  Object.defineProperty(response, "redirected", {value: true});
  return response;
 }) as typeof fetch;
 await assert.rejects(() => collectOfficialEvidence("https://openrouter.ai/docs", fake), /DESTINATION_MISMATCH/);
});

Deno.test("reject evidence whose response URL differs", async () => {
 const fake = (async () => {
  const response = new Response("<title>Wrong origin</title>", {headers: {"content-type":"text/html"}});
  Object.defineProperty(response, "url", {value: "https://other.example/page"});
  return response;
 }) as typeof fetch;
 await assert.rejects(() => collectOfficialEvidence("https://openrouter.ai/docs", fake), /DESTINATION_MISMATCH/);
});
Deno.test("overlong official URL rejected before network request", async () => {
 let calls = 0;
 const fake = (async () => { calls++; return new Response("ok"); }) as typeof fetch;
 await assert.rejects(() => collectOfficialEvidence("https://openrouter.ai/docs/" + "a".repeat(600), fake));
 assert.equal(calls, 0);
});
