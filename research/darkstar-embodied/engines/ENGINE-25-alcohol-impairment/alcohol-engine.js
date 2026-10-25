/**
 * ENGINE-25｜Alcohol Impairment（開發中）
 * 輸入 ABV／容量／時間／虛擬體參數／代謝；輸出分級損傷。
 * 嚴重中毒獨立於一般醉酒／睡眠。禁寫死「一杯＝固定動畫」。
 * 虛擬模擬｜非真實中毒醫學建議。
 */
export const ALCOHOL_ENGINE_VERSION = '0.1.0-dev';
export const ALCOHOL_STATUS = '開發中';
export const DISCLAIMER =
  '虛擬酒精損傷模型｜簡化 Widmark 類推；非真實飲酒安全建議或臨床診斷';

function clamp(v, a = 0, b = 1) {
  return Math.max(a, Math.min(b, Number.isFinite(v) ? v : a));
}

/** Default virtual body + metabolism params (tunable) */
export const DEFAULT_BODY_PARAMS = Object.freeze({
  massKg: 55,
  bodyWaterRatio: 0.55, // Widmark r approx
  absorbHalfLifeMin: 20,
  metabolizeBacPerHour: 0.015, // g/dL per hour
  criticalBac: 0.30,
  severeBac: 0.20,
  mildBac: 0.03
});

/**
 * Pure ethanol grams from drink
 * volumeMl * (abvPercent/100) * 0.789 g/ml
 */
export function ethanolGrams(volumeMl, abvPercent) {
  return Math.max(0, volumeMl) * (Math.max(0, abvPercent) / 100) * 0.789;
}

/**
 * Instantaneous theoretical BAC contribution (Widmark-like)
 * BAC ≈ A / (r * W)  with A in grams, W kg → g/L ≈ g/dL scale using /10 for g/dL
 */
export function bacContribution(grams, body = DEFAULT_BODY_PARAMS) {
  const denom = body.bodyWaterRatio * body.massKg;
  if (denom <= 0) return 0;
  // g / (L water) ≈ grams / (r*W); convert to g/dL by /10
  return grams / denom / 10;
}

export function createAlcoholEngine(opts = {}) {
  const body = { ...DEFAULT_BODY_PARAMS, ...(opts.body || {}) };
  /** @type {{ tSimMin: number, gramsAbsorbed: number, gramsPending: number, bac: number }[]} */
  let doses = [];
  let bac = 0; // g/dL
  let pendingGrams = 0;
  let simMinutes = 0;
  let criticalLatched = false;

  /**
   * Ingest a drink at current sim time.
   * Different ABV/volume/timing → different curves (NOT fixed animation).
   */
  function ingest({ abvPercent, volumeMl, label } = {}) {
    const g = ethanolGrams(volumeMl, abvPercent);
    pendingGrams += g;
    doses.push({
      tSimMin: simMinutes,
      abvPercent,
      volumeMl,
      grams: g,
      label: label || `${abvPercent}%×${volumeMl}ml`
    });
    return { grams: g, pendingGrams, bac, doses: doses.length };
  }

  /**
   * Advance absorption + metabolism.
   * @param {number} deltaMin simulated minutes
   */
  function tickMinutes(deltaMin) {
    const dt = Math.max(0, deltaMin);
    simMinutes += dt;
    // absorption: first-order from pending → BAC
    const kAbs = Math.LN2 / Math.max(1, body.absorbHalfLifeMin);
    const absorbed = pendingGrams * (1 - Math.exp(-kAbs * dt));
    pendingGrams = Math.max(0, pendingGrams - absorbed);
    bac += bacContribution(absorbed, body);
    // metabolism
    bac = Math.max(0, bac - body.metabolizeBacPerHour * (dt / 60));
    if (bac >= body.criticalBac) criticalLatched = true;
    // clear critical latch only when BAC well below severe and recovering
    if (criticalLatched && bac < body.severeBac * 0.5) {
      // stay critical until much lower — severe intoxication track independent
    }
    if (bac < 0.02) criticalLatched = false;
    return getImpairment();
  }

  function getImpairment() {
    const mild = body.mildBac;
    const severe = body.severeBac;
    const critical = body.criticalBac;
    // Continuous curves — not discrete fixed animations
    const impairment = clamp(bac / severe); // 0..1+ scaled
    const attention = clamp(1 - impairment * 0.9);
    const reactionSpeed = clamp(1 - impairment * 1.0);
    const gazeFocus = clamp(1 - impairment * 0.85);
    const headInstability = clamp(impairment * 0.95);
    const coordination = clamp(1 - impairment * 1.05);
    const balance = clamp(1 - impairment * 1.1);
    const muscleTone = clamp(1 - impairment * 0.5);
    const speechSlur = clamp(impairment * 0.9);
    const behaviorDisinhibition = clamp(impairment * 0.7);

    let band = 'sober';
    if (bac >= critical || criticalLatched) band = 'critical';
    else if (bac >= severe) band = 'severe';
    else if (bac >= mild * 3) band = 'moderate';
    else if (bac >= mild) band = 'mild';

    const consciousness =
      band === 'critical' ? 'critical' : band === 'severe' ? 'intoxicated' : band === 'sober' ? 'awake' : 'intoxicated';

    return {
      engine: 'ENGINE-25',
      version: ALCOHOL_ENGINE_VERSION,
      disclaimer: DISCLAIMER,
      simulated: true,
      bac: Number(bac.toFixed(4)),
      pendingGrams: Number(pendingGrams.toFixed(3)),
      simMinutes,
      body: { ...body },
      band,
      criticalIntoxication: band === 'critical' || criticalLatched,
      // severe intoxication is independent axis from sleep
      independentFromSleep: true,
      impairment01: clamp(impairment),
      channels: {
        attention,
        reactionSpeed,
        gazeFocus,
        headInstability,
        coordination,
        balance,
        muscleTone,
        speechSlur,
        behaviorDisinhibition,
        consciousness
      },
      doses: doses.map((d) => ({ ...d })),
      note: '輸出隨 BAC 連續變化；禁止單一飲酒→固定動畫'
    };
  }

  function reset() {
    doses = [];
    bac = 0;
    pendingGrams = 0;
    simMinutes = 0;
    criticalLatched = false;
  }

  function setBody(p) {
    Object.assign(body, p);
  }

  /** Test / persist restore — set BAC directly (not a drink animation) */
  function hydrateBac(nextBac, opts = {}) {
    bac = Math.max(0, Number(nextBac) || 0);
    pendingGrams = opts.pendingGrams != null ? opts.pendingGrams : 0;
    if (bac >= body.criticalBac) criticalLatched = true;
    if (opts.simMinutes != null) simMinutes = opts.simMinutes;
  }

  return {
    version: ALCOHOL_ENGINE_VERSION,
    status: ALCOHOL_STATUS,
    disclaimer: DISCLAIMER,
    ingest,
    tickMinutes,
    getImpairment,
    reset,
    setBody,
    hydrateBac,
    ethanolGrams,
    bacContribution
  };
}
