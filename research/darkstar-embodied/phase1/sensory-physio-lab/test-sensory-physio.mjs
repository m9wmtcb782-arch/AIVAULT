/**
 * ENGINE-17～22 Phase1 驗收 A～G（Node 自動化）
 * Run: node research/darkstar-embodied/phase1/sensory-physio-lab/test-sensory-physio.mjs
 */
import { createSensoryPhysioStack } from '../../shared/sensory-physio-stack.js';
import { createBodyAwareness } from '../../engines/ENGINE-02-body-awareness/body-awareness.js';
import { createCapabilityEngine } from '../../engines/ENGINE-05-capability/capability-engine.js';

let passed = 0;
let failed = 0;
const evidence = [];

function assert(cond, msg) {
  if (cond) {
    passed += 1;
    console.log('  PASS', msg);
    evidence.push({ ok: true, msg });
  } else {
    failed += 1;
    console.error('  FAIL', msg);
    evidence.push({ ok: false, msg });
  }
}

function section(t) {
  console.log('\n==', t);
}

const motorLog = [];
const stack = createSensoryPhysioStack({
  timeScale: 50,
  motor: {
    executeReflex(r) {
      motorLog.push({ ...r, executedAt: Date.now() });
    }
  }
});

const awareness = createBodyAwareness({
  controller: {
    version: '0.2.0-dev-mock',
    macros: ['wave', 'lift_heavy', 'smile'],
    getLastFeedback: () => ({ status: 'idle' }),
    inspectArms: () => ({
      R: { upper: { name: 'RightArm' } },
      L: { upper: { name: 'LeftArm' } }
    })
  },
  mockState: {
    boneCount: 912,
    pose: { standing: true, sitting: false },
    skeleton: { boneCount: 912, hints: ['neck'], armChains: { R: true, L: true }, morphCapable: true }
  },
  scene: { id: 'sensory-lab', objects: {} },
  sensoryMemory: stack.memory
});
const capability = createCapabilityEngine({ bodyAwareness: awareness });

section('Test A｜高溫 → 縮手＋皮膚反應');
stack.reset();
motorLog.length = 0;
const hot = stack.processStimulus({
  region: 'hand_R',
  type: 'temperature',
  temperatureC: 80,
  intensity: 1,
  source: 'virtual_hot_plate',
  durationMs: 500
});
assert(hot.ok, 'A process ok');
assert(hot.protectiveFirst === true, 'A protectiveFirst');
assert((hot.reflexes || []).some((r) => r.kind === 'withdraw_hand'), 'A withdraw_hand reflex');
assert(motorLog.some((m) => m.kind === 'withdraw_hand'), 'A motor executed reflex before decision');
assert(hot.sensation.skinTone === 'burned' || hot.sensation.skinTone === 'flushed', `A skinTone=${hot.sensation.skinTone}`);
assert(hot.sensation.heat > 0 && hot.sensation.virtualPain > 0, 'A heat+virtualPain');
assert(hot.injury && hot.injury.kind === 'burn', `A injury kind=${hot.injury && hot.injury.kind}`);
assert(hot.sensation.subjectiveClaim === false, 'A no subjective pain claim');
assert(hot.sensation.simulated === true, 'A simulated flag');

section('Test B｜低溫冷刺激');
stack.reset();
const cold = stack.processStimulus({
  region: 'hand_L',
  type: 'temperature',
  temperatureC: -5,
  intensity: 0.8,
  source: 'virtual_ice'
});
assert(cold.ok, 'B process ok');
assert(cold.sensation.cold > 0, `B cold=${cold.sensation.cold}`);
assert(cold.sensation.skinTone === 'pale', 'B skin pale');
assert(!(cold.reflexes || []).some((r) => r.kind === 'withdraw_hand'), 'B no heat withdraw');

section('Test C｜碰撞更新身體狀態');
stack.reset();
const hit = stack.processStimulus({
  region: 'forearm_R',
  type: 'collision',
  impactForce: 40,
  intensity: 0.5,
  source: 'virtual_obstacle'
});
assert(hit.ok, 'C process ok');
assert(hit.injury && hit.injury.kind === 'bruise', `C bruise got ${hit.injury && hit.injury.kind}`);
assert(hit.injury.fromPhysics === true, 'C fromPhysics');
const memC = stack.memory.getState();
assert(memC.stimulusCount >= 1, 'C memory recorded stimulus');
assert(hit.restrictions.activeInjuryCount >= 1, 'C active injury in restrictions');

