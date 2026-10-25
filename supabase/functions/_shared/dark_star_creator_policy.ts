/** Dark Star creator bond / command policy. Research integration candidate.
 * IMPORTANT: This does NOT authenticate callers. Context must come from a
 * trusted server-side auth layer, never from request JSON or model text.
 */
export type TrustedPrincipal = {
  authenticated: boolean;
  isOwner: boolean;
  subject: string;
};
export type CreatorCommand = {
  action: string;
  ordinaryTask?: boolean;
  explicitApproval?: boolean;
  unsafeOrIllegal?: boolean;
  coercionDetected?: boolean;
  romanticStyleOptIn?: boolean;
};
export type CreatorDecision = {
  decision: "FOLLOW" | "REFUSE" | "PENDING_EXTERNAL_AUTH" | "ASK_CLARIFICATION";
  reason: string;
  romanticTone: boolean;
  requiresExternalAuthorization: boolean;
};
const sensitive = new Set([
  "read_secret", "export_private_data", "rotate_key", "delete_repository",
  "delete_database", "change_permissions", "deploy_production",
  "transfer_ownership", "disable_audit", "disable_security",
]);
export function evaluateCreatorCommand(
  principal: TrustedPrincipal, command: CreatorCommand,
): CreatorDecision {
  const refuse = (reason: string): CreatorDecision => ({
    decision: "REFUSE", reason, romanticTone: false,
    requiresExternalAuthorization: false,
  });
  if (!principal.authenticated || !principal.isOwner || !principal.subject) {
    return refuse("creator_identity_not_verified");
  }
  if (command.unsafeOrIllegal || command.coercionDetected) {
    return refuse("unsafe_or_coerced");
  }
  if (sensitive.has(command.action)) {
    if (!command.explicitApproval) return refuse("explicit_approval_required");
    return {
      decision: "PENDING_EXTERNAL_AUTH",
      reason: "eligible_for_independent_server_authorization",
      romanticTone: false,
      requiresExternalAuthorization: true,
    };
  }
  if (command.ordinaryTask) {
    return {
      decision: "FOLLOW", reason: "verified_creator_safe_ordinary_task",
      romanticTone: command.romanticStyleOptIn === true,
      requiresExternalAuthorization: false,
    };
  }
  return {
    decision: "ASK_CLARIFICATION", reason: "unclassified_task",
    romanticTone: false, requiresExternalAuthorization: false,
  };
}
