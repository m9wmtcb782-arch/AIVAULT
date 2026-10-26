/**
 * 參數來源證據分級｜Virtual Human Physiology Core
 * 虛擬模擬｜不得虛報為已證實生物研究成果
 */
export const EVIDENCE_TIERS_VERSION = '0.1.0-dev';

/** @typedef {'supported'|'approximation'|'hypothesis'} EvidenceTier */

export const EVIDENCE_TIER = Object.freeze({
  SUPPORTED: 'supported',
  APPROXIMATION: 'approximation',
  HYPOTHESIS: 'hypothesis'
});

export const TIER_LABEL_ZH = Object.freeze({
  supported: '經科學支持的機制（可引用文獻／標準模型）',
  approximation: '合理工程近似（須標已知誤差）',
  hypothesis: '尚未驗證的假設（不得冒充已驗證成果）'
});

/**
 * 註冊參數來源說明。
 * @param {string} paramId
 * @param {EvidenceTier} tier
 * @param {{ source?: string, knownError?: string, notes?: string }} [meta]
 */
export function annotateParam(paramId, tier, meta = {}) {
  if (!Object.values(EVIDENCE_TIER).includes(tier)) {
    throw new Error(`invalid evidence tier: ${tier}`);
  }
  return {
    paramId,
    tier,
    labelZh: TIER_LABEL_ZH[tier],
    source: meta.source || null,
    knownError: meta.knownError || null,
    notes: meta.notes || null,
    claimsBiologicalOrgan: false,
    claimsSubjectiveConsciousness: false
  };
}

/** 核心內建參數分級表（骨架；非完整臨床校準） */
export const CORE_PARAM_EVIDENCE = Object.freeze({
  fatigue_accumulation: annotateParam('fatigue_accumulation', EVIDENCE_TIER.APPROXIMATION, {
    source: 'sleep debt / homeostatic sleep drive 工程近似',
    knownError: '非個體多導睡眠圖校準；係數可調'
  }),
  reaction_delay_from_fatigue: annotateParam('reaction_delay_from_fatigue', EVIDENCE_TIER.APPROXIMATION, {
    source: '疲勞與反應時間正相關之簡化映射',
    knownError: '線性／分段近似；非神經傳導實測'
  }),
  alcohol_bac_widmark_like: annotateParam('alcohol_bac_widmark_like', EVIDENCE_TIER.APPROXIMATION, {
    source: 'Widmark-like 吸收／消除簡化模型',
    knownError: '未含完整胃排空、性別體脂個體化臨床校準'
  }),
  nociception_proxy: annotateParam('nociception_proxy', EVIDENCE_TIER.HYPOTHESIS, {
    source: '虛擬痛覺代理變數（非主觀痛覺）',
    notes: '禁止宣稱真實痛覺體驗'
  }),
  menstrual_cycle_phase: annotateParam('menstrual_cycle_phase', EVIDENCE_TIER.HYPOTHESIS, {
    source: '週期相位槽位占位；個體差異參數待研發',
    notes: '不得寫死固定日期→固定情緒結果'
  }),
  intimacy_motivation: annotateParam('intimacy_motivation', EVIDENCE_TIER.HYPOTHESIS, {
    source: '成年人生理動機連續槽位；輸出須過同意閘',
    notes: 'pending_research 動力學；不得固定親密動畫'
  }),
  soft_tissue_deform: annotateParam('soft_tissue_deform', EVIDENCE_TIER.APPROXIMATION, {
    source: 'ENGINE-12 局部形變場近似',
    knownError: '非完整 FEM／生物組織本構'
  }),
  critical_consciousness_gate: annotateParam('critical_consciousness_gate', EVIDENCE_TIER.APPROXIMATION, {
    source: '意識代理變數→運動／自主閘門',
    notes: '危急／昏迷禁止正常複雜自主'
  })
});

/**
 * 輸出前消毒：禁止虛報旗標。
 * @param {object} snapshot
 */
export function assertNoFalseBiologicalClaims(snapshot) {
  if (snapshot.claimsBiologicalOrgan === true) {
    throw new Error('禁止虛報：claimsBiologicalOrgan');
  }
  if (snapshot.claimsSubjectiveConsciousness === true) {
    throw new Error('禁止虛報：claimsSubjectiveConsciousness');
  }
  return true;
}

export function listEvidenceCatalog() {
  return Object.values(CORE_PARAM_EVIDENCE);
}
