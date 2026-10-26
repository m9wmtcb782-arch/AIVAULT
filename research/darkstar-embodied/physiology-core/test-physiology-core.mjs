/**
 * Virtual Human Physiology Core｜耦合與規範符合性測試
 */
import { createPhysiologyCore } from './dynamics.js';
import { SLOT_DEFS, createStateVector, listAllSlotIds } from './state-vector.js';
import { EVIDENCE_TIER, assertNoFalseBiologicalClaims, listEvidenceCatalog } from './evidence-tiers.js';
import { createConsentContext } from './consent-context.js';

let passed = 0;
let failed = 0;
const errors = [];

function ok(name, cond, detail) {
  if (cond) {
    passed += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failed += 1;
    errors.push({ name, detail });
    console.log(`  FAIL  ${name}${detail ? ' — ' + detail : ''}`);
  }
}

console.log('=== Physiology Core tests ===\n');

// A. 槽位完整性：pending 不被刪
{
  console.log('[A] slot integrity / pending_research preserved');
  const sv = createStateVector({ individualSeed: 1 });
  sv.assertIntegrity();
  const pending = sv.listPendingResearch();
  ok('all SLOT_DEFS present', listAllSlotIds().length === SLOT_DEFS.length);
  ok('pending_research count > 0', pending.length >= 8, `count=${pending.length}`);
  ok(
    'intimacy slots exist',
    pending.some((p) => p.id === 'intimacyMotivation') &&
      pending.some((p) => p.id === 'sexualArousal'),
    pending.map((p) => p.id).join(',')
  );
  ok(
    'cycle/endocrine slots exist',
    pending.some((p) => p.id === 'cyclePhase') &&
      pending.some((p) => p.id === 'estrogenProxy'),
    'missing cycle slots'
  );
  ok(
    'negative affect slots exist (not happiness-only)',
    pending.some((p) => p.id === 'sadness') && pending.some((p) => p.id === 'anger'),
    'missing sadness/anger'
  );
}

// B. 多狀態並存＋連續更新
{
  console.log('\n[B] multi-state coexistence + continuous dynamics');
  const core = createPhysiologyCore({ individualSeed: 2 });
  core.step(1, { socialStress: 0.5, thermal: -0.4 });
  core.step(2, { nociception: 0.7, rest: 0 });
  const snap = core.readSnapshot();
  ok('simTime advanced', snap.simTimeSec >= 3 - 1e-9, `t=${snap.simTimeSec}`);
  ok('fatigue and nociception can coexist', snap.slots.fatigue.value > 0 && snap.slots.nociception.value > 0);
  ok('stress elevated with socialStress', snap.slots.stress.value > 0.15, `stress=${snap.slots.stress.value}`);
  ok('thermal comfort set', snap.slots.thermalComfort.value < 0);
  ok('no biological organ claim', snap.claimsBiologicalOrgan === false);
  ok('no subjective consciousness claim', snap.claimsSubjectiveConsciousness === false);
  assertNoFalseBiologicalClaims(snap);
  ok('assertNoFalseBiologicalClaims', true);
}

// C. 疲勞影響輸出（禁疲倦＋全速）
{
  console.log('\n[C] fatigue affects effectors');
  const core = createPhysiologyCore({
    individualSeed: 3,
    overrides: { fatigue: 0.85, sleepDebt: 0.7, eyelidDroop: 0.5, reactionSpeed: 0.9 }
  });
  // step 一次讓耦合重算 reactionSpeed
  core.step(0.5, {});
  const eff = core.getEffectors();
  const snap = core.readSnapshot();
  ok('eyelidDroop elevated', eff.eyelidDroop > 0.3, `droop=${eff.eyelidDroop}`);
  ok('reactionDelay increased', eff.reactionDelayMs > 100, `delay=${eff.reactionDelayMs}`);
  ok(
    'tired-eyes full-speed forbidden flag',
    snap.gates.tiredEyesFullSpeedForbidden === true || snap.gates.forbidTiredEyesFullSpeed === true
  );
  ok(
    'reactionSpeed not full when droop high',
    snap.slots.reactionSpeed.value < 0.85,
    `rs=${snap.slots.reactionSpeed.value}`
  );
}

