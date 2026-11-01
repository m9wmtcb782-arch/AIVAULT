// 多模態路由器：把 "輸入模態 > 輸出模態" 對到登錄表裡的模型。只做規劃（stub）。
// 規則：優先 real，再看 quota 等級（免費本機 > pool 50% > 需付費核准），planned 只標記不執行。
import { REGISTRY, PIPELINES, QUOTA } from "./registry.mjs";
export function route(step, { allowPlanned = true, maxQuota = "pool_50pct" } = {}) {
  const [ins, out] = step.split(">"); const need = ins.split("+");
  const c = REGISTRY.filter((m) => m.out.includes(out) && need.every((n) => m.in.includes(n)) && (allowPlanned || m.status === "real") && QUOTA[m.quota] <= QUOTA[maxQuota]);
  c.sort((a, b) => (a.status === "real" ? 0 : 1) - (b.status === "real" ? 0 : 1) || QUOTA[a.quota] - QUOTA[b.quota]);
  return c[0] ? { step, model: c[0].id, status: c[0].status, quota: c[0].quota } : { step, model: null, status: "blocked", reason: "no model within quota (needs approval)" };
}
export function plan(name, opts) {
  const steps = PIPELINES[name]; if (!steps) throw new Error("unknown pipeline " + name);
  const p = steps.map((s) => route(s, opts));
  return { pipeline: name, enabled: process.env.MULTIMODAL_ON === "1", executable: p.every((x) => x.status === "real"), steps: p };
}
export async function run(name, opts) { const p = plan(name, opts); if (!p.enabled || !p.executable) return { ...p, ran: false }; throw new Error("execution not implemented (design stage)"); }
