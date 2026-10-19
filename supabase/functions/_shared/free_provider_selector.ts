// AIVAULT free-only provider selection. No network calls or credential handling.
// Deny by default: only manually verified, unexpired, enabled free providers qualify.
export type FreeProvider = {
  id: string;
  enabled: boolean;
  verifiedFree: boolean;
  requiresPaymentMethod: boolean;
  permitsIntendedUse: boolean;
  verifiedUntil: string;
  availableRequests: number;
  availableTokens: number;
  model: string;
};
export type WorkRequest = { estimatedTokens: number; now: string };
export type Selection =
  | { status: "SELECTED"; providerId: string; model: string }
  | { status: "BLOCKED"; reason: string };

function validNonnegativeInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}
export function selectFreeProvider(
  providers: readonly FreeProvider[],
  request: WorkRequest,
): Selection {
  const now = Date.parse(request.now);
  if (!Number.isFinite(now) || !validNonnegativeInteger(request.estimatedTokens) ||
      request.estimatedTokens === 0) {
    return { status: "BLOCKED", reason: "INVALID_REQUEST" };
  }
  for (const p of providers) {
    const until = Date.parse(p.verifiedUntil);
    if (!p.id || !p.model || !p.enabled || !p.verifiedFree ||
        p.requiresPaymentMethod || !p.permitsIntendedUse ||
        !Number.isFinite(until) || until <= now ||
        !validNonnegativeInteger(p.availableRequests) ||
        !validNonnegativeInteger(p.availableTokens) ||
        p.availableRequests < 1 || p.availableTokens < request.estimatedTokens) {
      continue;
    }
    return { status: "SELECTED", providerId: p.id, model: p.model };
  }
  return { status: "BLOCKED", reason: "NO_VERIFIED_FREE_CAPACITY" };
}
// IMPORTANT: Selection is advisory only, NOT a quota reservation.
// Before any inference, implement atomic quota reservation and cost enforcement
// on the server. Never pass a selected provider directly to a paid endpoint.
