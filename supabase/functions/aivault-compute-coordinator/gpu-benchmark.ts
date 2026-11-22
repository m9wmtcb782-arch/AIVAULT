export function benchmarkChecksum(elements: number, iterations: number): number {
  let sum=0;
  for(let i=0;i<Math.min(1024,elements);i++){
    let x=(i+1)>>>0;
    for(let j=0;j<iterations;j++){x=(Math.imul(x,1664525)+1013904223)>>>0;x=(x^(x>>>13))>>>0;x=Math.imul(x,2246822519)>>>0;x=(x^(x>>>16))>>>0;}
    sum=(sum+x)>>>0;
  }
  return sum;
}
// t230u: honest CPU worker path. A node with runtime 'cpu' may only run 'cpu-u32-mix' and must report executed_on 'CPU', gpu false.
export function isCpuNode(node: any): boolean { return String(node?.runtime||'').toLowerCase()==='cpu'; }
export function verifyCpuResult(task: any, result: any): boolean {
  const elements=Number(task.elements),iterations=Number(task.iterations);
  return task.type==='cpu-u32-mix' && result.executed_on==='CPU' && result.gpu===false && result.verified===true &&
    Number.isInteger(elements)&&elements>0&&elements<=4096&&Number.isInteger(iterations)&&iterations>0&&iterations<=16&&
    result.elements===elements && result.iterations_per_element===iterations && result.sample_count===Math.min(1024,elements) &&
    Number.isFinite(result.cpu_time_ms)&&result.cpu_time_ms>=0 && result.checksum===benchmarkChecksum(elements,iterations);
}
export function compatibleGpuTask(node: any, task: any): boolean {
  const payload=task.payload || {};
  if(isCpuNode(node)||task.type==='cpu-u32-mix'){
    if(!(isCpuNode(node)&&task.type==='cpu-u32-mix'))return false;
    if(payload.target_node_id && payload.target_node_id !== node.node_id)return false;
    return Number.isInteger(task.elements)&&task.elements>0&&task.elements<=4096&&Number.isInteger(task.iterations)&&task.iterations>0&&task.iterations<=16;
  }
  if(Array.isArray(node.capability?.supported_task_types) && !node.capability.supported_task_types.includes(task.type))return false;
  if((payload.excluded_node_id&&payload.excluded_node_id===node.node_id)||payload.excluded_node_ids?.includes(node.node_id))return false;
  if(task.type==='gpu-tensor-stage')return node.capability?.supported_task_types?.includes('gpu-tensor-stage')===true;
  if(payload.target_node_id && payload.target_node_id !== node.node_id)return false;
  if(node.runtime !== 'webgl2')return true;
  return task.type === 'gpu-u32-mix' && Number.isInteger(task.elements) && task.elements>0 && task.elements<=4096 && Number.isInteger(task.iterations) && task.iterations>0 && task.iterations<=16;
}
export function verifyPortableGpuResult(task: any, result: any): boolean {
  const elements=Number(task.elements),iterations=Number(task.iterations);
  return task.type==='gpu-u32-mix' && ['WebGPU','WebGL2'].includes(result.executed_on) && result.gpu===true && result.verified===true &&
    Number.isInteger(elements)&&elements>0&&elements<=4096&&Number.isInteger(iterations)&&iterations>0&&iterations<=16&&
    result.elements===elements && result.iterations_per_element===iterations && result.sample_count===Math.min(1024,elements) &&
    Number.isFinite(result.gpu_time_ms)&&result.gpu_time_ms>=0 && result.checksum===benchmarkChecksum(elements,iterations);
}

// Visual capacity estimate only: browser wall time includes dispatch and GPU readback.
// Client timings are not attested and must never be used for payment settlement.
export function poolGpuRating(result: any) {
 if(!result || result.benchmark_version!=='pool-u32-v1')return null;
 if(!verifyPortableGpuResult({type:'gpu-u32-mix',elements:4096,iterations:16},result))return null;
 const times=result.benchmark_samples_ms;
 if(!Array.isArray(times)||times.length!==5||!times.every((t:any)=>typeof t==='number'&&Number.isFinite(t)&&t>0))return null;
 const median=[...times].sort((a,b)=>a-b)[2];
 if(Math.abs(median-result.gpu_time_ms)>.001)return null;
 const units=4096*16/(median*1000); // One PGU = one million u32-mix rounds per second.
 if(!Number.isFinite(units)||units<=0)return null;
 return {version:'pool-u32-v1',units,median_ms:median,engine:result.executed_on,samples:5,timing:'browser_wall_with_readback',settlement_eligible:false};
}
