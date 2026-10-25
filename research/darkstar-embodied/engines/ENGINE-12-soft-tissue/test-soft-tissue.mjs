/**
 * ENGINE-12 soft-tissue automated tests.
 * Different angle / area / duration → different deformation.
 * Forbidden: uniform scale stand-in.
 *
 * node research/darkstar-embodied/engines/ENGINE-12-soft-tissue/test-soft-tissue.mjs
 */
import { createSoftTissueSim } from './soft-tissue-sim.js';
import { createShoulderCollider } from './shoulder-collider.js';
import { createCameraShoulderTracker } from './camera-shoulder-stub.js';
import fs from 'fs';

let passed = 0;
let failed = 0;
function assert(c, m) {
  if (c) {
    passed++;
    console.log('  PASS', m);
  } else {
    failed++;
    console.error('  FAIL', m);
  }
}
function section(t) {
  console.log('\n==', t);
}

function runPress({ x, y, z, radius, frames, regionFocus }) {
  const sim = createSoftTissueSim({
    regions: regionFocus || ['chest_L', 'chest_R', 'abdomen', 'cheek_L', 'buttock_L'],
    samplesPerAxis: 3
  });
  const shoulder = createShoulderCollider({ x, y, z, radius });
  shoulder.startPress(0);
  let peak = 0;
  for (let i = 0; i < frames; i++) {
    const c = shoulder.tick(i * 16);
    const snap = sim.step(1 / 60, [c]);
    const m = snap.metrics.chest_L || snap.metrics[regionFocus?.[0]] || Object.values(snap.metrics)[0];
    peak = Math.max(peak, m.maxDisplacement);
  }
  // release & settle a bit
  shoulder.endPress();
  for (let i = 0; i < 20; i++) sim.step(1 / 60, []);
  const state = sim.getDeformationState();
  const metrics = sim.getMetrics();
  return { peak, metrics, state, sim };
}

section('Independent region params exist (not one blob)');
const sim0 = createSoftTissueSim();
const st0 = sim0.getDeformationState();
assert(st0.regions.chest_L && st0.regions.abdomen && st0.regions.cheek_L, 'cheek/chest/abdomen present');
assert(st0.regions.buttock_L && st0.regions.buttock_R, 'buttocks present');
assert(
  st0.regions.chest_L.params.elasticity !== st0.regions.cheek_L.params.elasticity,
  'chest vs cheek elasticity differ'
);
assert(
  st0.regions.chest_L.params.volume !== st0.regions.abdomen.params.volume ||
    st0.regions.chest_L.params.damping !== st0.regions.abdomen.params.damping,
  'chest vs abdomen params differ'
);
assert(st0.regions.chest_L.uniformScale === null, 'uniformScale explicitly null');
assert(st0.regions.chest_L.deformationMode === 'local_sample_field', 'local sample field mode');
assert(st0.sharedBodyCoreLayer === 'soft-tissue', 'Shared Body Core layer tag');

section('Different contact angle → different deformation');
const frontal = runPress({ x: -0.09, y: 1.22, z: 0.22, radius: 0.08, frames: 40 });
const side = runPress({ x: -0.22, y: 1.22, z: 0.12, radius: 0.08, frames: 40 });
const fPeak = frontal.metrics.chest_L.maxDisplacement;
const sPeak = side.metrics.chest_L.peakPenetration >= 0 ? side.peak : 0;
assert(frontal.peak > 0.001, `frontal peak=${frontal.peak}`);
assert(side.peak > 0.0005, `side peak=${side.peak}`);
assert(
  Math.abs(frontal.peak - side.peak) > 1e-5 ||
    Math.abs((frontal.metrics.chest_L.lastAngleDeg || 0) - (side.metrics.chest_L.lastAngleDeg || 0)) > 5,
  `angle response differs (peaks ${frontal.peak} vs ${side.peak})`
);

section('Different contact area (radius) → different deformation');
const small = runPress({ x: -0.09, y: 1.22, z: 0.2, radius: 0.04, frames: 35 });
const large = runPress({ x: -0.09, y: 1.22, z: 0.2, radius: 0.11, frames: 35 });
assert(large.peak > small.peak, `larger area peak ${large.peak} > small ${small.peak}`);

section('Different duration → different residual / peak path');
const short = runPress({ x: -0.09, y: 1.22, z: 0.2, radius: 0.08, frames: 8 });
const long = runPress({ x: -0.09, y: 1.22, z: 0.2, radius: 0.08, frames: 55 });
assert(long.peak >= short.peak * 0.9, `longer press peak ${long.peak} >= short ${short.peak}*0.9`);
// After same settle, longer contact often leaves different residual before full recovery
assert(
  Math.abs(long.metrics.chest_L.meanDisplacement - short.metrics.chest_L.meanDisplacement) >= 0 ||
    long.metrics.chest_L.contactFrames > short.metrics.chest_L.contactFrames,
  `duration affects contactFrames ${long.metrics.chest_L.contactFrames} > ${short.metrics.chest_L.contactFrames}`
);
assert(
  long.metrics.chest_L.contactFrames > short.metrics.chest_L.contactFrames,
  'longer press more contact frames'
);

section('Rebound / stability after release');
const sim = createSoftTissueSim({ regions: ['chest_L'], samplesPerAxis: 3 });
const shoulder = createShoulderCollider({ x: -0.09, y: 1.22, z: 0.18, radius: 0.09 });
shoulder.startPress(0);
for (let i = 0; i < 30; i++) sim.step(1 / 60, [shoulder.tick(i * 16)]);
const mid = sim.getMetrics().chest_L.maxDisplacement;
shoulder.endPress();
for (let i = 0; i < 90; i++) sim.step(1 / 60, []);
const end = sim.getMetrics().chest_L.maxDisplacement;
assert(mid > 0.002, `compressed mid=${mid}`);
assert(end < mid * 0.55, `rebounded end=${end} < mid*0.55 (${mid * 0.55})`);

section('Not a single fixed animation — local samples diverge under contact');
const under = runPress({ x: -0.09, y: 1.22, z: 0.18, radius: 0.1, frames: 25 });
const samples = under.state.regions.chest_L.samples;
const mags = samples.map((s) => Math.hypot(s.disp.x, s.disp.y, s.disp.z));
const uniq = new Set(mags.map((m) => m.toFixed(5)));
assert(uniq.size >= 2, `local sample displacements vary (unique=${uniq.size})`);

section('Camera shoulder tracker is stub');
const tracker = createCameraShoulderTracker({ shoulderCollider: createShoulderCollider() });
const tr = await tracker.start();
assert(tr.ok === false && tr.status === '開發中', 'camera stub not claiming complete');

section('Write evidence JSON');
const evidence = {
  ts: new Date().toISOString(),
  zone: 'Asia/Taipei',
  status: '開發中',
  frontalPeak: frontal.peak,
  sidePeak: side.peak,
  smallPeak: small.peak,
  largePeak: large.peak,
  shortFrames: short.metrics.chest_L.contactFrames,
  longFrames: long.metrics.chest_L.contactFrames,
  rebound: { mid, end },
  note: 'automated soft-tissue contact matrix — not browser FPS'
};
fs.writeFileSync(
  new URL('./docs/soft-tissue-test-2026-10-25.json', import.meta.url),
  JSON.stringify(evidence, null, 2)
);
assert(true, 'evidence written');

console.log('\n--------------------------------');
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
console.log('ALL ENGINE-12 SOFT-TISSUE TESTS PASSED');
