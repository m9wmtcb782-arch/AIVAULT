/** Memory consolidation proposal: produce reviewable, source-linked summaries.
 * Does not write memories, call models, or promote claims to verified facts.
 */
export type Episode = {
  id: number;
  content: string;
  importance: number;
  ownerUid: string;
  deletedAt?: string | null;
};
export type ConsolidationProposal = {
  ownerUid: string;
  sourceIds: number[];
  draftSummary: string;
  confidence: "unverified";
  status: "needs_review";
};
export function proposeConsolidation(
  episodes: Episode[], ownerUid: string, maxChars = 1500,
): ConsolidationProposal | null {
  const eligible = episodes.filter((e) =>
    e.ownerUid === ownerUid && !e.deletedAt && e.importance >= 7
  ).slice(0, 10);
  if (eligible.length < 2) return null;
  const sourceIds = [...new Set(eligible.map((e) => e.id))];
  if (sourceIds.length < 2) return null;
  const snippets = eligible.map((e) => e.content.trim().slice(0, 250)).filter(Boolean);
  if (snippets.length < 2) return null;
  return {
    ownerUid,
    sourceIds,
    draftSummary: snippets.join(" | ").slice(0, Math.max(1, Math.min(maxChars, 4000))),
    confidence: "unverified",
    status: "needs_review",
  };
}
