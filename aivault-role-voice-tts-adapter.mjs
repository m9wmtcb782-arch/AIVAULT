/* AIVAULT role-voice synthesis contract v1.
 * No provider, API key, or network call is bundled. No generated audio is implied.
 * Import from the voice-library page once an independently verified TTS worker exists.
 */
export const VOICE_GROUPS = Object.freeze(["成年男性","成年女性","老年男性","老年女性","男童","女童"]);
export const EMOTIONS = Object.freeze(["自然","喜悅","悲傷","憤怒","恐懼"]);
export const VOICE_IDS = Object.freeze([
"AV-M01","AV-M02","AV-M03","AV-M04",
"AV-F01","AV-F02","AV-F03","AV-F04",
"AV-OM01","AV-OM02","AV-OM03","AV-OM04",
"AV-OF01","AV-OF02","AV-OF03","AV-OF04",
"AV-B01","AV-B02","AV-B03","AV-B04",
"AV-G01","AV-G02","AV-G03","AV-G04"
]);
const allowed = new Set(VOICE_IDS);
export function validateDialogue(value) {
  if (!value || typeof value !== "object") throw new Error("INVALID_DIALOGUE");
  const voiceId = String(value.voice_id || "");
  const text = String(value.text || "").trim();
  const emotion = String(value.emotion || "自然");
  if (!allowed.has(voiceId)) throw new Error("UNKNOWN_VOICE_ID");
  if (!EMOTIONS.includes(emotion)) throw new Error("UNKNOWN_EMOTION");
  if (!text || text.length > 1500) throw new Error("INVALID_TEXT_LENGTH");
  return { voice_id: voiceId, emotion, text };
}
export function buildSynthesisRequest(dialogue) {
  const clean = validateDialogue(dialogue);
  return { schema_version: 1, model: "Qwen3-TTS", ...clean };
}
export function validateAudioResult(result) {
  if (!result || result.status !== "READY" || !result.audio_blob ||
      !(result.audio_blob instanceof Blob) ||
      !result.audio_blob.type.startsWith("audio/") ||
      result.audio_blob.size === 0) {
    throw new Error("AUDIO_NOT_VERIFIED");
  }
  return result.audio_blob;
}
export async function synthesizeWithWorker(dialogue, worker) {
  if (typeof worker !== "function") throw new Error("TTS_WORKER_NOT_CONNECTED");
  const result = await worker(buildSynthesisRequest(dialogue));
  return validateAudioResult(result);
}
