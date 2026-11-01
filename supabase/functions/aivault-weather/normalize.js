// 觀測值正規化（Deno 與 Node 共用、可單元測試）。缺測一律回 null，絕不補 0。
// CWA 缺測/異常：-99、-999、-9999、空字串、null、非數字字元（如 "X"）。
export function obsNum(v, min, max) {
  if (v === null || v === undefined) return null;
  if (typeof v === "string" && v.trim() === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n <= -90) return null;
  if (min !== undefined && n < min) return null;
  if (max !== undefined && n > max) return null;
  return n;
}
export const tempC = (v) => obsNum(v, -30, 50);
export const windDir = (v) => obsNum(v, 0, 360); // 990（風向不定）等超出範圍 → null
export const windSpeed = (v) => obsNum(v, 0, 80);
