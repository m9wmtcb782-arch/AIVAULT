// node --test tests/royal-shelf/ —— 繁簡搜尋折疊
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const Z = createRequire(import.meta.url)("../../royal-library-zhfold.js");
test("繁體查詢找得到簡體書名", () => {
  assert.ok(Z.matches("行政法入门（第二版）｜余凌云", "行政法入門"));
  assert.ok(Z.matches("行政法入门（第二版）｜余凌云", "行政法入門第二版"));
  assert.ok(Z.matches("宪法学讲义（第四版）｜林来梵", "憲法學講義"));
  assert.ok(Z.matches("宪法学讲义（第四版）｜林来梵", "林來梵"));
});
test("簡體查詢找得到繁體書名", () => {
  assert.ok(Z.matches("德國行政法院法 Verwaltungsgerichtsordnung", "德国行政法院法"));
  assert.ok(Z.matches("憲法解釋與行政法學研究方法論", "宪法解释"));
});
test("全形、大小寫、多關鍵字", () => {
  assert.ok(Z.matches("Ａｎａｔｏｍｙ and Physiology", "anatomy"));
  assert.ok(Z.matches("行政法入门（第二版）｜余凌云", "余凌雲 行政法"));
  assert.ok(!Z.matches("行政法入门", "刑法"));
  assert.ok(Z.matches("任何書", ""));
});
test("字表大小合理", () => { assert.ok(Z.size > 2500); });
