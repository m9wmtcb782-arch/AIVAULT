// 電子書可見度（純函式，無網路、無密鑰；供 dark-star-ebook-ingest 與 photo-solve 共用，並有單元測試）
// visibility：public（所有人）／members（已登入且未被拒的會員）／owner（只限擁有者本人；AIVAULT owner/admin 角色可管理）
// 來源：資料表欄位 visibility/owner_id（新）＋舊的 metadata.private／metadata.visibility／metadata.owner_id；取「最嚴格」者，避免任何一邊漏設而外洩。
export type Visibility = "public" | "members" | "owner";
export type Viewer = { id: string; role?: string | null; approved?: boolean | null } | null;
const RANK: Record<Visibility, number> = { public: 0, members: 1, owner: 2 };
const norm = (v: unknown): Visibility | null => {
  const s = String(v ?? "").trim().toLowerCase();
  return s === "public" || s === "members" || s === "owner" ? s : null;
};
export function visibilityOf(e: any): Visibility {
  if (!e) return "public";
  const m = (e.metadata && typeof e.metadata === "object") ? e.metadata : {};
  let v: Visibility = "public";
  for (const c of [norm(e.visibility), norm(m.visibility), (m.private === true || m.private === "true") ? "members" as Visibility : null]) {
    if (c && RANK[c] > RANK[v]) v = c;
  }
  return v;
}
export function ownerOf(e: any): string | null {
  const id = e?.owner_id || e?.metadata?.owner_id || null;
  return id ? String(id) : null;
}
export const isAdmin = (v: Viewer) => !!v && (v.role === "owner" || v.role === "admin");
export const isMember = (v: Viewer) => !!v && !!v.id && v.approved !== false;
export function canRead(e: any, v: Viewer): boolean {
  const vis = visibilityOf(e);
  if (vis === "public") return true;
  if (vis === "members") return isMember(v);
  // owner：本人（id 相同且帳號未被拒）或 AIVAULT owner/admin；owner_id 缺失時只有 owner/admin 可讀（fail closed）
  if (isAdmin(v)) return true;
  const o = ownerOf(e);
  return !!o && isMember(v) && v!.id === o;
}
// 拒絕時的回應：沒登入 → 401 LOGIN_REQUIRED；owner-only 對非本人 → 404（不透露書存在）
export function denial(e: any, v: Viewer): { status: number; error: string; message: string } {
  if (visibilityOf(e) === "owner") return { status: 404, error: "BOOK_NOT_FOUND", message: "找不到這本書" };
  if (!v) return { status: 401, error: "LOGIN_REQUIRED", message: "這本書只有登入的 AIVAULT 會員可以閱讀" };
  return { status: 403, error: "MEMBERS_ONLY", message: "這本書只有已核准的 AIVAULT 會員可以閱讀" };
}
// 對外輸出時移除擁有者以外不需要的欄位（owner_id 只給本人／管理者）
export function publicShape(e: any, v: Viewer) {
  const o = ownerOf(e), vis = visibilityOf(e);
  const x = { ...e, visibility: vis };
  if (!(isAdmin(v) || (o && v && v.id === o))) { delete x.owner_id; if (x.metadata && typeof x.metadata === "object") { x.metadata = { ...x.metadata }; delete x.metadata.owner_id; } }
  return x;
}
export function parseVisibility(input: unknown, legacyPrivate?: unknown): Visibility {
  const v = norm(input);
  if (v) return v;
  return legacyPrivate === true || legacyPrivate === "true" ? "members" : "public";
}
