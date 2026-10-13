import test from "node:test";
import assert from "node:assert/strict";
import {PcmAudioPlayer} from "./pcm-audio-player.mjs";
function fakeContext(){
 const sources=[];
 const ctx={currentTime:1,state:"running",destination:{},
  createBuffer(_channels,count){return {getChannelData:()=>new Float32Array(count)};},
  createBufferSource(){const source={start(time){source.started=time;},stop(){source.stopped=true;},connect(){},disconnect(){},onended:null};sources.push(source);return source;}
 };
 return {ctx,sources};
}
test("schedules consecutive PCM frames and interruption stops sources",()=>{
 const {ctx,sources}=fakeContext();const events=[];
 const player=new PcmAudioPlayer({audioContext:ctx,onEvent:e=>events.push(e)});
 const frame=new Uint8Array(4800);
 assert.equal(player.enqueue(frame,{generation:0,sequence:0}),true);
 assert.equal(player.enqueue(frame,{generation:0,sequence:1}),true);
 assert.ok(sources[1].started>sources[0].started);
 const generation=player.interrupt();
 assert.equal(generation,1);
 assert.ok(sources.every(s=>s.stopped));
 assert.equal(player.enqueue(frame,{generation:0,sequence:2}),false);
 assert.ok(events.some(e=>e.type==="playback.cleared"));
});
test("queue limit prevents runaway buffering",()=>{
 const {ctx}=fakeContext();const player=new PcmAudioPlayer({audioContext:ctx,maxQueuedSeconds:0.05});
 player.enqueue(new Uint8Array(4800));
 assert.throws(()=>player.enqueue(new Uint8Array(4800)),/PLAYBACK_BACKPRESSURE/);
});
test("rejects malformed PCM",()=>{
 const {ctx}=fakeContext();const player=new PcmAudioPlayer({audioContext:ctx});
 assert.throws(()=>player.enqueue(new Uint8Array([1])),/INVALID_PCM/);
});
