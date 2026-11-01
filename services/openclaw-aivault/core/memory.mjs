// 共同記憶（10 萬 AI 共用）＋ 暗星單獨記憶。本機 JSON 檔（Supabase 鏡像的離線替身）。
// 規則：一般 AI 只能讀寫共同記憶；暗星另有 private，其他身分讀取一律拒絕。
import fs from "node:fs"; import path from "node:path";
export const norm = (q) => String(q).toLowerCase().replace(/[\s，。？?！!、,.:：;；"'「」]/g, "");
export class CommonMemory {
  constructor(dir) { this.dir = dir; fs.mkdirSync(dir, { recursive: true }); this.f = path.join(dir, "common-memory.json"); this.p = path.join(dir, "darkstar-private.json"); }
  _r(f) { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return { correct: [], wrong: [] }; } }
  _w(f, d) { const t = f + ".tmp"; fs.writeFileSync(t, JSON.stringify(d, null, 1)); fs.renameSync(t, f); }
  load() { return this._r(this.f); }
  findCorrect(q) { const k = norm(q); return this.load().correct.find((e) => e.key === k && !e.revoked) || null; }
  wrongFor(q) { const k = norm(q); return this.load().wrong.filter((e) => e.key === k && !e.revoked); }
  wrongByFamily(fam) { return this.load().wrong.filter((e) => e.family === fam && !e.revoked); }
  add(kind, entry) { const d = this.load(); const e = { id: `${kind}-${d[kind].length + 1}`, at: new Date().toISOString(), ...entry, key: norm(entry.question) }; d[kind].push(e); this._w(this.f, d); return e; }
  search(query, limit = 5) { const k = norm(query); const d = this.load(); return [...d.correct.map((e) => ({ ...e, kind: "correct" })), ...d.wrong.map((e) => ({ ...e, kind: "wrong" }))]
      .filter((e) => !e.revoked && (e.key.includes(k) || k.includes(e.key) || (e.family && k.includes(norm(e.family))))).slice(0, limit); }
  readPrivate(identity) { if (!identity?.is_darkstar) throw new Error("PRIVATE_MEMORY_DARKSTAR_ONLY"); return this._r(this.p); }
  writePrivate(identity, note) { if (!identity?.is_darkstar) throw new Error("PRIVATE_MEMORY_DARKSTAR_ONLY"); const d = this._r(this.p); (d.notes ||= []).push({ at: new Date().toISOString(), note }); this._w(this.p, d); }
}
