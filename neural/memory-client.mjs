// 共同記憶 SDK。一般 AI（worker）：只讀 common、只能「提案」到 common（待驗證）；沒有個人記憶。
// 暗星（darkstar）：讀寫 common、擁有 darkstar_private、可驗證與撤銷 common。真正的權限由資料庫 RLS/函式強制（memory_scopes.sql），這裡只是提早擋。
export class MemoryClient {
  constructor({ role, agentId, rpc, select }) { if (!["worker", "darkstar", "founder"].includes(role)) throw new Error("BAD_ROLE"); Object.assign(this, { role, agentId, rpc, select }); }
  async read({ task_type, scope = "common" } = {}) { if (scope === "darkstar_private" && this.role === "worker") throw new Error("PRIVATE_SCOPE_DARKSTAR_ONLY"); return this.select("aivault_memory_active", { scope, task_type }); }
  async propose({ scope = "common", bank, task_type, signature = null, question = null, answer, evidence }) {
    if (scope === "darkstar_private" && this.role === "worker") throw new Error("PRIVATE_SCOPE_DARKSTAR_ONLY");
    if (!evidence || !("test_passed" in evidence || "agreement" in evidence)) throw new Error("EVIDENCE_REQUIRED");
    return this.rpc("aivault_memory_propose", { p_scope: scope, p_bank: bank, p_task: task_type, p_sig: signature, p_q: question, p_answer: answer, p_evidence: evidence, p_by: this.agentId }); }
  async verify(id, verification) { if (this.role === "worker") throw new Error("VERIFY_DARKSTAR_OR_FOUNDER_ONLY"); return this.rpc("aivault_memory_verify", { p_id: id, p_verifier: this.agentId, p_verification: verification }); }
  async revoke(id, reason) { if (this.role === "worker") throw new Error("REVOKE_DARKSTAR_OR_FOUNDER_ONLY"); return this.rpc("aivault_memory_revoke", { p_id: id, p_by: this.agentId, p_reason: reason }); }
  // worker 沒有個人記憶：任何「記住」都只能是 common 提案
  rememberPrivately() { if (this.role !== "darkstar") throw new Error("WORKERS_HAVE_NO_INDIVIDUAL_MEMORY"); }
}
