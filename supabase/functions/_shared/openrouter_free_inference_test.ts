import { strict as assert } from "node:assert";
import { runOpenRouterFreeInference, validateFreeRequest } from "./openrouter_free_inference.ts";
Deno.test("rejects paid or arbitrary model",()=>{
 assert.throws(()=>validateFreeRequest({prompt:"hello",model:"openai/gpt-4o"}),/FREE_MODEL_ONLY/);
});
Deno.test("disabled gate prevents all network calls",async()=>{
 let calls=0;
 const fake=(async()=>{calls++;return new Response("{}");}) as typeof fetch;
 await assert.rejects(()=>runOpenRouterFreeInference({prompt:"hello",model:"openrouter/free"},
  {apiKey:"dummy",enabled:false,authorized:true,fetcher:fake}),/DISABLED/);
 assert.equal(calls,0);
});
Deno.test("unauthorized gate prevents all network calls",async()=>{
 let calls=0;
 const fake=(async()=>{calls++;return new Response("{}");}) as typeof fetch;
 await assert.rejects(()=>runOpenRouterFreeInference({prompt:"hello",model:"openrouter/free"},
  {apiKey:"dummy",enabled:true,authorized:false,fetcher:fake}),/DISABLED/);
 assert.equal(calls,0);
});
Deno.test("mocked free-only request enforces model and token ceiling",async()=>{
 let payload:Record<string,unknown>={};
 const fake=(async (_url:string|URL|Request,init?:RequestInit)=>{
  payload=JSON.parse(String(init?.body));
  return new Response(JSON.stringify({model:"openrouter/free",choices:[{message:{content:"ok"}}],usage:{total_tokens:3}}),
   {headers:{"content-type":"application/json"}});
 }) as typeof fetch;
 const result=await runOpenRouterFreeInference({prompt:"hello",model:"openrouter/free"},
  {apiKey:"dummy",enabled:true,authorized:true,fetcher:fake});
 assert.equal(payload.model,"openrouter/free");
 assert.equal(payload.max_tokens,128);
 assert.equal(result.text,"ok");
});

Deno.test("provider must return JSON and no secret appears in errors",async()=>{
 const fake=(async()=>new Response("<html>gateway error</html>",{headers:{"content-type":"text/html"}})) as typeof fetch;
 await assert.rejects(()=>runOpenRouterFreeInference({prompt:"hello",model:"openrouter/free"},
  {apiKey:"SECRET_SENTINEL",enabled:true,authorized:true,fetcher:fake}),/INVALID_PROVIDER_CONTENT_TYPE/);
});
