/* Dark Star virtual somatic safety core v0.1.0
 * Pure computation module. No DOM, API calls, or existing character modifications.
 * Joint limits are conservative illustrative defaults, NOT medical reference ranges.
 */
export const JOINT_LIMITS = Object.freeze({
  neckYaw: [-55,55], neckPitch: [-35,40],
  leftShoulderFlex: [-45,150], rightShoulderFlex: [-45,150],
  leftElbowFlex: [0,145], rightElbowFlex: [0,145],
  leftWristFlex: [-60,60], rightWristFlex: [-60,60],
  spineFlex: [-25,55], spineTwist: [-30,30],
  leftHipFlex: [-25,110], rightHipFlex: [-25,110],
  leftKneeFlex: [0,135], rightKneeFlex: [0,135],
  leftAnkleFlex: [-35,25], rightAnkleFlex: [-35,25]
});
const clamp = (x,a,b) => Math.min(b,Math.max(a,x));
export function evaluateJoint(joint, angle, previousAngle = null, options = {}) {
  if (!Object.hasOwn(JOINT_LIMITS,joint)) throw new Error('UNKNOWN_JOINT');
  if (!Number.isFinite(angle)) throw new Error('INVALID_ANGLE');
  const [min,max] = JOINT_LIMITS[joint];
  const safe = clamp(angle,min,max);
  const margin = Math.max(2,(max-min)*0.1);
  const outside = angle < min || angle > max;
  const near = safe-min < margin || max-safe < margin;
  const velocity = Number.isFinite(previousAngle) && Number.isFinite(options.dtSeconds) && options.dtSeconds>0
    ? Math.abs(angle-previousAngle)/options.dtSeconds : null;
  const tooFast = velocity !== null && velocity > (options.maxDegPerSecond ?? 180);
  const collision = options.collision === true;
  const load = Number.isFinite(options.loadRatio) ? options.loadRatio : 0;
  const severity = outside || collision || load>=1 ? 3 : tooFast || load>=0.85 ? 2 : near || load>=0.65 ? 1 : 0;
  return {joint, requestedAngle:angle, safeAngle:safe, severity,
    nociception:severity/3, reflexStop:severity>=2,
    reasons:[...(outside?['JOINT_LIMIT']:[]),...(collision?['COLLISION']:[]),
      ...(tooFast?['EXCESSIVE_SPEED']:[]),...(load>=0.85?['EXCESSIVE_LOAD']:[]),
      ...(near?['NEAR_LIMIT']:[])], velocity};
}
export function protectPose(requestedPose, previousPose={}, options={}) {
  if (!requestedPose || typeof requestedPose!=='object' || Array.isArray(requestedPose)) throw new Error('INVALID_POSE');
  const pose={}, signals=[];
  for (const [joint,angle] of Object.entries(requestedPose)) {
    const s=evaluateJoint(joint,angle,previousPose[joint],options[joint]||{});
    // On severe risk, hold the last known safe position instead of following the dangerous command.
    const previous=previousPose[joint];
    const [min,max]=JOINT_LIMITS[joint];
    pose[joint]=s.reflexStop && Number.isFinite(previous) ? clamp(previous,min,max) : s.safeAngle;
    signals.push(s);
  }
  return {pose, signals, reflexTriggered:signals.some(s=>s.reflexStop),
    maximumSeverity:Math.max(0,...signals.map(s=>s.severity))};
}
