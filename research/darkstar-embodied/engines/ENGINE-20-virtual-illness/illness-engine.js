/**
 * ENGINE-20｜Virtual Illness & Physiological Response（開發中）
 * 獨立虛擬健康狀態＋可見表現描述（材質／粒子／morph 鉤子）。
 * 禁止表述為 AI 真正感染生物病毒。
 */
export const ILLNESS_ENGINE_VERSION = '0.1.0-dev';
export const ILLNESS_STATUS = '開發中';
export const DISCLAIMER =
  '虛擬疾病模擬｜不得表述為 AI 真正感染生物病毒或具真實病理';

function uid() {
  return `ill_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

const SYMPTOM_VISUALS = {
  cough: {
    morph: 'mouth_open_burst',
    particles: null,
    audioHint: 'cough',
    durationMs: 400
  },
  sneeze: {
    morph: 'sneeze',
    particles: 'droplet_spray',
    audioHint: 'sneeze',
    durationMs: 350
  },
  runny_nose: {
    morph: null,
    particles: 'mucus_drip',
    material: { noseGloss: 0.7, opacity: 0.55, color: '#c8ddd8' },
    continuous: true
  },
  tear: {
    morph: null,
    particles: 'tear_trail',
    material: { tearGloss: 0.9, opacity: 0.65, color: '#a8c8e8' },
    continuous: true
  },
  saliva: {
    morph: 'mouth_slight_open',
    particles: 'saliva_string',
    material: { gloss: 0.85, opacity: 0.5, color: '#e8f0f0' },
    continuous: true
  },
  fatigue: {
    morph: 'eye_half',
    particles: null,
    postureBias: 'slouch',
    continuous: true
  }
};

export function createIllnessEngine(opts = {}) {
  let health = {
    illness: null, // null | 'cold' | ...
    severity: 0,
    since: 0,
    symptoms: {},
    viralClaim: false // always false — virtual only
  };
  const eventLog = [];
  let symptomClock = 0;

  function startIllness(kind = 'cold', severity = 0.6) {
    if (kind !== 'cold') {
      // Phase1 only validates cold; others stub
      return {
        ok: false,
        error: `Phase1 僅實作 cold；${kind}＝未完成`,
        status: '開發中'
      };
    }
    health = {
      illness: 'cold',
      severity: Math.max(0.1, Math.min(1, severity)),
      since: Date.now(),
      symptoms: {
        runny_nose: true,
        cough: true,
        sneeze: true,
        fatigue: severity >= 0.4,
        tear: severity >= 0.7,
        saliva: false
      },
      viralClaim: false,
      disclaimer: DISCLAIMER,
      simulated: true
    };
    const ev = {
      id: uid(),
      type: 'illness_start',
      health: snapshot(),
      visuals: buildVisualState(),
      ts: Date.now()
    };
    eventLog.push(ev);
    if (opts.onChange) opts.onChange(ev);
    return { ok: true, health: snapshot(), visuals: buildVisualState() };
  }

  function clearIllness() {
    health = {
      illness: null,
      severity: 0,
      since: 0,
      symptoms: {},
      viralClaim: false
    };
    const ev = { id: uid(), type: 'illness_clear', health: snapshot(), visuals: buildVisualState(), ts: Date.now() };
    eventLog.push(ev);
    if (opts.onChange) opts.onChange(ev);
    return { ok: true, health: snapshot(), visuals: buildVisualState() };
  }

  function buildVisualState() {
    const active = [];
    const materials = {};
    const particles = [];
    const morphs = {};
    if (!health.illness) {
      return { active, materials, particles, morphs, visible: false };
    }
    for (const [sym, on] of Object.entries(health.symptoms)) {
      if (!on) continue;
      const v = SYMPTOM_VISUALS[sym];
      if (!v) continue;
      active.push(sym);
      if (v.material) materials[sym] = { ...v.material };
      if (v.particles) particles.push({ id: v.particles, symptom: sym });
      if (v.morph) morphs[sym] = v.morph;
    }
    return {
      active,
      materials,
      particles,
      morphs,
      visible: active.length > 0,
      note: '可見表現鉤子（材質／粒子／morph）；lab 以 canvas mock 繪製，非僅文字'
    };
  }

  /**
   * Drive episodic symptoms (cough/sneeze bursts).
   * @param {number} dtMs
   */
  function tick(dtMs) {
    if (!health.illness) return { bursts: [], visuals: buildVisualState() };
    symptomClock += dtMs;
    const bursts = [];
    const coughEvery = 2800 / Math.max(0.3, health.severity);
    const sneezeEvery = 5100 / Math.max(0.3, health.severity);
    if (health.symptoms.cough && symptomClock % coughEvery < dtMs) {
      bursts.push({ symptom: 'cough', visual: SYMPTOM_VISUALS.cough, ts: Date.now() });
    }
    if (health.symptoms.sneeze && symptomClock % sneezeEvery < dtMs) {
      bursts.push({ symptom: 'sneeze', visual: SYMPTOM_VISUALS.sneeze, ts: Date.now() });
    }
    return { bursts, visuals: buildVisualState(), health: snapshot() };
  }

  function snapshot() {
    return {
      ...health,
      engine: 'ENGINE-20',
      version: ILLNESS_ENGINE_VERSION,
      disclaimer: DISCLAIMER
    };
  }

  function getLog() {
    return eventLog.slice();
  }

  function reset() {
    clearIllness();
    eventLog.length = 0;
    symptomClock = 0;
  }

  return {
    version: ILLNESS_ENGINE_VERSION,
    status: ILLNESS_STATUS,
    disclaimer: DISCLAIMER,
    startIllness,
    clearIllness,
    tick,
    getHealth: snapshot,
    getVisuals: buildVisualState,
    getLog,
    reset,
    SYMPTOM_VISUALS
  };
}
