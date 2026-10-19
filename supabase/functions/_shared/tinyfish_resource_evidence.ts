// Resource eligibility is fail-closed: discovery or documentation alone never grants capacity.
export type Evidence = {
  provider: string;
  officialDocsUrl: string;
  termsUrl: string;
  pricingUrl: string;
  freeTierExplicit: boolean;
  allowedForAutomatedUse: boolean | null;
  quotaRequestsPerDay: number | null;
  requiresPaymentMethod: boolean | null;
  checkedAt: string;
  authenticatedAvailabilityTest: boolean;
};
export type Decision = {
  status: "REQUIRES_REVIEW" | "BLOCKED" | "ELIGIBLE_FOR_CONTROLLED_TEST";
  reasons: string[];
  productionReady: false;
};
function publicHttps(value: string): boolean {
  try {
    const u = new URL(value);
    if (u.protocol !== "https:" || u.username || u.password || u.port) return false;
    const h = u.hostname.toLowerCase();
    if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal")) return false;
    if (/^[0-9.]+$/.test(h) || h.includes(":")) return false;
    return h.includes(".");
  } catch { return false; }
}
export function evaluateResourceEvidence(e: Evidence): Decision {
  const reasons: string[] = [];
  if (!e.provider.trim()) reasons.push("MISSING_PROVIDER");
  if (!publicHttps(e.officialDocsUrl) || !publicHttps(e.termsUrl) || !publicHttps(e.pricingUrl))
    reasons.push("MISSING_PUBLIC_OFFICIAL_URLS");
  if (!Number.isFinite(Date.parse(e.checkedAt)) || Date.now() - Date.parse(e.checkedAt) > 30 * 86400000 ||
      Date.parse(e.checkedAt) > Date.now() + 86400000) reasons.push("EVIDENCE_STALE");
  if (!e.freeTierExplicit) reasons.push("FREE_TIER_NOT_ESTABLISHED");
  if (e.allowedForAutomatedUse !== true) reasons.push("AUTOMATION_PERMISSION_UNCONFIRMED");
  if (e.requiresPaymentMethod !== false) reasons.push("PAYMENT_METHOD_UNCONFIRMED");
  if (e.quotaRequestsPerDay === null || !Number.isSafeInteger(e.quotaRequestsPerDay) || e.quotaRequestsPerDay <= 0)
    reasons.push("FREE_QUOTA_UNCONFIRMED");
  if (!e.authenticatedAvailabilityTest) reasons.push("AVAILABILITY_NOT_TESTED");
  return { status: reasons.length === 0 ? "ELIGIBLE_FOR_CONTROLLED_TEST" : "REQUIRES_REVIEW",
    reasons, productionReady: false };
}
