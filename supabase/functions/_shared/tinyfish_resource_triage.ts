// Conservative, deterministic triage of TinyFish search candidates.
// Discovery is not proof of free capacity, entitlement or operational access.
export type Candidate = { title: string; url: string; snippet: string };
export type Triage = Candidate & {
  classification: "OFFICIAL_DOCS" | "THIRD_PARTY_LEAD" | "REJECTED";
  evidence: "OFFICIAL_SOURCE_ONLY" | "UNVERIFIED" | "INVALID_URL";
  verifiedFreeCapacity: false;
  usableForInference: false;
  reasons: string[];
};
const officialHosts = new Set([
  "openrouter.ai", "huggingface.co", "console.groq.com", "groq.com",
  "ai.google.dev", "developers.google.com", "cloudflare.com", "developers.cloudflare.com",
  "docs.github.com"
]);
const docsPath = /\/(docs?|api|developers?|pricing|models?|limits|inference|reference)(\/|$|[?#-])/i;
export function triageCandidate(input: Candidate): Triage {
  const reasons: string[] = [];
  let host = "";
  let path = "";
  try {
    const u = new URL(input.url);
    if (u.protocol !== "https:" || u.username || u.password || u.port || u.hostname.endsWith(".") ||
      u.hostname === "localhost" || u.hostname.endsWith(".local") || u.hostname.endsWith(".internal") ||
      /^[0-9.]+$/.test(u.hostname) || u.hostname.startsWith("[") || !u.hostname.includes(".")) throw Error("bad url");
    host = u.hostname.toLowerCase();
    path = u.pathname;
  } catch {
    return { ...input, classification: "REJECTED", evidence: "INVALID_URL",
      verifiedFreeCapacity: false, usableForInference: false, reasons: ["INVALID_HTTPS_URL"] };
  }
  // A GitHub repository is not automatically the provider's official documentation.
  const official = officialHosts.has(host) && host !== "github.com" && docsPath.test(path);
  if (official) reasons.push("OFFICIAL_DOCUMENTATION_CANDIDATE");
  else reasons.push("REQUIRES_OFFICIAL_PROVIDER_SOURCE");
  reasons.push("NO_AUTHENTICATED_QUOTA_OR_INFERENCE_TEST");
  return { ...input, classification: official ? "OFFICIAL_DOCS" : "THIRD_PARTY_LEAD",
    evidence: official ? "OFFICIAL_SOURCE_ONLY" : "UNVERIFIED",
    verifiedFreeCapacity: false, usableForInference: false, reasons };
}
export function triageCandidates(items: Candidate[]): Triage[] {
  const seen = new Set<string>();
  return items.slice(0, 50).flatMap(item => {
    const out = triageCandidate(item);
    if (out.classification === "REJECTED") return [out];
    const key = out.url.replace(/\/$/, "").toLowerCase();
    if (seen.has(key)) return [];
    seen.add(key);
    return [out];
  });
}
