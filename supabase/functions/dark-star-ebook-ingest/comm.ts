// cm2：6 代理小遊戲驗收（真的用模型推理；傳輸層本身不呼叫模型）。
// 證據分四層：①DB 已送達（deliveries.queued）②代理執行時租到（leased, run_id）③模型回覆中逐則寫出「理解摘要」才標 read，回覆帶 reply_to/correlation ④作品在無網路容器測試通過、由非作者的整合者接受合併（merge accepted, test_result 來自執行器，不是代理自稱）。
// 關閉：aivault_floor_state comm:off；額度睡眠時 callModel 直接拒絕，不浪費。
import { callModel } from "./floor.ts";
import { memContext } from "./mem.ts";
const URL0 = Deno.env.get("SUPABASE_URL") || "", SR = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const SRH = { apikey: SR, Authorization: "Bearer " + SR, "Content-Type": "application/json" };
async function rest(path: string, init: RequestInit = {}) { const r = await fetch(URL0 + "/rest/v1/" + path, { ...init, headers: { ...SRH, Prefer: "return=representation", ...(init.headers || {}) } }); const t = await r.text(); if (!r.ok) throw new Error("DB " + r.status + " " + t.slice(0, 200)); return t ? JSON.parse(t) : null; }
const rpc = (f: string, a: any) => rest("rpc/" + f, { method: "POST", body: JSON.stringify(a) });
const tok = (u: any) => Number(u?.total) || 0;
export const ROLES = [
  { role: "planner", sandbox: "reason", file: "plan.md", job: "企劃：把遊戲拆成檔案與介面，指派給其他人（delegate），回答問題、追進度。" },
  { role: "coder", sandbox: "game", file: "game.js", job: "遊戲程式：寫 game.js，純邏輯 createGame(opts) 回傳 {state, step(dt), input(key), score, over}，可在 Node 載入（module.exports）。" },
  { role: "artist", sandbox: "3d", file: "assets.js", job: "美術資產：寫 assets.js，用程式資料描述角色與物件（顏色、尺寸、像素圖陣列），module.exports = { sprites, palette }。" },
  { role: "sound", sandbox: "music", file: "sound.js", job: "音效：寫 sound.js，module.exports = { sfx }，每個音效是 [{freq, ms, type}] 陣列，另附 play(ctx, name) 用 WebAudio 播放（Node 測試時不會呼叫 play）。" },
  { role: "tester", sandbox: "security", file: "test.js", job: "測試：只依企劃與 API 寫 test.js（node:test），require 各檔並測需求；測試失敗時發 test_failed／fix_request 給負責人。" },
  { role: "integrator", sandbox: "collab", file: "index.html", job: "整合與驗收：寫 index.html 把 game.js/assets.js/sound.js 接成可玩頁面；審核大家的合併提案，只有執行器測試通過才能 accept，否則回 fix_request。" },
];
const GOAL = "做一個可玩的小遊戲「接雪花 Snow Catcher」：玩家左右移動籃子接住落下的雪花（+1 分），漏接 3 片結束；方向鍵／觸控按鈕操作；有接到與失敗的音效；畫面用 assets.js 的像素圖。全部純 JavaScript、無外部資源。";
async function pick(sandbox: string, not: string[]) {
  const r = await rest(`aivault_comm_skills?sandbox=eq.${sandbox}&state=neq.RETIRED&select=agent_id,tier,level,lab_passed&order=tier.desc.nullslast,level.desc.nullslast&limit=12`);
  const c = r.filter((x: any) => !not.includes(x.agent_id)); return (c[0] || {}).agent_id;
}
export async function commGameStart() {
  const id = "game-" + new Date().toISOString().slice(0, 16).replace(/\D/g, ""); const team: any[] = []; const used: string[] = [];
  for (const R of ROLES) { const a = await pick(R.sandbox, used); if (!a) return { ok: false, error: "no agent for " + R.sandbox }; used.push(a); team.push({ ...R, agent: a }); }
  await rest("aivault_comm_projects", { method: "POST", body: JSON.stringify({ id, title: "Snow Catcher 小遊戲（6 代理驗收）", owner_agent: team[0].agent, max_turns: 300 }) });
  await rest("aivault_comm_groups", { method: "POST", body: JSON.stringify({ id: id + "-g", project_id: id, created_by: team[0].agent }) });
  await rest("aivault_comm_group_members", { method: "POST", body: JSON.stringify(team.map((t) => ({ group_id: id + "-g", agent_id: t.agent, role: t.role }))) });
  await rest("aivault_comm_memory", { method: "POST", body: JSON.stringify({ project_id: id, agent_id: "system", note: JSON.stringify({ goal: GOAL, team: team.map((t) => ({ role: t.role, agent: t.agent, file: t.file })) }) }) });
  const k = await rpc("aivault_comm_send", { p_sender: "system", p_kind: "dm", p_recipient: team[0].agent, p_type: "handoff", p_payload: { text: "新專案交接給企劃", goal: GOAL, context: "團隊：" + team.map((t) => `${t.role}=${t.agent}（${t.file}）`).join("、") + "；交接協定見知識庫「交接協定 handoff v1」", owned_scope: "plan.md（你的分支）；拆工並用 handoff 交給每位隊友", forbidden_scope: "不得直接寫 main、不得寫別人的檔案、不得核准合併", constraints: "free-only（只用免費資源）；no privilege escalation（不得提升權限）；不得自我核准；不得造假", success_criteria: "每位隊友收到一張 handoff 並 accept；最後 game.js/assets.js/sound.js/test.js/index.html 都經容器測試通過並由整合者合併", report_format: "report: done/missing/changes/tests/failures/cost/commits" }, p_project: id, p_task: null, p_correlation: null, p_reply_to: null, p_dedupe: id + "-kickoff" });
  return { ok: true, project: id, team: team.map((t) => ({ role: t.role, agent: t.agent })), kickoff: k };
}
async function teamOf(p: string): Promise<any[]> { const m = await rest(`aivault_comm_group_members?group_id=eq.${p}-g&select=agent_id,role`); return m.map((x: any) => ({ ...ROLES.find((r) => r.role === x.role)!, agent: x.agent_id })); }
async function mainFiles(p: string) { const f = await rest(`aivault_comm_files?project_id=eq.${p}&select=path,branch,version,author,content&order=version.desc`); const main: Record<string, any> = {}, br: Record<string, any> = {};
  for (const x of f) { if (x.branch === "main") { if (!main[x.path]) main[x.path] = x; } else { const k = x.branch + ":" + x.path; if (!br[k]) br[k] = x; } } return { main, br }; }
