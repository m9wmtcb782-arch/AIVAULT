import {strict as assert} from "node:assert";
import {runThreeEngines} from "./three-engine-runtime.ts";
const now=1000000;
const task={id:"t1",authorized:true,now,worker:{id:"Worker-0001",enabled:true,modelReady:true,runtimeReady:true,capabilities:["reasoning"],lastSeenAt:now},ann:{status:"FALLBACK_RULE" as const,score:null,reason:"no_accepted_model"},rules:{truth:"PROVEN" as const,evidenceIds:["e1"]}};
let calls=0;
const execute=async(t:typeof task)=>{calls++;return {taskId:t.id,workerId:t.worker.id,success:true,output:"actual output",verified:true};};
async function main(){
 assert.equal((await runThreeEngines({...task,authorized:false},execute)).phase,"BLOCKED");
 assert.equal(calls,0);
 assert.equal((await runThreeEngines(task,execute)).phase,"VERIFIED");
 assert.equal(calls,1);
 assert.equal((await runThreeEngines({...task,ann:{status:"ACCEPTED",score:0.1,reason:"mlp"}},execute)).phase,"BLOCKED");
 assert.equal(calls,1);
 const bad=await runThreeEngines(task,async t=>({taskId:t.id,workerId:"Worker-9999",success:true,output:"x",verified:true}));
 assert.equal(bad.phase,"FAILED");
 console.log("three-engine runtime tests passed");
}
main().catch(e=>{console.error(e);process.exitCode=1;});
