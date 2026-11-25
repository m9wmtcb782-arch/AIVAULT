/** Allowed document extensions for TronClass material sync (construction order §6). */

export const DEFAULT_ALLOWLIST = [
  '.pdf',
  '.ppt',
  '.pptx',
  '.doc',
  '.docx',
] as const;

/**
 * Return true if fileName ends with an allowlisted extension (case-insensitive).
 */
export function isAllowedExtension(
  fileName: string,
  allowlist: readonly string[] = DEFAULT_ALLOWLIST,
): boolean {
  const lower = fileName.trim().toLowerCase();
  const base = lower.split(/[/\\]/).pop() ?? '';
  return allowlist.some((ext) => base.endsWith(ext.toLowerCase()));
}

/** Filter material-like objects that have a fileName field. */
export function filterByAllowlist<T extends { fileName: string }>(
  items: T[],
  allowlist: readonly string[] = DEFAULT_ALLOWLIST,
): T[] {
  return items.filter((item) => isAllowedExtension(item.fileName, allowlist));
}
