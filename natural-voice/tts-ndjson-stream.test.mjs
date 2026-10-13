import test from "node:test";
import assert from "node:assert/strict";
import {parseTtsNdjson} from "./tts-ndjson-stream.mjs";
const encode = new TextEncoder();
function mockResponse(parts) {
  return {ok:true,body:new ReadableStream({
    start(controller) {
      for (const part of parts) controller.enqueue(encode.encode(part));
      controller.close();
    }
  })};
}
test("reads audio split across network packets",async()=>{
  const payload = JSON.stringify({type:"audio",sequence:0,pcm_base64:"AAA="})+"\n"+
    JSON.stringify({type:"complete",frames:1})+"\n";
  const frames=[];
  for await (const pcm of parseTtsNdjson(mockResponse([payload.slice(0,9),payload.slice(9,27),payload.slice(27)]))) frames.push([...pcm]);
  assert.deepEqual(frames,[[0,0]]);
});
test("rejects incomplete stream",async()=>{
  const r=mockResponse([JSON.stringify({type:"audio",sequence:0,pcm_base64:"AAA="})+"\n"]);
  await assert.rejects(async()=>{for await(const pcm of parseTtsNdjson(r)) void pcm;},/TTS_STREAM_TRUNCATED/);
});
test("rejects skipped frame sequence",async()=>{
  const r=mockResponse([JSON.stringify({type:"audio",sequence:2,pcm_base64:"AAA="})+"\n"]);
  await assert.rejects(async()=>{for await(const pcm of parseTtsNdjson(r)) void pcm;},/INVALID_TTS_EVENT/);
});

test("accepts many short lines delivered in one packet",async()=>{
 const audio=JSON.stringify({type:"audio",sequence:0,pcm_base64:"AAA="})+"\n";
 const done=JSON.stringify({type:"complete",frames:1})+"\n";
 const frames=[];
 for await(const pcm of parseTtsNdjson(mockResponse([audio+done]),{maxLineBytes:100}))frames.push([...pcm]);
 assert.deepEqual(frames,[[0,0]]);
});
test("rejects incorrect completed frame count",async()=>{
 const r=mockResponse([JSON.stringify({type:"audio",sequence:0,pcm_base64:"AAA="})+"\n"+
 JSON.stringify({type:"complete",frames:2})+"\n"]);
 await assert.rejects(async()=>{for await(const pcm of parseTtsNdjson(r))void pcm;},/INVALID_TTS_COMPLETE/);
});

test("rejects unexpected audio after completion",async()=>{
 const done=JSON.stringify({type:"complete",frames:0})+"\n";
 const audio=JSON.stringify({type:"audio",sequence:0,pcm_base64:"AAA="})+"\n";
 await assert.rejects(async()=>{for await(const pcm of parseTtsNdjson(mockResponse([done+audio]))) { void pcm; }},/TRAILING_TTS_DATA/);
});

test("metadata mode exposes original text range",async()=>{
 const audio=JSON.stringify({type:"audio",sequence:0,pcm_base64:"AAA=",char_start:0,char_end:3,sample_rate:24000})+"\n";
 const done=JSON.stringify({type:"complete",frames:1})+"\n";
 const frames=[];
 for await(const item of parseTtsNdjson(mockResponse([audio+done]),{withMetadata:true}))frames.push(item);
 assert.equal(frames[0].charStart,0);
 assert.equal(frames[0].charEnd,3);
 assert.equal(frames[0].sampleRate,24000);
 assert.deepEqual([...frames[0].pcm],[0,0]);
});

test("rejects trailing audio in a separate network packet",async()=>{
 const done=JSON.stringify({type:"complete",frames:0})+"\n";
 const extra=JSON.stringify({type:"audio",sequence:0,pcm_base64:"AAA="})+"\n";
 await assert.rejects(async()=>{for await(const frame of parseTtsNdjson(mockResponse([done,extra])))void frame;},/TRAILING_TTS_DATA/);
});
