/**
 * Dark Star motion primitives: cached motor programs + inertial interpolation.
 * Isolated preview only. Does not drive production avatar.
 * Time-based sampling avoids LLM/physics re-solving each rendered frame.
 */
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
const ease=t=>{t=clamp(t,0,1);return t*t*(3-2*t)};
const PROGRAMS=Object.freeze({
 greet:{duration:1.8,channels:{
  'right.shoulder.flexion':[[0,0],[.25,45],[.7,45],[1,0]],
  'right.elbow.flexion':[[0,0],[.25,85],[.7,85],[1,0]],
  'right.wrist.deviation':[[0,0],[.3,-15],[.42,15],[.54,-15],[.66,15],[.8,0],[1,0]]
 }},
 nod:{duration:.9,channels:{'midline.upperNeck.flexion':[[0,0],[.3,14],[.65,-5],[1,0]]}},
 blink:{duration:.24,channels:{'face.eyelidCloseLeft':[[0,0],[.4,1],[.6,1],[1,0]],'face.eyelidCloseRight':[[0,0],[.4,1],[.6,1],[1,0]]}},
 smile:{duration:1.2,channels:{'face.smileLeft':[[0,0],[.35,.75],[.75,.75],[1,0]],'face.smileRight':[[0,0],[.35,.75],[.75,.75],[1,0]]}}
});
export const MOTION_PROGRAMS=PROGRAMS;
export function validateMotionProgram(program){
 const errors=[];
 if(!program||!Number.isFinite(program.duration)||program.duration<=0||!program.channels)errors.push('BAD_PROGRAM');
 else for(const [channel,keys] of Object.entries(program.channels)){
  if(!Array.isArray(keys)||keys.length<2||keys[0]?.[0]!==0||keys.at(-1)?.[0]!==1)errors.push('BAD_KEYS:'+channel);
  else for(let i=0;i<keys.length;i++){
   const [t,v]=keys[i];
   if(!Number.isFinite(t)||!Number.isFinite(v)||t<0||t>1||(i&&t<=keys[i-1][0]))errors.push('BAD_KEY:'+channel);
  }
 }
 return {valid:errors.length===0,errors};
}
export function sampleMotion(program,seconds){
 if(!validateMotionProgram(program).valid)throw Error('INVALID_MOTION_PROGRAM');
 if(!Number.isFinite(seconds))throw Error('INVALID_TIME');
 const t=clamp(seconds/program.duration,0,1),pose={};
 for(const [name,keys] of Object.entries(program.channels)){
  let i=0;while(i<keys.length-2&&keys[i+1][0]<t)i++;
  const [a,x]=keys[i],[b,y]=keys[i+1],u=ease((t-a)/(b-a));
  pose[name]=x+(y-x)*u;
 }
 return {pose,finished:seconds>=program.duration,actuationAllowed:false};
}
/** Critically damped-like velocity filter. Stable substeps for varying frame time. */
export function inertialFollow(current,target,dt,{frequency=6,maxSpeed=360}={}){
 if(!Number.isFinite(current)||!Number.isFinite(target)||!Number.isFinite(dt)||dt<0||dt>.1||!Number.isFinite(frequency)||frequency<=0||!Number.isFinite(maxSpeed)||maxSpeed<=0)throw Error('INVALID_INERTIA_INPUT');
 const alpha=1-Math.exp(-frequency*dt);
 return current+clamp((target-current)*alpha,-maxSpeed*dt,maxSpeed*dt);
}
export const MOTION_MEMORY_STATUS=Object.freeze({mode:'ISOLATED_PREVIEW',adaptiveRigMapping:false,physicsValidated:false,actuationAllowed:false});
