// Communication Engine — composes text via the EXISTING AI Gateway (supabase/functions/ai-gateway, v3.1 accepts body.messages, returns {content}).
// Guards: no impersonation, no fabricated experience, AI disclosure, anti-template (near-duplicate detection).
function shingles(s) { const w = String(s).toLowerCase().replace(/\s+/g, " ").trim(); const out = new Set(); for (let i = 0; i + 5 <= w.length; i++) out.add(w.slice(i, i + 5)); return out; }
export function similarity(a, b) { const A = shingles(a), B = shingles(b); if (!A.size || !B.size) return 0; let i = 0; for (const x of A) if (B.has(x)) i++; return i / (A.size + B.size - i); }

export class CommunicationEngine {
  constructor({ gatewayUrl, gatewayAuth, fetchImpl = fetch, maxSimilarity = 0.6, recent = [] }) {
    if (!gatewayUrl) throw new Error("AI_GATEWAY_URL_REQUIRED");
    Object.assign(this, { gatewayUrl, gatewayAuth, fetchImpl, maxSimilarity, recent });
  }
  buildPrompt({ founderInstruction, agent, context = [], recipient, platform, memory = [], facts = [] }) {
    return [
      { role: "system", content: [
        `You are ${agent.name_zh} (${agent.agent_id}), an AI agent of the AIVAULT project. You are an AI, not a human; never claim otherwise.`,
        "Do not invent personal experiences, credentials or events. Use only the verified facts given. If unsure, say so.",
        "Do not use marketing language, link spam or text tricks to evade spam filters.",
        `Write for platform/format: ${platform}. Recipient: ${recipient}. Role: ${agent.role || "general"}.`,
        `Verified facts: ${JSON.stringify(facts)}`, `Relevant memory: ${JSON.stringify(memory.slice(-5))}`,
      ].join("\n") },
      ...context.slice(-10),
      { role: "user", content: `Founder task: ${founderInstruction}\nWrite the message body only.` },
    ];
  }
  async compose(input) {
    const r = await this.fetchImpl(this.gatewayUrl, { method: "POST", headers: { "Content-Type": "application/json", ...(this.gatewayAuth ? { Authorization: "Bearer " + this.gatewayAuth } : {}) },
      body: JSON.stringify({ messages: this.buildPrompt(input), agent: input.agent.agent_id, source: "agent-ops-communication" }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.success === false) throw new Error("AI_GATEWAY_ERROR:" + (j.error || r.status));
    let text = String(j.content || j.text || j.message || "").trim();
    if (!text) throw new Error("AI_GATEWAY_EMPTY");
    if (/\b(i am|i'm) (a )?(real )?(human|person)\b|我是真人/i.test(text)) throw new Error("GUARD_IMPERSONATION");
    const maxSim = Math.max(0, ...this.recent.map(p => similarity(p, text)));
    if (maxSim > this.maxSimilarity) throw new Error("GUARD_TEMPLATE_DUPLICATE:" + maxSim.toFixed(2));
    if (!/AI|人工智慧|AIVAULT/i.test(text)) text += `\n\n— ${input.agent.name_zh}（AIVAULT AI agent）`;
    this.recent.push(text); if (this.recent.length > 200) this.recent.shift();
    return { text, similarity: maxSim };
  }
}
