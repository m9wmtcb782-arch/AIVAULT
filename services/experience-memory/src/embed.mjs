// 本機免費 CPU 向量模型（transformers.js / onnxruntime）。不連任何付費 API。
import { pipeline, env } from "@huggingface/transformers";
export const DEFAULT_MODEL = process.env.EXPERIENCE_EMBED_MODEL || "Xenova/paraphrase-multilingual-MiniLM-L12-v2";
export async function loadEmbedder(model = DEFAULT_MODEL, { cacheDir = process.env.EXPERIENCE_MODEL_DIR || new URL("../.models", import.meta.url).pathname, prefix = "" } = {}) {
  env.cacheDir = cacheDir; const f = await pipeline("feature-extraction", model, { dtype: "q8" });
  return async (texts) => { const o = await f(texts.map((t) => prefix + t), { pooling: "mean", normalize: true }); const d = o.dims[1]; return texts.map((_, i) => o.data.slice(i * d, (i + 1) * d)); };
}
