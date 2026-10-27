/**
 * Dark Star M1: GLTF skeleton-to-atlas binding verifier.
 * Read-only. A match by name never grants actuation.
 */
import {MOTION_ATLAS} from './darkstar-joint-motion-atlas.js';
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const vec3=a=>Array.isArray(a)&&a.length===3&&a.every(finite);
const unit=a=>vec3(a)&&Math.abs(Math.hypot(...a)-1)<1e-3;
const q4=a=>Array.isArray(a)&&a.length===4&&a.every(finite)&&Math.abs(Math.hypot(...a)-1)<1e-3;
export function verifyRigBinding(gltf,bindings,{atlas=MOTION_ATLAS}={}){
 const errors=[],records=[],nodes=gltf?.nodes,skins=gltf?.skins;
 if(!Array.isArray(nodes)||!Array.isArray(skins)||!skins.length)
  return {status:'BLOCKED_NO_SKINNED_RIG',errors:['NO_SKINNED_RIG'],records:[],actuationAllowed:false};
 const skinned=new Set();
 for(const s of skins){
  if(!Array.isArray(s.joints))continue;
  for(const i of s.joints)if(Number.isInteger(i)&&i>=0&&i<nodes.length)skinned.add(i);
 }
 const atlasById=new Map(atlas.map(j=>[j.id,j])),used=new Set(),mapped=new Set();
 if(!Array.isArray(bindings))return {status:'BLOCKED_MAPPING',errors:['BINDINGS_NOT_ARRAY'],records:[],actuationAllowed:false};
 for(const b of bindings){
  const j=atlasById.get(b?.jointId),n=b?.nodeIndex;
  if(!j){errors.push('UNKNOWN_JOINT:'+b?.jointId);continue}
  if(mapped.has(j.id)){errors.push('DUPLICATE_JOINT:'+j.id);continue}mapped.add(j.id);
  if(!Number.isInteger(n)||!skinned.has(n)){errors.push('NODE_NOT_SKINNED:'+j.id);continue}
  if(used.has(n)){errors.push('NODE_REUSED:'+n);continue}used.add(n);
  const axes=b.axes||{};
  for(const a of j.axes){
   if(!unit(axes[a.name]))errors.push('BAD_AXIS:'+j.id+':'+a.name);
  }
  if(!q4(b.bindRotation))errors.push('BAD_BIND_ROTATION:'+j.id);
  if(!vec3(b.bindPosition))errors.push('BAD_BIND_POSITION:'+j.id);
  if(b.reviewed!==true||!b.source)errors.push('NOT_REVIEWED:'+j.id);
  records.push({jointId:j.id,nodeIndex:n,nodeName:nodes[n]?.name||'',axisCount:j.axes.length,reviewed:b.reviewed===true});
 }
 const missing=atlas.filter(j=>j.axes.length&&!mapped.has(j.id)).map(j=>j.id);
 return {status:errors.length?'INVALID_MAPPING':missing.length?'INCOMPLETE_MAPPING':'STRUCTURE_REVIEWED_ONLY',
  errors,records,missing,total:atlas.filter(j=>j.axes.length).length,mapped:records.length,
  actuationAllowed:false,requiresDynamicAndAnatomicalCalibration:true};
}
export function createBindingTemplate(gltf,atlas=MOTION_ATLAS){
 const names=(gltf?.nodes||[]).map((n,i)=>({index:i,name:n?.name||''}));
 return {status:'TEMPLATE_ONLY',actuationAllowed:false,availableNodes:names,
  joints:atlas.filter(j=>j.axes.length).map(j=>({jointId:j.id,nodeIndex:null,
   axes:Object.fromEntries(j.axes.map(a=>[a.name,null])),bindRotation:null,bindPosition:null,reviewed:false,source:null}))};
}
