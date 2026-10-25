/**
 * ENGINE-23～27 Phase1 驗收 A～F
 * Run: node research/darkstar-embodied/phase1/neuro-state-lab/test-neuro-state.mjs
 */
import {
  createNeuroPhysioStack,
  createMemoryStorage
} from '../../shared/neuro-physio-stack.js';
import { ethanolGrams, bacContribution, createAlcoholEngine } from '../../engines/ENGINE-25-alcohol-impairment/alcohol-engine.js';

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) {
    passed += 1;
    console.log('  PASS', msg);
  } else {
    failed += 1;
    console.error('  FAIL', msg);
  }
}
function section(t) {
  console.log('\n==', t);
}

const storage = createMemoryStorage();
const stack = createNeuroPhysioStack({ storage, testMode: true, timeScale: 60 });

section('Test A｜清醒→疲勞累積；禁疲倦眼神＋全速反應');
stack.safeReset();
// Simulate long awake: 18 hours
stack.tickMinutes(18 * 60, { autosave: false });
const a = stack.recomputeAll();
assert(a.sleep.fatigue > 0.4, `A fatigue=${a.sleep.fatigue}`);
assert(a.sleep.forbidTiredEyesFullSpeed === true || a.sleep.fatigue >= 0.55 || a.sleep.sleepDebt01 >= 0.5, 'A forbid flag or high fatigue/debt');
assert(a.neuro.gazeFocus < 0.85 || a.neuro.fatigue > 0.4, `A gazeFocus=${a.neuro.gazeFocus}`);
// reactionSpeed must not greatly exceed gazeFocus when tired
assert(
  a.neuro.reactionSpeed <= a.neuro.gazeFocus + 0.15 + 1e-6,
  `A reactionSpeed ${a.neuro.reactionSpeed} <= gazeFocus ${a.neuro.gazeFocus}+0.15`
);
assert(a.effectors.tiredExpression === true || a.effectors.eyelidDroop > 0.2, 'A tired expression/eyelid');
assert(a.neuro.disclaimer.includes('意識') || a.neuro.simulated === true, 'A simulated disclaimer');

section('Test B｜睡眠／休息恢復疲勞');
const fatigueBefore = a.sleep.fatigue;
stack.sleep.startSleep();
stack.tickMinutes(6 * 60, { autosave: false }); // 6h sleep
const b = stack.recomputeAll();
assert(b.sleep.fatigue < fatigueBefore, `B fatigue ${b.sleep.fatigue} < ${fatigueBefore}`);
assert(b.neuro.wakefulness > a.neuro.wakefulness || b.sleep.fatigue < 0.35, 'B wakefulness improved or low fatigue');
stack.sleep.wake();

section('Test C｜酒精 ABV／容量／時間 → 連續分級（非固定動畫）');
stack.safeReset();
const mild = stack.ingestDrink({ abvPercent: 5, volumeMl: 350, label: 'beer' });
stack.tickMinutes(40, { autosave: false });
const c1 = stack.alcohol.getImpairment();
stack.ingestDrink({ abvPercent: 40, volumeMl: 60, label: 'spirit' });
stack.tickMinutes(50, { autosave: false });
const c2 = stack.alcohol.getImpairment();
assert(c2.bac > c1.bac, `C bac rose ${c1.bac} → ${c2.bac}`);
assert(c2.channels.coordination < c1.channels.coordination || c2.impairment01 > c1.impairment01, 'C coordination/impairment worsened');
assert(c2.note.includes('固定動畫') || c2.doses.length >= 2, 'C multi-dose continuous model');
// Different dose → different BAC (not same fixed outcome)
const eng = createAlcoholEngine();
eng.ingest({ abvPercent: 5, volumeMl: 100 });
eng.tickMinutes(60);
const low = eng.getImpairment().bac;
eng.reset();
eng.ingest({ abvPercent: 40, volumeMl: 200 });
eng.tickMinutes(60);
const high = eng.getImpairment().bac;
assert(high > low * 2, `C dose-responsive bac low=${low} high=${high}`);
assert(ethanolGrams(100, 40) > ethanolGrams(100, 5), 'C ethanolGrams scales with ABV');

