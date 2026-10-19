/**
 * Dark Star two-model review gate.
 * Pure local decision logic: no provider requests and no API keys.
 * Agreement is never promoted to VERIFIED without independent evidence.
 */
export type ReviewStatus = "PENDING" | "CONFLICT" | "CONSENSUS_UNVERIFIED" | "VERIFIED" | "INCORRECT";
export interface ModelReview {
  model_family: string;
  model_id: string;
  conclusion: string;
  rationale: string;
  evidence_ids: string[];
}
export interface ReviewDecision {
  status: ReviewStatus;
  distinct_model_families: number;
  agreed: boolean;
  reason: string;
}
const normalized = (s: string) => s.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ");
export function evaluateDarkStarReviews(
  originalAnswer: string,
  reviews: ModelReview[],
  verifiedEvidenceIds: string[] = [],
): ReviewDecision {
  const valid = reviews.filter(r => r.model_family?.trim() && r.model_id?.trim() && r.conclusion?.trim() && r.rationale?.trim());
  const families = new Set(valid.map(r => normalized(r.model_family)));
  if (families.size < 2) return {
    status: "PENDING", distinct_model_families: families.size, agreed: false,
    reason: "需要兩個不同模型家族的獨立審查；更換同一模型的 API Key 不算第二票。",
  };
  const independent = [...families].slice(0, 2).map(family => valid.find(r => normalized(r.model_family) === family)!);
  const agreed = normalized(independent[0].conclusion) === normalized(independent[1].conclusion);
  if (!agreed) return {
    status: "CONFLICT", distinct_model_families: families.size, agreed: false,
    reason: "兩個模型結論不同；保存分歧，等待來源證據或人工裁定。",
  };
  const evidence = new Set(verifiedEvidenceIds.map(normalized));
  const commonEvidence = independent[0].evidence_ids.some(id =>
    evidence.has(normalized(id)) && independent[1].evidence_ids.some(other => normalized(other) === normalized(id))
  );
  if (!commonEvidence) return {
    status: "CONSENSUS_UNVERIFIED", distinct_model_families: families.size, agreed: true,
    reason: "模型結論相同，但缺少雙方共同引用且獨立驗證的證據；不得寫入正確記憶。",
  };
  const matchesOriginal = normalized(originalAnswer) === normalized(independent[0].conclusion);
  return {
    status: matchesOriginal ? "VERIFIED" : "INCORRECT",
    distinct_model_families: families.size, agreed: true,
    reason: matchesOriginal
      ? "兩模型共識且具共同驗證證據；可記錄為已驗證候選，仍需保留證據版本。"
      : "原答案與具證據的模型共識不符；保留原錯誤與修正理由。",
  };
}
