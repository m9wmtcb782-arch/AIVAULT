/**
 * Shared Body Core — Sensory / Physio stack (ENGINE-17～22)
 * Physiology Core = source of truth；本堆疊為薄適配＋雙寫。
 * 痛覺／傷害 → Sensory Nerve Bus（source:virtual）→ 危險記憶／保護（非只表情）
 * 虛擬模擬｜禁止宣稱真實主觀痛覺／真感染
 */
import { createSomatosensory } from '../engines/ENGINE-17-somatosensory/somatosensory.js';
import { createInjuryEngine } from '../engines/ENGINE-18-virtual-injury/injury-engine.js';
import { createRecoveryEngine } from '../engines/ENGINE-19-virtual-recovery/recovery-engine.js';
import { createIllnessEngine } from '../engines/ENGINE-20-virtual-illness/illness-engine.js';
import { createTasteOlfactory } from '../engines/ENGINE-21-taste-olfactory/taste-olfactory.js';
import { createSensoryMemory } from '../engines/ENGINE-22-sensory-memory/sensory-memory.js';
import {
  createCoreForSensoryStack,
  createSensoryBusForStack,
  dualWriteAfterStimulus,
  syncIllnessTickIntoCore,
  SENSORY_STACK_ADAPTER_VERSION,
  SOURCE_OF_TRUTH
} from '../physiology-core/adapters/sensory-stack-adapter.js';

export const SENSORY_PHYSIO_STACK_VERSION = '0.2.0-dev';

export function createSensoryPhysioStack(opts = {}) {
  const injury = createInjuryEngine();
  const recovery = createRecoveryEngine({ timeScale: opts.timeScale != null ? opts.timeScale : 15 });
  const memory = createSensoryMemory({ injuryEngine: injury });
  memory.bindInjuryEngine(injury);

  const physiologyCore = createCoreForSensoryStack({
    individualSeed: opts.individualSeed != null ? opts.individualSeed : 17,
    overrides: opts.coreOverrides
  });
  const sensoryBus = createSensoryBusForStack({
    sensoryBus: opts.sensoryBus,
    onNerveEvent: opts.onNerveEvent
  });

  const reflexesExecuted = [];
  const nerveEventLog = [];

  const somato = createSomatosensory({
    onReflex(r) {
      memory.recordReflex(r);
      reflexesExecuted.push(r);
      // Protective motor first — before decision
      if (opts.motor && typeof opts.motor.executeReflex === 'function') {
        opts.motor.executeReflex(r);
      }
      if (opts.onReflex) opts.onReflex(r);
    },
    onSensation(s) {
      memory.recordStimulus(s);
    }
  });

  const illness = createIllnessEngine();
  const tasteOlf = createTasteOlfactory();

  function currentIllnessLoad() {
    const h = illness.getHealth ? illness.getHealth() : null;
    if (h && h.illness) return h.severity != null ? h.severity : 0.5;
    // fallback via last tick visuals
    return 0;
  }

  /**
   * Full closed loop for contact-like stimuli
   */
  function processStimulus(stim) {
    const snsResult = somato.applyStimulus(stim);
    if (!snsResult.ok) {
      return { ...snsResult, sourceOfTruth: SOURCE_OF_TRUTH };
    }

    const collision =
      stim.type === 'collision'
        ? { impactForce: stim.impactForce != null ? stim.impactForce : stim.intensity * 80 }
        : stim.impactForce != null
          ? { impactForce: stim.impactForce }
          : null;

    const injResult = injury.applyFromPhysics({
      sensation: snsResult.sensation,
      collision,
      fromDialogueOnly: !!stim.fromDialogueOnly
    });

    if (injResult.injury) {
      memory.recordInjury(injResult.injury);
      recovery.registerInjury(injResult.injury);
    }

    const processResult = {
      ok: true,
      sensation: snsResult.sensation,
      reflexes: snsResult.reflexes,
      injury: injResult.injury || null,
      injuryNote: injResult.note || injResult.reason,
      restrictions: memory.getMotionRestrictions(),
      handoffToDecision: true,
      protectiveFirst: (snsResult.reflexes || []).some((r) => r.beforeDecision)
    };

    const out = dualWriteAfterStimulus({
      core: physiologyCore,
      sensoryBus,
      memory,
      processResult,
      illnessLoad: currentIllnessLoad()
    });

    if (out.nerveEvents) {
      for (const ev of out.nerveEvents) nerveEventLog.push(ev);
      while (nerveEventLog.length > 300) nerveEventLog.shift();
    }
    return out;
  }

  function tick(dtMs) {
    const rec = recovery.tick(dtMs, injury);
    const ill = illness.tick(dtMs);
    const physiology = syncIllnessTickIntoCore(physiologyCore, ill);
    // Keep injuryLoad loosely aligned with active injuries
    const active = injury.listActive ? injury.listActive() : [];
    if (active.length === 0) {
      // allow natural decay via dynamics only — soft nudge
      physiologyCore.state.set(
        'injuryLoad',
        Math.max(0, physiologyCore.state.get('injuryLoad') * 0.98)
      );
      physiologyCore.step(0, {});
    }
    return {
      recovery: rec,
      illness: ill,
      restrictions: memory.getMotionRestrictions(),
      physiology,
      sourceOfTruth: SOURCE_OF_TRUTH
    };
  }

  function reset() {
    somato.resetAll();
    injury.reset();
    recovery.reset();
    illness.reset();
    tasteOlf.reset();
    memory.reset();
    reflexesExecuted.length = 0;
    nerveEventLog.length = 0;
    physiologyCore.safeReset('soft');
    physiologyCore.state.set('nociception', 0);
    physiologyCore.state.set('injuryLoad', 0);
    physiologyCore.state.set('touchPressure', 0);
    physiologyCore.state.set('thermalComfort', 0);
    physiologyCore.state.set('illnessLoad', 0);
    physiologyCore.step(0, {});
  }

  return {
    version: SENSORY_PHYSIO_STACK_VERSION,
    status: '開發中',
    disclaimer: '虛擬感覺／生理堆疊｜Physiology Core 為真相來源｜非真實痛覺／感染',
    sourceOfTruth: SOURCE_OF_TRUTH,
    adapterVersion: SENSORY_STACK_ADAPTER_VERSION,
    somato,
    injury,
    recovery,
    illness,
    tasteOlf,
    memory,
    physiologyCore,
    sensoryBus,
    processStimulus,
    tick,
    getReflexLog: () => reflexesExecuted.slice(),
    getNerveEventLog: () => nerveEventLog.slice(),
    getPhysiologySnapshot: () => physiologyCore.readSnapshot(),
    listPendingResearch: () => physiologyCore.listPendingResearch(),
    reset
  };
}
