export function benchmarkChecksum(elements: number, iterations: number): number {
  let sum=0;
  for(let i=0;i<Math.min(1024,elements);i++){
    let x=(i+1)>>>0;
    for(let j=0;j<iterations;j++){x=(Math.imul(x,1664525)+1013904223)>>>0;x=(x^(x>>>13))>>>0;x=Math.imul(x,2246822519)>>>0;x=(x^(x>>>16))>>>0;}
    sum=(sum+x)>>>0;
  }
  return sum;
}
export function compatibleGpuTask(node: any, task: any): boolean {
  const payload=task.payload || {};
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
