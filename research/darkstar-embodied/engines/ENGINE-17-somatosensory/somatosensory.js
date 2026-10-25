/**
 * ENGINE-17｜Virtual Somatosensory Nervous System（開發中）
 * 虛擬皮膚感覺：接觸／壓力／溫度／碰撞 → 冷熱／虛擬痛覺訊號。
 * 保護反射先於決策：過熱先縮手，再交 ENGINE-08／22。
 * 明確標示：此為模擬狀態機，非已證實的主觀痛覺。
 */
import { SKIN_REGIONS, getSkinRegion, listSkinRegions, SKIN_REGIONS_VERSION } from './skin-regions.js';

export const SOMATOSENSORY_VERSION = '0.1.0-dev';
export const SOMATOSENSORY_STATUS = '開發中';
export const DISCLAIMER =
  '虛擬模擬｜不得宣稱 AI 具有已證實的主觀痛覺或真實生理感受';

const HEAT_WITHDRAW_C = 55;
const COLD_NOTICE_C = 5;
const PAIN_PRESSURE = 0.75;
const PAIN_IMPACT = 40; // N-ish mock

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

function uid(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * @param {object} [opts]
 * @param {(reflex: object) => void} [opts.onReflex] 保護反射回呼（先於決策）
 * @param {(evt: object) => void} [opts.onSensation]
 */
export function createSomatosensory(opts = {}) {
  /** @type {Map<string, object>} regionId → last local sensation */
  const regionState = new Map();
  const eventLog = [];
  let reflexQueue = [];

  function getRegionState(id) {
    return (
      regionState.get(id) || {
        regionId: id,
        temperatureC: 33,
        pressure: 0,
        virtualPain: 0,
        cold: 0,
        heat: 0,
        contact: false,
        skinTone: 'neutral', // neutral | flushed | pale | burned
        lastStimulusId: null,
        ts: 0
      }
    );
  }

  /**
   * @param {object} stim
   * @param {string} stim.region
   * @param {'contact'|'pressure'|'temperature'|'collision'} stim.type
   * @param {number} [stim.intensity] 0..1
   * @param {number} [stim.temperatureC]
   * @param {number} [stim.impactForce] mock Newtons
   * @param {number} [stim.durationMs]
   * @param {string} [stim.source]
   * @param {object} [stim.meta]
   */
  function applyStimulus(stim) {
    const region = getSkinRegion(stim.region);
    if (!region) {
      return { ok: false, error: `unknown skin region: ${stim.region}` };
    }
    const now = Date.now();
    const intensity = clamp(stim.intensity != null ? stim.intensity : 0.5, 0, 1);
    const durationMs = stim.durationMs != null ? stim.durationMs : 200;
    const prev = getRegionState(region.id);
    const next = { ...prev, ts: now, contact: true, lastStimulusId: null };

    let cold = 0;
    let heat = 0;
    let virtualPain = 0;
    let temperatureC = prev.temperatureC;
    let pressure = prev.pressure;
    let skinTone = prev.skinTone;

    if (stim.type === 'temperature' || stim.temperatureC != null) {
      temperatureC = stim.temperatureC != null ? stim.temperatureC : temperatureC;
      if (temperatureC >= HEAT_WITHDRAW_C) {
        heat = clamp((temperatureC - 40) / 40, 0, 1);
        virtualPain = Math.max(virtualPain, heat * 0.9);
        skinTone = temperatureC >= 70 ? 'burned' : 'flushed';
      } else if (temperatureC <= COLD_NOTICE_C) {
        cold = clamp((COLD_NOTICE_C + 5 - temperatureC) / 20, 0, 1);
        virtualPain = Math.max(virtualPain, cold * 0.35);
        skinTone = 'pale';
      } else if (temperatureC >= 42) {
        heat = clamp((temperatureC - 36) / 30, 0, 0.6);
        skinTone = 'flushed';
      }
    }

    if (stim.type === 'pressure' || stim.type === 'contact') {
      pressure = intensity;
      if (intensity >= PAIN_PRESSURE) {
        virtualPain = Math.max(virtualPain, (intensity - 0.5) * 1.2);
      }
    }

    if (stim.type === 'collision') {
      const force = stim.impactForce != null ? stim.impactForce : intensity * 80;
      pressure = clamp(force / 100, 0, 1);
      virtualPain = Math.max(virtualPain, clamp(force / 80, 0, 1));
      if (force >= 25) skinTone = 'flushed';
    }

    next.temperatureC = temperatureC;
    next.pressure = pressure;
    next.cold = cold;
    next.heat = heat;
    next.virtualPain = clamp(virtualPain, 0, 1);
    next.skinTone = skinTone;
    next.contact = stim.type !== 'collision' ? true : intensity > 0.05;

    const eventId = uid('sns');
    next.lastStimulusId = eventId;
    regionState.set(region.id, next);

    const sensation = {
      id: eventId,
      schema: 'aivault.darkstar.sensation.v0.1',
      engine: 'ENGINE-17',
      version: SOMATOSENSORY_VERSION,
      disclaimer: DISCLAIMER,
      ts: now,
      region: region.id,
      limb: region.limb,
      side: region.side,
      softTissueLink: region.softTissueLink || null,
      type: stim.type,
      intensity,
      durationMs,
      temperatureC,
      pressure,
      cold,
      heat,
      virtualPain: next.virtualPain,
      skinTone,
      source: stim.source || 'virtual_object',
      meta: stim.meta || {},
      simulated: true,
      subjectiveClaim: false
    };
    eventLog.push(sensation);
    if (eventLog.length > 200) eventLog.shift();
    if (opts.onSensation) opts.onSensation(sensation);

    // Protective reflex BEFORE decision handoff
    const reflexes = [];
    if (temperatureC >= HEAT_WITHDRAW_C && region.limb === 'arm') {
      reflexes.push({
        id: uid('rfx'),
        kind: 'withdraw_hand',
        priority: 'protective',
        beforeDecision: true,
        region: region.id,
        side: region.side,
        reason: `虛擬高溫 ${temperatureC}°C ≥ ${HEAT_WITHDRAW_C}°C → 保護性縮手`,
        sensationId: eventId,
        ts: now,
        motorHint: {
          macro: 'withdraw_hand',
          side: region.side || 'R',
          interrupt: true
        }
      });
    }
    if (stim.type === 'collision' && (stim.impactForce || 0) >= 60 && region.limb === 'arm') {
      reflexes.push({
        id: uid('rfx'),
        kind: 'flinch',
        priority: 'protective',
        beforeDecision: true,
        region: region.id,
        side: region.side,
        reason: '高衝擊碰撞 → 閃避／退縮',
        sensationId: eventId,
        ts: now,
        motorHint: { macro: 'flinch', side: region.side || 'R', interrupt: true }
      });
    }

    for (const r of reflexes) {
      reflexQueue.push(r);
      if (opts.onReflex) opts.onReflex(r);
    }

    return {
      ok: true,
      sensation,
      reflexes,
      regionState: { ...next },
      handoffToDecision: true,
      note: reflexes.length
        ? '保護反射已觸發；須先執行縮手再交自主決策'
        : '無保護反射；可交決策層'
    };
  }

  function drainReflexes() {
    const q = reflexQueue.slice();
    reflexQueue = [];
    return q;
  }

  function getAllRegionStates() {
    const out = {};
    for (const id of Object.keys(SKIN_REGIONS)) {
      out[id] = getRegionState(id);
    }
    return out;
  }

  function getLog(limit = 50) {
    return eventLog.slice(-limit);
  }

  function resetRegion(id) {
    regionState.delete(id);
  }

  function resetAll() {
    regionState.clear();
    reflexQueue = [];
    eventLog.length = 0;
  }

  return {
    version: SOMATOSENSORY_VERSION,
    status: SOMATOSENSORY_STATUS,
    disclaimer: DISCLAIMER,
    skinRegionsVersion: SKIN_REGIONS_VERSION,
    listSkinRegions,
    getSkinRegion,
    applyStimulus,
    drainReflexes,
    getRegionState,
    getAllRegionStates,
    getLog,
    resetRegion,
    resetAll,
    thresholds: {
      HEAT_WITHDRAW_C,
      COLD_NOTICE_C,
      PAIN_PRESSURE,
      PAIN_IMPACT
    }
  };
}

export { SKIN_REGIONS, getSkinRegion, listSkinRegions };
