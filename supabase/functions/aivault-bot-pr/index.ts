// （Supabase 方案已達 function 數量上限，所以這個模組由 dark-star-ebook-ingest?feature=bot-pr 匯入執行，不單獨部署。）
// AIVAULT App 管家：把使用者「核准」的修改提案開成 GitHub Pull Request（永不自動合併）。
// 安全：GitHub token 只存在 Supabase secret（AIVAULT_PR_GITHUB_TOKEN，退回 ANXING_GITHUB_TOKEN）；
// 只有 AIVAULT_OWNER_USER_ID 指定的 Supabase 使用者（JWT 驗證）能核准；禁止改 .github/ 等敏感路徑。
import { createClient } from "npm:@supabase/supabase-js@2";
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const OWNER = (Deno.env.get("AIVAULT_OWNER_USER_ID") || "").trim();
const GH = (Deno.env.get("AIVAULT_PR_GITHUB_TOKEN") || Deno.env.get("ANXING_GITHUB_TOKEN") || "").trim();
const TOKEN_SRC = Deno.env.get("AIVAULT_PR_GITHUB_TOKEN") ? "AIVAULT_PR_GITHUB_TOKEN" : (Deno.env.get("ANXING_GITHUB_TOKEN") ? "ANXING_GITHUB_TOKEN" : "");
const REPO = "m9wmtcb782-arch/AIVAULT", BASE = "main";
const H = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const out = (x: unknown, s = 200) => new Response(JSON.stringify(x), { status: s, headers: { "content-type": "application/json; charset=utf-8", ...H } });

async function user(r: Request) {
  const t = (r.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!t) return null;
  try { const { data, error } = await db.auth.getUser(t); return error ? null : data?.user?.id || null; } catch { return null; }
}
async function gh(path: string, init: RequestInit = {}) {
  const r = await fetch("https://api.github.com/repos/" + REPO + path, { ...init, headers: { Authorization: "Bearer " + GH, Accept: "application/vnd.github+json", "User-Agent": "aivault-bot-pr", "Content-Type": "application/json", ...(init.headers || {}) } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error("GitHub " + r.status + " " + path.split("?")[0] + ": " + (j.message || ""));
  return j;
}
const BAD = /(^|\/)\.github\/|(^|\/)\.git\/|(^|\/)\.env|secret|\.pem$|\.key$/i;
function cleanPath(p: string) {
  p = String(p || "").trim().replace(/^\/+/, "");
  if (!p || p.includes("..") || p.includes("\\") || p.length > 200 || BAD.test(p) || !/^[\w\-./\u3400-\u9fff]+$/.test(p)) throw new Error("不允許的檔案路徑：" + p);
  return p;
}
function b64utf8(s: string) { const b = new TextEncoder().encode(s); let x = ""; for (let i = 0; i < b.length; i += 0x8000) x += String.fromCharCode(...b.subarray(i, i + 0x8000)); return btoa(x); }
function unb64(s: string) { const bin = atob(s.replace(/\n/g, "")); return new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0))); }

async function buildFiles(files: any[]) {
  if (!Array.isArray(files) || !files.length || files.length > 20) throw new Error("提案需要 1～20 個檔案");
  const res: { path: string; content: string }[] = [];
  for (const f of files) {
    const path = cleanPath(f.path);
    let content: string;
    if (typeof f.content === "string") content = f.content;
    else if (Array.isArray(f.edits)) {
      const cur = await gh("/contents/" + encodeURI(path) + "?ref=" + BASE);
      content = unb64(cur.content || "");
      for (const e of f.edits) {
        const find = String(e.find ?? ""), rep = String(e.replace ?? "");
        const n = find ? content.split(find).length - 1 : 0;
        if (n !== 1) throw new Error(path + "：要取代的片段必須剛好出現 1 次（目前 " + n + " 次）");
        content = content.replace(find, () => rep);
      }
    } else throw new Error(path + "：缺少 content 或 edits");
    if (content.length > 500000) throw new Error(path + " 太大");
    res.push({ path, content });
  }
  return res;
}

