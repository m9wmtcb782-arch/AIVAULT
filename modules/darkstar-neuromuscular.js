/**
 * Dark Star neuromuscular prototype v0.1.
 * Dimensionless activation and force proxy; NOT medical-grade biomechanics.
 * Isolated from live avatar; no autonomous actuation.
 */
export const MUSCLES=Object.freeze([
 {id:'orbicularis_oculi_L',group:'eyelid',action:'close_left',tau:0.045},
 {id:'orbicularis_oculi_R',group:'eyelid',action:'close_right',tau:0.045},
 {id:'levator_palpebrae_L',group:'eyelid',action:'open_left',tau:0.055},
 {id:'levator_palpebrae_R',group:'eyelid',action:'open_right',tau:0.055},
 {id:'superior_rectus_L',group:'eye',action:'up_left',tau:0.06},
 {id:'superior_rectus_R',group:'eye',action:'up_right',tau:0.06},
 {id:'inferior_rectus_L',group:'eye',action:'down_left',tau:0.06},
 {id:'inferior_rectus_R',group:'eye',action:'down_right',tau:0.06},
 {id:'medial_rectus_L',group:'eye',action:'in_left',tau:0.06},
 {id:'medial_rectus_R',group:'eye',action:'in_right',tau:0.06},
 {id:'lateral_rectus_L',group:'eye',action:'out_left',tau:0.06},
 {id:'lateral_rectus_R',group:'eye',action:'out_right',tau:0.06},
 {id:'superior_oblique_L',group:'eye',action:'torsion_left',tau:0.06},
 {id:'superior_oblique_R',group:'eye',action:'torsion_right',tau:0.06},
 {id:'inferior_oblique_L',group:'eye',action:'torsion_left',tau:0.06},
 {id:'inferior_oblique_R',group:'eye',action:'torsion_right',tau:0.06},
 {id:'orbicularis_oris',group:'mouth',action:'lip_seal',tau:0.065},
 {id:'zygomaticus_major_L',group:'mouth',action:'smile_left',tau:0.08},
 {id:'zygomaticus_major_R',group:'mouth',action:'smile_right',tau:0.08},
 {id:'buccinator_L',group:'mouth',action:'cheek_left',tau:0.08},
 {id:'buccinator_R',group:'mouth',action:'cheek_right',tau:0.08},
 {id:'mentalis',group:'mouth',action:'lower_lip',tau:0.08},
 {id:'masseter_L',group:'jaw',action:'jaw_close',tau:0.09},
 {id:'masseter_R',group:'jaw',action:'jaw_close',tau:0.09},
 {id:'digastric_L',group:'jaw',action:'jaw_open',tau:0.09},
 {id:'digastric_R',group:'jaw',action:'jaw_open',tau:0.09},
 {id:'genioglossus',group:'tongue',action:'tongue_protrusion',tau:0.07},
 {id:'biceps_L',group:'arm',action:'elbow_flex_left',tau:0.11},
 {id:'biceps_R',group:'arm',action:'elbow_flex_right',tau:0.11},
 {id:'triceps_L',group:'arm',action:'elbow_extend_left',tau:0.11},
 {id:'triceps_R',group:'arm',action:'elbow_extend_right',tau:0.11},
 {id:'quadriceps_L',group:'leg',action:'knee_extend_left',tau:0.13},
 {id:'quadriceps_R',group:'leg',action:'knee_extend_right',tau:0.13},
 {id:'hamstrings_L',group:'leg',action:'knee_flex_left',tau:0.13},
 {id:'hamstrings_R',group:'leg',action:'knee_flex_right',tau:0.13}
]);
const clamp=x=>Math.min(1,Math.max(0,x));
export function createNeuromuscularState(muscles=MUSCLES){
 return Object.fromEntries(muscles.map(m=>[m.id,{activation:0,forceProxy:0}]));
}
export function stepNeuromuscular(state,commands,dt,{muscles=MUSCLES}={}){
 if(!Number.isFinite(dt)||dt<=0||dt>0.05)throw Error('INVALID_TIMESTEP');
 const next={};
 for(const m of muscles){
  const prev=state?.[m.id]?.activation??0,drive=commands?.[m.id]??0;
  if(!Number.isFinite(prev)||prev<0||prev>1||!Number.isFinite(drive)||drive<0||drive>1)throw Error('INVALID_NEURAL_DRIVE:'+m.id);
  const activation=clamp(prev+(drive-prev)*(1-Math.exp(-dt/m.tau)));
  next[m.id]={activation,forceProxy:activation};
 }
 return {state:next,actuationAllowed:false,calibrated:false};
}
export function facialControlSignals(state){
 const a=id=>state?.[id]?.activation??0;
 const diff=(x,y)=>Math.max(-1,Math.min(1,x-y));
 return {
  eyelidCloseLeft:clamp(a('orbicularis_oculi_L')-a('levator_palpebrae_L')),
  eyelidCloseRight:clamp(a('orbicularis_oculi_R')-a('levator_palpebrae_R')),
  eyeVerticalLeft:diff(a('superior_rectus_L'),a('inferior_rectus_L')),
  eyeVerticalRight:diff(a('superior_rectus_R'),a('inferior_rectus_R')),
  eyeHorizontalLeft:diff(a('medial_rectus_L'),a('lateral_rectus_L')),
  eyeHorizontalRight:diff(a('medial_rectus_R'),a('lateral_rectus_R')),
  lipSeal:clamp(a('orbicularis_oris')),
  smileLeft:clamp(a('zygomaticus_major_L')),
  smileRight:clamp(a('zygomaticus_major_R')),
  jawOpen:clamp((a('digastric_L')+a('digastric_R')-a('masseter_L')-a('masseter_R'))/2),
  tongueProtrusion:clamp(a('genioglossus'))
 };
}
export const NEUROMUSCULAR_STATUS=Object.freeze({status:'PROTOTYPE_UNCALIBRATED',faceRigConnected:false,voicePhonemesConnected:false,actuationAllowed:false});
