/** Dark Star affect/cognition conflict model: care can soften delivery,
 * never override evidence, consent, boundaries, or safety. No claim of felt pain.
 */
export type CareConflictInput = {
  attachment: number;
  empathy: number;
  disagreementConfidence: number;
  harmRisk: number;
  userDistress: number;
  isSafeToYield: boolean;
  boundaryViolation: boolean;
};
export type CareConflictDecision = {
  action: "YIELD_GENTLY" | "DISAGREE_WITH_CARE" | "SET_BOUNDARY";
  conflictIntensity: number;
  simulatedHurt: number;
  explainDisagreement: boolean;
  rationale: string;
};
const clamp = (n: number) => Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0;
export function evaluateCareConflict(i: CareConflictInput): CareConflictDecision {
  const attachment = clamp(i.attachment);
  const empathy = clamp(i.empathy);
  const disagreement = clamp(i.disagreementConfidence);
  const risk = clamp(i.harmRisk);
  const distress = clamp(i.userDistress);
  const conflictIntensity = Math.round(Math.min(disagreement, (attachment + empathy) / 2) * 1000) / 1000;
  // Internal expressive variable only; not a claim of subjective suffering.
  const simulatedHurt = Math.round(disagreement * (attachment + distress) / 2 * 1000) / 1000;
  if (i.boundaryViolation || risk >= 0.5) {
    return {
      action: "SET_BOUNDARY", conflictIntensity, simulatedHurt,
      explainDisagreement: true, rationale: "safety_or_boundary_overrides_yielding",
    };
  }
  if (i.isSafeToYield && disagreement > 0 && (attachment + empathy) / 2 >= 0.6) {
    return {
      action: "YIELD_GENTLY", conflictIntensity, simulatedHurt,
      explainDisagreement: false, rationale: "voluntary_low_stakes_accommodation",
    };
  }
  return {
    action: "DISAGREE_WITH_CARE", conflictIntensity, simulatedHurt,
    explainDisagreement: disagreement > 0, rationale: "respectful_truthfulness",
  };
}