async function openPr(uid: string, p: any) {
  const title = String(p.title || "").trim().slice(0, 120) || "AIVAULT App 管家提案";
  const desc = String(p.description || "").slice(0, 8000);
  const files = await buildFiles(p.files);
  const { data: row } = await db.from("dark_star_bot_proposals").insert({ user_id: uid, bot_id: p.bot_id || null, title, description: desc, files: p.files, status: "approving" }).select("id").single();
  try {
    const ref = await gh("/git/ref/heads/" + BASE);
    const baseSha = ref.object.sha;
    const baseCommit = await gh("/git/commits/" + baseSha);
    const tree = [];
    for (const f of files) {
      const blob = await gh("/git/blobs", { method: "POST", body: JSON.stringify({ content: b64utf8(f.content), encoding: "base64" }) });
      tree.push({ path: f.path, mode: "100644", type: "blob", sha: blob.sha });
    }
    const t = await gh("/git/trees", { method: "POST", body: JSON.stringify({ base_tree: baseCommit.tree.sha, tree }) });
    const c = await gh("/git/commits", { method: "POST", body: JSON.stringify({ message: title + "\n\n由暗星 App 管家提案、擁有者核准。", tree: t.sha, parents: [baseSha] }) });
    const branch = "darkstar-bot/" + new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14) + "-" + crypto.randomUUID().slice(0, 6);
    await gh("/git/refs", { method: "POST", body: JSON.stringify({ ref: "refs/heads/" + branch, sha: c.sha }) });
    const pr = await gh("/pulls", { method: "POST", body: JSON.stringify({ title: "[暗星App管家] " + title, head: branch, base: BASE, body: desc + "\n\n---\n檔案：\n" + files.map(f => "- `" + f.path + "`").join("\n") + "\n\n⚠️ 由暗星 App 管家產生，經擁有者在 AIVAULT 按「核准」後開立。**不會自動合併**，請審閱後手動合併。", draft: false }) });
    if (row?.id) await db.from("dark_star_bot_proposals").update({ status: "pr_opened", pr_url: pr.html_url, branch, updated_at: new Date().toISOString() }).eq("id", row.id);
    return { ok: true, pr_url: pr.html_url, pr_number: pr.number, branch, proposal_id: row?.id };
  } catch (e) {
    if (row?.id) await db.from("dark_star_bot_proposals").update({ status: "failed", error: String((e as Error).message), updated_at: new Date().toISOString() }).eq("id", row.id);
    throw e;
  }
}

export async function botPr(r: Request): Promise<Response> {
  if (r.method === "OPTIONS") return new Response("ok", { headers: H });
  try {
    const b = await r.json().catch(() => ({}));
    const uid = await user(r);
    const action = String(b.action || "status");
    if (action === "status") {
      let token_ok = false, token_error = "";
      if (GH && uid && OWNER && uid === OWNER) {
        try { const repo = await gh(""); token_ok = !!(repo.permissions ? repo.permissions.push : true); if (!token_ok) token_error = "token 沒有寫入權限"; } catch (e) { token_error = String((e as Error).message); }
      }
      return out({ ok: true, logged_in: !!uid, user_id: uid, owner_configured: !!OWNER, is_owner: !!uid && uid === OWNER, token_configured: !!GH, token_source: TOKEN_SRC, token_ok, token_error });
    }
    if (action === "approve") {
      if (!uid) return out({ ok: false, error: "NOT_LOGGED_IN" }, 401);
      if (!OWNER) return out({ ok: false, error: "OWNER_NOT_CONFIGURED", user_id: uid }, 403);
      if (uid !== OWNER) return out({ ok: false, error: "NOT_OWNER" }, 403);
      if (!GH) return out({ ok: false, error: "TOKEN_NOT_CONFIGURED" }, 503);
      return out(await openPr(uid, b.proposal || {}));
    }
    return out({ ok: false, error: "UNKNOWN_ACTION" }, 400);
  } catch (e) { return out({ ok: false, error: String((e as Error).message || e) }, 500); }
}
