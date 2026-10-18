// lb1：AI 實驗工廠。程式與代理區學階最高的 AI 寫程式，較低學階的 AI 只看規格寫測試；程式在 GitHub Actions 的無網路、無密鑰容器裡真的執行測試；
// 失敗把錯誤回饋給寫程式的 AI 修正，最多 LAB_MAX_ITER 次。所有程式、測試輸出、通過與否、token、代理 id 都存真實紀錄。成功才送 🟡 作品審核，不會自動上線。
// 關閉：函式 env LAB_OFF=1；每日上限 LAB_DAILY（預設 4）
import { callModel } from "./floor.ts";
const URL0 = Deno.env.get("SUPABASE_URL") || "", SR = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const SRH = { apikey: SR, Authorization: "Bearer " + SR, "Content-Type": "application/json" };
async function rest(path: string, init: RequestInit = {}) { const r = await fetch(URL0 + "/rest/v1/" + path, { ...init, headers: { ...SRH, Prefer: "return=representation", ...(init.headers || {}) } }); const t = await r.text(); if (!r.ok) throw new Error("DB " + r.status + " " + t.slice(0, 200)); return t ? JSON.parse(t) : null; }
const MAX_ITER = () => Math.max(1, Math.min(5, Number(Deno.env.get("LAB_MAX_ITER")) || 3));
export const BRIEFS = [
  { kind: "小工具", title: "能量式語音活動偵測（VAD）", spec: "函式 vad(frames, opts) ：frames 是數字陣列的陣列（每個 frame 是 PCM 取樣 -1~1），計算每個 frame 的 RMS；連續 opts.startFrames（預設 3）個 frame RMS ≥ opts.threshold（預設 0.02）判定開始說話，連續 opts.endFrames（預設 8）個低於門檻判定結束；回傳 [{start, end}]（frame 索引，end 含）；結尾仍在說話時 end 為最後一個 frame。函式 rms(frame)。demo：用滑桿產生模擬音量序列並顯示偵測區段（不使用麥克風）。" },
  { kind: "小工具", title: "插話（barge-in）狀態機", spec: "函式 createTurn() 回傳物件，有 state（'idle'|'listening'|'thinking'|'speaking'）與 event(name) 方法：idle+userStart→listening；listening+userEnd→thinking；thinking+replyStart→speaking；speaking+replyEnd→idle；speaking+userStart→listening 並把 interrupted 計數 +1（barge-in）；其他不合法事件不改變狀態並回傳 false，合法回傳 true。另有 history 陣列記錄每次轉換 [from,to,event]。demo：按鈕觸發事件並顯示狀態。" },
  { kind: "資料處理", title: "中文 TTS 文字正規化", spec: "函式 normalize(text) 把中文句子裡的阿拉伯數字、日期（2026/10/18 → 二〇二六年十月十八日）、百分比（35% → 百分之三十五）、金額（NT$120 → 新台幣一百二十元）、時間（14:05 → 十四點零五分）轉成國語讀法，其他文字不變；整數規則：0–9999 用「零一二…千百十」（10 → 十、105 → 一百零五）。" },
  { kind: "小工具", title: "中文停頓／韻律預測器", spec: "函式 pauses(text) 依標點預測停頓並回傳陣列 [{index, ms}]：句號／問號／驚嘆號 500ms、分號 350ms、逗號／頓號 200ms、冒號 250ms；連續標點只算最大的一個；結尾標點也要列出；index 是標點在字串中的位置。函式 split(text, maxLen) 把文字在標點處切成每段不超過 maxLen 字的片段（給串流 TTS 用），不能切斷在字中間，除非單句超過 maxLen。" },
  { kind: "小工具", title: "台灣身分證字號檢查器", spec: "函式 checkTwId(id) 回傳 {valid:boolean, reason:string}，依官方檢查碼規則驗證（第一碼英文字母、第二碼 1/2/8/9、共 10 碼）。demo：輸入框即時顯示是否有效。" },
  { kind: "小遊戲", title: "井字遊戲勝負判定", spec: "函式 winner(board) ，board 是長度 9 的陣列（'X'、'O' 或 null），回傳 'X'、'O'、'draw'（滿盤無人勝）或 null（未結束）。demo：可以點格子玩的 3×3 井字遊戲。" },
  { kind: "資料處理", title: "CSV 解析與欄位統計", spec: "函式 parseCsv(text) 回傳二維陣列，支援雙引號包住的欄位、欄位內逗號與 \"\" 跳脫；函式 columnStats(rows, colIndex) 回傳 {count, sum, mean, min, max}（只計算可轉成數字的值）。demo：貼上 CSV 顯示表格與第 2 欄統計。" },
  { kind: "網頁元件", title: "番茄鐘時間格式化", spec: "函式 fmt(seconds) 回傳 'MM:SS'（補零，超過 60 分鐘用 'H:MM:SS'）；函式 nextPhase(phase, count) 依番茄鐘規則回傳下一階段 {phase:'work'|'short'|'long', minutes}（每 4 個工作後長休息 15 分、其他短休息 5 分、工作 25 分）。demo：可開始／暫停的番茄鐘。" },
  { kind: "小工具", title: "密碼強度評分", spec: "函式 score(pw) 回傳 0–4 的整數與 tips 陣列：長度≥8 +1、≥12 再 +1、同時有大小寫 +1、有數字與符號 +1，最多 4；空字串回 0。demo：輸入密碼顯示強度條（不送出任何資料）。" },
  { kind: "資料處理", title: "羅馬數字互轉", spec: "函式 toRoman(n)（1–3999，超出丟 RangeError）與 fromRoman(s)（不合法丟 Error）。demo：雙向轉換輸入框。" },
];
const PROD_RULES = `程式規則：product.js 是純 JavaScript（不能用 require/import、不能用網路、不能讀檔），所有函式放在全域，檔尾加上：if (typeof module !== "undefined") module.exports = { 函式名… };。demo.html 是完整單檔 HTML（含 CSS），用 <!--PRODUCT--> 這一行標示要插入 product.js 的位置（之後會換成 <script>），不得載入任何外部資源。`;
// city1：3D 沙盒規則：product.js 匯出 build(THREE) 回傳 THREE.Object3D／Scene（只用 three.js 內建幾何與材質），執行器用 GLTFExporter 轉成 GLB，再用 Khronos glTF-Validator 檢查。
const RULES_3D = `程式規則：product.js 是純 JavaScript，只定義 function build(THREE) { … return scene; }，用 THREE 內建幾何（Box/Sphere/Cylinder/Cone/Plane…）與 MeshStandardMaterial 組出場景，不能 require/import、不能用網路、不能用貼圖檔或 canvas；檔尾加上：if (typeof module !== "undefined") module.exports = { build };。demo_html 給空字串即可（展示由頁面用 GLB 產生）。`;
export const RULES = (sb?: string) => sb === "3d" ? RULES_3D : PROD_RULES;
export const SB_BRIEFS: Record<string, any[]> = {
  game: [
    { kind: "小遊戲", title: "貪食蛇核心邏輯", spec: "函式 createGame(w,h) 回傳物件：snake（陣列，頭在 [0]，初始長度 3、位於中央、向右）、dir、food、score、over；step() 前進一格，吃到食物長度 +1、score +1 並在空格重生食物（用 game.rng()，預設 Math.random），撞牆或撞自己 over=true 且之後 step 不再改變；turn(d) 改方向（'up'|'down'|'left'|'right'），不能直接反向。demo：方向鍵／按鈕可玩的貪食蛇。" },
    { kind: "小遊戲", title: "2048 合併規則", spec: "函式 move(board, dir) ：board 是 4×4 數字陣列（0 為空），dir 為 'left'|'right'|'up'|'down'，回傳 {board, gained, moved}；同列相同數字合併一次（[2,2,2,2] 向左 → [4,4,0,0]，gained=8），沒移動時 moved=false。函式 hasMoves(board)。demo：可用方向鍵玩的 2048（新方塊用 Math.random）。" },
  ],
  "3d": [
    { kind: "3D", title: "冰原小屋", spec: "build(THREE) 回傳一個 Scene，至少包含：地面（Plane 或扁 Box）、一棟小屋（牆＋屋頂）、門、2 棵雪松（Cone＋Cylinder），每個 Mesh 有 name；總 Mesh 數 6–40；全部在原點附近 20 單位內。" },
    { kind: "3D", title: "能源核心塔", spec: "build(THREE) 回傳一個 Scene：中央發光柱（Cylinder，材質 emissive 非黑）、底座、環繞的 3 個圓環（Torus），以及 4 根支柱；每個 Mesh 有 name；總 Mesh 數 8–40；高度不超過 15 單位。" },
  ],
};
async function pickSandbox(sb: string) {
  const [box] = await rest(`aivault_sandboxes?key=eq.${sb}&select=lo,hi`); if (!box) return null; const ids = []; for (let i = box.lo; i <= box.hi; i++) ids.push("ag-" + String(i).padStart(4, "0"));
  const dg = await rest(`aivault_pool_agent_degree?agent_id=in.(${ids.join(",")})&select=agent_id,tier,level&order=tier.desc,level.desc`); const sh = (a: any[]) => a.sort(() => Math.random() - .5);
  const pool = dg.length >= 2 ? dg.map((x: any) => x.agent_id) : sh(ids.slice()); const lead = pool[0], tester = pool.find((x: string) => x !== lead) || ids[1];
  const ver = (await rest(`aivault_pool_agent_degree?agent_id=not.in.(${lead},${tester})&select=agent_id&order=tier.desc,level.desc&limit=20`)); const verifier = ver.length ? sh(ver)[0].agent_id : ids.find((x) => x !== lead && x !== tester);
  return { lead, tester, verifier, ranks: null };
}
async function pickAgents() {
  const dg = await rest("aivault_pool_agent_degree?district=eq.code&select=agent_id,tier,level&order=tier.desc,level.desc&limit=40");
  if (dg.length < 2) { const a = await rest("aivault_pool_agents?domain=eq.coding&select=id&limit=30"); return { lead: a[0]?.id, tester: a[1]?.id, ranks: null }; }
  const lead = dg[Math.floor(Math.random() * Math.min(3, dg.length))]; const low = dg.slice(Math.floor(dg.length / 2)); const tester = low[Math.floor(Math.random() * low.length)];
  return { lead: lead.agent_id, tester: tester.agent_id === lead.agent_id ? dg[dg.length - 1].agent_id : tester.agent_id, ranks: { lead: [lead.tier, lead.level], tester: [tester.tier, tester.level] } };
}
async function persona(id: string) { const [a] = await rest(`aivault_pool_agents?id=eq.${id}&select=id,name,persona`); return a || { id, name: id, persona: "" }; }
const tok = (u: any) => Number(u?.total) || 0;
// lb2：學了就要做。同一代理同一主題累積 LAB_LEARN_N（預設 3）筆未連結的學習紀錄，就輪到它在實驗工廠做一件可執行、可測試的作品；
// 非程式區也一樣做成可測試的 JS（例如規則檢查器、計算器、題庫資料驗證），由同區另一位 AI 只看規格寫測試。學習紀錄會連到這次實驗（lab_id）。
async function dueLearning() {
  const N = Number(Deno.env.get("LAB_LEARN_N")) || 3; const rows = await rest("aivault_pool_agent_learning?lab_id=is.null&http_status=eq.200&select=id,agent_id,district,topic,notes,url&order=created_at.desc&limit=3000");
  const g: Record<string, any[]> = {}; rows.forEach((r: any) => { const k = r.agent_id + "|" + r.topic; (g[k] = g[k] || []).push(r); });
  const due = Object.values(g).filter((x) => x.length >= N).sort((a, b) => b.length - a.length); return due[0] ? due[0].slice(0, N) : null;
}
export async function labStart(b: any) {
  // 復原：卡在 running 超過 30 分鐘的實驗（執行器中途掛掉）標成 failed，並取消對應任務
  try { const old = new Date(Date.now() - 30 * 60000).toISOString(); const st = await rest(`aivault_lab_experiments?status=eq.running&created_at=lt.${old}&select=id,task_id`);
    for (const x of st) { await rest(`aivault_lab_experiments?id=eq.${x.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ status: "failed", finished_at: new Date().toISOString() }) }); if (x.task_id) await rest(`aivault_pool_agent_tasks?id=eq.${x.task_id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ status: "cancelled", result: "🧪 執行器中斷，自動復原", updated_at: new Date().toISOString() }) }); } } catch (_) { /* recovery best-effort */ }
  if (Deno.env.get("LAB_OFF") === "1") return { ok: false, off: true };
  const cap = Number(Deno.env.get("LAB_DAILY")) || 4; const day = new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10);
  const today = await rest(`aivault_lab_experiments?day=eq.${day}&select=id`); if (today.length >= cap && !b.force) return { ok: false, cap_hit: true, cap };
  const used = new Set((await rest("aivault_lab_experiments?status=eq.passed&select=title")).map((x: any) => x.title));
  if (b.brief == null && Deno.env.get("LAB_LEARN_OFF") !== "1") { const due = await dueLearning(); if (due) return await learnedArtifact(due, day); }
  const SB = SB_BRIEFS[String(b.sandbox || "")] ? String(b.sandbox) : "code";
  if (SB !== "code") return await sandboxStart(b, SB, day);
  const br = (b.brief != null ? BRIEFS[Number(b.brief) % BRIEFS.length] : null) || BRIEFS.filter((x) => !used.has(x.title))[0] || BRIEFS[Math.floor(Math.random() * BRIEFS.length)];
  const ag = await pickAgents(); if (!ag.lead || !ag.tester) return { ok: false, error: "no agents" };
  const L = await persona(ag.lead), T = await persona(ag.tester);
  const c = await callModel(`${L.persona || ""}\n你是 AIVAULT 程式與代理區的 ${L.name}，在 AI 實驗工廠負責寫產品程式。${PROD_RULES}`, `產品需求（${br.kind}）：${br.title}\n${br.spec}\n\n只輸出 JSON：{"api":"每個函式的簽名與行為一句話說明","product_js":"完整程式","demo_html":"完整 HTML"}`, 6000);
  const api = String(c.v?.api || ""); const product = String(c.v?.product_js || ""); const demo = String(c.v?.demo_html || "");
  if (!product) return { ok: false, error: "lead returned no code", model: c.model };
  const t = await callModel(`${T.persona || ""}\n你是 AIVAULT 程式與代理區的 ${T.name}，負責寫自動測試。你看不到程式，只能依需求與 API 寫測試。`, `產品需求：${br.title}\n${br.spec}\nAPI：${api}\n\n請寫 Node.js 測試檔 test.js：用 const { test } = require("node:test"); const assert = require("node:assert/strict"); const P = require("./product.js"); 寫 6–10 個測試，包含邊界情況；只測需求明確寫到的行為。只輸出 JSON：{"test_js":"完整測試檔"}`, 3000);
  const test = String(t.v?.test_js || ""); if (!test) return { ok: false, error: "tester returned no tests", model: t.model };
  const [task] = await rest("aivault_pool_agent_tasks", { method: "POST", body: JSON.stringify({ agent_id: ag.lead, zone: "code", source: "floor", kind: "lab", status: "running", max_steps: MAX_ITER(), order_text: `🧪 實驗工廠：${br.title}` }) });
  const it = [{ n: 1, by: ag.lead, model: c.model, tokens: tok(c.usage), test_by: ag.tester, test_model: t.model, test_tokens: tok(t.usage), at: new Date().toISOString() }];
  const [row] = await rest("aivault_lab_experiments", { method: "POST", body: JSON.stringify({ day, kind: br.kind, title: br.title, spec: br.spec, api, lead_id: ag.lead, tester_id: ag.tester, ranks: ag.ranks, product_js: product, demo_html: demo, test_js: test, iterations: it, status: "running", task_id: task?.id, tokens: tok(c.usage) + tok(t.usage) }) });
  return { ok: true, id: row.id, iter: 1, files: { "product.js": product, "test.js": test } };
}
async function learnedArtifact(due: any[], day: string) {
  const lead = due[0].agent_id, d = due[0].district, topic = due[0].topic; const L = await persona(lead);
  const peers = await rest(`aivault_pool_agent_degree?district=eq.${d}&agent_id=neq.${lead}&select=agent_id&limit=50`); const tester = peers.length ? peers[Math.floor(Math.random() * peers.length)].agent_id : (await rest(`aivault_pool_agents?id=neq.${lead}&select=id&limit=1`))[0].id; const T = await persona(tester);
  const notes = due.map((x: any, i: number) => `${i + 1}. ${String(x.notes || "").slice(0, 500)}（${x.url}）`).join("\n");
  const c = await callModel(`${L.persona || ""}\n你是 AIVAULT 的 ${L.name}，你剛學完「${topic}」。現在要在 AI 實驗工廠把學到的東西做成一件可以執行、可以自動測試的小作品（不是心得）。如果主題不是程式（例如法律、醫學、寫作、影像），就做成能驗證的工具：規則檢查器、計算器、分類器、結構化資料與驗證函式等。${PROD_RULES}`, `你的學習筆記：\n${notes}\n\n只輸出 JSON：{"title":"作品名（20 字內）","kind":"小工具|小遊戲|網頁元件|資料處理","spec":"可驗證的需求：函式名稱、輸入輸出、規則（3–6 句，要寫明確可測的行為）","api":"每個函式簽名與行為","product_js":"完整程式","demo_html":"完整 HTML"}`, 6500);
  const v = c.v || {}; if (!v.product_js || !v.spec) return { ok: false, error: "lead returned no artifact", model: c.model };
  const t = await callModel(`${T.persona || ""}\n你是 AIVAULT 的 ${T.name}，負責寫自動測試。你看不到程式，只能依需求與 API 寫測試。`, `作品：${v.title}\n需求：${v.spec}\nAPI：${v.api}\n\n請寫 Node.js 測試檔 test.js：用 const { test } = require("node:test"); const assert = require("node:assert/strict"); const P = require("./product.js"); 寫 5–8 個測試，只測需求明確寫到的行為。只輸出 JSON：{"test_js":"完整測試檔"}`, 3000);
  if (!t.v?.test_js) return { ok: false, error: "tester returned no tests", model: t.model };
  const [task] = await rest("aivault_pool_agent_tasks", { method: "POST", body: JSON.stringify({ agent_id: lead, zone: d === "code" ? "code" : d === "img" ? "image" : d === "av" ? "video" : "research", source: "floor", kind: "lab", status: "running", max_steps: MAX_ITER(), order_text: `🧪 學以致用：${String(v.title).slice(0, 40)}` }) });
  const it = [{ n: 1, by: lead, model: c.model, tokens: tok(c.usage), test_by: tester, test_model: t.model, test_tokens: tok(t.usage), at: new Date().toISOString() }];
  const [row] = await rest("aivault_lab_experiments", { method: "POST", body: JSON.stringify({ day, kind: String(v.kind || "小工具").slice(0, 10), title: String(v.title).slice(0, 60), spec: String(v.spec).slice(0, 1500), api: String(v.api || "").slice(0, 1500), lead_id: lead, tester_id: tester, product_js: String(v.product_js), demo_html: String(v.demo_html || ""), test_js: String(t.v.test_js), iterations: it, status: "running", task_id: task?.id, tokens: tok(c.usage) + tok(t.usage), source_topic: topic, learning_ids: due.map((x: any) => x.id) }) });
  await rest(`aivault_pool_agent_learning?id=in.(${due.map((x: any) => x.id).join(",")})`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ lab_id: row.id }) });
  return { ok: true, id: row.id, iter: 1, from_learning: topic, files: { "product.js": String(v.product_js), "test.js": String(t.v.test_js) } };
}
export async function agentLabStats(id: string) {
  const rows = await rest(`aivault_lab_experiments?lead_id=eq.${id}&select=id,title,status,source_topic&order=created_at.desc&limit=20`);
  return { built: rows.length, passed: rows.filter((x: any) => x.status === "passed").length, items: rows.slice(0, 5) };
}
async function sandboxStart(b: any, SB: string, day: string) {
  const L0 = SB_BRIEFS[SB]; const br = b.brief != null ? L0[Number(b.brief) % L0.length] : L0[Math.floor(Math.random() * L0.length)];
  const ag = await pickSandbox(SB); if (!ag?.lead) return { ok: false, error: "no sandbox agents" }; const L = await persona(ag.lead), T = await persona(ag.tester);
  const c = await callModel(`${L.persona || ""}\n你是 AIVAULT ${SB === "3d" ? "3D" : "遊戲"}沙盒的 ${L.name}，在共用實驗工廠負責製作。${RULES(SB)}`, `需求（${br.kind}）：${br.title}\n${br.spec}\n\n只輸出 JSON：{"api":"函式說明","product_js":"完整程式","demo_html":"完整 HTML${SB === "3d" ? "（可空字串）" : ""}"}`, 6000);
  if (!c.v?.product_js) return { ok: false, error: "lead returned no code", model: c.model };
  const tHint = SB === "3d" ? `測試檔可用 const THREE = require("three"); const P = require("./product.js"); const s = P.build(THREE); 檢查 Mesh 數量、name、尺寸範圍、材質等需求明確寫到的條件（用 s.traverse 與 new THREE.Box3().setFromObject(s)）。` : `const P = require("./product.js");`;
  const t = await callModel(`${T.persona || ""}\n你是 AIVAULT 的 ${T.name}，負責寫自動測試。你看不到程式，只能依需求與 API 寫測試。`, `需求：${br.title}\n${br.spec}\nAPI：${c.v.api || ""}\n\n請寫 Node.js 測試檔 test.js：用 const { test } = require("node:test"); const assert = require("node:assert/strict"); ${tHint} 寫 5–8 個測試，只測需求明確寫到的行為。只輸出 JSON：{"test_js":"完整測試檔"}`, 3000);
  if (!t.v?.test_js) return { ok: false, error: "tester returned no tests", model: t.model };
  const [task] = await rest("aivault_pool_agent_tasks", { method: "POST", body: JSON.stringify({ agent_id: ag.lead, zone: "code", source: "floor", kind: "lab", status: "running", max_steps: MAX_ITER(), order_text: `🧪 ${SB === "3d" ? "3D" : "遊戲"}沙盒：${br.title}` }) });
  const it = [{ n: 1, by: ag.lead, model: c.model, tokens: tok(c.usage), test_by: ag.tester, test_model: t.model, test_tokens: tok(t.usage), at: new Date().toISOString() }];
  const [row] = await rest("aivault_lab_experiments", { method: "POST", body: JSON.stringify({ day, kind: br.kind, title: br.title, spec: br.spec, api: String(c.v.api || ""), lead_id: ag.lead, tester_id: ag.tester, verifier_id: ag.verifier, product_js: String(c.v.product_js), demo_html: String(c.v.demo_html || ""), test_js: String(t.v.test_js), iterations: it, status: "running", task_id: task?.id, tokens: tok(c.usage) + tok(t.usage), sandbox: SB, artifact_kind: SB === "3d" ? "glb" : "js" }) });
  return { ok: true, id: row.id, iter: 1, sandbox: SB, files: { "product.js": String(c.v.product_js), "test.js": String(t.v.test_js) } };
}
// 獨立驗收：維護者以外、學階較高的另一位 AI 只看需求寫隱藏驗收測試；製作者看不到，也不能自己核准
async function verifyFiles(e: any) {
  const V = await persona(e.verifier_id); const tHint = e.sandbox === "3d" ? `可用 const THREE = require("three"); const s = require("./product.js").build(THREE);` : `const P = require("./product.js");`;
  const v = await callModel(`${V.persona || ""}\n你是 AIVAULT 的 ${V.name}，擔任獨立驗收員。你看不到程式和原本的測試，只依需求寫 3–5 個隱藏驗收測試。`, `需求：${e.title}\n${e.spec}\nAPI：${e.api || ""}\n\n寫 verify.js：const { test } = require("node:test"); const assert = require("node:assert/strict"); ${tHint} 只輸出 JSON：{"verify_js":"完整測試檔"}`, 2500);
  return { js: String(v.v?.verify_js || ""), model: v.model, tokens: tok(v.usage) };
}
export async function labReport(b: any) {
  const [e] = await rest(`aivault_lab_experiments?id=eq.${b.id}&select=*`); if (!e || e.status !== "running") return { ok: false, error: "not running" };
  const its = e.iterations || []; const cur = its[its.length - 1]; cur.pass = !!b.pass; cur.exit = b.exit; cur.output = String(b.output || "").slice(0, 6000); cur.tests = b.tests || null; cur.ran_at = new Date().toISOString();
  if (b.stage === "verify") { cur.verify = { pass: !!b.pass, output: String(b.output || "").slice(0, 4000), tests: b.tests || null, by: e.verifier_id };
    if (b.artifact_b64) cur.artifact_bytes = Math.round(String(b.artifact_b64).length * .75);
    if (!b.pass) { await rest(`aivault_lab_experiments?id=eq.${e.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ iterations: its, status: "failed", finished_at: new Date().toISOString() }) }); if (e.task_id) await rest(`aivault_pool_agent_tasks?id=eq.${e.task_id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ status: "cancelled", result: `🧪 獨立驗收沒通過（${e.verifier_id}）`, updated_at: new Date().toISOString() }) }); return { ok: true, done: true, status: "failed_verify" }; }
    b.pass = true; b.verified = true; }
  else if (b.pass && e.verifier_id && Deno.env.get("LAB_VERIFY_OFF") !== "1") { const vf = await verifyFiles(e); if (vf.js) { cur.verify_model = vf.model; cur.verify_tokens = vf.tokens;
      await rest(`aivault_lab_experiments?id=eq.${e.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ iterations: its, tokens: (e.tokens || 0) + vf.tokens, demo_html: e.demo_html }) });
      return { ok: true, id: e.id, stage: "verify", files: { "product.js": e.product_js, "test.js": vf.js } }; } }
  if (b.pass && b.artifact_b64 && e.sandbox === "3d") { await rest(`aivault_lab_experiments?id=eq.${e.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ demo_html: "glb:" + String(b.artifact_b64).slice(0, 700000) }) }); }
  if (b.pass) {
    await rest(`aivault_lab_experiments?id=eq.${e.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ iterations: its, status: "passed", finished_at: new Date().toISOString() }) });
    if (e.task_id) await rest(`aivault_pool_agent_tasks?id=eq.${e.task_id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ kind: "work", status: "done", review_status: "pending", result: `🧪 AI 實驗工廠成品：${e.title}（${e.kind}）\n寫程式：${e.lead_id}；寫測試：${e.tester_id}\n自動測試在無網路容器內通過（第 ${its.length} 次）${b.verified ? `，並由 ${e.verifier_id} 的隱藏驗收測試獨立通過` : ""}。\n展示與完整程式：aivault-lab.html#${e.id}\n（未上線；核准只代表作品通過審核）`, updated_at: new Date().toISOString() }) });
    return { ok: true, done: true, status: "passed" };
  }
  if (its.length >= MAX_ITER()) {
    await rest(`aivault_lab_experiments?id=eq.${e.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ iterations: its, status: "failed", finished_at: new Date().toISOString() }) });
    if (e.task_id) await rest(`aivault_pool_agent_tasks?id=eq.${e.task_id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ status: "cancelled", result: `🧪 實驗失敗：${its.length} 次修正後測試仍未通過（紀錄保留在 aivault-lab.html#${e.id}）`, updated_at: new Date().toISOString() }) });
    return { ok: true, done: true, status: "failed" };
  }
  const L = await persona(e.lead_id);
  const c = await callModel(`${L.persona || ""}\n你是 ${L.name}，你寫的程式沒通過同事寫的自動測試。${RULES(e.sandbox)}\n如果你確定是測試本身寫錯（和需求矛盾），可以在 note 說明，但仍要讓程式符合需求。`, `需求：${e.title}\n${e.spec}\n\n你的程式：\n${e.product_js}\n\n測試檔：\n${e.test_js}\n\n測試輸出（節錄）：\n${cur.output.slice(-3500)}\n\n只輸出 JSON：{"product_js":"修正後完整程式","note":"改了什麼"}`, 6000);
  const product = String(c.v?.product_js || ""); if (!product) return { ok: false, error: "no fix", model: c.model };
  its.push({ n: its.length + 1, by: e.lead_id, model: c.model, tokens: tok(c.usage), note: String(c.v?.note || "").slice(0, 400), at: new Date().toISOString() });
  await rest(`aivault_lab_experiments?id=eq.${e.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ iterations: its, product_js: product, tokens: (e.tokens || 0) + tok(c.usage) }) });
  if (e.task_id) await rest(`aivault_pool_agent_tasks?id=eq.${e.task_id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ updated_at: new Date().toISOString() }) });
  return { ok: true, id: e.id, iter: its.length, files: { "product.js": product, "test.js": e.test_js } };
}
export async function labPublic(b: any) {
  const sel = "id,day,kind,title,spec,api,source_topic,learning_ids,sandbox,verifier_id,artifact_kind,cost_usd,lead_id,tester_id,ranks,status,tokens,created_at,finished_at,iterations" + (b.id ? ",product_js,test_js,demo_html" : "");
  const rows = await rest(`aivault_lab_experiments?select=${sel}${b.id ? "&id=eq." + Number(b.id) : ""}&order=created_at.desc&limit=30`);
  const ids = [...new Set(rows.flatMap((r: any) => [r.lead_id, r.tester_id]))]; const ns = ids.length ? await rest(`aivault_pool_agents?id=in.(${ids.join(",")})&select=id,name`) : [];
  rows.forEach((r: any) => { r.lead_name = ns.find((n: any) => n.id === r.lead_id)?.name; r.tester_name = ns.find((n: any) => n.id === r.tester_id)?.name; });
  return { ok: true, rows };
}
