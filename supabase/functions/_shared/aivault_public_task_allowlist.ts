// Server-owned allowlisted public prompts. Never accept caller-supplied classification.
// Only static public reference questions may be sent; no user text or project data.
import type { EgressRequest } from "./aivault_external_egress.ts";
export type PublicTaskId = "PUBLIC_CONNECTIVITY_CHECK" | "PUBLIC_GENERAL_KNOWLEDGE";
const PROMPTS: Record<PublicTaskId, string> = {
 PUBLIC_CONNECTIVITY_CHECK: "Reply with the single word OK.",
 PUBLIC_GENERAL_KNOWLEDGE: "What is the capital of France? Answer in one sentence.",
};
export function createApprovedPublicTask(taskId: PublicTaskId): {prompt:string;egress:EgressRequest} {
 if (!Object.prototype.hasOwnProperty.call(PROMPTS,taskId)) throw Error("UNAPPROVED_PUBLIC_TASK");
 const prompt = PROMPTS[taskId];
 return { prompt, egress: {classification:"PUBLIC",purpose:"PUBLIC_QA",payload:prompt,approvedByPolicy:true} };
}
