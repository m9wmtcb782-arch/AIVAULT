/**
 * Shared Body Core — Neuro / Physio stack (ENGINE-23～27)
 * 與 sensory-physio-stack（17～22）並列，同一暗星身體，不另建第二套。
 */
import { createNeuroState } from '../engines/ENGINE-23-neurobehavioral-state/neuro-state.js';
import { createSleepFatigue } from '../engines/ENGINE-24-sleep-fatigue/sleep-fatigue.js';
import { createAlcoholEngine } from '../engines/ENGINE-25-alcohol-impairment/alcohol-engine.js';
import { createNeuroMotorCoupling } from '../engines/ENGINE-26-neuro-motor-coupling/neuro-motor-coupling.js';
import {
  createPersistentPhysio,
  createMemoryStorage
} from '../engines/ENGINE-27-persistent-physio/persistent-physio.js';

export const NEURO_PHYSIO_STACK_VERSION = '0.1.0-dev';

export function createNeuroPhysioStack(opts = {}) {
  const neuro = createNeuroState();
  const sleep = createSleepFatigue();
  const alcohol = createAlcoholEngine({ body: opts.body });
  const coupling = createNeuroMotorCoupling();
  const persist = createPersistentPhysio({
    storage: opts.storage || createMemoryStorage(),
    testMode: opts.testMode !== false,
    timeScale: opts.timeScale != null ? opts.timeScale : 60
  });

  let illnessLoad = 0;
  let painLoad = 0;

  function setExternalLoads({ illness, pain } = {}) {
    if (illness != null) illnessLoad = illness;
    if (pain != null) painLoad = pain;
  }

  function recomputeAll() {
    const sp = sleep.getState();
    const al = alcohol.getImpairment();
    const st = neuro.recompute({
      fatigue: sp.fatigue,
      sleepDebt: sp.sleepDebt01,
      alcoholImpairment: al.impairment01,
      criticalIntoxication: al.criticalIntoxication,
      illnessLoad,
      painLoad
    });
    const effectors = neuro.getEffectorModifiers();
    // Enforce forbid tired eyes + full speed (already in recompute; double-check effectors)
    if (sp.forbidTiredEyesFullSpeed && effectors.reactionDelayMs < 80 && effectors.eyelidDroop > 0.35) {
      effectors.reactionDelayMs = Math.max(effectors.reactionDelayMs, 120);
    }
    const bundle = coupling.sync(st, effectors);
    return { neuro: st, sleep: sp, alcohol: al, coupling: bundle, effectors };
  }

  /**
   * Advance simulated time (minutes) — alcohol metabolism + sleep/fatigue + persist clock
   */
  function tickMinutes(deltaMin, ctx = {}) {
    persist.advanceSimMinutes(deltaMin);
    alcohol.tickMinutes(deltaMin);
    const hours = deltaMin / 60;
    sleep.tickHours(hours, {
      illnessLoad,
      painLoad,
      resting: ctx.resting
    });
    const out = recomputeAll();
    if (ctx.autosave !== false) {
      persist.save({
        neuro: out.neuro,
        sleep: out.sleep,
        alcohol: { bac: out.alcohol.bac, band: out.alcohol.band, pendingGrams: out.alcohol.pendingGrams },
        interactions: {
          sleepDebt: out.sleep.sleepHoursDebt,
          illness: illnessLoad,
          alcoholBac: out.alcohol.bac,
          injuryFatigueMul: 1 + painLoad * 0.3
        }
      });
    }
    return out;
  }

  function ingestDrink(spec) {
    alcohol.ingest(spec);
    return recomputeAll();
  }

  function restoreFromStorage() {
    const loaded = persist.load();
    if (!loaded.ok) return { ok: false, loaded };
    const pay = loaded.doc.payload || {};
    if (pay.sleep) {
      sleep.hydrate({
        awakeHours: pay.sleep.awakeHours,
        sleepHoursDebt: pay.sleep.sleepHoursDebt,
        fatigue: pay.sleep.fatigue,
        isSleeping: pay.sleep.isSleeping
      });
    }
    if (pay.alcohol && pay.alcohol.bac != null) {
      alcohol.hydrateBac(pay.alcohol.bac, {
        pendingGrams: pay.alcohol.pendingGrams || 0,
        simMinutes: loaded.doc.simMinutes
      });
    }
    if (pay.interactions) {
      illnessLoad = pay.interactions.illness || 0;
    }
    const out = recomputeAll();
    return { ok: true, loaded, continued: true, ...out };
  }

  function safeReset() {
    neuro.reset();
    sleep.reset();
    alcohol.reset();
    illnessLoad = 0;
    painLoad = 0;
    persist.safeReset();
    return recomputeAll();
  }

  // initial
  recomputeAll();

  return {
    version: NEURO_PHYSIO_STACK_VERSION,
    status: '開發中',
    disclaimer: '虛擬神經／生理堆疊｜Shared Body Core｜非真實意識／中毒',
    neuro,
    sleep,
    alcohol,
    coupling,
    persist,
    setExternalLoads,
    recomputeAll,
    tickMinutes,
    ingestDrink,
    restoreFromStorage,
    safeReset
  };
}

export { createMemoryStorage };
