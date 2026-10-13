import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const html=readFileSync(new URL("./mobile-voice-pool-test.html",import.meta.url),"utf8");
test("standalone phone diagnostic imports existing probe",()=>{
 assert.match(html,/mobile-webgpu-voice-preflight\.mjs/);
 assert.match(html,/probeMobileVoiceRuntime\(\)/);
});
test("no fabricated audio or paid API is used",()=>{
 assert.doesNotMatch(html,/speechSynthesis|new Audio\(|\.play\(|gemini|grok|kling/i);
 assert.match(html,/生成中文語音（尚未具備模型）/);
 assert.match(html,/<button disabled>/);
});
