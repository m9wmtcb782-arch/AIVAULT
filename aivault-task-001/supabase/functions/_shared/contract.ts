export const TASK_TYPE = "batch.image.classify";
export const CONTRACT = "task.batch.image.classify.v0.1";
export const ROUTER = "router.v0.1";
export const W_COST = 0.5;
export const W_LAT = 0.3;
export const W_RISK = 0.2;
export const MAX_ATTEMPTS = 3;
export const UNITS_PER_ITEM_DEFAULT = 10;
export const PROVIDER_REWARD_PER_PASSED = 8;
export const VERIFIER_UNITS_PER_SAMPLED = 2;
export const OWN_VERIFIER_MODEL = "aivault.own.system_model.v0.1";

export const LEGAL: Record<string, string[]> = {
  submitted: ["contract_validated", "rejected_invalid_contract"],
  contract_validated: ["queued"],
  queued: ["matched", "unmatched_no_provider", "settlement_blocked"],
  matched: ["accepted", "accept_timeout"],
  accepted: ["executing"],
  executing: ["result_received", "exec_timeout", "exec_failed"],
  result_received: ["verifying"],
  verifying: ["verified_passed", "verified_failed", "waived"],
  verified_passed: ["settled"],
  verified_failed: ["queued", "settlement_blocked", "closed"],
  accept_timeout: ["queued", "settlement_blocked", "closed"],
  exec_timeout: ["queued", "settlement_blocked", "closed"],
  exec_failed: ["queued", "settlement_blocked", "closed"],
  settled: ["capability_updated"],
  capability_updated: ["closed"],
  settlement_blocked: ["closed"],
  unmatched_no_provider: ["closed"],
  rejected_invalid_contract: ["closed"],
  waived: ["settled", "closed"],
};

export type TaskItem = {
  item_id: string;
  image_uri: string;
  content_hash: string;
  allowed_labels: string[];
};

export function sha256HexOk(h: string): boolean {
  return /^sha256:[0-9a-f]{64}$/.test(h);
}

export function labelsCanonical(labels: string[]): boolean {
  if (labels.length < 2 || labels.length > 256) return false;
  const set = new Set(labels);
  if (set.size !== labels.length) return false;
  const sorted = [...labels].sort();
  return sorted.every((v, i) => v === labels[i]);
}

export function sameLabels(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((v, i) => v === b[i]);
}

export function validateItems(items: unknown): { ok: true; items: TaskItem[] } | { ok: false; reason: string } {
  if (!Array.isArray(items) || items.length < 1 || items.length > 10000) {
    return { ok: false, reason: "items_count_invalid" };
  }
  const ids = new Set<string>();
  let canon: string[] | null = null;
  const out: TaskItem[] = [];
  for (const it of items) {
    if (!it || typeof it !== "object") return { ok: false, reason: "item_not_object" };
    const item = it as TaskItem;
    if (!item.item_id || ids.has(item.item_id)) return { ok: false, reason: "item_id_not_unique" };
    ids.add(item.item_id);
    if (typeof item.image_uri !== "string") return { ok: false, reason: "image_uri_invalid" };
    if (!item.image_uri.startsWith("https://") && !item.image_uri.startsWith("aivault-cas://")) {
      return { ok: false, reason: "image_uri_scheme_invalid" };
    }
    if (!sha256HexOk(item.content_hash)) return { ok: false, reason: "content_hash_invalid" };
    if (!Array.isArray(item.allowed_labels) || !labelsCanonical(item.allowed_labels)) {
      return { ok: false, reason: "allowed_labels_not_canonical" };
    }
    if (!canon) canon = item.allowed_labels;
    else if (!sameLabels(canon, item.allowed_labels)) return { ok: false, reason: "allowed_labels_mismatch_across_items" };
    out.push(item);
  }
  return { ok: true, items: out };
}

export function defaultBudget(n: number): number {
  return n * UNITS_PER_ITEM_DEFAULT;
}

export function sampleCount(n: number, frac: number): number {
  return Math.max(1, Math.ceil(n * frac));
}

export function riskOf(trust: string): number {
  if (trust === "trusted") return 0;
  if (trust === "observed") return 0.4;
  return 1;
}

export function capabilityId(providerId: string, taskType: string, contractVersion: string): string {
  return `${providerId}:${taskType}:${contractVersion}`;
}

export function ownWeightClassify(contentHash: string, allowed: string[]): { label: string; confidence: number } {
  const hex = contentHash.replace("sha256:", "");
  const n = parseInt(hex.slice(0, 8), 16);
  const idx = Number.isFinite(n) ? n % allowed.length : 0;
  const conf = 0.5 + ((Number.isFinite(n) ? n % 5000 : 0) / 10000);
  return { label: allowed[idx], confidence: Math.min(0.99, conf) };
}

export function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-aivault-internal",
    "Content-Type": "application/json",
  };
}

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: corsHeaders() });
}
