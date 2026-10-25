/**
 * Formal adapter｜ENGINE-17～22 sensory-physio-stack → Physiology Core
 *
 * Source of truth: physiology-core
 * Specialized engines (somato/injury/illness/…) remain input models;
 * key pain/injury/illness loads dual-write into core.
 * Pain/injury also publish on Sensory Nerve Bus (source: virtual)
 * and record danger memory (not expression-only).
 *
 * pending_research slots are never deleted.
 * Hardware skills stay locked (this adapter does not touch skill-gate enable).
 */
import { createPhysiologyCore } from '../dynamics.js';
import { createSensoryNerveBus } from '../../embodiment-interfaces/sensory-nerve-bus.js';

export const SENSORY_STACK_ADAPTER_VERSION = '0.1.0-dev';
export const SENSORY_STACK_ADAPTER_STATUS = '開發中';
export const SOURCE_OF_TRUTH = 'physiology-core';

function clamp(v, a = 0, b = 1) {
  return Math.max(a, Math.min(b, Number.isFinite(v) ? v : a));
}

export function createCoreForSensoryStack(opts = {}) {
  return createPhysiologyCore({
    individualSeed: opts.individualSeed != null ? opts.individualSeed : 17,
    overrides: opts.overrides
  });
}

/**
 * Map ENGINE-17 sensation → unified nerve-bus event(s).
 * @returns {object[]}
 */
export function mapSensationToNerveEvents(sensation, extra = {}) {
  if (!sensation) return [];
  const bodyRegion = sensation.region || 'unknown';
  const base = {
    source: 'virtual',
    bodyRegion,
    confidence: 0.9,
    meta: {
      sensationId: sensation.id,
      limb: sensation.limb,
      side: sensation.side,
      engine: 'ENGINE-17',
      subjectiveClaim: false,
      ...extra.meta
    }
  };
  const events = [];

  if (sensation.type === 'temperature' || sensation.temperatureC != null) {
    events.push({
      ...base,
      modality: 'temperature',
      intensity: clamp(
        Math.max(sensation.heat || 0, sensation.cold || 0, sensation.intensity || 0)
      ),
      meta: {
        ...base.meta,
        temperatureC: sensation.temperatureC,
        heat: sensation.heat,
        cold: sensation.cold,
        skinTone: sensation.skinTone
      }
    });
  }

  if (sensation.type === 'pressure' || sensation.type === 'contact') {
    events.push({
      ...base,
      modality: sensation.type === 'contact' ? 'touch' : 'pressure',
      intensity: clamp(sensation.pressure != null ? sensation.pressure : sensation.intensity || 0)
    });
  }

  if (sensation.type === 'collision') {
    events.push({
      ...base,
      modality: 'pressure',
      intensity: clamp(sensation.pressure != null ? sensation.pressure : sensation.intensity || 0),
      meta: { ...base.meta, collision: true }
    });
  }

  if ((sensation.virtualPain || 0) > 0.05) {
    events.push({
      ...base,
      modality: 'nociception',
      intensity: clamp(sensation.virtualPain),
      meta: {
        ...base.meta,
        protectiveRelevant: true,
        notExpressionOnly: true
      }
    });
  }

  if (!events.length) {
    events.push({
      ...base,
      modality: 'touch',
      intensity: clamp(sensation.intensity || 0)
    });
  }
  return events;
}

/**
 * Push sensation / injury / illness into Physiology Core (write path).
 */
export function syncSensoryIntoCore(core, src = {}) {
  const st = core.state;
  const sns = src.sensation || null;
  const injury = src.injury || null;
  const illnessLoad = src.illnessLoad;

  if (sns) {
    if (sns.virtualPain != null) {
      st.set('nociception', clamp(Math.max(st.get('nociception'), sns.virtualPain)));
    }
    if (sns.pressure != null) {
      st.set('touchPressure', clamp(sns.pressure));
    }
    if (sns.heat > 0) {
      st.set('thermalComfort', clamp(Math.min(1, sns.heat)));
    } else if (sns.cold > 0) {
      st.set('thermalComfort', -clamp(sns.cold));
    }
  }

  if (injury) {
    const bump =
      injury.kind === 'fracture' ? 0.85 : injury.kind === 'burn' ? 0.55 : injury.kind === 'bruise' ? 0.35 : 0.25;
    st.set('injuryLoad', clamp(Math.max(st.get('injuryLoad'), bump)));
    if (injury.severity != null) {
      st.set('nociception', clamp(Math.max(st.get('nociception'), injury.severity)));
    }
  }

  if (illnessLoad != null) {
    st.set('illnessLoad', clamp(illnessLoad));
  }

  const stimuli = {};
  if (sns && sns.virtualPain > 0) stimuli.nociception = sns.virtualPain;
  if (sns && sns.pressure != null) stimuli.touchPressure = sns.pressure;
  if (sns && sns.heat > 0) stimuli.thermal = clamp(sns.heat);
  if (sns && sns.cold > 0) stimuli.thermal = -clamp(sns.cold);

  core.step(0, stimuli);
  return core.readSnapshot();
}

