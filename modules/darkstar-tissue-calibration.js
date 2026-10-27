// Explicitly uncalibrated muscle/tendon/ligament model parameter validation.
// Rejects unreviewed records for production actuation.
export function validateTissueParameters(record){
 const required=['id','type','source','reviewer','units'];
 if(!record||required.some(k=>!record[k]))return {status:'INCOMPLETE',actuationAllowed:false};
 if(!['muscle','tendon','ligament'].includes(record.type))return {status:'INVALID_TYPE',actuationAllowed:false};
 const params=record.parameters||{};
 if(!Object.keys(params).length||Object.values(params).some(v=>!Number.isFinite(v)))return {status:'INVALID_PARAMETERS',actuationAllowed:false};
 if(record.verified!==true)return {status:'UNVERIFIED',actuationAllowed:false};
 return {status:'PARAMETERS_REVIEWED',actuationAllowed:false,requiresSystemCalibration:true};
}
export function auditTissueCoverage(joints,records){
 const ids=new Set(records.map(r=>r.jointId));
 return {totalJoints:joints.length,covered:joints.filter(j=>ids.has(j.id)).length,
  missing:joints.filter(j=>!ids.has(j.id)).map(j=>j.id),fullyCalibrated:false};
}
