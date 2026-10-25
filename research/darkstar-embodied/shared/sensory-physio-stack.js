/**
 * Shared Body Core — Sensory / Physio stack (ENGINE-17～22)
 * 單一管道：刺激 → 感覺 → 保護反射 → 傷害規則 → 記憶 → 能力閘門
 * 虛擬模擬｜禁止宣稱真實主觀痛覺／真感染
 */
import { createSomatosensory } from '../engines/ENGINE-17-somatosensory/somatosensory.js';
import { createInjuryEngine } from '../engines/ENGINE-18-virtual-injury/injury-engine.js';
import { createRecoveryEngine } from '../engines/ENGINE-19-virtual-recovery/recovery-engine.js';
import { createIllnessEngine } from '../engines/ENGINE-20-virtual-illness/illness-engine.js';
import { createTasteOlfactory } from '../engines/ENGINE-21-taste-olfactory/taste-olfactory.js';
import { createSensoryMemory } from '../engines/ENGINE-22-sensory-memory/sensory-memory.js';

export const SENSORY_PHYSIO_STACK_VERSION = '0.1.0-dev';

export function createSensoryPhysioStack(opts = {}) {
  const injury = createInjuryEngine();
  const recovery = createRecoveryEngine({ timeScale: opts.timeScale != null ? opts.timeScale : 15 });
  const memory = createSensoryMemory({ injuryEngine: injury });
  memory.bindInjuryEngine(injury);

  const reflexesExecuted = [];

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

  /**
   * Full closed loop for contact-like stimuli
   */
  function processStimulus(stim) {
    const snsResult = somato.applyStimulus(stim);
    if (!snsResult.ok) return snsResult;

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

    return {
      ok: true,
      sensation: snsResult.sensation,
      reflexes: snsResult.reflexes,
      injury: injResult.injury || null,
      injuryNote: injResult.note || injResult.reason,
      restrictions: memory.getMotionRestrictions(),
      handoffToDecision: true,
      protectiveFirst: (snsResult.reflexes || []).some((r) => r.beforeDecision)
    };
  }

  function tick(dtMs) {
    const rec = recovery.tick(dtMs, injury);
    const ill = illness.tick(dtMs);
    return { recovery: rec, illness: ill, restrictions: memory.getMotionRestrictions() };
  }

  return {
    version: SENSORY_PHYSIO_STACK_VERSION,
    status: '開發中',
    disclaimer: '虛擬感覺／生理堆疊｜Shared Body Core 唯一',
    somato,
    injury,
    recovery,
    illness,
    tasteOlf,
    memory,
    processStimulus,
    tick,
    getReflexLog: () => reflexesExecuted.slice(),
    reset() {
      somato.resetAll();
      injury.reset();
      recovery.reset();
      illness.reset();
      tasteOlf.reset();
      memory.reset();
      reflexesExecuted.length = 0;
    }
  };
}
