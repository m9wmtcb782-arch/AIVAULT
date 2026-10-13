import test from "node:test";
import assert from "node:assert/strict";
import {enqueueWithPacing} from "./stream-playback-pacing.mjs";
test("queues frame when audio clock has room",async()=>{
 const player={nextTime:0,maxQueuedSeconds:3,context:{currentTime:0},enqueue:frame=>frame.length===2};
 assert.equal(await enqueueWithPacing(player,new Uint8Array([0,0])),true);
});
test("stops promptly if interrupted",async()=>{
 const controller=new AbortController();controller.abort();
 const player={nextTime:8,maxQueuedSeconds:3,context:{currentTime:0},enqueue:()=>{throw Error("should not run")}};
 assert.equal(await enqueueWithPacing(player,new Uint8Array([0,0]),{signal:controller.signal}),false);
});
test("rejects permanently blocked audio queue",async()=>{
 const player={nextTime:8,maxQueuedSeconds:3,context:{currentTime:0},enqueue:()=>true};
 await assert.rejects(enqueueWithPacing(player,new Uint8Array([0,0]),{maximumWaitMs:1}),/PLAYBACK_QUEUE_TIMEOUT/);
});
