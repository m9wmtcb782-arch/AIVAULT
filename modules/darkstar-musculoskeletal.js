/* Dark Star virtual musculoskeletal mechanics v0.1
 * Pure simulation, no avatar mutation, no clinical injury thresholds.
 * SI units: N, m, kg, s, Nm. All parameters require calibration.
 */
const valid=x=>typeof x==='number'&&Number.isFinite(x);
const requireNonnegative=(x,label)=>{if(!valid(x)||x<0)throw Error('INVALID_'+label);return x};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function muscleForce({activation,maxIsometricForce,normalizedLength=1,normalizedVelocity=0,fatigue=0}){
 for(const [k,v] of Object.entries({activation,maxIsometricForce,fatigue}))requireNonnegative(v,k);
 if(!valid(normalizedLength)||!valid(normalizedVelocity))throw Error('INVALID_MUSCLE_STATE');
 const a=clamp(activation,0,1), f=clamp(fatigue,0,1);
 const lengthFactor=Math.exp(-Math.pow((normalizedLength-1)/0.45,2));
 const velocityFactor=clamp(1-0.3*normalizedVelocity,0,1.5);
 const active=a*maxIsometricForce*lengthFactor*velocityFactor*(1-f);
 const passive=maxIsometricForce*0.05*Math.pow(Math.max(0,normalizedLength-1),2);
 return {forceN:active+passive,activeN:active,passiveN:passive,calibration:'ILLUSTRATIVE'};
}
export function tendonForce({elongationM,stiffnessNPerM,dampingNsPerM=0,velocityMPerS=0}){
 requireNonnegative(stiffnessNPerM,'STIFFNESS');requireNonnegative(dampingNsPerM,'DAMPING');
 if(!valid(elongationM)||!valid(velocityMPerS))throw Error('INVALID_TENDON_STATE');
 const stretch=Math.max(0,elongationM);
 return {forceN:Math.max(0,stiffnessNPerM*stretch+dampingNsPerM*velocityMPerS),
 storedEnergyJ:0.5*stiffnessNPerM*stretch*stretch};
}
export function ligamentForce({elongationM,slackLengthM=0,stiffnessNPerM,dampingNsPerM=0,velocityMPerS=0}){
 requireNonnegative(slackLengthM,'SLACK');requireNonnegative(stiffnessNPerM,'STIFFNESS');
 requireNonnegative(dampingNsPerM,'DAMPING');
 if(!valid(elongationM)||!valid(velocityMPerS))throw Error('INVALID_LIGAMENT_STATE');
 const stretch=Math.max(0,elongationM-slackLengthM);
 return {forceN:Math.max(0,stiffnessNPerM*stretch+dampingNsPerM*Math.max(0,velocityMPerS)),
 engaged:stretch>0};
}
export function jointTorque({muscleForces=[],momentArmsM=[],externalTorqueNm=0}){
 if(muscleForces.length!==momentArmsM.length||!valid(externalTorqueNm))throw Error('INVALID_TORQUE_INPUT');
 let internal=0;
 for(let i=0;i<muscleForces.length;i++){
  requireNonnegative(muscleForces[i],'FORCE');
  if(!valid(momentArmsM[i]))throw Error('INVALID_MOMENT_ARM');
  internal+=muscleForces[i]*momentArmsM[i];
 }
 return {internalTorqueNm:internal,netTorqueNm:internal+externalTorqueNm};
}
export function somaticRisk({forceN=0,velocityMPerS=0,collision=false,verifiedForceLimitN=null}){
 requireNonnegative(forceN,'FORCE');
 if(!valid(velocityMPerS))throw Error('INVALID_VELOCITY');
 if(!valid(verifiedForceLimitN)||verifiedForceLimitN<=0)
  return {status:'BLOCKED_UNCALIBRATED',nociception:null,reflexStop:true};
 const ratio=forceN/verifiedForceLimitN;
 const severity=collision||ratio>=1?3:ratio>=0.85?2:ratio>=0.65?1:0;
 return {status:'SIMULATED',severity,nociception:severity/3,reflexStop:severity>=2};
}
