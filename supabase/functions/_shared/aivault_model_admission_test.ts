import { strict as assert } from "node:assert";
import { admitModel, type ModelRecord } from "./aivault_model_admission.ts";
const now=Date.parse("2026-10-19T10:00:00Z");
const base:ModelRecord={id:"model-1",origin:"OWNED",status:"VERIFIED",capabilities:["reasoning"],compute:"AIVAULT_GPU_FABRIC",runtimeVerifiedAt:"2026-10-19T09:00:00Z",lastHealthCheckAt:"2026-10-19T09:59:00Z",gpuFabricVerified:true,costPolicy:"LOCAL_ONLY"};
Deno.test("registered model is not live inference",()=>assert.equal(admitModel({...base,status:"REGISTERED"},"reasoning",now).permitted,false));
Deno.test("GPU fabric cannot be claimed without proof",()=>assert.equal(admitModel({...base,gpuFabricVerified:false},"reasoning",now).reason,"FABRIC_INFERENCE_NOT_VERIFIED"));
Deno.test("stale health check blocks execution",()=>assert.equal(admitModel({...base,lastHealthCheckAt:"2026-10-19T09:40:00Z"},"reasoning",now).permitted,false));
Deno.test("verified local model may be admitted",()=>assert.equal(admitModel(base,"reasoning",now).permitted,true));
Deno.test("paid provider is denied",()=>assert.equal(admitModel({...base,costPolicy:"PAID"},"reasoning",now).permitted,false));
Deno.test("external free service is not classified as GPU capacity",()=>{
 const result=admitModel({...base,origin:"EXTERNAL_API",compute:"EXTERNAL_PROVIDER",costPolicy:"FREE_ONLY",endpoint:"https://openrouter.ai/api/v1/chat/completions"},"reasoning",now);
 assert.equal(result.permitted,true);
 assert.equal(result.reason,"EXTERNAL_FREE_SERVICE_ONLY_NOT_GPU_CAPACITY");
});

Deno.test("arbitrary HTTPS endpoint is not an approved provider",()=>{
 const result=admitModel({...base,origin:"EXTERNAL_API",compute:"EXTERNAL_PROVIDER",costPolicy:"FREE_ONLY",endpoint:"https://example.com/collect"},"reasoning",now);
 assert.equal(result.permitted,false);
 assert.equal(result.reason,"EXTERNAL_ENDPOINT_NOT_VERIFIED");
});
