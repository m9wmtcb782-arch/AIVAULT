/**
 * 連續生理狀態向量｜AIVAULT Virtual Human Physiology Core
 * 臨床／工程槽位；未實作標 pending_research；不得刪除槽位
 * 虛擬模擬｜不宣稱生物器官或主觀意識
 */
import { CORE_PARAM_EVIDENCE } from './evidence-tiers.js';

export const PHYSIO_STATE_VERSION = '0.1.0-dev';
export const PHYSIO_STATE_STATUS = '開發中';

/** @typedef {'active'|'pending_research'} SlotStatus */

/**
 * 槽位定義：id、單位區間、狀態、證據鍵、分類
 * adult intimacy / cycle 等槽位保留；動力學未完成 → pending_research
 */
export const SLOT_DEFS = Object.freeze([
  // —— 神經／清醒 ——
  { id: 'consciousness', domain: 'neuro', min: 0, max: 1, status: 'active', evidenceKey: 'critical_consciousness_gate', desc: '意識代理（0 危急～1 清醒）' },
  { id: 'alertness', domain: 'neuro', min: 0, max: 1, status: 'active', evidenceKey: 'fatigue_accumulation', desc: '清醒程度' },
  { id: 'attention', domain: 'neuro', min: 0, max: 1, status: 'active', evidenceKey: 'fatigue_accumulation', desc: '注意力' },
  { id: 'reactionSpeed', domain: 'neuro', min: 0, max: 1, status: 'active', evidenceKey: 'reaction_delay_from_fatigue', desc: '反應速度代理' },
  { id: 'gazeFocus', domain: 'neuro', min: 0, max: 1, status: 'active', evidenceKey: 'reaction_delay_from_fatigue', desc: '眼神聚焦能力' },
  { id: 'headPostureControl', domain: 'neuro', min: 0, max: 1, status: 'active', evidenceKey: 'critical_consciousness_gate', desc: '頭姿控制' },

  // —— 疲勞／睡眠 ——
  { id: 'fatigue', domain: 'fatigue', min: 0, max: 1, status: 'active', evidenceKey: 'fatigue_accumulation', desc: '疲勞' },
  { id: 'sleepDebt', domain: 'fatigue', min: 0, max: 1, status: 'active', evidenceKey: 'fatigue_accumulation', desc: '睡眠債' },
  { id: 'eyelidDroop', domain: 'fatigue', min: 0, max: 1, status: 'active', evidenceKey: 'fatigue_accumulation', desc: '眼皮下垂代理' },

  // —— 情緒（連續；非單一標籤）——
  { id: 'affectValence', domain: 'affect', min: -1, max: 1, status: 'active', evidenceKey: null, desc: '情緒效價（負～正）' },
  { id: 'affectArousal', domain: 'affect', min: 0, max: 1, status: 'active', evidenceKey: null, desc: '情緒喚醒' },
  { id: 'stress', domain: 'affect', min: 0, max: 1, status: 'active', evidenceKey: null, desc: '壓力' },
  { id: 'anxiety', domain: 'affect', min: 0, max: 1, status: 'pending_research', evidenceKey: null, desc: '焦慮軌跡（待研發動力學）' },
  { id: 'anger', domain: 'affect', min: 0, max: 1, status: 'pending_research', evidenceKey: null, desc: '憤怒軌跡（待研發）' },
  { id: 'sadness', domain: 'affect', min: 0, max: 1, status: 'pending_research', evidenceKey: null, desc: '悲傷軌跡（待研發）' },

  // —— 感覺／疼痛／舒適 ——
  { id: 'nociception', domain: 'somatosensory', min: 0, max: 1, status: 'active', evidenceKey: 'nociception_proxy', desc: '虛擬痛覺代理' },
  { id: 'thermalComfort', domain: 'somatosensory', min: -1, max: 1, status: 'active', evidenceKey: null, desc: '熱舒適（冷～熱）' },
  { id: 'comfort', domain: 'somatosensory', min: 0, max: 1, status: 'active', evidenceKey: null, desc: '整體舒適' },
  { id: 'touchPressure', domain: 'somatosensory', min: 0, max: 1, status: 'active', evidenceKey: 'soft_tissue_deform', desc: '接觸壓力代理' },

  // —— 肌肉骨骼 ——
  { id: 'muscleTone', domain: 'musculoskeletal', min: 0, max: 1, status: 'active', evidenceKey: null, desc: '肌肉張力' },
  { id: 'coordination', domain: 'musculoskeletal', min: 0, max: 1, status: 'active', evidenceKey: 'alcohol_bac_widmark_like', desc: '協調' },
  { id: 'balance', domain: 'musculoskeletal', min: 0, max: 1, status: 'active', evidenceKey: 'alcohol_bac_widmark_like', desc: '平衡' },
  { id: 'injuryLoad', domain: 'musculoskeletal', min: 0, max: 1, status: 'active', evidenceKey: null, desc: '創傷負荷代理' },

  // —— 皮膚／循環／復原 ——
  { id: 'skinFlush', domain: 'integument', min: 0, max: 1, status: 'pending_research', evidenceKey: null, desc: '皮膚血流／泛紅（待研發視覺耦合）' },
  { id: 'healingProgress', domain: 'integument', min: 0, max: 1, status: 'active', evidenceKey: null, desc: '復原進度代理' },

  // —— 酒精／外源影響 ——
  { id: 'bac', domain: 'xenobiotic', min: 0, max: 0.4, status: 'active', evidenceKey: 'alcohol_bac_widmark_like', desc: '虛擬 BAC' },
  { id: 'otherImpairment', domain: 'xenobiotic', min: 0, max: 1, status: 'pending_research', evidenceKey: null, desc: '其他生理影響（待研發）' },

  // —— 健康／疾病 ——
  { id: 'illnessLoad', domain: 'health', min: 0, max: 1, status: 'active', evidenceKey: null, desc: '虛擬疾病負荷' },
  { id: 'virtualHealth', domain: 'health', min: 0, max: 1, status: 'active', evidenceKey: null, desc: '虛擬健康' },

  // —— 內分泌／週期（不得寫死日期→固定結果）——
  { id: 'cyclePhase', domain: 'endocrine', min: 0, max: 1, status: 'pending_research', evidenceKey: 'menstrual_cycle_phase', desc: '週期相位 [0,1) 連續；個體差異待研發' },
  { id: 'estrogenProxy', domain: 'endocrine', min: 0, max: 1, status: 'pending_research', evidenceKey: 'menstrual_cycle_phase', desc: '雌激素代理（待研發）' },
  { id: 'progesteroneProxy', domain: 'endocrine', min: 0, max: 1, status: 'pending_research', evidenceKey: 'menstrual_cycle_phase', desc: '黃體素代理（待研發）' },
  { id: 'cortisolProxy', domain: 'endocrine', min: 0, max: 1, status: 'pending_research', evidenceKey: null, desc: '皮質醇代理（待研發）' },
  { id: 'oxytocinProxy', domain: 'endocrine', min: 0, max: 1, status: 'pending_research', evidenceKey: null, desc: '催產素代理（待研發）' },

  // —— 成年親密／性生理相關（槽位保留；輸出須同意閘）——
  { id: 'intimacyMotivation', domain: 'intimacy', min: 0, max: 1, status: 'pending_research', evidenceKey: 'intimacy_motivation', desc: '親密動機連續變數' },
  { id: 'sexualArousal', domain: 'intimacy', min: 0, max: 1, status: 'pending_research', evidenceKey: 'intimacy_motivation', desc: '性興奮代理（待研發動力學）' },
  { id: 'pleasure', domain: 'intimacy', min: 0, max: 1, status: 'pending_research', evidenceKey: 'intimacy_motivation', desc: '愉悅代理（待研發）' },
  { id: 'relaxation', domain: 'intimacy', min: 0, max: 1, status: 'active', evidenceKey: null, desc: '放鬆' },

  // —— 呼吸／自主神經（占位）——
  { id: 'respirationRate', domain: 'autonomic', min: 0.2, max: 1, status: 'pending_research', evidenceKey: null, desc: '呼吸率歸一化（待研發）' },
  { id: 'heartRateProxy', domain: 'autonomic', min: 0.2, max: 1, status: 'pending_research', evidenceKey: null, desc: '心率代理（待研發）' }
]);

