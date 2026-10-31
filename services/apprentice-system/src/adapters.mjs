// v3 介面層：只「接」現有引擎，不改任何線上程式碼。全部預設 stub / 唯讀；APPRENTICE_V3_ON 未開時 orchestrator 不會被任何線上流程呼叫。
// 現有引擎盤點（main @ inventory 時）：
//  - AI Gateway v3.1  supabase/functions/ai-gateway（Gemini/Groq/Grok、failover、cooldown、paid_gate、aivault_gateway_quota_events）
//  - 額度守門 50%     services/pool-learning/src/quota-guard.mjs（fail-closed）
//  - ANCN 協作網路     migration 20261018130000_aivault_ancn.sql（skills / edges / activations；權重只由已驗證結果更新）
//  - 學歷 / 實驗工廠   dark-star-ebook-ingest/degree.ts、lab.ts、agent-lab.yml（無網路容器跑測試）
//  - 因果引擎 v0       dark-star-ebook-ingest/causal*.{ts,mjs}（CAUSAL_ENGINE_ON）
//  - 經驗記憶 v1/v2     services/experience-memory（雙庫、MiniLM、簽章、閘門、權重、疼痛反射）
//  - EOT v1 ONNX       models/eot（58,689 參數，語音結束偵測；不是推理模型，只用於語音輪替）
//  - Qwen3-0.6B        只有瀏覽器端測試頁 aivault-qwen3-0.6b-test.html；伺服器端沒有推論 → 這裡是 stub
//  - 算力池            supabase/functions/aivault-compute-coordinator（nn-infer-verify；可把學徒推論分派到裝置）
//  - 認知模型表         aivault_agent_cognitive_models（只讀，用於人和情境）
//  - 治理              ai-gateway 的 paid_gate（付費一律需批准）＋ AIVAULT-EMPIRE-CHARTER.md
export { LocalQuotaLedger, SupabaseQuotaGuard, decide } from "../../pool-learning/src/quota-guard.mjs";
export const stubs = {
  // 學徒：Qwen3-0.6B（本機/算力池）。未接線 → 回 null，讓 orchestrator 直接走記憶或升級。
  apprentice: async () => null,
  // 師父：經 AI Gateway 呼叫。v3 不實作真實呼叫。
  master: { groq: async () => { throw new Error("MASTER_NOT_CONFIGURED"); }, gemini: async () => { throw new Error("MASTER_NOT_CONFIGURED"); } },
  // 驗證：lab 的無網路測試容器；ANCN verify 邊。未接線 → unknown。
  verify: async () => ({ verdict: "unknown", conf: 0 }),
  // 情境（天時地利人和）：ANCN 技能、認知模型表（唯讀）。
  context: async (task) => ({ task_type: task.task_type, district: task.district || null, model: task.model || null, hour: new Date().getHours() }),
  // EOT：只用於語音輪替，與推理無關；保留介面以免誤用。
  eot: { purpose: "voice end-of-turn only (not reasoning)" },
};
