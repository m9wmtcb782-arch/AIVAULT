import test from "node:test";
import assert from "node:assert/strict";

function normalizeNovelText(value) {
  return String(value == null ? "" : value)
    .replace(/\r\n?/g, "\n")
    .replace(/(?:\\n|\/n){2,}/gi, "\n\n")
    .replace(/(?:\\n|\/n)/gi, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

test("collaboration novels convert visible /n/n markers", () => {
  assert.equal(normalizeNovelText("第一段/n/n第二段"), "第一段\n\n第二段");
});
test("collaboration novels convert literal escaped newline markers", () => {
  assert.equal(normalizeNovelText("第一段\\n\\n第二段"), "第一段\n\n第二段");
});
test("collaboration novels preserve Chinese punctuation and dialogue", () => {
  assert.equal(normalizeNovelText("他說：「我會回來。」"), "他說：「我會回來。」");
});
test("collaboration novels normalize CRLF and excessive blank lines", () => {
  assert.equal(normalizeNovelText("第一段\r\n\r\n\r\n第二段"), "第一段\n\n第二段");
});
