/** AIVAULT logical learning lanes.
 * 1000 logical lanes != 1000 network connections or model runtimes.
 * Assignment is deterministic; capacity must be enforced by a real backend executor.
 */
export const MAX_LOGICAL_LANES=1000;
export type Assignment={workerId:string;lane:number};
export function assignLearningLanes(workerIds:readonly string[],laneCount=MAX_LOGICAL_LANES):Assignment[]{
 if(!Number.isInteger(laneCount)||laneCount<1||laneCount>MAX_LOGICAL_LANES)throw Error("INVALID_LANE_COUNT");
 const unique=[...new Set(workerIds.filter(Boolean))].sort();
 return unique.map((workerId,index)=>({workerId,lane:index%laneCount}));
}
export type LaneHealth={lane:number;activeExecutions:number;capacity:number;lastHeartbeat:string|null};
export function availableLanes(lanes:readonly LaneHealth[],now=new Date(),timeoutMs=120000):number[]{
 return lanes.filter(l=>l.lane>=0&&l.lane<MAX_LOGICAL_LANES&&l.capacity>0&&l.activeExecutions<l.capacity&&l.lastHeartbeat!==null&&now.getTime()-Date.parse(l.lastHeartbeat)<=timeoutMs).map(l=>l.lane);
}
export function laneSummary(assignments:readonly Assignment[],healthy:readonly number[]){
 const counts=new Map<number,number>();for(const a of assignments)counts.set(a.lane,(counts.get(a.lane)||0)+1);
 return {registeredWorkers:assignments.length,configuredLanes:counts.size,healthyLanes:new Set(healthy).size,workersPerLane:[...counts.values()],note:"Only actual backend execution receipts establish learning activity."};
}
