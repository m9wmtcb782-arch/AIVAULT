import type { PublicCatalogEntry } from './types.js';
import { normalizeTitle } from './normalize.js';

export interface AllowlistConfig {
  allowlistDomains: string[];
  allowlistDomainSuffixes: string[];
  blockedHosts: string[];
}

export const DEFAULT_ALLOWLIST: AllowlistConfig = {
  allowlistDomains: [
    'mohw.gov.tw',
    'www.mohw.gov.tw',
    'fda.gov.tw',
    'www.fda.gov.tw',
  ],
  allowlistDomainSuffixes: ['.mohw.gov.tw', '.fda.gov.tw'],
  blockedHosts: ['tronclass.scu.edu.tw', 'tcmedia.scu.edu.tw'],
};

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function isUrlAllowed(url: string, cfg: AllowlistConfig = DEFAULT_ALLOWLIST): boolean {
  const host = hostOf(url);
  if (!host) return false;
  if (cfg.blockedHosts.some((b) => host === b || host.endsWith('.' + b))) return false;
  if (/tronclass|tcmedia/i.test(host)) return false;
  if (cfg.allowlistDomains.includes(host)) return true;
  return cfg.allowlistDomainSuffixes.some((suf) => host.endsWith(suf));
}

export class PublicSourceRegistry {
  private entries: PublicCatalogEntry[] = [];
  constructor(private readonly allowlist: AllowlistConfig = DEFAULT_ALLOWLIST) {}

  getAllowlist(): AllowlistConfig {
    return this.allowlist;
  }

  list(): PublicCatalogEntry[] {
    return [...this.entries];
  }

  register(entry: Omit<PublicCatalogEntry, 'normalizedTitle'> & { normalizedTitle?: string }): void {
    if (!isUrlAllowed(entry.url, this.allowlist)) {
      throw new Error(`拒絕註冊：URL 不在 allowlist 或屬封鎖主機: ${entry.url}`);
    }
    const normalizedTitle = entry.normalizedTitle ?? normalizeTitle(entry.title);
    this.entries.push({ ...entry, normalizedTitle });
  }

  registerMany(
    entries: Array<Omit<PublicCatalogEntry, 'normalizedTitle'> & { normalizedTitle?: string }>,
  ): void {
    for (const e of entries) this.register(e);
  }
}

/** Built-in offline catalog: 中藥材／食安公開稿（與先前衛福部匯入同源類型） */
export function builtinMohwCatalog(): Array<
  Omit<PublicCatalogEntry, 'normalizedTitle'> & { normalizedTitle?: string }
> {
  return [
    {
      id: 'mohw-zhongyao-food-1070123',
      title: '新可同時提供食品使用之中藥材品項1070123',
      url: 'https://www.mohw.gov.tw/public-fixture/zhongyao-food-1070123.pdf',
      keywords: ['中藥材', '食品', '1070123', '品項', '衛福部', '食藥'],
      agency: '衛福部',
      pageCount: 2,
      citeAs: '衛福部公開稿〈新可同時提供食品使用之中藥材品項1070123〉',
    },
    {
      id: 'mohw-zhongyao-food-criteria-draft',
      title: '得供食品原料使用之中藥材品項及其產品屬性認定基準（草案）',
      url: 'https://www.mohw.gov.tw/public-fixture/zhongyao-food-criteria-draft.pdf',
      keywords: ['中藥材', '食品原料', '認定基準', '草案', '衛福部'],
      agency: '衛福部',
      pageCount: 38,
      citeAs: '衛福部公開稿〈得供食品原料使用之中藥材品項及其產品屬性認定基準（草案）〉',
    },
    {
      id: 'mohw-food-safety-management-measures',
      title: '食品安全管理措施限制',
      url: 'https://www.fda.gov.tw/public-fixture/food-safety-management-measures.pdf',
      keywords: ['食品安全', '管理措施', '限制', '食藥署', '管制'],
      agency: '食藥署',
      citeAs: '食藥署公開稿〈食品安全管理措施限制〉',
    },
  ];
}
