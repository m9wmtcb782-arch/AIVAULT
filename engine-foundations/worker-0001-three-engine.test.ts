import {strict as assert} from "node:assert";
import {runWorker0001EvidenceTask} from "./worker-0001-three-engine.ts";
const now=1000000;
const base={
 taskId:"task-1",proposition:"A",now,authorized:true,
 document:{url:"https://example.org/evidence",title:"Test",retrievedAt:"2026-10-20T00:00:00Z",content:"[CLAIM:+] A",sourceId:"src-1",extractionVerified:true},
 worker:{id:"Worker-0001",enabled:true,modelReady:true,runtimeReady:true,capabilities:["reasoning"],lastSeenAt:now},
 ann:{status:"FALLBACK_RULE" as const,score:null,reason:"no_accepted_model"},
};
async function main(){
 const yes=await runWorker0001EvidenceTask({...base,verify:async()=>true});
 assert.equal(yes.phase,"VERIFIED");
 assert.equal(yes.annUsed,false);
 const no=await runWorker0001EvidenceTask({...base,verify:async()=>false});
 assert.equal(no.phase,"FAILED");
 const unknown=await runWorker0001EvidenceTask({...base,proposition:"B",verify:async()=>{throw Error("should not dispatch")}});
 assert.equal(unknown.phase,"BLOCKED");
 const unverified=await runWorker0001EvidenceTask({...base,document:{...base.document,extractionVerified:false},verify:async()=>true});
 assert.equal(unverified.phase,"BLOCKED");
 console.log("worker-0001 three-engine tests passed");
}
main().catch(e=>{console.error(e);process.exitCode=1;});
