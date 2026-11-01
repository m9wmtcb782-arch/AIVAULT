// 統一模型登錄表 + 能力合約（capability contract）。
// status: "real" = 目前程式庫裡真的有接；"planned" = 只是預留介面（stub），沒有模型、沒有呼叫。
// 預設全部關閉：MULTIMODAL_ON 不等於 "1" 時，orchestrator 只回傳計畫，不會執行任何東西。
export const MODALITIES = ["text", "voice", "image", "video", "short_video", "3d", "music"];
export const QUOTA = { free_local: 0, pool_50pct: 1, paid_approval: 2 }; // pool 50% 額度規則沿用 v3 quota guard
/** @typedef {{id:string,status:"real"|"planned",in:string[],out:string[],cost:{unit:string,est:number},quota:keyof QUOTA,device:"cpu"|"gpu"|"api"|"edge",embed?:string,notes?:string}} Cap */
/** @type {Cap[]} */
export const REGISTRY = [
  { id: "tiny-router-lora", status: "real", in: ["text"], out: ["text"], cost: { unit: "call", est: 0 }, quota: "free_local", device: "cpu", notes: "v3 tiny transformer + LoRA + memory-augmented read (PoC only)" },
  { id: "groq-llm", status: "real", in: ["text"], out: ["text"], cost: { unit: "1k_tok", est: 0 }, quota: "pool_50pct", device: "api", notes: "existing ai-gateway; free tier quota" },
  { id: "gemini-llm", status: "real", in: ["text", "image"], out: ["text"], cost: { unit: "1k_tok", est: 0 }, quota: "pool_50pct", device: "api", notes: "existing ai-gateway" },
  { id: "voice-eot", status: "planned", in: ["voice"], out: ["text"], cost: { unit: "sec", est: 0 }, quota: "free_local", device: "edge", notes: "ASR + end-of-turn detector" },
  { id: "tts", status: "planned", in: ["text"], out: ["voice"], cost: { unit: "sec", est: 0 }, quota: "free_local", device: "cpu" },
  { id: "image-gen", status: "planned", in: ["text", "image"], out: ["image"], cost: { unit: "image", est: 0 }, quota: "paid_approval", device: "gpu", embed: "clip_like_512" },
  { id: "music-gen", status: "planned", in: ["text"], out: ["music"], cost: { unit: "sec", est: 0 }, quota: "paid_approval", device: "gpu", embed: "clap_like_512" },
  { id: "video-gen", status: "planned", in: ["text", "image", "music"], out: ["video"], cost: { unit: "sec", est: 0 }, quota: "paid_approval", device: "gpu", embed: "video_512" },
  { id: "short-clipper", status: "planned", in: ["video"], out: ["short_video"], cost: { unit: "sec", est: 0 }, quota: "free_local", device: "cpu", notes: "cut / caption / 9:16 reframe" },
  { id: "3d-gen", status: "planned", in: ["text", "image"], out: ["3d"], cost: { unit: "asset", est: 0 }, quota: "paid_approval", device: "gpu" },
];
export const PIPELINES = {
  "script_music_video_short": ["text>text", "text>music", "text+music>video", "video>short_video"],
  "voice_answer": ["voice>text", "text>text", "text>voice"],
  "image_to_3d": ["text>image", "image>3d"],
};
export function validate(cap) {
  const e = []; for (const k of ["id", "status", "in", "out", "cost", "quota", "device"]) if (cap[k] == null) e.push("missing " + k);
  for (const m of [...(cap.in || []), ...(cap.out || [])]) if (!MODALITIES.includes(m)) e.push("bad modality " + m);
  if (cap.quota && !(cap.quota in QUOTA)) e.push("bad quota"); return e;
}
