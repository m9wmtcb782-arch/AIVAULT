/**
 * Dark Star M1 procedural reference skeleton, for isolated testing ONLY.
 * Not the production avatar, not a skinned mesh, not clinically calibrated.
 * Uses glTF node conventions and a skin joint index list.
 */
const v=(x,y,z)=>[x,y,z];
const nodes=[],parents=[],ids={};
function bone(name,parent,translation){
 const i=nodes.length;
 nodes.push({name,translation,rotation:[0,0,0,1]});parents.push(parent);ids[name]=i;
 if(parent>=0){(nodes[parent].children??=[]).push(i)}
 return i;
}
const hips=bone('Hips',-1,v(0,1,0));
const spine=bone('Spine',hips,v(0,.18,0));
const chest=bone('Chest',spine,v(0,.24,0));
const neck=bone('Neck',chest,v(0,.20,0));
bone('Head',neck,v(0,.17,0));
for(const side of ['Left','Right']){
 const s=side==='Left'?-1:1;
 const shoulder=bone(side+'Shoulder',chest,v(.17*s,.13,0));
 const arm=bone(side+'UpperArm',shoulder,v(.12*s,0,0));
 const forearm=bone(side+'ForeArm',arm,v(.26*s,0,0));
 const hand=bone(side+'Hand',forearm,v(.24*s,0,0));
 for(const [finger,offset] of Object.entries({Thumb:-.06,Index:-.03,Middle:0,Ring:.03,Little:.06})){
  let prev=bone(side+finger+'1',hand,v(.08*s,0,offset));
  prev=bone(side+finger+'2',prev,v(.045*s,0,0));
  if(finger!=='Thumb')bone(side+finger+'3',prev,v(.035*s,0,0));
 }
 const thigh=bone(side+'UpperLeg',hips,v(.12*s,-.12,0));
 const shin=bone(side+'LowerLeg',thigh,v(0,-.42,0));
 const foot=bone(side+'Foot',shin,v(0,-.40,.03));
 bone(side+'Toe',foot,v(0,-.05,.16));
}
export const REFERENCE_SKELETON={
 asset:{generator:'AIVAULT Dark Star isolated skeleton v0.1',version:'2.0'},
 scene:0,scenes:[{nodes:[hips]}],nodes,
 skins:[{joints:nodes.map((_,i)=>i),skeleton:hips}],
 extras:{referenceOnly:true,skinnedMesh:false,anatomicallyCalibrated:false,actuationAllowed:false}
};
export const REFERENCE_PARENT_INDEX=parents;
export const REFERENCE_NODE_INDEX=ids;
