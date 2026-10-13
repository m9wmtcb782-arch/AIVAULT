import test from "node:test";
import assert from "node:assert/strict";
import {VoicePlaybackSession} from "./voice-playback-session.mjs";
function fakeAudio(){
 const sources=[];
 return {sources,context:{
  currentTime:0,state:"running",destination:{},
  createBuffer(_channels,length){return {getChannelData:()=>new Float32Array(length)};},
  createBufferSource(){const s={connect(){},disconnect(){},start(){s.started=true;},stop(){s.stopped=true;}};sources.push(s);return s;}
 }};
}
test("plays synthesized PCM from independent voice pipeline",async()=>{
 const {context,sources}=fakeAudio();const events=[];
 const session=new VoicePlaybackSession({
  audioContext:context,
  asr:{transcribe:async()=> "你好"},
  brain:{respond:async()=> "暗星回答"},
  tts:{synthesize:async()=> (async function*(){yield new Uint8Array([0,0,0,0]);})()},
  onEvent:e=>events.push(e)
 });
 const result=await session.start({audio:new Uint8Array([0,0])});
 assert.equal(result.status,"completed");
 assert.equal(sources.length,1);
 assert.equal(sources[0].started,true);
 assert.ok(events.some(e=>e.type==="playback.scheduled"));
 session.interrupt();
 assert.equal(sources[0].stopped,true);
});
test("stale ASR response cannot reach playback after interrupt",async()=>{
 const {context,sources}=fakeAudio();
 let release;const gate=new Promise(resolve=>release=resolve);
 const session=new VoicePlaybackSession({
  audioContext:context,
  asr:{transcribe:async()=>{await gate;return "late";}},
  brain:{respond:async()=> "answer"},
  tts:{synthesize:async()=> (async function*(){yield new Uint8Array([0,0]);})()}
 });
 const pending=session.start({audio:new Uint8Array([0,0])});
 await Promise.resolve();
 session.interrupt();release();
 assert.equal((await pending).status,"cancelled");
 assert.equal(sources.length,0);
});
