/* Dark Star coupled-axis constraints v0.1.
 * No anatomical claims: all envelopes must be independently calibrated.
 * Safe by default; does not control the avatar.
 */
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
export function validateEnvelope(envelope){
 if(!envelope||!envelope.jointId||!Array.isArray(envelope.axes)||!envelope.axes.length)throw Error('INVALID_ENVELOPE');
 if(envelope.verified!==true||!envelope.source||!envelope.reviewer)throw Error('UNVERIFIED_ENVELOPE');
 const seen=new Set();
 for(const a of envelope.axes){
  if(!a.name||seen.has(a.name)||!finite(a.min)||!finite(a.max)||a.min>a.max)throw Error('INVALID_AXIS');
  seen.add(a.name);
 }
 for(const c of envelope.couplings||[]){
  if(!seen.has(c.dependent)||!seen.has(c.driver)||c.driver===c.dependent||!Array.isArray(c.knots)||c.knots.length<2)throw Error('INVALID_COUPLING');
  let prev=-Infinity;
  for(const k of c.knots){
   if(!finite(k.at)||!finite(k.min)||!finite(k.max)||k.min>k.max||k.at<=prev)throw Error('INVALID_KNOT');
   prev=k.at;
  }
 }
 return envelope;
}
function interpolate(knots,x){
 if(x<=knots[0].at)return knots[0];
 if(x>=knots.at(-1).at)return knots.at(-1);
 for(let i=1;i<knots.length;i++)if(x<=knots[i].at){
  const a=knots[i-1],b=knots[i],t=(x-a.at)/(b.at-a.at);
  return {min:a.min+(b.min-a.min)*t,max:a.max+(b.max-a.max)*t};
 }
}
export function evaluateCoupledPose(envelope,pose,{loadRatio=0,collision=false}={}){
 validateEnvelope(envelope);
 if(!pose||typeof pose!=='object'||!finite(loadRatio)||loadRatio<0)throw Error('INVALID_STATE');
 const limits={},violations=[];
 for(const a of envelope.axes){
  if(!finite(pose[a.name]))throw Error('MISSING_AXIS:'+a.name);
  limits[a.name]={min:a.min,max:a.max};
 }
 for(const c of envelope.couplings||[]){
  const r=interpolate(c.knots,pose[c.driver]);
  limits[c.dependent].min=Math.max(limits[c.dependent].min,r.min);
  limits[c.dependent].max=Math.min(limits[c.dependent].max,r.max);
 }
 const safe={};
 for(const a of envelope.axes){
  const r=limits[a.name],v=pose[a.name];
  if(r.min>r.max)violations.push({axis:a.name,reason:'EMPTY_FEASIBLE_RANGE'});
  else if(v<r.min||v>r.max)violations.push({axis:a.name,reason:'COUPLED_LIMIT'});
  safe[a.name]=r.min<=r.max?clamp(v,r.min,r.max):null;
 }
 if(collision||loadRatio>=1)violations.push({reason:collision?'COLLISION':'OVERLOAD'});
 return {jointId:envelope.jointId,limits,safe,violations,
  status:violations.length?'REFLEX_STOP':'STATIC_ENVELOPE_VALID',
  actuationAllowed:false,requiresDynamicsSolver:true};
}
