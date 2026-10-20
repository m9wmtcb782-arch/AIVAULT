/** V0.7 automatic worker admission and engine routing. Pure logic, no network calls.
 * A registered worker is NOT a running inference model.
 */
export type Worker = {
 id:string; enabled:boolean; modelReady:boolean; runtimeReady:boolean;
 capabilities:readonly string[]; lastSeenAt:number;
};
export type Admission = {workerId:string; status:"READY"|"BLOCKED"; reason:string};
export function admit(worker:Worker, now:number, maxAgeMs=120000):Admission {
 if(!/^Worker-[0-9]{4,9}$/.test(worker.id)) return {workerId:worker.id,status:"BLOCKED",reason:"INVALID_WORKER_ID"};
 if(!worker.enabled) return {workerId:worker.id,status:"BLOCKED",reason:"DISABLED"};
 if(!worker.modelReady) return {workerId:worker.id,status:"BLOCKED",reason:"MODEL_NOT_READY"};
 if(!worker.runtimeReady) return {workerId:worker.id,status:"BLOCKED",reason:"RUNTIME_NOT_READY"};
 if(!Number.isFinite(worker.lastSeenAt)||worker.lastSeenAt>now||now-worker.lastSeenAt>maxAgeMs) return {workerId:worker.id,status:"BLOCKED",reason:"STALE_HEARTBEAT"};
 if(!worker.capabilities.includes("reasoning")) return {workerId:worker.id,status:"BLOCKED",reason:"REASONING_CAPABILITY_MISSING"};
 return {workerId:worker.id,status:"READY",reason:"ADMITTED"};
}
export function selectWorkers(workers:readonly Worker[],now:number,limit=100):string[] {
 const cap=Math.max(0,Math.min(10000,Math.floor(limit)));
 return workers.filter(w=>admit(w,now).status==="READY").sort((a,b)=>a.id.localeCompare(b.id)).slice(0,cap).map(w=>w.id);
}
export type RegistrySummary={registered:number;ready:number;blocked:number;selected:number};
export function summarizeWorkers(workers:readonly Worker[],now:number,limit=100):RegistrySummary {
 const ready=workers.filter(w=>admit(w,now).status==="READY").length;
 return {registered:workers.length,ready,blocked:workers.length-ready,selected:Math.min(ready,Math.max(0,Math.min(10000,Math.floor(limit))))};
}
