/**
 * Dark Star anatomical motion-control atlas v0.1.
 * Degrees in anatomical LOCAL frames; illustrative software guardrails only.
 * NOT clinically calibrated. NEVER use as permission to actuate a production avatar.
 * +X flexion/extension, +Y abduction/adduction, +Z axial rotation are
 * semantic axis labels, not a rig-specific Euler convention.
 */
const axis=(name,min,max)=>({name,min,max,units:'deg',verified:false});
const joint=(id,side,kind,axes,notes='')=>({id,side,kind,axes,notes,verified:false,motorEnabled:false});
const mirrored=(name,kind,axes,notes='')=>['left','right'].map(side=>joint(side+'.'+name,side,kind,axes,notes));
const A=[];
const add=(...entries)=>A.push(...entries.flat());
add(
 joint('midline.jaw','midline','joint',[axis('open',0,35),axis('lateral',-8,8)],'TMJ composite; simplified'),
 joint('midline.upperNeck','midline','joint',[axis('flexion',-20,25),axis('lateral',-15,15),axis('rotation',-35,35)],'Upper cervical composite'),
 joint('midline.lowerNeck','midline','joint',[axis('flexion',-25,35),axis('lateral',-20,20),axis('rotation',-25,25)],'Lower cervical composite'),
 joint('midline.thoracic','midline','composite',[axis('flexion',-20,30),axis('lateral',-20,20),axis('rotation',-25,25)],'Not a single vertebral joint'),
 joint('midline.lumbar','midline','composite',[axis('flexion',-20,45),axis('lateral',-20,20),axis('rotation',-10,10)],'Not a single vertebral joint'),
 joint('midline.pelvis','midline','root',[],'Reference frame; no independent anatomical joint motor'),
 mirrored('clavicle','composite',[axis('elevation',-15,25),axis('protraction',-20,20),axis('rotation',-20,20)],'Sternoclavicular/scapular coordination required'),
 mirrored('shoulder','joint',[axis('flexion',-45,150),axis('abduction',-30,150),axis('rotation',-70,70)],'Glenohumeral + scapular coupling required'),
 mirrored('elbow','joint',[axis('flexion',0,145)],'Hinge approximation'),
 mirrored('forearm','joint',[axis('pronation',-75,75)],'Radioulnar composite, not elbow flexion'),
 mirrored('wrist','joint',[axis('flexion',-60,60),axis('deviation',-20,30)],'Carpal coupling required'),
 mirrored('hip','joint',[axis('flexion',-25,110),axis('abduction',-25,45),axis('rotation',-40,40)],'Coupled limits required'),
 mirrored('knee','joint',[axis('flexion',0,135),axis('axialRotation',-10,10)],'Axial rotation MUST be coupled to flexion'),
 mirrored('ankle','joint',[axis('dorsiflexion',-35,25)],'Talocrural hinge approximation'),
 mirrored('subtalar','joint',[axis('inversion',-20,20)],'Coupled foot motion'),
 mirrored('toeBase','composite',[axis('extension',-25,50)],'Toe group placeholder, not one joint')
);
for(const side of ['left','right']){
 for(const finger of ['thumb','index','middle','ring','little']){
  const thumb=finger==='thumb';
  add(joint(side+'.'+finger+'.base',side,'joint',thumb?
   [axis('flexion',-15,50),axis('abduction',-25,40),axis('opposition',0,45)]:
   [axis('flexion',-20,85),axis('abduction',-15,15)],'MCP/CMC placeholder; independent axis calibration needed'));
  add(joint(side+'.'+finger+'.middle',side,'joint',[axis('flexion',0,thumb?80:100)],thumb?'Thumb IP':'Finger PIP'));
  if(!thumb)add(joint(side+'.'+finger+'.tip',side,'joint',[axis('flexion',0,80)],'Finger DIP'));
 }
}
export const MOTION_ATLAS=Object.freeze(A);
export const ATLAS_METADATA=Object.freeze({
 version:'0.1',reference:'annotated full-body image; not a medical measurement',
 coordinateSystem:'semantic local axes, rig transform NOT CALIBRATED',
 status:'UNVERIFIED',actuationAllowed:false,
 note:'All numerical angles are provisional conservative design bounds; NOT validated human ROM.'
});
export function validateAtlas(atlas=MOTION_ATLAS){
 const ids=new Set(),errors=[];
 for(const j of atlas){
  if(ids.has(j.id))errors.push('DUPLICATE:'+j.id);ids.add(j.id);
  if(j.motorEnabled||j.verified)errors.push('UNVERIFIED_MOTOR:'+j.id);
  for(const a of j.axes){
   if(!Number.isFinite(a.min)||!Number.isFinite(a.max)||a.min>a.max)errors.push('BAD_AXIS:'+j.id+'.'+a.name);
  }
 }
 return {status:errors.length?'INVALID':'UNVERIFIED_VALID_SCHEMA',records:atlas.length,errors,actuationAllowed:false};
}
export function evaluateAtlasPose(pose,atlas=MOTION_ATLAS){
 const violations=[],clamped={};
 for(const j of atlas){
  const requested=pose?.[j.id];if(!requested)continue;
  clamped[j.id]={};
  for(const a of j.axes){
   const value=requested[a.name];
   if(!Number.isFinite(value)){violations.push({joint:j.id,axis:a.name,reason:'MISSING_OR_INVALID'});continue;}
   clamped[j.id][a.name]=Math.max(a.min,Math.min(a.max,value));
   if(value<a.min||value>a.max)violations.push({joint:j.id,axis:a.name,reason:'OUT_OF_PROVISIONAL_RANGE'});
  }
 }
 return {clamped,violations,actuationAllowed:false,reason:'REQUIRES_CALIBRATED_RIG_AND_COUPLED_DYNAMICS'};
}
