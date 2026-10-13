import test from "node:test";
import assert from "node:assert/strict";
import {AsrTranscript} from "./asr-transcript.mjs";
test("partial and final transcript ordering",()=>{
 const events=[];const a=new AsrTranscript({onEvent:e=>events.push(e)});
 const epoch=a.start("session-1");
 assert.equal(a.receive({sessionId:"session-1",epoch,sequence:0,text:"你好",isFinal:false}),true);
 assert.equal(a.snapshot().partial,"你好");
 assert.equal(a.receive({sessionId:"session-1",epoch,sequence:1,text:"你好暗星",isFinal:true}),true);
 assert.equal(a.snapshot().finalText,"你好暗星");
 assert.equal(a.snapshot().partial,"");
 assert.deepEqual(events.map(e=>e.type),["asr.partial","asr.final"]);
});
test("rejects stale and duplicate transcripts",()=>{
 const a=new AsrTranscript();const epoch=a.start("a");
 assert.equal(a.receive({sessionId:"a",epoch,sequence:0,text:"一",isFinal:true}),true);
 assert.equal(a.receive({sessionId:"a",epoch,sequence:0,text:"重複",isFinal:true}),false);
 a.start("b");
 assert.equal(a.receive({sessionId:"a",epoch,sequence:1,text:"過期",isFinal:true}),false);
 assert.equal(a.snapshot().finalText,"");
});
test("invalid text fails",()=>{
 const a=new AsrTranscript();const epoch=a.start("a");
 assert.throws(()=>a.receive({sessionId:"a",epoch,sequence:0,text:4,isFinal:true}),/INVALID_TRANSCRIPT/);
});
