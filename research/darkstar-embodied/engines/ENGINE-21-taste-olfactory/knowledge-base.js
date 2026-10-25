/**
 * ENGINE-21 食物／氣味知識庫（可驗證的常識映射，非主觀體驗）
 */
export const TASTE_OLF_KB_VERSION = '0.1.0-dev';

/** @type {Record<string, { taste?: string[], smell?: string[], note: string }>} */
export const KNOWLEDGE_BASE = Object.freeze({
  lemon: {
    aliases: ['檸檬', 'lemons'],
    taste: ['sour', '酸'],
    smell: ['citrus', '花香', '香氣'],
    note: '常見檸檬偏酸；僅知識庫推測'
  },
  coffee: {
    aliases: ['咖啡', 'espresso'],
    taste: ['bitter', '苦'],
    smell: ['roast', '食物氣味'],
    note: '烘焙咖啡常偏苦'
  },
  sugar: {
    aliases: ['糖', 'candy'],
    taste: ['sweet', '甜'],
    smell: ['香氣'],
    note: '甜'
  },
  salt: {
    aliases: ['鹽'],
    taste: ['salty', '鹹'],
    smell: [],
    note: '鹹'
  },
  chili: {
    aliases: ['辣椒', '辣'],
    taste: ['spicy', '辣'],
    smell: ['刺激性氣味'],
    note: '化學刺激（辣）'
  },
  flower: {
    aliases: ['花', '玫瑰', 'rose'],
    taste: [],
    smell: ['花香', '香氣'],
    note: '花香'
  },
  smoke: {
    aliases: ['煙', '煙霧', 'smoke'],
    taste: [],
    smell: ['煙霧氣味', '刺激性氣味'],
    note: '煙霧'
  },
  garbage: {
    aliases: ['垃圾', '臭'],
    taste: [],
    smell: ['臭味'],
    note: '臭味'
  },
  umami_broth: {
    aliases: ['高湯', '味精'],
    taste: ['umami', '鮮'],
    smell: ['食物氣味'],
    note: '鮮味'
  }
});

export function lookupKnowledge(label) {
  if (!label) return null;
  const q = String(label).trim().toLowerCase();
  for (const [key, val] of Object.entries(KNOWLEDGE_BASE)) {
    if (key === q) return { key, ...val };
    if ((val.aliases || []).some((a) => a.toLowerCase() === q || q.includes(a.toLowerCase()))) {
      return { key, ...val };
    }
  }
  return null;
}
