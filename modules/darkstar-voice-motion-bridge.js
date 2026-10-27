import {MOTION_PROGRAMS,sampleMotion,inertialFollow} from './darkstar-motion-memory.js';
const patterns=[
 ['greet',/(揮(?:揮)?手|招(?:招)?手|打(?:個)?招呼)/u],
 ['nod',/(點(?:點)?頭|點一下頭)/u],
 ['blink',/(眨(?:眨)?眼|眨一下眼)/u],
 ['smile',/(微笑|笑一個|笑一下)/u]
];
export function recognizeMotionCommand(text){
 if(typeof text!=='string'||text.length>500)return null;
 const normalized=text.replace(/\s+/g,'');
 for(const [name,pattern] of patterns)if(pattern.test(normalized))return {name,source:'speech-transcript',confidence:'RULE_MATCH'};
 return null;
}
/**
 * A realtime speech-to-motion bridge.
 * User speech transcripts are the only trigger; output speech must not retrigger.
 * The sink receives joint-channel targets, never direct production actuator commands.
 */
export function createVoiceMotionBridge({sink,clock=()=>performance.now()}={}){
 if(typeof sink!=='function')throw Error('SINK_REQUIRED');
 let active=null,lastName='',lastStart=-Infinity,lastTick=null,pose={};
 function onTranscript(text,{source='user',final=true}={}){
  if(source!=='user'||!final)return {accepted:false,reason:'NOT_FINAL_USER_SPEECH'};
  const cmd=recognizeMotionCommand(text);
  if(!cmd)return {accepted:false,reason:'NO_MATCH'};
  const now=clock();
  if(lastName===cmd.name&&now-lastStart<1000)return {accepted:false,reason:'DEBOUNCED'};
  active={name:cmd.name,start:now};lastName=cmd.name;lastStart=now;lastTick=null;
  return {accepted:true,name:cmd.name,mode:'PREVIEW_ONLY'};
 }
 function tick(){
  if(!active)return {active:false};
  const now=clock(),seconds=Math.max(0,(now-active.start)/1000),program=MOTION_PROGRAMS[active.name];
  const sampled=sampleMotion(program,seconds),dt=lastTick===null?0:Math.min(.1,Math.max(0,(now-lastTick)/1000));
  lastTick=now;
  for(const [key,target] of Object.entries(sampled.pose))pose[key]=inertialFollow(pose[key]??target,target,dt);
  const frame={name:active.name,pose:{...pose},previewOnly:true,actuationAllowed:false};
  sink(frame);
  if(sampled.finished)active=null;
  return {active:!!active,frame};
 }
 function stop(){active=null;pose={};lastTick=null;}
 return {onTranscript,tick,stop,getState:()=>({active:active?.name??null,previewOnly:true})};
}
