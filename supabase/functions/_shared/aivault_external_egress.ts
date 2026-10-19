// AIVAULT external-model egress policy: fail closed. Never send internal tasks by default.
// Classification must be set by a trusted server-side caller, not by the external user.
export type EgressClass = "PUBLIC" | "INTERNAL" | "CONFIDENTIAL" | "SECRET";
export type EgressRequest = {
  classification: EgressClass;
  purpose: "PUBLIC_QA" | "PUBLIC_SUMMARIZATION" | "CODE_REVIEW" | "RESEARCH" | "OTHER";
  payload: string;
  approvedByPolicy: boolean;
};
export type EgressDecision = { allowed: boolean; reason: string };
const DENY_PATTERNS: RegExp[] = [
 /\b(?:sk-or-v1-|sk-[A-Za-z0-9_-]{12,})/i,
 /\b(?:SUPABASE_SERVICE_ROLE_KEY|OPENROUTER_API_KEY|GROK_API_KEY|KLING_API_KEY)\b/i,
 /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i,
 /\b(?:AIVAULT_DISCOVERY_RUNNER_SECRET|AIVAULT_SUPABASE_JWT)\b/i,
];
export function authorizeExternalEgress(req: EgressRequest): EgressDecision {
 const deny = (reason: string): EgressDecision => ({allowed:false,reason});
 if (!req || req.classification !== "PUBLIC") return deny("NON_PUBLIC_DATA_BLOCKED");
 if (!req.approvedByPolicy) return deny("POLICY_APPROVAL_REQUIRED");
 if (req.purpose !== "PUBLIC_QA" && req.purpose !== "PUBLIC_SUMMARIZATION")
  return deny("PURPOSE_NOT_ALLOWED");
 if (typeof req.payload !== "string" || !req.payload.trim() || req.payload.length > 2000)
  return deny("PAYLOAD_INVALID");
 if (DENY_PATTERNS.some(pattern => pattern.test(req.payload))) return deny("POSSIBLE_SECRET_BLOCKED");
 // Pattern matching cannot prove absence of sensitive data. The trusted server
 // must classify content before this guard. Unknown or mixed content is not PUBLIC.
 return {allowed:true,reason:"PUBLIC_APPROVED"};
}
