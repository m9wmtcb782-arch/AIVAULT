// Offline-only candidate screening for a global free AI resource directory.
// This module does not browse, register accounts, or invoke providers.
export type Candidate = {
  url: string;
  name: string;
  freeTierClaim: boolean;
  paymentMethodRequired: boolean | null;
  automatedRegistrationAllowed: boolean | null;
  quotaTermsKnown: boolean;
  usageTermsKnown: boolean;
  verifiedAt: string | null;
};
export type CandidateDecision = {
  status: "REVIEW_REQUIRED" | "REJECTED" | "ELIGIBLE_FOR_MANUAL_REVIEW";
  reason: string;
};
export function reviewCandidate(candidate: Candidate): CandidateDecision {
  let url: URL;
  try {
    url = new URL(candidate.url);
  } catch {
    return { status: "REJECTED", reason: "INVALID_URL" };
  }
  if (url.protocol !== "https:" || !url.hostname || !candidate.name.trim()) {
    return { status: "REJECTED", reason: "INVALID_SOURCE" };
  }
  if (!candidate.freeTierClaim || candidate.paymentMethodRequired === true) {
    return { status: "REJECTED", reason: "NOT_FREE_ONLY" };
  }
  if (candidate.paymentMethodRequired === null ||
      !candidate.quotaTermsKnown || !candidate.usageTermsKnown ||
      !candidate.verifiedAt || !Number.isFinite(Date.parse(candidate.verifiedAt))) {
    return { status: "REVIEW_REQUIRED", reason: "INSUFFICIENT_EVIDENCE" };
  }
  return {
    status: "ELIGIBLE_FOR_MANUAL_REVIEW",
    reason: candidate.automatedRegistrationAllowed === true
      ? "VERIFY_ACCOUNT_ELIGIBILITY_AND_AUTHORIZE"
      : "MANUAL_REGISTRATION_ONLY",
  };
}
// An eligible candidate is not a token balance, credential, or approved registration.
// Do not perform signups, provider calls or quota claims based on this result.
