const API = "https://generativelanguage.googleapis.com/v1beta";
const VOICES = new Set("Zephyr Puck Charon Kore Fenrir Leda Orus Aoede Callirrhoe Autonoe Enceladus Iapetus Umbriel Algieba Despina Erinome Algenib Rasalgethi Laomedeia Achernar Alnilam Schedar Gacrux Pulcherrima Achird Zubenelgenubi Vindemiatrix Sadachbia Sadaltager Sulafat".split(" "));
let modelCache: { key: string; model: string; expires: number } | null = null;
function apiKey(): string { return Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_API_KEY") || ""; }
export function geminiConfigured(): boolean { return !!apiKey(); }
async function googleFetch(path: string, key: string, body?: unknown): Promise<any> {
  const init = {
    method: body ? "POST" : "GET",
    headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  };
  let response = await fetch(API + path, { ...init, signal: AbortSignal.timeout(60000) });
  if(response.status===503){await new Promise(resolve=>setTimeout(resolve,800));response=await fetch(API+path,{...init,signal:AbortSignal.timeout(60000)});}
  if (!response.ok) throw new Error(`GEMINI_TTS_HTTP_${response.status}`);
  return await response.json();
}
async function selectModel(key: string): Promise<string> {
  const configured = (Deno.env.get("GEMINI_TTS_MODEL") || "").replace(/^models\//, "");
  if (configured) {
    if (!/^gemini-[a-z0-9.-]*tts[a-z0-9.-]*$/.test(configured)) throw new Error("GEMINI_TTS_INVALID_MODEL");
    return configured;
  }
  if (modelCache && modelCache.key === key && modelCache.expires > Date.now()) return modelCache.model;
  const available: string[] = [];
  let token = "";
  for (let page = 0; page < 3; page++) {
    const data = await googleFetch("/models?pageSize=100" + (token ? "&pageToken=" + encodeURIComponent(token) : ""), key);
    (data.models || []).forEach((m: any) => {
      const name = String(m.name || "").replace(/^models\//, "");
      if (/^gemini-.*tts/.test(name)) available.push(name);
    });
    token = data.nextPageToken || ""; if (!token) break;
  }
  const preferred = ["gemini-3.8-flash-tts", "gemini-3.1-flash-tts-preview", "gemini-2.5-flash-preview-tts", "gemini-2.5-pro-preview-tts", "gemini-3.8-flash-lite-tts"];
  const model = preferred.find(m => available.includes(m)) || available.sort().find(m => /flash/.test(m)) || available[0];
  if (!model) throw new Error("GEMINI_TTS_MODEL_UNAVAILABLE");
  modelCache = { key, model, expires: Date.now() + 300000 }; return model;
}
export function bytesBase64(bytes: Uint8Array): string {
  let binary = ""; for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(binary);
}
export function wavAudio(base64: string, mime: string): { mime: string; base64: string } {
  const raw = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
  if (raw.length < 2) throw new Error("GEMINI_TTS_EMPTY_AUDIO");
  if (String.fromCharCode(...raw.subarray(0, 4)) === "RIFF") return { mime: "audio/wav", base64 };
  if (!/audio\/(?:l16|pcm)/i.test(mime)) throw new Error("GEMINI_TTS_UNSUPPORTED_AUDIO");
  if (raw.length % 2) throw new Error("GEMINI_TTS_INVALID_PCM");
  const rate = Number(mime.match(/rate=(\d+)/i)?.[1] || 24000);
  const wav = new Uint8Array(raw.length + 44), view = new DataView(wav.buffer);
  function ascii(at: number, value: string) { for (let i = 0; i < value.length; i++) wav[at + i] = value.charCodeAt(i); }
  ascii(0, "RIFF"); view.setUint32(4, raw.length + 36, true); ascii(8, "WAVE"); ascii(12, "fmt ");
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, rate, true); view.setUint32(28, rate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  ascii(36, "data"); view.setUint32(40, raw.length, true); wav.set(raw, 44);
  return { mime: "audio/wav", base64: bytesBase64(wav) };
}
export async function ttsGemini(text: string, language = "zh-TW", voice = "Aoede"): Promise<{ mime: string; base64: string }> {
  if (!text.trim() || text.length > 2400) throw new Error("GEMINI_TTS_TEXT_LENGTH");
  if (!VOICES.has(voice)) throw new Error("GEMINI_TTS_INVALID_VOICE");
  const key = apiKey(); if (!key) throw new Error("GEMINI_TTS_NOT_CONFIGURED");
  const model = await selectModel(key);
  const delivery = language === "zh-CN" ? "Natural Mandarin Chinese" : "Natural Taiwanese Mandarin Chinese";
  const style = `${delivery}. Warm, relaxed, conversational audiobook narration, like a person explaining text to a listener. Smooth connected phrasing, meaningful emphasis, natural sentence pauses, not robotic or overly theatrical. Preserve every word and legal article number exactly. Do not paraphrase, add commentary, greetings or stage directions.`;
  let audio: { data: string; mime_type?: string; mimeType?: string } | undefined;
  if (/^gemini-(?:3\.[8-9]|[4-9]\.)/.test(model)) {
    const data = await googleFetch("/interactions", key, {
      model, input: [{ type: "user_input", content: [{ type: "text", text, annotations: [{ type: "speech_metadata", style }] }] }],
      response_format: { type: "audio" }, generation_config: { speech_config: [{ voice }] },
    });
    const blocks = (data.steps || []).filter((s: any) => s.type === "model_output").flatMap((s: any) => s.content || []).filter((c: any) => c.type === "audio" && c.data);
    audio = blocks[blocks.length - 1] || data.output_audio;
  } else {
    const data = await googleFetch(`/models/${model}:generateContent`, key, {
      contents: [{ role: "user", parts: [{ text: style + "\n\nRead only this exact text:\n" + text }] }],
      generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } } },
    });
    audio = (data.candidates?.[0]?.content?.parts || []).find((p: any) => p.inlineData?.data)?.inlineData;
  }
  if (!audio?.data) throw new Error("GEMINI_TTS_NO_AUDIO");
  return wavAudio(audio.data, audio.mimeType || audio.mime_type || "audio/wav");
}