/**
 * Build danger-memory entry (protection / prediction — not expression-only).
 */
export function buildDangerMemoryEntry({ sensation, injury, reflexes, nerveEvents }) {
  const pain = sensation ? sensation.virtualPain || 0 : 0;
  const hasProtective = (reflexes || []).some((r) => r.beforeDecision || r.priority === 'protective');
  const hasNociception = (nerveEvents || []).some((e) => e.modality === 'nociception');
  if (pain < 0.15 && !injury && !hasProtective && !hasNociception) return null;
  return {
    schema: 'aivault.darkstar.danger_memory.v0.1',
    kind: 'danger',
    ts: Date.now(),
    region: sensation && sensation.region,
    source: (sensation && sensation.source) || 'virtual',
    modality: hasNociception ? 'nociception' : sensation && sensation.type,
    intensity: pain,
    temperatureC: sensation && sensation.temperatureC,
    injuryId: injury && injury.id,
    injuryKind: injury && injury.kind,
    protectiveReflexes: (reflexes || []).map((r) => r.kind),
    nerveEventIds: (nerveEvents || []).map((e) => e.id),
    notExpressionOnly: true,
    feedsProtection: true,
    feedsPrediction: true,
    subjectiveClaim: false,
    sourceOfTruth: SOURCE_OF_TRUTH,
    disclaimer: '虛擬危險記憶｜非真實主觀痛覺｜非僅表情觸發'
  };
}

/**
 * After processStimulus domain engines run — dual-write + bus + danger memory.
 */
export function dualWriteAfterStimulus(ctx) {
  const {
    core,
    sensoryBus,
    memory,
    processResult,
    illnessLoad
  } = ctx;

  if (!processResult || !processResult.ok) {
    return {
      ...processResult,
      sourceOfTruth: SOURCE_OF_TRUTH,
      nerveEvents: [],
      danger: null,
      physiology: core.readSnapshot()
    };
  }

  const sensation = processResult.sensation;
  const injury = processResult.injury || null;
  const reflexes = processResult.reflexes || [];

  const mapped = mapSensationToNerveEvents(sensation);
  const nerveEvents = mapped.map((partial) => sensoryBus.publish(partial));

  const physiology = syncSensoryIntoCore(core, {
    sensation,
    injury,
    illnessLoad
  });

  const danger = buildDangerMemoryEntry({
    sensation,
    injury,
    reflexes,
    nerveEvents
  });
  if (danger && memory && typeof memory.recordDanger === 'function') {
    memory.recordDanger(danger);
  } else if (danger && memory && typeof memory.recordStimulus === 'function') {
    // fallback: tag stimulus path
    memory.recordStimulus(sensation, { danger: true, notExpressionOnly: true });
  }

  const corePain = physiology.slots.nociception.value;
  const coreInjury = physiology.slots.injuryLoad.value;

  return {
    ...processResult,
    sourceOfTruth: SOURCE_OF_TRUTH,
    adapterVersion: SENSORY_STACK_ADAPTER_VERSION,
    nerveEvents,
    danger,
    physiology,
    coreSensory: {
      nociception: corePain,
      injuryLoad: coreInjury,
      touchPressure: physiology.slots.touchPressure.value,
      thermalComfort: physiology.slots.thermalComfort.value,
      comfort: physiology.slots.comfort.value,
      pendingResearchCount: physiology.pendingResearchCount
    },
    // Proof hooks for tests: protection path existed beyond expression
    protectionPath: {
      reflexFirst: !!(processResult.protectiveFirst || reflexes.some((r) => r.beforeDecision)),
      nerveBusNociception: nerveEvents.some((e) => e.modality === 'nociception'),
      dangerMemory: !!danger,
      coreNociception: corePain,
      notExpressionOnly: true
    }
  };
}

/**
 * Sync illness engine load into core on tick.
 */
export function syncIllnessTickIntoCore(core, illnessState) {
  const load =
    illnessState && illnessState.health && illnessState.health.illness
      ? clamp(illnessState.health.severity != null ? illnessState.health.severity : 0.5)
      : illnessState && illnessState.load != null
        ? clamp(illnessState.load)
        : 0;
  if (illnessState && illnessState.health && !illnessState.health.illness) {
    // cleared — gently reduce via step, don't wipe other slots
    core.state.set('illnessLoad', clamp(core.state.get('illnessLoad') * 0.5));
  } else if (load > 0) {
    core.state.set('illnessLoad', clamp(Math.max(core.state.get('illnessLoad'), load)));
  }
  core.step(0, {});
  return core.readSnapshot();
}

export function createSensoryBusForStack(opts = {}) {
  return opts.sensoryBus || createSensoryNerveBus({ onEvent: opts.onNerveEvent });
}
