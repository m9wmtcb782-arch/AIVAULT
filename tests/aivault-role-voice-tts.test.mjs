import assert from "node:assert/strict";
import { test } from "node:test";
import { VOICE_IDS, validateDialogue, buildSynthesisRequest, validateAudioResult, synthesizeWithWorker } from "../aivault-role-voice-tts-adapter.mjs";
const valid={voice_id:"AV-M01",emotion:"自然",text:"你好，世界。"};
test("24 unique voices",()=>{assert.equal(VOICE_IDS.length,24);assert.equal(new Set(VOICE_IDS).size,24)});
test("all 24 IDs pass",()=>{for(const id of VOICE_IDS)assert.equal(validateDialogue({...valid,voice_id:id}).voice_id,id)});
test("invalid voice and emotion blocked",()=>{assert.throws(()=>validateDialogue({...valid,voice_id:"fake"}),/UNKNOWN_VOICE_ID/);assert.throws(()=>validateDialogue({...valid,emotion:"未知"}),/UNKNOWN_EMOTION/)});
test("blank and oversized text blocked",()=>{assert.throws(()=>validateDialogue({...valid,text:" "}),/INVALID_TEXT_LENGTH/);assert.throws(()=>validateDialogue({...valid,text:"字".repeat(1501)}),/INVALID_TEXT_LENGTH/)});
test("no worker never claims success",async()=>{await assert.rejects(synthesizeWithWorker(valid),/TTS_WORKER_NOT_CONNECTED/)});
test("MIME spoofed audio blocked",async()=>{const fake=new Blob(["this is not audio at all"],{type:"audio/wav"});await assert.rejects(validateAudioResult({status:"READY",audio_blob:fake}),/AUDIO_HEADER_MISMATCH/)});
test("WAV header accepted, no playback quality implied",async()=>{const h=new Uint8Array(44);h.set([82,73,70,70],0);h.set([87,65,86,69],8);h.set([102,109,116,32],12);const wav=new Blob([h],{type:"audio/wav"});assert.equal(await validateAudioResult({status:"READY",audio_blob:wav}),wav)});
test("request keeps selected voice and model",()=>{const r=buildSynthesisRequest(valid);assert.equal(r.voice_id,"AV-M01");assert.equal(r.model,"Qwen3-TTS")});

test("RIFF-only fake WAV rejected",async()=>{const h=new Uint8Array(44);h.set([82,73,70,70],0);h.set([87,65,86,69],8);await assert.rejects(validateAudioResult({status:"READY",audio_blob:new Blob([h],{type:"audio/wav"})}),/AUDIO_HEADER_MISMATCH/)});
