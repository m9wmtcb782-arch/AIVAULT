// deno test tests/ebook-privacy/ebook_access_test.ts —— 純函式可見度矩陣
import { assertEquals } from "jsr:@std/assert@1";
import { canRead, visibilityOf, denial, publicShape, parseVisibility } from "../../supabase/functions/_shared/ebook_access.ts";
const OWNER = "11111111-1111-1111-1111-111111111111", OTHER = "22222222-2222-2222-2222-222222222222";
const anon = null, member = { id: OTHER, role: null }, owner = { id: OWNER, role: null }, admin = { id: "33333333-3333-3333-3333-333333333333", role: "owner" }, rejected = { id: OWNER, role: null, approved: false };
const pub = { id: "p", metadata: {} }, legacyPriv = { id: "m", metadata: { private: true } }, mem = { id: "m2", visibility: "members", metadata: {} };
const own = { id: "o", visibility: "owner", owner_id: OWNER, metadata: { private: true, visibility: "owner", owner_id: OWNER } };
const ownMetaOnly = { id: "o2", metadata: { private: true, visibility: "owner", owner_id: OWNER } };
const ownNoOwner = { id: "o3", visibility: "owner", metadata: {} };
Deno.test("visibilityOf：取最嚴格", () => {
  assertEquals(visibilityOf(pub), "public");
  assertEquals(visibilityOf(legacyPriv), "members");
  assertEquals(visibilityOf({ visibility: "public", metadata: { private: "true" } }), "members");
  assertEquals(visibilityOf({ visibility: "members", metadata: { visibility: "owner" } }), "owner");
  assertEquals(visibilityOf(own), "owner");
});
Deno.test("公開書：所有人可讀（含 e0bc8c57 這類既有公開書，不變）", () => {
  for (const v of [anon, member, owner, admin, rejected]) assertEquals(canRead(pub, v), true);
});
Deno.test("members：訪客與被拒帳號不可讀，會員可讀", () => {
  for (const b of [legacyPriv, mem]) {
    assertEquals(canRead(b, anon), false); assertEquals(canRead(b, rejected), false);
    assertEquals(canRead(b, member), true); assertEquals(canRead(b, owner), true); assertEquals(canRead(b, admin), true);
  }
});
Deno.test("owner：只有本人與 owner/admin", () => {
  for (const b of [own, ownMetaOnly]) {
    assertEquals(canRead(b, anon), false); assertEquals(canRead(b, member), false);
    assertEquals(canRead(b, rejected), false); assertEquals(canRead(b, owner), true); assertEquals(canRead(b, admin), true);
  }
  assertEquals(canRead(ownNoOwner, owner), false); // 無 owner_id → fail closed
  assertEquals(canRead(ownNoOwner, admin), true);
});
Deno.test("拒絕狀態碼：owner-only 一律 404，members 依登入 401/403", () => {
  assertEquals(denial(own, anon).status, 404); assertEquals(denial(own, member).status, 404);
  assertEquals(denial(legacyPriv, anon).status, 401); assertEquals(denial(legacyPriv, rejected as any).status, 403);
});
Deno.test("publicShape：owner_id 不外流給他人", () => {
  assertEquals("owner_id" in publicShape(own, member), false);
  assertEquals("owner_id" in publicShape(own, member).metadata, false);
  assertEquals(publicShape(own, owner).owner_id, OWNER);
});
Deno.test("parseVisibility：預設公開；舊 private=true → members", () => {
  assertEquals(parseVisibility(undefined), "public"); assertEquals(parseVisibility("OWNER"), "owner");
  assertEquals(parseVisibility("bogus", true), "members"); assertEquals(parseVisibility("", false), "public");
});
