import test from "node:test";
import assert from "node:assert/strict";
import {EnergyVad} from "./energy-vad.mjs";
const samples=(amplitude,n=1600)=>new Int16Array(n).fill(amplitude);
test("speech start after minimum voiced duration",()=>{
 const v=new EnergyVad({minSpeechMs:200,hangoverMs:300});
 assert.equal(v.process(samples(6000)).event,null);
 assert.equal(v.process(samples(6000)).event,"speech.start");
 assert.equal(v.process(samples(0)).event,null);
 assert.equal(v.process(samples(0)).event,null);
 assert.equal(v.process(samples(0)).event,"speech.end");
});
test("silence does not start speech",()=>{
 const v=new EnergyVad();
 for(let i=0;i<10;i++)assert.equal(v.process(samples(0)).event,null);
});
test("invalid audio rejected",()=>{
 assert.throws(()=>new EnergyVad().process(new Uint8Array([1])),/INVALID_AUDIO/);
});
