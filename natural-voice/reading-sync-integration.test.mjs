import test from "node:test";
import assert from "node:assert/strict";
import {parseTtsNdjson} from "./tts-ndjson-stream.mjs";
import {PcmAudioPlayer} from "./pcm-audio-player.mjs";

function responseFor(events){
 const bytes=new TextEncoder().encode(events.map(e=>JSON.stringify(e)+"\n").join(""));
 return {ok:true,body:new ReadableStream({start(controller){controller.enqueue(bytes);controller.close();}})};
}
function fakeAudioContext(){
 return {currentTime:0,state:"running",destination:{},
  createBuffer(_channels,length){return {getChannelData(){return new Float32Array(length);}};},
  createBufferSource(){return {connect(){},disconnect(){},start(){},stop(){},onended:null};}};
}
test("server offsets survive browser parsing and highlight at playback time",async()=>{
 const original="你好。再見。";
 const events=[
  {type:"audio",sequence:0,pcm_base64:"AAA=",char_start:0,char_end:3,sample_rate:24000},
  {type:"audio",sequence:1,pcm_base64:"AAA=",char_start:3,char_end:6,sample_rate:24000},
  {type:"complete",frames:2}
 ];
 const ctx=fakeAudioContext(),highlights=[];
 const player=new PcmAudioPlayer({audioContext:ctx,onEvent:e=>{
  if(e.type==="playback.highlight")highlights.push(original.slice(e.charStart,e.charEnd));
 }});
 for await(const item of parseTtsNdjson(responseFor(events),{withMetadata:true})){
  player.enqueue(item.pcm,{sequence:item.sequence,charStart:item.charStart,charEnd:item.charEnd});
 }
 assert.deepEqual(highlights,[]);
 ctx.currentTime=0.2;
 player.updatePlaybackPosition();
 assert.deepEqual(highlights,["你好。","再見。"]);
 player.interrupt();
});
