/**
 * Shared Body Core — Neuro / Physio stack (ENGINE-23～27)
 * Physiology Core = source of truth；本堆疊為薄適配＋雙寫同步。
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
import {
  createCoreForNeuroStack,
  dualWriteRecompute,
  NEURO_STACK_ADAPTER_VERSION,
  SOURCE_OF_TRUTH
} from '../physiology-core/adapters/neuro-stack-adapter.js';

export const NEURO_PHYSIO_STACK_VERSION = '0.2.0-dev';

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
  const physiologyCore = createCoreForNeuroStack({
    individualSeed: opts.individualSeed != null ? opts.individualSeed : 23,
    overrides: opts.coreOverrides
  });

  let illnessLoad = 0;
  let painLoad = 0;

  function setExternalLoads({ illness, pain } = {}) {
    if (illness != null) illnessLoad = illness;
    if (pain != null) painLoad = pain;
  }

  function recomputeAll() {
    return dualWriteRecompute({
      core: physiologyCore,
      sleep,
      alcohol,
      neuro,
      coupling,
      illnessLoad,
      painLoad
    });
  }

  /**
   * Advance simulated time (minutes) — alcohol metabolism + sleep/fatigue + persist clock
   * Then dual-write into Physiology Core (SoT).
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
    // Also advance core clock (seconds) for continuity — domain models remain primary inputs
    physiologyCore.step((deltaMin * 60) * 0.0, {
      // domain engines own fatigue/bac this tick; rest flag only
      rest: ctx.resting ? 1 : 0,
      illnessPulse: 0
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
        },
        physiologyCore: {
          sourceOfTruth: SOURCE_OF_TRUTH,
          pendingResearchCount: out.physiology.pendingResearchCount,
          simTimeSec: out.physiology.simTimeSec
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
    physiologyCore.safeReset('soft');
    physiologyCore.state.set('fatigue', 0.1);
    physiologyCore.state.set('sleepDebt', 0);
    physiologyCore.state.set('eyelidDroop', 0.05);
    physiologyCore.state.set('bac', 0);
    physiologyCore.state.set('consciousness', 1);
    physiologyCore.step(0, {});
    persist.safeReset();
    return recomputeAll();
  }

  // initial dual-write
  recomputeAll();

  return {
    version: NEURO_PHYSIO_STACK_VERSION,
    status: '開發中',
    disclaimer: '虛擬神經／生理堆疊｜Physiology Core 為真相來源｜非真實意識／中毒',
    sourceOfTruth: SOURCE_OF_TRUTH,
    adapterVersion: NEURO_STACK_ADAPTER_VERSION,
    neuro,
    sleep,
    alcohol,
    coupling,
    persist,
    physiologyCore,
    setExternalLoads,
    recomputeAll,
    tickMinutes,
    ingestDrink,
    restoreFromStorage,
    safeReset,
    getPhysiologySnapshot: () => physiologyCore.readSnapshot(),
    listPendingResearch: () => physiologyCore.listPendingResearch()
  };
}

export { createMemoryStorage };
