// Audit only: never enable actuation based on names alone.
export function auditRig(gltf,requiredBones=[]){
 const nodes=gltf?.nodes;
 if(!Array.isArray(nodes))return {status:'NO_RIG',matched:[],missing:[...requiredBones],verified:false};
 const names=nodes.map(n=>n?.name).filter(n=>typeof n==='string');
 const duplicateNames=names.filter((n,i)=>names.indexOf(n)!==i);
 const missing=requiredBones.filter(n=>!names.includes(n));
 const skins=Array.isArray(gltf.skins)?gltf.skins:[];
 const validSkins=skins.filter(s=>Array.isArray(s.joints)&&s.joints.length>0&&s.joints.every(i=>Number.isInteger(i)&&i>=0&&i<nodes.length));
 return {status:validSkins.length?'SKINNED_RIG_FOUND':'NO_SKINNED_RIG',nodeCount:nodes.length,skinCount:validSkins.length,
  matched:requiredBones.filter(n=>names.includes(n)),missing,duplicateNames:[...new Set(duplicateNames)],
  verified:false,actuationAllowed:false,requiresManualAxisAndWeightValidation:true};
}
