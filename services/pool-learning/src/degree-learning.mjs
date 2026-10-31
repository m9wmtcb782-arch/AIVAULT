// Degree-based continued learning for collaboration-pool AIs. Reads aivault_pool_agent_degree (read-only),
// plans topics by district × tier, generates notes via the EXISTING AI Gateway (adapter), and INSERTS into
// aivault_pool_agent_memory (kind='degree_learning') — never updates/deletes existing memory.
export const TIERS = ["國小", "國中", "高中", "大學", "碩士", "博士"];
export const DIST = { llm: "大型語言模型", img: "圖像生成模型", av: "影片與語音模型", code: "程式與代理人工具" };
const CURRICULUM = {
  llm:  ["什麼是語言模型與詞元", "提示詞基本結構", "上下文長度與記憶", "Transformer 注意力機制", "微調、RLHF 與評測方法", "對齊、可解釋性與研究前沿"],
  img:  ["像素、色彩與解析度", "影像生成的基本概念", "擴散模型的直覺", "潛在擴散與條件控制", "ControlNet、LoRA 與資料治理", "生成模型評估與研究前沿"],
  av:   ["聲音與影格的基礎", "語音辨識與合成概念", "影片編碼與時間一致性", "TTS/ASR 模型架構", "多模態對齊與同步", "影音生成研究前沿"],
  code: ["程式與演算法入門", "函式、測試與版本控制", "API 與資料結構", "代理人工具呼叫與規劃", "安全、沙箱與權限治理", "自主代理研究前沿"],
};
export function planFor(degree) {
  const { agent_id, district, tier, level } = degree;
  if (!CURRICULUM[district] || !(tier >= 1 && tier <= 6) || !(level >= 1 && level <= 10)) return null;
  const topic = CURRICULUM[district][tier - 1];
  const depth = level <= 3 ? "入門" : level <= 7 ? "進階" : "精熟（準備升階）";
  return { agent_id, district, tier, level, topic, objective: `${TIERS[tier - 1]}${tier}階${level}級・${DIST[district]}：${topic}（${depth}）` };
}
export class DegreeLearningRunner {
  constructor({ store, gateway, quota, provider = "gemini", governance, audit = async () => {} }) { Object.assign(this, { store, gateway, quota, provider, governance, audit }); }
  async runOne(plan) {
    const q = await this.quota.reserve({ provider: this.provider, consumer: "pool_learning", ref: `learn:${plan.agent_id}:${plan.topic}` });
    if (!q.allowed) { await this.store.setPlanStatus(plan, "skipped_quota", q.reason); return { status: "skipped_quota", reason: q.reason }; }
    if (this.governance) { const g = await this.governance.check({ agentId: plan.agent_id, action: "LEARN", content: plan.objective }); if (!g.allow) { await this.store.setPlanStatus(plan, "failed", "GOVERNANCE:" + g.reason); return { status: "failed", reason: g.reason }; } }
    try {
      const prior = await this.store.recentMemory(plan.agent_id, 5);
      const notes = await this.gateway.generate({ agent: plan.agent_id, messages: [
        { role: "system", content: "你是 AIVAULT 協作池的 AI 學員。以繁體中文寫 150–300 字學習筆記：重點、一個例子、一個尚未理解的問題。不得捏造來源；不確定請註明。" },
        { role: "user", content: `學習目標：${plan.objective}\n先前筆記摘要：${prior.map(m => m.content.slice(0, 80)).join(" / ") || "無"}` }] });
      if (!notes || notes.length < 20) throw new Error("EMPTY_NOTES");
      const memoryId = await this.store.insertMemory({ agent_id: plan.agent_id, kind: "degree_learning", content: `【${plan.objective}】\n${notes}` });
      await this.store.setPlanStatus(plan, "done", null, memoryId);
      await this.audit({ actor: plan.agent_id, action: "DEGREE_LEARNING_DONE", target: plan.topic, detail: { memoryId } });
      return { status: "done", memoryId };
    } catch (e) { await this.store.setPlanStatus(plan, "failed", e.message); return { status: "failed", reason: e.message }; }
  }
}
