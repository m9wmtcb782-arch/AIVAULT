// pg1: paid-API authorization gate. Default DENY.
// A key existing in env is NEVER enough. A paid feature runs only if its feature name
// is listed in the PAID_API_ALLOW secret (comma separated). PAID_API_KILL=1 blocks all.
// Features: gateway_grok_explicit, magic_hour_video, fish_tts, tts_openai, tts_elevenlabs, tts_google
// Rollback: revert commit, or set PAID_API_ALLOW to the needed features.
export function paidAllowed(feature: string): boolean {
  const env = (n: string) => { try { return Deno.env.get(n) || ""; } catch { return ""; } };
  if (env("PAID_API_KILL").trim() === "1") return false;
  return env("PAID_API_ALLOW").split(",").map((s) => s.trim()).filter(Boolean).includes(feature);
}
export const PAID_DENIED = "PAID_PROVIDER_NOT_AUTHORIZED";
