/* Dark Star somatic avatar adapter v0.2.
 * Fail-closed: no motion without validated rig, sensors and dynamics approval.
 * Existing video and UI are not touched.
 */
import {protectPose} from './darkstar-somatic-safety.js';
import {assessBalance} from './darkstar-balance-recovery.js';
export function createSomaticAvatarAdapter(rig){
 if(!rig||typeof rig.readPose!=='function'||typeof rig.applyPose!=='function'||rig.validatedMapping!==true)
  throw new Error('RIG_NOT_VALIDATED');
 let enabled=false,last=null;
 return {
  enable(){enabled=true;},
  disable(){enabled=false;},
  status(){return {enabled,last,rigValidated:true};},
  step(requestedPose,sensors={}){
   if(!enabled)return {status:'DISABLED'};
   const previous=rig.readPose();
   const safety=protectPose(requestedPose,previous,sensors.joints||{});
   if(safety.reflexTriggered){
    last={status:'BLOCKED_REFLEX',safety};return last;
   }
   if(!sensors.segments||!sensors.velocity||!sensors.contacts){
    last={status:'BLOCKED_MISSING_BALANCE_SENSORS',safety};return last;
   }
   const balance=assessBalance(sensors);
   if(balance.strategy!=='MAINTAIN_BALANCE'){
    last={status:'BLOCKED_UNSTABLE',safety,balance};return last;
   }
   // The balance estimator is NOT a rigid-body dynamics solver.
   // The solver must independently validate joint torques, contacts, collisions,
   // velocity, acceleration and the proposed pose.
   if(typeof rig.validateDynamics!=='function'){
    last={status:'BLOCKED_NO_DYNAMICS_SOLVER',safety,balance};return last;
   }
   const validation=rig.validateDynamics({pose:safety.pose,previous,sensors,balance});
   if(!validation||validation.approved!==true){
    last={status:'BLOCKED_DYNAMICS_NOT_APPROVED',safety,balance};return last;
   }
   rig.applyPose(safety.pose);
   last={status:'POSE_APPLIED',safety,balance};return last;
  }
 };
}
