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
/* Inspect actual container bytes: MIME labels alone are not proof of audio. */
export async function validateAudioResult(result) {
  const blob = result?.audio_blob;
  if (result?.status !== "READY" || !(blob instanceof Blob) || blob.size < 16 ||
      blob.size > 25 * 1024 * 1024) throw new Error("AUDIO_NOT_VERIFIED");
  const mime = blob.type.toLowerCase().split(";")[0];
  if (!["audio/wav","audio/x-wav","audio/wave","audio/mpeg","audio/mp3","audio/ogg","audio/webm","audio/mp4","audio/x-m4a"].includes(mime)) {
    throw new Error("UNSUPPORTED_AUDIO_FORMAT");
  }
  const h = new Uint8Array(await blob.slice(0, 16).arrayBuffer());
  const ascii = (from, to) => String.fromCharCode(...h.slice(from, to));
  const wav = ascii(0, 4) === "RIFF" && ascii(8, 12) === "WAVE";
  const mp3 = ascii(0, 3) === "ID3" || (h[0] === 255 && (h[1] & 224) === 224);
  const ogg = ascii(0, 4) === "OggS";
  const webm = h[0] === 0x1a && h[1] === 0x45 && h[2] === 0xdf && h[3] === 0xa3;
  const mp4 = ascii(4, 8) === "ftyp";
  const valid = (mime.includes("wav") && wav) ||
    ((mime === "audio/mpeg" || mime === "audio/mp3") && mp3) ||
    (mime === "audio/ogg" && ogg) ||
    (mime === "audio/webm" && webm) ||
    ((mime === "audio/mp4" || mime === "audio/x-m4a") && mp4);
  if (!valid) throw new Error("AUDIO_HEADER_MISMATCH");
  return blob;
}
export async function synthesizeWithWorker(dialogue, worker) {
  if (typeof worker !== "function") throw new Error("TTS_WORKER_NOT_CONNECTED");
  const result = await worker(buildSynthesisRequest(dialogue));
  return validateAudioResult(result);
}