// 一回合：每位代理租信；沒信就跳過（不花 token）；有信才呼叫模型
export async function commGameTurn(b: any) {
  const p = String(b.project || ""); const team = await teamOf(p); if (!team.length) return { ok: false, error: "no project" };
  const out: any[] = []; let tokens = 0;
  for (const T of team) {
    const run = `${p}:${T.role}:${Date.now()}`; const L = (await rpc("aivault_comm_lease", { p_agent: T.agent, p_run: run, p_limit: 8, p_lease_s: 300 })) as any[];
    const merges = T.role === "integrator" ? await rest(`aivault_comm_merges?project_id=eq.${p}&status=eq.proposed&test_result=not.is.null&select=id,path,branch,version,proposer,test_result`) : [];
    if (!L.length && !merges.length) { out.push({ role: T.role, skipped: "no mail" }); continue; }
    const { main, br } = await mainFiles(p); const mine = br[T.agent + ":" + T.file];
    const [pa] = await rest(`aivault_pool_agents?id=eq.${T.agent}&select=name,persona`);
    const sys = `${pa?.persona || ""}\n你是 AIVAULT 代理 ${pa?.name || T.agent}（${T.agent}），在 6 人專案擔任 ${T.role}。${T.job}\n專案目標：${GOAL}\n隊友：${team.map((t) => `${t.role}=${t.agent}`).join("、")}。直接傳訊給負責的人（不必經暗星）。不能改權限、不能自己核准自己的合併。\n【交接協定 handoff v1，全體必用】交辦工作用 type=handoff，fields 必填 goal、context、owned_scope、forbidden_scope、constraints（要寫明 free-only 與 no privilege escalation）、success_criteria、report_format；收到 handoff 要 reply_to 它回 accept 或 reject（附理由）；做完（合併被接受後）reply_to 原 handoff 回 type=report，fields 必填 done、missing、changes、tests、failures、cost、commits，沒做到的寫 missing，不能造假。`;
    const ctx = `收到的訊息：\n${L.map((m: any) => `#${m.id} 來自 ${m.sender}［${m.message_type}］：${JSON.stringify(m.payload).slice(0, 1500)}`).join("\n") || "（無）"}\n\nmain 分支目前檔案：${Object.values(main).map((f: any) => `${f.path} v${f.version}（${f.author}）`).join("、") || "（空）"}\n${Object.values(main).filter((f: any) => f.path !== T.file).map((f: any) => `--- ${f.path} ---\n${String(f.content).slice(0, 2500)}`).join("\n")}\n你自己的分支 ${T.file}：${mine ? "v" + mine.version + "\n" + String(mine.content).slice(0, 3000) : "（還沒寫）"}\n${merges.length ? "待你驗收的合併（測試由無網路容器執行，結果不可更改）：\n" + merges.map((m: any) => `merge#${m.id} ${m.path} by ${m.proposer} → ${m.test_result.pass ? "✅ 通過" : "❌ 失敗"} ${String(m.test_result.output || "").slice(-600)}`).join("\n") : ""}`;
    const ask = `\n\n只輸出 JSON：{"understood":[{"message_id":數字,"summary":"用你自己的話寫這則訊息要你做什麼"}],"replies":[{"reply_to":數字或null,"to":"代理 id 或 group","type":"handoff|report|accept|reject|progress|deliver|help_request|test_failed|fix_request|info","text":"內容","fields":{handoff 或 report 的必填欄位，其他類型可省略}}],"file":{"path":"${T.file}","content":"完整檔案內容"}或null,"propose":true或false,"decisions":[{"merge_id":數字,"accept":true或false,"reason":"…"}],"memory":"一句協作筆記"}`;
    const memt = await memContext(T.agent, T.file + " " + L.map((m: any) => String(m.payload?.text || m.payload?.goal || "").slice(0, 80)).join(" "));
    let c: any; try { c = await callModel(sys, ctx + memt + ask, 7000); } catch (e) { for (const m of L) await rpc("aivault_comm_ack", { p_agent: T.agent, p_message: m.id, p_status: "failed", p_run: run, p_evidence: { error: String((e as any)?.message || e).slice(0, 200) } }); out.push({ role: T.role, error: String((e as any)?.message || e).slice(0, 120) }); if (/429/.test(String(e))) break; continue; }
    tokens += tok(c.usage); const v = c.v || {}; const rec: any = { role: T.role, agent: T.agent, model: c.model, tokens: tok(c.usage), leased: L.map((m: any) => m.id), read: [], sent: [], errors: [] };
    for (const u of v.understood || []) if (L.some((m: any) => m.id === Number(u.message_id)) && String(u.summary || "").length >= 8) { const a = await rpc("aivault_comm_ack", { p_agent: T.agent, p_message: Number(u.message_id), p_status: "read", p_run: run, p_evidence: null }); if (a?.ok) { rec.read.push(Number(u.message_id)); await rest("aivault_comm_memory", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ project_id: p, agent_id: T.agent, note: "理解 #" + u.message_id + "：" + String(u.summary).slice(0, 400), ref_message: Number(u.message_id) }) }); } }
    if (v.file?.content && v.file.path === T.file) { const s = await rpc("aivault_comm_save", { p_project: p, p_agent: T.agent, p_path: T.file, p_content: String(v.file.content) }); rec.saved = s; if (v.propose && s?.ok) { const pr = await rpc("aivault_comm_propose", { p_project: p, p_agent: T.agent, p_path: T.file, p_version: s.version }); rec.proposed = pr; } }
    for (const d of v.decisions || []) { const g = merges.find((m: any) => m.id === Number(d.merge_id)); if (!g) continue; const r = await rpc("aivault_comm_decide", { p_merge: g.id, p_acceptor: T.agent, p_accept: !!d.accept, p_test: g.test_result }); rec.decisions = [...(rec.decisions || []), { merge: g.id, ...r }];
      await rpc("aivault_comm_send", { p_sender: T.agent, p_kind: "dm", p_recipient: g.proposer, p_type: r?.status === "accepted" ? "accepted" : "fix_request", p_payload: { text: String(d.reason || "").slice(0, 800) + (r?.status === "accepted" ? "\n（已合併：請 reply_to 你收到的 handoff 回 report）" : ""), merge_id: g.id, result: r }, p_project: p, p_task: null, p_correlation: p + "-merge-" + g.id, p_reply_to: null, p_dedupe: p + "-decide-" + g.id }); }
    for (const r of (v.replies || []).slice(0, 6)) { const grp = r.to === "group" || !team.some((t) => t.agent === r.to); const rt = L.some((m: any) => m.id === Number(r.reply_to)) ? Number(r.reply_to) : null;
      const s = await rpc("aivault_comm_send", { p_sender: T.agent, p_kind: grp ? "group" : "dm", p_recipient: grp ? p + "-g" : r.to, p_type: ["handoff", "report", "accept", "reject", "progress", "deliver", "help_request", "delegate", "test_failed", "fix_request", "accepted", "info"].includes(r.type) ? r.type : "info", p_payload: { ...(r.fields && typeof r.fields === "object" ? Object.fromEntries(Object.entries(r.fields).map(([k, x]) => [k, typeof x === "string" ? x.slice(0, 1500) : JSON.stringify(x).slice(0, 1500)])) : {}), text: String(r.text || "").slice(0, 2000) }, p_project: p, p_task: null, p_correlation: null, p_reply_to: rt, p_dedupe: null }).catch((e: any) => ({ ok: false, error: String(e?.message || e).slice(0, 160) }));
      if (s?.ok) rec.sent.push(s.id); else rec.errors.push(s?.error); }
    for (const m of L) if (!rec.read.includes(m.id)) await rpc("aivault_comm_ack", { p_agent: T.agent, p_message: m.id, p_status: "failed", p_run: run, p_evidence: { error: "model did not summarize" } });
    if (v.memory) await rest("aivault_comm_memory", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ project_id: p, agent_id: T.agent, note: String(v.memory).slice(0, 500) }) });
    out.push(rec);
  }
  const { main } = await mainFiles(p); const need = ROLES.filter((r) => r.role !== "planner").map((r) => r.file);
  return { ok: true, tokens, agents: out, main: Object.keys(main), complete: need.every((f) => main[f]) };
}
// 執行器要測的合併：組合 main 檔＋提案檔，test.js 取（提案本身／main／測試員分支最新）
export async function commPendingTests(b: any) {
  const p = String(b.project || ""); const ms = await rest(`aivault_comm_merges?project_id=eq.${p}&status=eq.proposed&test_result=is.null&select=id,path,branch,version`); const { main, br } = await mainFiles(p); const team = await teamOf(p); const tester = team.find((t) => t.role === "tester")?.agent;
  const jobs = []; for (const m of ms) { const [f] = await rest(`aivault_comm_files?project_id=eq.${p}&path=eq.${encodeURIComponent(m.path)}&branch=eq.${m.branch}&version=eq.${m.version}&select=content`);
    const files: Record<string, string> = {}; for (const k in main) files[k] = main[k].content; files[m.path] = f.content; if (!files["test.js"] && br[tester + ":test.js"]) files["test.js"] = br[tester + ":test.js"].content;
    jobs.push({ merge_id: m.id, files }); } return { ok: true, jobs };
}
export async function commTestResult(b: any) { const t = { pass: !!b.pass, tests: b.tests || null, exit: b.exit ?? null, output: String(b.output || "").slice(-3000), by: "lab-runner", at: new Date().toISOString() };
  await rest(`aivault_comm_merges?id=eq.${Number(b.merge_id)}&status=eq.proposed`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ test_result: t }) });
  const [g] = await rest(`aivault_comm_merges?id=eq.${Number(b.merge_id)}&select=project_id,proposer`); const [in_] = await rest(`aivault_comm_group_members?group_id=eq.${g.project_id}-g&role=eq.integrator&select=agent_id`);
  await rpc("aivault_comm_send", { p_sender: "system", p_kind: "dm", p_recipient: in_.agent_id, p_type: t.pass ? "deliver" : "test_failed", p_payload: { text: `merge#${b.merge_id} 由 ${g.proposer} 提出，容器測試 ${t.pass ? "通過" : "失敗"}`, merge_id: Number(b.merge_id) }, p_project: g.project_id, p_task: null, p_correlation: g.project_id + "-merge-" + b.merge_id, p_reply_to: null, p_dedupe: g.project_id + "-tr-" + b.merge_id });
  if (!t.pass) await rpc("aivault_comm_send", { p_sender: "system", p_kind: "dm", p_recipient: g.proposer, p_type: "test_failed", p_payload: { text: "你的合併提案沒通過容器測試：\n" + t.output.slice(-1200), merge_id: Number(b.merge_id) }, p_project: g.project_id, p_task: null, p_correlation: g.project_id + "-merge-" + b.merge_id, p_reply_to: null, p_dedupe: g.project_id + "-tf-" + b.merge_id });
  return { ok: true };
}
// 公開證據（不含金鑰）：每則訊息四層狀態
export async function commPublic(b: any) {
  const ps = await rest("aivault_comm_projects?select=id,title,status,turns,created_at&order=created_at.desc&limit=10"); const p = String(b.project || ps.find((x: any) => x.id.startsWith("game-"))?.id || ps[0]?.id || "");
  if (!p) return { ok: true, projects: ps };
  const [msgs, dl, merges, files, mem, team] = await Promise.all([rest(`aivault_comm_messages?project_id=eq.${p}&select=id,sender,recipient_kind,recipient,message_type,payload,correlation_id,reply_to,hop,delivery_status,created_at&order=id&limit=400`), rest(`aivault_comm_deliveries?message_id=in.(select id from aivault_comm_messages where project_id='${p}')&select=*`).catch(() => []),
    rest(`aivault_comm_merges?project_id=eq.${p}&select=*&order=id`), rest(`aivault_comm_files?project_id=eq.${p}&select=path,branch,version,author,sha256,created_at${b.files ? ",content" : ""}&order=created_at`), rest(`aivault_comm_memory?project_id=eq.${p}&select=agent_id,note,ref_message,created_at&order=id&limit=200`), rest(`aivault_comm_group_members?group_id=eq.${p}-g&select=agent_id,role`)]);
  const ids = msgs.map((m: any) => m.id); const dd = ids.length ? await rest(`aivault_comm_deliveries?message_id=in.(${ids.join(",")})&select=message_id,agent_id,status,attempts,run_id,delivered_at,leased_at,read_at,replied_at,done_at`) : [];
  const handoffs = await rest(`aivault_comm_handoffs?project_id=eq.${p}&select=*&order=handoff_id`).catch(() => []);
  return { ok: true, project: p, projects: ps, team, messages: msgs, deliveries: dd, merges, files, memory: mem, handoffs };
}
