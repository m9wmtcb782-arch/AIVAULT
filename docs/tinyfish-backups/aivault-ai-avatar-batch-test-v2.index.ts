import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const SUPABASE_URL=(Deno.env.get("SUPABASE_URL")||"").replace(/\/$/,"");
const INTERNAL_SECRET=Deno.env.get("AIVAULT_INTERNAL_SECRET")||Deno.env.get("GATEWAY_INTERNAL_SECRET")||Deno.env.get("COMPUTE_COORDINATOR_SECRET")||"";
const GEN=SUPABASE_URL+"/functions/v1/aivault-ai-avatar-generation";
const CORS={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization,apikey,content-type,x-aivault-internal","Access-Control-Allow-Methods":"POST,OPTIONS","Content-Type":"application/json; charset=utf-8"};
const json=(x:any,s=200)=>new Response(JSON.stringify(x),{status:s,headers:CORS});
Deno.serve(async req=>{
 if(req.method==="OPTIONS") return new Response(null,{status:204,headers:CORS});
 if(req.method!=="POST") return json({ok:false,error:"METHOD_NOT_ALLOWED"},405);
 if(!INTERNAL_SECRET || req.headers.get("x-aivault-internal")!==INTERNAL_SECRET) return json({ok:false,error:"INTERNAL_ONLY"},401);
 let body:any={}; try{body=await req.json()}catch{}
 const mode=body.mode||"test";
 const ids=Array.isArray(body.agent_ids)?body.agent_ids.slice(0,2):["auditor","Worker-001"];
 if(mode!=="test" || ids.length!==2) return json({ok:false,error:"TEST_REQUIRES_EXACTLY_TWO_AGENT_IDS"},400);
 const results=[];
 for(const agent_id of ids){
   const r=await fetch(GEN,{method:"POST",headers:{"Content-Type":"application/json","x-aivault-internal":INTERNAL_SECRET},body:JSON.stringify({agent_id})});
   let data:any; try{data=await r.json()}catch{data={raw:await r.text()}};
   results.push({agent_id,http_status:r.status,result:data});
 }
 return json({ok:true,mode:"test_1_male_1_female",results});
});