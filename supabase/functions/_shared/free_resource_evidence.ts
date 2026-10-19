// AIVAULT free-resource evidence admission gate (pure logic; no external calls).
export type FreeEvidence = {
  providerId: string;
  officialTermsUrl: string;
  officialPricingUrl: string;
  modelId: string;
  accountEligibilityConfirmed: boolean;
  intendedUsePermitted: boolean;
  automatedApiUsePermitted: boolean;
  requiresPaymentMethod: boolean;
  autoPaidUpgradePossible: boolean;
  noChargeVerified: boolean;
  quotaRequests: number;
  quotaTokens: number;
  verifiedAt: string;
  verifiedBy: string;
};
export type EvidenceDecision = {
  state: "REVIEW_REQUIRED" | "BLOCKED" | "ELIGIBLE_FOR_APPROVAL";
  reason: string;
};
function officialHttps(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && !!parsed.hostname &&
      !parsed.username && !parsed.password && !parsed.hash;
  } catch { return false; }
}
export function assessFreeEvidence(e: FreeEvidence, now: string): EvidenceDecision {
  const review = (reason: string): EvidenceDecision => ({ state: "REVIEW_REQUIRED", reason });
  const blocked = (reason: string): EvidenceDecision => ({ state: "BLOCKED", reason });
  const t = Date.parse(now);
  const verified = Date.parse(e.verifiedAt);
  if (!e.providerId || !e.modelId || !e.verifiedBy ||
      !officialHttps(e.officialTermsUrl) || !officialHttps(e.officialPricingUrl) ||
      !Number.isFinite(t) || !Number.isFinite(verified) ||
      verified > t || t - verified > 7 * 86400000) return review("EVIDENCE_MISSING_OR_STALE");
  if (e.requiresPaymentMethod || e.autoPaidUpgradePossible || !e.noChargeVerified) {
    return blocked("BILLING_RISK");
  }
  if (!e.accountEligibilityConfirmed || !e.intendedUsePermitted ||
      !e.automatedApiUsePermitted) return blocked("TERMS_NOT_PERMITTED");
  if (!Number.isSafeInteger(e.quotaRequests) || e.quotaRequests < 1 ||
      !Number.isSafeInteger(e.quotaTokens) || e.quotaTokens < 1) {
    return review("NO_VERIFIED_QUOTA");
  }
  return { state: "ELIGIBLE_FOR_APPROVAL", reason: "REQUIRES_OWNER_AUTHORIZATION" };
}
// No resource is automatically activated by this assessment.
// Independent verification of evidence and actual capacity remains mandatory.
