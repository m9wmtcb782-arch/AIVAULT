// OpenAI 相容的本機端點（只綁 127.0.0.1），讓 OpenClaw 的模型呼叫全部經過學徒管線。
import http from "node:http"; import { Pipeline } from "./pipeline.mjs";
const PORT = Number(process.env.AIVAULT_PIPELINE_PORT || 18899);
const pipe = new Pipeline({ stateDir: process.env.AIVAULT_STATE_DIR || new URL("../state", import.meta.url).pathname, quotaTotals: { groq: Number(process.env.AIVAULT_GROQ_DAILY || 100), gemini: 0 } });
const text = (c) => typeof c === "string" ? c : Array.isArray(c) ? c.map((p) => p.text || "").join("") : "";
http.createServer(async (req, res) => {
  if (req.method === "GET" && req.url.startsWith("/v1/models")) { res.setHeader("content-type", "application/json"); return res.end(JSON.stringify({ data: [{ id: "apprentice-v3", object: "model" }] })); }
  if (req.method === "GET" && req.url === "/stats") { res.setHeader("content-type", "application/json"); return res.end(JSON.stringify({ stats: pipe.stats, log: pipe.log })); }
  if (req.method !== "POST" || !req.url.startsWith("/v1/chat/completions")) { res.statusCode = 404; return res.end(); }
  let b = ""; for await (const c of req) b += c; const body = JSON.parse(b || "{}"); const msgs = body.messages || [];
  const sys = msgs.filter((m) => m.role === "system" || m.role === "developer").map((m) => text(m.content)).join("\n");
  const users = msgs.filter((m) => m.role === "user"); const lastUser = text(users.at(-1)?.content);
  const idm = (sys + "\n" + lastUser).match(/AIVAULT_IDENTITY=([A-Za-z0-9-]+)/);
  const tm = lastUser.match(/TASK:\s*(.+)$/m); const question = (tm ? tm[1] : lastUser).trim();
  const r = await pipe.run(idm?.[1], question); const content = r.text;
  const id = "chatcmpl-" + Date.now(), created = Math.floor(Date.now() / 1000);
  if (body.stream) {
    res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache" });
    res.write(`data: ${JSON.stringify({ id, object: "chat.completion.chunk", created, model: "apprentice-v3", choices: [{ index: 0, delta: { role: "assistant", content }, finish_reason: null }] })}\n\n`);
    res.write(`data: ${JSON.stringify({ id, object: "chat.completion.chunk", created, model: "apprentice-v3", choices: [{ index: 0, delta: {}, finish_reason: "stop" }], usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } })}\n\n`);
    return res.end("data: [DONE]\n\n");
  }
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify({ id, object: "chat.completion", created, model: "apprentice-v3", choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }], usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } }));
}).listen(PORT, "127.0.0.1", () => console.log(`aivault pipeline on 127.0.0.1:${PORT} (groq key present: ${pipe.hasRealGroq})`));
