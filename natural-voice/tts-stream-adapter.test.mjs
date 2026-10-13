import test from "node:test";
import assert from "node:assert/strict";
import {openTtsStream} from "./tts-stream-adapter.mjs";
test("streams self-hosted audio without paid providers",async()=>{
 let called;
 const fetchImpl=async(url,opts)=>{
  called={url,opts};
  return {ok:true,body:new ReadableStream({start(c){
   c.enqueue(new TextEncoder().encode(JSON.stringify({type:"audio",sequence:0,pcm_base64:"AAA="})+"\n"));
   c.enqueue(new TextEncoder().encode(JSON.stringify({type:"complete",frames:1})+"\n"));
   c.close();
  }})};
 };
 const frames=[];
 const stream=await openTtsStream({baseUrl:"https://voice.example.test/",token:"short-lived-test",text:"你好",fetchImpl});
 for await(const frame of stream)frames.push([...frame]);
 assert.equal(called.url,"https://voice.example.test/v1/tts/stream");
 assert.equal(called.opts.method,"POST");
 assert.equal(JSON.parse(called.opts.body).text,"你好");
 assert.deepEqual(frames,[[0,0]]);
});
test("requires HTTPS and credentials",async()=>{
 await assert.rejects(openTtsStream({baseUrl:"http://localhost",token:"x",text:"test"}),/HTTPS_REQUIRED/);
 await assert.rejects(openTtsStream({baseUrl:"https://example.test",token:"",text:"test"}),/AUTH_REQUIRED/);
});
