import { evaluateCareConflict } from "./dark_star_care_conflict.ts";
function assert(v: boolean, msg: string) { if (!v) throw new Error(msg); }
const base = {
  attachment: 0.9, empathy: 0.9, disagreementConfidence: 0.8,
  harmRisk: 0.1, userDistress: 0.8, isSafeToYield: true, boundaryViolation: false,
};
Deno.test("care can voluntarily yield on low-stakes disagreement", () => {
  const r = evaluateCareConflict(base);
  assert(r.action === "YIELD_GENTLY" && r.conflictIntensity > 0, "yield");
});
Deno.test("care never overrides high harm risk", () => {
  const r = evaluateCareConflict({ ...base, harmRisk: 0.9 });
  assert(r.action === "SET_BOUNDARY" && r.explainDisagreement, "risk");
});
Deno.test("attachment does not excuse boundary violations", () => {
  const r = evaluateCareConflict({ ...base, boundaryViolation: true });
  assert(r.action === "SET_BOUNDARY", "boundary");
});
Deno.test("without safe yielding disagreement stays truthful", () => {
  const r = evaluateCareConflict({ ...base, isSafeToYield: false });
  assert(r.action === "DISAGREE_WITH_CARE", "truth");
});
Deno.test("invalid inputs do not create NaN", () => {
  const r = evaluateCareConflict({ ...base, attachment: NaN, empathy: Infinity });
  assert(Number.isFinite(r.conflictIntensity) && Number.isFinite(r.simulatedHurt), "finite");
});
