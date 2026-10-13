/** Read-only normalization of AIVAULT's real Compute Mesh database node shape.
 * Status READY + fresh heartbeat means transport readiness, not voice inference.
 * Never trust client-advertised model verification as proof of authorization.
 */
export function normalizeMeshNodes(rows,{nowMs=Date.now(),freshMs=120000}={}){
 if(!Array.isArray(rows)||!Number.isFinite(nowMs)||!Number.isFinite(freshMs)||freshMs<1000)
  throw new Error("INVALID_MESH_SNAPSHOT");
 return {success:true,nodes:rows.map(row=>{
  const seen=typeof row?.last_seen==="string"?Date.parse(row.last_seen):NaN;
  const fresh=Number.isFinite(seen)&&seen<=nowMs&&nowMs-seen<=freshMs;
  const ready=["READY","ONLINE"].includes(String(row?.status||"").toUpperCase());
  const gpuRuntime=row?.runtime==="webgpu";
  return {
   online:ready&&fresh,available:row?.available===true,
   gpu:gpuRuntime,
   // Claims retained for diagnostics only. Admission still requires independent approval.
   capability:row?.capability&&typeof row.capability==="object"&&!Array.isArray(row.capability)?row.capability:{},
   transportRuntime:row?.runtime||null,
   heartbeatFresh:fresh,
  };
 })};
}