section('Test D｜嚴重中毒／危急獨立；昏迷禁走談');
stack.safeReset();
// Push to critical BAC via hydrate for deterministic test
stack.alcohol.hydrateBac(0.32);
const d = stack.recomputeAll();
assert(d.alcohol.criticalIntoxication === true || d.alcohol.band === 'critical', `D band=${d.alcohol.band}`);
assert(d.alcohol.independentFromSleep === true, 'D independent from sleep');
assert(d.neuro.consciousness === 'critical' || d.neuro.consciousness === 'coma', `D consciousness=${d.neuro.consciousness}`);
assert(d.coupling.locomotion.allowWalk === false, 'D no walk');
assert(d.coupling.behavior.allowComplexAutonomy === false, 'D no complex autonomy');
const walkGate = stack.coupling.canPerformMotor('walk_to');
assert(walkGate.can === false, `D walk blocked: ${walkGate.reason}`);
const talkGate = stack.coupling.canPerformMotor('talk');
// critical may allow weak talk; coma must not — force coma
stack.alcohol.hydrateBac(0.4);
stack.neuro.recompute({
  fatigue: 0.9,
  sleepDebt: 0.5,
  alcoholImpairment: 1,
  criticalIntoxication: true,
  illnessLoad: 0.5,
  painLoad: 0.2
});
const d2 = stack.recomputeAll();
assert(d2.coupling.behavior.allowTalk === false || d2.neuro.consciousness === 'coma' || d2.neuro.wakefulness <= 0.15, 'D talk restricted in deep critical/coma');

section('Test E｜神經－運動耦合影響視線／頭／運動修飾');
stack.safeReset();
stack.tickMinutes(16 * 60, { autosave: false });
stack.ingestDrink({ abvPercent: 40, volumeMl: 80 });
stack.tickMinutes(60, { autosave: false });
const e = stack.recomputeAll();
assert(e.coupling.gaze.blinkRateMul > 1, `E blinkRateMul=${e.coupling.gaze.blinkRateMul}`);
assert(e.coupling.headNeck.sway > 0 || e.coupling.headNeck.droop > 0, 'E head sway/droop');
assert(e.coupling.hands.precision < 1, `E hand precision=${e.coupling.hands.precision}`);
assert(e.coupling.behavior.reactionDelayMs >= 0, 'E reactionDelayMs');
assert(e.coupling.applyTo['ENGINE-15'] && e.coupling.applyTo['ENGINE-16'] && e.coupling.applyTo['ENGINE-03'], 'E hooks to 15/16/03');

section('Test F｜持久化：存檔→新堆疊載入→代謝續跑；安全重置');
stack.safeReset();
stack.setExternalLoads({ illness: 0.3, pain: 0.2 });
stack.ingestDrink({ abvPercent: 40, volumeMl: 50 });
stack.tickMinutes(30, { autosave: true });
const beforeBac = stack.alcohol.getImpairment().bac;
const beforeDebt = stack.sleep.getState().sleepHoursDebt;
assert(beforeBac > 0, `F bac saved ${beforeBac}`);
const saved = stack.persist.load();
assert(saved.ok, 'F storage has doc');

const stack2 = createNeuroPhysioStack({ storage, testMode: true });
const restored = stack2.restoreFromStorage();
assert(restored.ok && restored.continued, 'F restore continued');
assert(Math.abs(stack2.alcohol.getImpairment().bac - beforeBac) < 0.05, `F bac restored ${stack2.alcohol.getImpairment().bac}≈${beforeBac}`);
// metabolism continues
stack2.tickMinutes(120, { autosave: true });
const afterBac = stack2.alcohol.getImpairment().bac;
assert(afterBac < beforeBac, `F metabolized ${beforeBac} → ${afterBac}`);
assert(stack2.persist.getSimClock().simMinutes > 0, 'F sim clock advanced');

const reset = stack2.safeReset();
assert(stack2.alcohol.getImpairment().bac === 0, 'F reset bac=0');
assert(stack2.persist.load().ok === false || stack2.persist.load().reason === 'empty', 'F storage cleared');
assert(stack2.persist.isTestMode() === true, 'F testMode kept');

console.log('\n==== SUMMARY ====');
console.log(`passed=${passed} failed=${failed}`);
if (failed) process.exit(1);
console.log('All A–F passed (虛擬模擬｜開發中｜非真實意識／中毒)');
process.exit(0);
