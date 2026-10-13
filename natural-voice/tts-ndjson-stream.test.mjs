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
