/** Consent-gated candidate capture. Pure functions, no database or model calls. */
import type { MemoryTier } from "./dark_star_memory_policy.ts";
export type CaptureInput = {
  text: string;
  source: "owner_message" | "verified_event" | "model_output";
  ownerOptIn: boolean;
  isOwnerVerified: boolean;
  requestedTier?: MemoryTier;
  importance?: number;
};
export type CaptureDecision =
  | { accepted: false; reason: string }
  | { accepted: true; tier: MemoryTier; content: string; importance: number; reviewRequired: true };

const secretPatterns = [
  /(?:sk-|gsk_|ghp_|github_pat_)[A-Za-z0-9_-]{12,}/i,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /(?:password|passwd|api[_-]?key|access[_-]?token|secret)\s*[:=]\s*\S{6,}/i,
  /\b\d{3}-\d{2}-\d{4}\b/,
];
export function assessMemoryCapture(input: CaptureInput): CaptureDecision {
  if (!input.isOwnerVerified) return { accepted: false, reason: "owner_not_verified" };
  if (!input.ownerOptIn) return { accepted: false, reason: "consent_required" };
  if (input.source === "model_output") return { accepted: false, reason: "model_output_not_evidence" };
  const text = input.text.trim();
  if (Array.from(text).length < 4 || Array.from(text).length > 4000) {
    return { accepted: false, reason: "invalid_length" };
  }
  if (secretPatterns.some((re) => re.test(text))) {
    return { accepted: false, reason: "sensitive_content" };
  }
  // High-trust self-model memory requires explicit separate review, not auto-capture.
  const tier = input.requestedTier === "self" ? "episodic" : (input.requestedTier || "short");
  const importance = Number.isFinite(input.importance)
    ? Math.max(0, Math.min(10, Math.round(input.importance!))) : 5;
  return { accepted: true, tier, content: text, importance, reviewRequired: true };
}
