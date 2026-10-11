/**
 * AIVAULT learning records v0.1 — standalone contracts only.
 * No training jobs, provider requests, external posting, or DB writes.
 * Skill metadata and reviewed trajectories are NOT trained model weights.
 */
export type Skill = {
  skillId: string;
  version: string;
  description: string;
  toolNames: readonly string[];
  risk: "read_only" | "approval_required";
};
export type TrainingExample = {
  exampleId: string;
  ownerId: string;
  agentId: string;
  skillId: string;
  taskSummary: string;
  observation: string;
  outcome: "success" | "failure" | "unknown";
  reviewedBy: string | null;
  reviewedAt: string | null;
  consentOrLicense: string | null;
  createdAt: string;
};
export interface SkillStore {
  get(skillId: string): Promise<Skill | null>;
  listForAgent(agentId: string): Promise<readonly Skill[]>;
}
export interface TrainingExampleStore {
  append(example: TrainingExample): Promise<void>;
  listByAgent(ownerId: string, agentId: string): Promise<readonly TrainingExample[]>;
}
export function validateTrainingExample(x: TrainingExample): void {
  if (![x.exampleId, x.ownerId, x.agentId, x.skillId, x.taskSummary, x.observation].every(v => typeof v === "string" && v.trim().length > 0)) throw new Error("INVALID_TRAINING_EXAMPLE");
  if (!Number.isFinite(Date.parse(x.createdAt))) throw new Error("INVALID_CREATED_AT");
  if ((x.reviewedBy === null) !== (x.reviewedAt === null)) throw new Error("INCOMPLETE_REVIEW");
  if (x.reviewedAt && !Number.isFinite(Date.parse(x.reviewedAt))) throw new Error("INVALID_REVIEW_DATE");
}
export function eligibleForTraining(x: TrainingExample): boolean {
  validateTrainingExample(x);
  return Boolean(x.reviewedBy && x.reviewedAt && x.consentOrLicense?.trim() && x.outcome !== "unknown");
}
export class ScopedTrainingRecords {
  constructor(private readonly store: TrainingExampleStore, private readonly ownerId: string, private readonly agentId: string) {
    if (!ownerId.trim() || !agentId.trim()) throw new Error("INVALID_SCOPE");
  }
  async append(x: TrainingExample): Promise<void> {
    validateTrainingExample(x);
    if (x.ownerId !== this.ownerId || x.agentId !== this.agentId) throw new Error("TRAINING_SCOPE_VIOLATION");
    await this.store.append({ ...x });
  }
  async reviewed(): Promise<readonly TrainingExample[]> {
    const records = await this.store.listByAgent(this.ownerId, this.agentId);
    if (records.some(x => x.ownerId !== this.ownerId || x.agentId !== this.agentId)) throw new Error("TRAINING_SCOPE_VIOLATION");
    return records.filter(eligibleForTraining);
  }
}
