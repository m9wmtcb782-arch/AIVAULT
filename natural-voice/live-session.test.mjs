import test from "node:test";
import assert from "node:assert/strict";
import {LiveVoiceSession} from "./live-session.mjs";

test("reorders audio frames and ignores stale generations",()=>{
 const events=[];const s=new LiveVoiceSession({onEvent:e=>events.push(e)});
 s.start();const old=s.beginResponse();
 const frame=(sequence,epoch=old)=>({epoch,sequence,pcm:new Uint8Array([1]),segmentId:"a",startOffset:0,endOffset:1});
 assert.equal(s.receiveAudio(frame(1)),true);
 assert.equal(events.filter(e=>e.type==="audio.frame").length,0);
 assert.equal(s.receiveAudio(frame(0)),true);
 assert.deepEqual(events.filter(e=>e.type==="audio.frame").map(e=>e.sequence),[0,1]);
 s.interrupt();
 assert.equal(s.receiveAudio(frame(2)),false);
 assert.equal(s.state,"listening");
});
test("stop clears buffered frames and rejects late output",()=>{
 const s=new LiveVoiceSession();s.start();const epoch=s.beginResponse();
 s.stop();
 assert.equal(s.receiveAudio({epoch,sequence:0,pcm:new Uint8Array([1]),startOffset:0,endOffset:1}),false);
});
test("backpressure rejects far-ahead sequence",()=>{
 const s=new LiveVoiceSession({maxBufferedFrames:2});s.start();const epoch=s.beginResponse();
 assert.throws(()=>s.receiveAudio({epoch,sequence:2,pcm:new Uint8Array([1]),startOffset:0,endOffset:1}),/AUDIO_BACKPRESSURE/);
});