section('Test D｜手臂傷 → 能力限制 → 復原更新');
stack.reset();
const frac = stack.processStimulus({
  region: 'upper_arm_R',
  type: 'collision',
  impactForce: 100,
  intensity: 1,
  source: 'virtual_fall'
});
assert(frac.injury && frac.injury.kind === 'fracture', `D fracture=${frac.injury && frac.injury.kind}`);
const liftBlocked = capability.canPerform('lift_heavy', { side: 'R' });
assert(liftBlocked.can === false, `D lift blocked: ${liftBlocked.reason}`);
assert(String(liftBlocked.reason).includes('ENGINE-22') || String(liftBlocked.reason).includes('傷害'), 'D reason cites ENGINE-22/injury');
const waveBlocked = awareness.canPerform('wave', { side: 'R' });
assert(waveBlocked.can === false, `D wave blocked: ${waveBlocked.reason}`);

// Dialogue-only injury must be rejected
const dlg = stack.injury.applyFromPhysics({ fromDialogueOnly: true, sensation: { region: 'hand_R' } });
assert(dlg.rejected === true, 'D dialogue-only injury rejected');

// Heal
const injId = frac.injury.id;
stack.recovery.setTimeScale(100);
for (let i = 0; i < 80; i++) stack.tick(500);
const after = stack.injury.get(injId);
assert(after && after.status === 'healed', `D healed status=${after && after.status}`);
assert(after.recoveryProgress >= 1, 'D recoveryProgress>=1');
const liftOk = capability.canPerform('lift_heavy', { side: 'R' });
assert(liftOk.can === true, `D lift allowed after heal: ${liftOk.reason}`);

section('Test E｜檸檬視覺 → 推測酸＋區分推測/測量');
stack.reset();
const lemon = stack.tasteOlf.inferFromVision('檸檬');
assert(lemon.isInference === true, 'E isInference');
assert(lemon.isMeasurement === false, 'E not measurement');
assert(lemon.actuallyTasted === false, 'E actuallyTasted=false');
assert(lemon.qualities.some((q) => /酸|sour/i.test(q)), `E qualities=${lemon.qualities}`);
assert(lemon.source === 'visual_inference', 'E source visual_inference');
assert(lemon.confidence < 0.95, `E confidence=${lemon.confidence} < attribute`);

section('Test F｜文字氣味＋可信度');
const smell = stack.tasteOlf.recordUserDescription('這附近有煙霧氣味，很刺鼻', { objectLabel: 'room' });
assert(smell.source === 'user_report', 'F user_report');
assert(smell.actuallySmelled === false, 'F actuallySmelled=false');
assert(smell.qualities.some((q) => /煙|刺激|臭|香/i.test(q)), `F qualities=${smell.qualities}`);
assert(/使用者|未真正/i.test(smell.claimAllowed), `F claimAllowed=${smell.claimAllowed}`);
assert(smell.confidence === stack.tasteOlf.SOURCE_CONFIDENCE.user_report, 'F confidence');

section('Test G｜虛擬感冒可見表現可恢復');
stack.reset();
const ill = stack.illness.startIllness('cold', 0.7);
assert(ill.ok, 'G start cold');
assert(ill.health.viralClaim === false, 'G viralClaim=false');
assert(ill.visuals.visible === true, 'G visuals visible');
assert(ill.visuals.particles.length >= 1 || Object.keys(ill.visuals.materials).length >= 1, 'G has particles or materials');
assert(ill.visuals.active.includes('runny_nose') || ill.visuals.active.includes('cough'), `G active=${ill.visuals.active}`);
const tickG = stack.illness.tick(3000);
assert(tickG.visuals.visible === true, 'G still visible while ill');
const cleared = stack.illness.clearIllness();
assert(cleared.health.illness === null, 'G cleared');
assert(cleared.visuals.visible === false, 'G visuals off after clear');

section('Integration｜Shared stack disclaimer');
assert(stack.somato.disclaimer.includes('主觀痛覺'), 'disclaimer somato');
assert(stack.illness.disclaimer.includes('病毒'), 'disclaimer illness');

console.log('\n==== SUMMARY ====');
console.log(`passed=${passed} failed=${failed}`);
if (failed) {
  console.error('EVIDENCE failures:', evidence.filter((e) => !e.ok));
  process.exit(1);
}
console.log('All A–G checks passed (虛擬模擬｜開發中｜非真實痛覺/感染)');
process.exit(0);
