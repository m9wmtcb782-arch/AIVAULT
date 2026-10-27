/* Dark Star coordinated reflex controller v0.1
 * Isolated simulation core: not attached to live avatar.
 * Angles in degrees; indicative engineering limits only.
 */
import {JOINT_LIMITS, protectPose} from './darkstar-somatic-safety.js';
const groups={
 leftLeg:['leftHipFlex','leftKneeFlex','leftAnkleFlex'],
 rightLeg:['rightHipFlex','rightKneeFlex','rightAnkleFlex'],
 leftArm:['leftShoulderFlex','leftElbowFlex','leftWristFlex'],
 rightArm:['rightShoulderFlex','rightElbowFlex','rightWristFlex'],
 trunk:['spineFlex','spineTwist','neckPitch','neckYaw']
};
const connected={
 leftLeg:['rightLeg','trunk','leftArm','rightArm'],
 rightLeg:['leftLeg','trunk','leftArm','rightArm'],
 leftArm:['trunk','rightArm'],rightArm:['trunk','leftArm'],
 trunk:['leftLeg','rightLeg','leftArm','rightArm']
};
export function coordinateReflex(requestedPose, previousPose={}, sensors={}) {
 const result=protectPose(requestedPose,previousPose,sensors.joints||{});
 const affected=new Set();
 for(const signal of result.signals){
   if(signal.severity<2) continue;
   for(const [group,joints] of Object.entries(groups)){
     if(joints.includes(signal.joint)){affected.add(group);connected[group].forEach(g=>affected.add(g));}
   }
 }
 const plan=[];
 if(result.reflexTriggered){
   plan.push({type:'STOP_UNSAFE_COMMAND',priority:0});
   for(const group of affected)plan.push({type:'STABILIZE_GROUP',group,priority:1});
   if(sensors.supportLost===true)plan.push({type:'BALANCE_RECOVERY_REQUIRED',priority:1});
   plan.push({type:'REQUEST_SAFE_MOTION_PLAN',priority:2});
 }
 return {...result,affectedGroups:[...affected],reflexPlan:plan,
   // Never synthesize unvalidated balancing angles: a physics controller must solve them.
   requiresPhysicsSolver:result.reflexTriggered};
}
export function validateSkeletonCoverage(skeletonJoints){
 const known=new Set(Object.keys(JOINT_LIMITS));
 const names=Array.isArray(skeletonJoints)?skeletonJoints:[];
 return {known:[...known],unmapped:names.filter(n=>!known.has(n)),
  covered:names.filter(n=>known.has(n)),complete:names.length>0&&names.every(n=>known.has(n))};
}