// D. 危急／高 BAC 限制活動
{
  console.log('\n[D] critical / high BAC gates');
  const core = createPhysiologyCore({
    individualSeed: 4,
    overrides: { bac: 0.3, consciousness: 0.9 }
  });
  core.step(2, {});
  const g = core.readSnapshot().gates;
  const eff = core.getEffectors();
  ok('critical true at high BAC', g.critical === true || eff.critical === true);
  ok('walk blocked when critical', eff.allowWalk === false);
  ok('complex autonomy blocked', eff.allowComplexAutonomy === false);
}

// E. 同意閘：不刪槽；阻擋親密輸出
{
  console.log('\n[E] consent gate preserves slots');
  const consent = createConsentContext({ mutualConsent: false, userPresent: true });
  const core = createPhysiologyCore({ individualSeed: 5, consent });
  const before = core.state.listPendingResearch().length;
  const denied = core.gateOutput('intimacy_expression');
  ok('intimacy output denied without consent', denied.allowed === false, denied.reason);
  ok('physiologySlotsPreserved', denied.physiologySlotsPreserved === true);
  const after = core.state.listPendingResearch().length;
  ok('pending slots count unchanged after deny', before === after && after > 0, `${before}->${after}`);
  ok('read_state always allowed', core.gateOutput('read_state').allowed === true);

  consent.update({ mutualConsent: true });
  const allowed = core.gateOutput('intimacy_expression');
  ok('intimacy output allowed with consent', allowed.allowed === true, allowed.reason);
}

// F. 證據分級存在
{
  console.log('\n[F] evidence tiers');
  const catalog = listEvidenceCatalog();
  ok('catalog non-empty', catalog.length >= 5);
  ok(
    'has approximation and hypothesis',
    catalog.some((c) => c.tier === EVIDENCE_TIER.APPROXIMATION) &&
      catalog.some((c) => c.tier === EVIDENCE_TIER.HYPOTHESIS)
  );
  ok(
    'no catalog item claims organ/consciousness',
    catalog.every((c) => c.claimsBiologicalOrgan === false && c.claimsSubjectiveConsciousness === false)
  );
}

// G. 個體差異：同刺激不同種子可不同（非固定劇本）
{
  console.log('\n[G] individual differences');
  const a = createPhysiologyCore({ individualSeed: 10 });
  const b = createPhysiologyCore({ individualSeed: 99 });
  const va = a.readSnapshot().slots.intimacyMotivation.value;
  const vb = b.readSnapshot().slots.intimacyMotivation.value;
  const fa = a.readSnapshot().slots.fatigue.value;
  const fb = b.readSnapshot().slots.fatigue.value;
  ok(
    'seeds can differ on jittered slots',
    va !== vb || fa !== fb,
    `mot ${va}/${vb} fat ${fa}/${fb}`
  );
}

// H. pending 槽可 set，不得因 pending 拋錯刪除
{
  console.log('\n[H] pending slots writable');
  const core = createPhysiologyCore({ individualSeed: 6 });
  core.state.set('sadness', 0.4);
  core.state.set('cyclePhase', 0.6);
  ok('set sadness ok', core.state.get('sadness') === 0.4);
  ok('set cyclePhase ok', Math.abs(core.state.get('cyclePhase') - 0.6) < 1e-9);
  core.assertIntegrity();
  ok('integrity after pending writes', true);
}

console.log(`\n=== Result: ${passed} passed, ${failed} failed ===`);
if (failed) {
  console.error(JSON.stringify(errors, null, 2));
  process.exit(1);
}
process.exit(0);
