/* Dark Star somatic avatar adapter v0.1
 * Opt-in bridge only. Does not touch existing video, UI or avatar.
 * No actuation unless an explicitly supplied rig has validated mapping.
 */
import {protectPose} from './darkstar-somatic-safety.js';
import {assessBalance} from './darkstar-balance-recovery.js';
export function createSomaticAvatarAdapter(rig){
 if(!rig||typeof rig.readPose!=='function'||typeof rig.applyPose!=='function'||!rig.validatedMapping)
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
   let balance=null;
   if(sensors.segments&&sensors.velocity&&sensors.contacts)
    balance=assessBalance(sensors);
   // Refuse to drive a real rig on risk or without validated dynamics.
   if(safety.reflexTriggered || (balance&&balance.strategy!=='MAINTAIN_BALANCE')){
    last={status:'BLOCKED_REFLEX_OR_BALANCE',safety,balance};
    return last;
   }
   // Explicit opt-in: only a rig with a validated mapping can accept a safe pose.
   rig.applyPose(safety.pose);
   last={status:'POSE_APPLIED',safety,balance};
   return last;
  }
 };
}
