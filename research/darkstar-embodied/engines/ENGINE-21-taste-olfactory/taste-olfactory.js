/**
 * ENGINE-21｜Virtual Taste & Olfactory Inference（開發中）
 * 來源可信度：visual_inference | user_report | virtual_attribute | knowledge_base
 * 禁止假稱真的嚐過／聞到。
 */
import { lookupKnowledge, KNOWLEDGE_BASE, TASTE_OLF_KB_VERSION } from './knowledge-base.js';

export const TASTE_OLF_VERSION = '0.1.0-dev';
export const TASTE_OLF_STATUS = '開發中';
export const DISCLAIMER =
  '虛擬味覺／嗅覺推論｜推測 ≠ 實際測量；不得假稱真的嚐過或聞到';

const SOURCE_CONFIDENCE = {
  virtual_attribute: 0.95,
  user_report: 0.8,
  knowledge_base: 0.7,
  visual_inference: 0.55
};

function uid(p) {
  return `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

export function createTasteOlfactory(opts = {}) {
  const log = [];

  /**
   * Visual: e.g. camera sees lemon → infer sour, mark as inference not measurement
   */
  function inferFromVision(label, meta = {}) {
    const kb = lookupKnowledge(label);
    const source = 'visual_inference';
    const conf = SOURCE_CONFIDENCE[source] * (kb ? 1 : 0.4);
    const record = {
      id: uid('tof'),
      modality: kb && kb.taste && kb.taste.length ? 'taste' : 'smell',
      qualities: kb ? [...(kb.taste || []), ...(kb.smell || [])] : [],
      objectLabel: label,
      source,
      confidence: conf,
      isInference: true,
      isMeasurement: false,
      actuallyTasted: false,
      actuallySmelled: false,
      claimAllowed: `推測「${label}」通常${(kb && kb.taste && kb.taste[0]) || '有氣味'}；非實際測量`,
      kbKey: kb && kb.key,
      ts: Date.now(),
      engine: 'ENGINE-21',
      disclaimer: DISCLAIMER,
      meta
    };
    log.push(record);
    if (opts.onInfer) opts.onInfer(record);
    return record;
  }

  /**
   * User text/voice: "這杯咖啡很苦" → record as user_report
   */
  function recordUserDescription(text, opts2 = {}) {
    const source = 'user_report';
    const lower = String(text);
    let qualities = [];
    const tasteMap = [
      [/酸|sour/i, '酸'],
      [/甜|sweet/i, '甜'],
      [/苦|bitter/i, '苦'],
      [/鹹|salty/i, '鹹'],
      [/鮮|umami/i, '鮮'],
      [/辣|spicy/i, '辣']
    ];
    const smellMap = [
      [/香|fragrance|香氣/i, '香氣'],
      [/臭|stink/i, '臭味'],
      [/花香|floral/i, '花香'],
      [/煙|smoke/i, '煙霧氣味'],
      [/刺激/i, '刺激性氣味'],
      [/食物|food/i, '食物氣味']
    ];
    for (const [re, q] of tasteMap) if (re.test(lower)) qualities.push(q);
    for (const [re, q] of smellMap) if (re.test(lower)) qualities.push(q);
    const modality = /聞|氣味|味兒|smell|odor/i.test(lower)
      ? 'smell'
      : /嚐|吃|喝|taste|苦|甜|酸|鹹|鮮|辣/i.test(lower)
        ? 'taste'
        : qualities.length
          ? 'mixed'
          : 'unknown';
    const record = {
      id: uid('tof'),
      modality,
      qualities,
      rawText: text,
      source,
      confidence: SOURCE_CONFIDENCE[source],
      isInference: false,
      isMeasurement: false,
      actuallyTasted: false,
      actuallySmelled: false,
      claimAllowed: `記錄為使用者提供的資訊：「${text}」；暗星未真正聞到／嚐到`,
      objectLabel: opts2.objectLabel || null,
      ts: Date.now(),
      engine: 'ENGINE-21',
      disclaimer: DISCLAIMER
    };
    log.push(record);
    if (opts.onInfer) opts.onInfer(record);
    return record;
  }

  /**
   * Virtual world object attributes (authoritative for virtual domain)
   */
  function fromVirtualAttributes(attrs) {
    const source = 'virtual_attribute';
    const record = {
      id: uid('tof'),
      modality: attrs.modality || 'taste',
      qualities: attrs.qualities || [],
      objectLabel: attrs.label || attrs.id,
      source,
      confidence: SOURCE_CONFIDENCE[source],
      isInference: false,
      isMeasurement: false,
      isVirtualAttribute: true,
      actuallyTasted: false,
      actuallySmelled: false,
      claimAllowed: `依虛擬物件屬性模擬反應（仍非生物味覺）`,
      ts: Date.now(),
      engine: 'ENGINE-21',
      disclaimer: DISCLAIMER,
      attrs
    };
    log.push(record);
    return record;
  }

  function fromKnowledge(label) {
    const kb = lookupKnowledge(label);
    if (!kb) return { ok: false, error: 'not in knowledge base' };
    const record = {
      id: uid('tof'),
      modality: 'knowledge',
      qualities: [...(kb.taste || []), ...(kb.smell || [])],
      objectLabel: label,
      source: 'knowledge_base',
      confidence: SOURCE_CONFIDENCE.knowledge_base,
      isInference: true,
      isMeasurement: false,
      actuallyTasted: false,
      actuallySmelled: false,
      claimAllowed: kb.note,
      kbKey: kb.key,
      ts: Date.now(),
      engine: 'ENGINE-21',
      disclaimer: DISCLAIMER
    };
    log.push(record);
    return record;
  }

  return {
    version: TASTE_OLF_VERSION,
    status: TASTE_OLF_STATUS,
    disclaimer: DISCLAIMER,
    kbVersion: TASTE_OLF_KB_VERSION,
    inferFromVision,
    recordUserDescription,
    fromVirtualAttributes,
    fromKnowledge,
    getLog: () => log.slice(),
    reset: () => {
      log.length = 0;
    },
    SOURCE_CONFIDENCE,
    KNOWLEDGE_BASE
  };
}

export { lookupKnowledge, KNOWLEDGE_BASE };
