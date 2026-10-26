import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createPhysiologyChatBridge, installPhysiologyChatBridge } from './darkstar-physiology-chat.js';

const map = new Map();
const storage = { getItem: k => map.get(k) ?? null, setItem: (k,v) => map.set(k,v) };
let time = 0;
const bridge = createPhysiologyChatBridge({ storage, scope: 'owner', now: () => time });
const initial = bridge.snapshot();
assert.ok(initial.slots.cyclePhase && initial.slots.intimacyMotivation);
assert.ok(initial.pendingResearchCount > 0);
assert.equal(bridge.receiveStimulus({ source: 'chat', nociception: 1 }).accepted, false);
assert.equal(bridge.receiveStimulus({ source: 'virtual', nociception: NaN }).accepted, false);
const pain = bridge.receiveStimulus({ source: 'virtual', nociception: 0.8, socialStress: 0.5 });
assert.equal(pain.accepted, true);
assert.ok(pain.snapshot.slots.comfort.value < initial.slots.comfort.value);
assert.ok(pain.snapshot.effectors.reactionDelayMs > initial.effectors.reactionDelayMs);
time = 86400000;
const context = bridge.context();
assert.ok(context.includes('pending_research') && context.includes('nociception'));
assert.equal(bridge.snapshot().simulatedSeconds, 1);
const reload = createPhysiologyChatBridge({ storage, scope: 'owner', now: () => time });
assert.equal(reload.snapshot().slots.stress.value, bridge.snapshot().slots.stress.value);
const other = createPhysiologyChatBridge({ storage, scope: 'other', now: () => time });
assert.equal(other.snapshot().slots.stress.value, initial.slots.stress.value);
assert.doesNotThrow(() => createPhysiologyChatBridge({ storage: { getItem(){throw Error('blocked')}, setItem(){throw Error('blocked')} } }).context());

const win = { localStorage: storage, addEventListener(){}, dispatchEvent(){} };
const installed = installPhysiologyChatBridge(win);
installed.receiveStimulus({ source:'virtual', socialStress:1 });
storage.setItem('sb-clcddygkaaqqtsbswgdf-auth-token', JSON.stringify({user:{id:'second'}}));
assert.equal(installed.snapshot().slots.stress.value, initial.slots.stress.value);

const page = fs.readFileSync(new URL('./technical-dark-star.html', import.meta.url), 'utf8');
const baselineScripts = [fs.readFileSync(new URL('./baseline-voice-script.txt', import.meta.url), 'utf8')];
let baselineErrors = 0;
for (const match of page.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
  if (/type\s*=\s*["'](?:module|application\/)/i.test(match[1])) continue;
  try { new vm.Script(match[2]); } catch(error) {
    assert.ok(baselineScripts.includes(match[2]), 'modified script must have no syntax errors');
    baselineErrors++;
  }
}
console.log('Unchanged pre-existing inline script syntax errors:', baselineErrors);
const appearanceSource = page.slice(page.indexOf('function getRequestedImageAppearanceGuidance('), page.indexOf('\nfunction isImageContinuationIntent'));
const appearance = vm.runInNewContext(appearanceSource + ';getRequestedImageAppearanceGuidance');
assert.ok(appearance('中國男性肖像').includes('中國／華人'));
assert.ok(!appearance('中國男性肖像').includes('成人女性'));
assert.ok(appearance('非洲成人').includes('非洲／非洲裔'));
assert.ok(appearance('泰國成年人').includes('東南亞'));
assert.ok(appearance('南亞印度男性').includes('南亞'));
assert.ok(!appearance('南亞印度男性').includes('東亞成人肖像'));
assert.ok(appearance('歐洲女性與非洲男性').includes('各人物描述分別套用'));
assert.equal(appearance('小狗坐在公園'), '');

// Execute the real page request builder with a mocked transport; no API calls.
const start = page.indexOf('async function callAIVAULT(');
const stop = page.indexOf('/* =========================================================\n   SEND MESSAGE', start);
assert.ok(start >= 0 && stop > start);
let payload;
const sandbox = {
  window: { AIVAULTDarkStarPhysiologyReady: Promise.resolve({getContext:()=>context}) },
  updateDarkStarWorkLocation(){}, requestSequence:0, console:{info(){},warn(){}},
  getDarkStarTopicId:()=> 'topic', getDarkStarLearningContext:async()=>'',
  ENGINE:'test', buildGatewayMessage:m=>m, conversationId:'conversation',
  isDarkStarSelfRepairIntent:()=>false, isDarkStarSelfDiagnosticIntent:()=>false,
  getAIVAULTAccessToken:()=>'', AI_GATEWAY_URL:'https://example.invalid',
  fetch:async (url, options)=>{payload=JSON.parse(options.body);throw Error('MOCK_TRANSPORT_STOP');}
};
vm.createContext(sandbox);
vm.runInContext(page.slice(start,stop)+';this.call=callAIVAULT;', sandbox);
await assert.rejects(sandbox.call('測試問題',[]), /MOCK_TRANSPORT_STOP/);
assert.ok(payload.message.includes('測試問題') && payload.message.includes('bot-physiology-core'));
assert.equal(payload.agent_id,'technical-dark-star');
assert.equal(payload.conversation_id,'conversation');
assert.equal(payload.provider,'gemini');
console.log('PASS: core coupling, event validation, persistence, account isolation, script syntax, appearance diversity and real chat payload integration. No network requests.');