const DEFAULT_VALUES = Object.freeze({
  consciousness: 1,
  alertness: 0.9,
  attention: 0.85,
  reactionSpeed: 0.9,
  gazeFocus: 0.9,
  headPostureControl: 0.9,
  fatigue: 0.15,
  sleepDebt: 0.1,
  eyelidDroop: 0.05,
  affectValence: 0.1,
  affectArousal: 0.35,
  stress: 0.15,
  anxiety: 0.1,
  anger: 0,
  sadness: 0,
  nociception: 0,
  thermalComfort: 0,
  comfort: 0.75,
  touchPressure: 0,
  muscleTone: 0.55,
  coordination: 0.9,
  balance: 0.9,
  injuryLoad: 0,
  skinFlush: 0.1,
  healingProgress: 1,
  bac: 0,
  otherImpairment: 0,
  illnessLoad: 0,
  virtualHealth: 0.95,
  cyclePhase: 0.25,
  estrogenProxy: 0.5,
  progesteroneProxy: 0.4,
  cortisolProxy: 0.3,
  oxytocinProxy: 0.3,
  intimacyMotivation: 0.2,
  sexualArousal: 0,
  pleasure: 0.2,
  relaxation: 0.5,
  respirationRate: 0.45,
  heartRateProxy: 0.45
});

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function mulberry32(seed) {
  let t = seed >>> 0;
  return function next() {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * @param {{ individualSeed?: number, overrides?: Record<string, number> }} [opts]
 */
export function createStateVector(opts = {}) {
  const seed = opts.individualSeed != null ? opts.individualSeed : 42;
  const rng = mulberry32(seed);
  const values = { ...DEFAULT_VALUES };

  // 個體差異：對部分槽位做小幅偏移（不寫死固定人格結果）
  const jitterIds = [
    'affectValence', 'affectArousal', 'fatigue', 'intimacyMotivation',
    'cyclePhase', 'muscleTone', 'attention', 'relaxation'
  ];
  for (const id of jitterIds) {
    const def = SLOT_DEFS.find((s) => s.id === id);
    if (!def) continue;
    const span = (def.max - def.min) * 0.08;
    values[id] = clamp(values[id] + (rng() - 0.5) * 2 * span, def.min, def.max);
  }

  if (opts.overrides) {
    for (const [k, v] of Object.entries(opts.overrides)) {
      if (k in values && typeof v === 'number') {
        const def = SLOT_DEFS.find((s) => s.id === k);
        values[k] = def ? clamp(v, def.min, def.max) : v;
      }
    }
  }

  let simTimeSec = 0;

  function getSlotMeta(id) {
    return SLOT_DEFS.find((s) => s.id === id) || null;
  }

  function get(id) {
    if (!(id in values)) throw new Error(`unknown slot: ${id}`);
    return values[id];
  }

  function set(id, raw) {
    const def = getSlotMeta(id);
    if (!def) throw new Error(`unknown slot: ${id}`);
    // pending_research 槽位仍可寫入（供測試／未來動力學），不得刪除
    values[id] = clamp(raw, def.min, def.max);
    return values[id];
  }

  function listPendingResearch() {
    return SLOT_DEFS.filter((s) => s.status === 'pending_research').map((s) => ({
      id: s.id,
      domain: s.domain,
      status: s.status,
      desc: s.desc
    }));
  }

  function snapshot() {
    const slots = {};
    for (const def of SLOT_DEFS) {
      slots[def.id] = {
        value: values[def.id],
        min: def.min,
        max: def.max,
        domain: def.domain,
        status: def.status,
        desc: def.desc,
        evidence: def.evidenceKey ? CORE_PARAM_EVIDENCE[def.evidenceKey] || null : null
      };
    }
    return {
      schema: 'aivault.darkstar.physiology_state_vector.v0.1',
      version: PHYSIO_STATE_VERSION,
      status: PHYSIO_STATE_STATUS,
      simTimeSec,
      individualSeed: seed,
      claimsBiologicalOrgan: false,
      claimsSubjectiveConsciousness: false,
      slots,
      pendingResearchCount: listPendingResearch().length,
      disclaimer: '虛擬模擬｜連續狀態向量｜非生物器官／非主觀意識'
    };
  }

  function advanceSimTime(dtSec) {
    simTimeSec += Math.max(0, dtSec);
    return simTimeSec;
  }

  function getSimTime() {
    return simTimeSec;
  }

  /** 測試用：確認所有 SLOT_DEFS 皆存在於 values */
  function assertIntegrity() {
    for (const def of SLOT_DEFS) {
      if (!(def.id in values)) throw new Error(`missing slot value: ${def.id}`);
      if (values[def.id] < def.min - 1e-9 || values[def.id] > def.max + 1e-9) {
        throw new Error(`slot out of range: ${def.id}`);
      }
    }
    return true;
  }

  return {
    version: PHYSIO_STATE_VERSION,
    SLOT_DEFS,
    get,
    set,
    snapshot,
    listPendingResearch,
    advanceSimTime,
    getSimTime,
    assertIntegrity,
    /** @deprecated 僅測試：直接取內部值表複本 */
    _debugValues: () => ({ ...values })
  };
}

export function listAllSlotIds() {
  return SLOT_DEFS.map((s) => s.id);
}
