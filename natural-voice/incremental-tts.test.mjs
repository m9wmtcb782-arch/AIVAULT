import test from "node:test";
import assert from "node:assert/strict";
import {speechChunks,synthesizeIncrementally} from "./incremental-tts.mjs";
test("preserves text and splits on punctuation",()=>{
 const text="你好，暗星！今天我們來測試語音合成。";
 const chunks=[...speechChunks(text,{maxChars:16,minChars:3})];
 assert.equal(chunks.join(""),text);
 assert.ok(chunks.length>=2);
});
test("handles unicode emoji without corruption",()=>{
 const text="你好😀你好😀你好😀";
 assert.equal([...speechChunks(text,{maxChars:8})].join(""),text);
});
test("emits audio frames in clause order",async()=>{
 const seen=[];
 const tts={synthesize:async({text})=>{
  seen.push(text);
  return (async function*(){yield new Uint8Array([0,0]);})();
 }};
 const results=[];
 for await(const frame of synthesizeIncrementally({text:"你好暗星。現在開始說話。",tts,voiceId:"anxing",maxChars:12}))
  results.push(frame);
 assert.equal(seen.join(""),"你好暗星。現在開始說話。");
 assert.equal(results.length,seen.length);
 assert.deepEqual(results.map(f=>f.chunkIndex),seen.map((_,i)=>i));
});
test("stops before next clause when aborted",async()=>{
 const controller=new AbortController();
 let calls=0;
 const tts={synthesize:async()=>{calls++;controller.abort();return (async function*(){yield new Uint8Array([0,0]);})();}};
 const frames=[];
 for await(const f of synthesizeIncrementally({text:"你好暗星。繼續說話。",tts,voiceId:"anxing",signal:controller.signal}))frames.push(f);
 assert.equal(frames.length,0);
 assert.equal(calls,1);
});
