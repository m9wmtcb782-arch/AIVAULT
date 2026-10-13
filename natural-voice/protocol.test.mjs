import test from "node:test";
import assert from "node:assert/strict";
import {validateSynthesisRequest,validateAudioFrame} from "./protocol.mjs";
const request={request_id:"req-1",text:"你好，暗星。",voice_id:"anxing-default",mode:"conversation"};
test("accepts valid self-hosted synthesis request",()=>{
 assert.equal(validateSynthesisRequest(request).language,"zh-TW");
});
test("rejects empty input and unsupported language",()=>{
 assert.throws(()=>validateSynthesisRequest({...request,text:" "}),/INVALID_TEXT/);
 assert.throws(()=>validateSynthesisRequest({...request,language:"en-US"}),/UNSUPPORTED_LANGUAGE/);
});
test("rejects malformed PCM and offsets",()=>{
 const frame={request_id:"req-1",epoch:1,sequence:0,sample_rate:24000,format:"pcm_s16le",start_offset:0,end_offset:2,pcm:new Uint8Array([0,0])};
 assert.equal(validateAudioFrame(frame),frame);
 assert.throws(()=>validateAudioFrame({...frame,pcm:new Uint8Array([1])}),/INVALID_PCM/);
 assert.throws(()=>validateAudioFrame({...frame,end_offset:-1}),/INVALID_OFFSETS/);
});
