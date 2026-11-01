// OpenClaw 外掛 'aivault'：佔用 memory 插槽，所以 OpenClaw 內建的每個 agent 個人記憶不會載入；
// memory_search / memory_get 改讀共同記憶。身分依 session key 動態載入（不建立 10 萬個 workspace）。
import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";
import { CommonMemory } from "../core/memory.mjs";
import { getIdentity, aiLabel } from "../core/pipeline.mjs";
const S = (props, req) => ({ type: "object", properties: props, required: req, additionalProperties: false });
const idFrom = (ctx) => { const k = String(ctx?.sessionKey || ctx?.session?.key || ""); const m = k.match(/aivault-id-([a-z0-9-]+)/i); return m ? getIdentity(m[1]) : null; };
export default definePluginEntry({
  id: "aivault", name: "AIVAULT", description: "AIVAULT common memory + identities",
  register(api) {
    const dir = api.pluginConfig?.stateDir || process.env.AIVAULT_STATE_DIR || "/workspace/oc-poc/services/openclaw-aivault/state";
    const mem = new CommonMemory(dir);
    api.registerTool({ name: "memory_search", description: "Search AIVAULT COMMON shared memory (verified correct + wrong lessons). No per-agent memory exists.",
      parameters: S({ query: { type: "string" } }, ["query"]),
      async execute(_id, p) { const r = mem.search(p.query); return { content: [{ type: "text", text: JSON.stringify(r) }], details: { results: r } }; } });
    api.registerTool({ name: "memory_get", description: "Get one common-memory entry by id.", parameters: S({ id: { type: "string" } }, ["id"]),
      async execute(_id, p) { const d = mem.load(); const e = [...d.correct, ...d.wrong].find((x) => x.id === p.id) || null; return { content: [{ type: "text", text: JSON.stringify(e) }], details: { entry: e } }; } });
    api.registerTool({ name: "aivault_whoami", description: "Return the AI identity of this session.", parameters: S({}, []),
      async execute(_id, _p, ctx) { const i = idFrom(ctx); return { content: [{ type: "text", text: JSON.stringify(i) }], details: { identity: i } }; } });
    api.on("before_prompt_build", async (_e, ctx) => {
      const i = idFrom(ctx); if (!i) return {};
      return { prependSystemContext: `AIVAULT_IDENTITY=${i.agent_code}\n你是 ${i.name}（${i.agent_code}，學歷 ${i.degree}，${i.role}），AIVAULT 的 AI，不是真人。只使用共同記憶${i.is_darkstar ? "與暗星單獨記憶" : ""}。所有輸出要標示為 AI。` };
    });
    api.on("message_sending", async (e, ctx) => { const i = idFrom(ctx); const c = e?.content ?? e?.text; if (!i || typeof c !== "string" || c.includes("【AI・")) return {}; return { content: `${aiLabel(i)}\n${c}` }; });
  },
});
