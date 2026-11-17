import test from "node:test";
import assert from "node:assert/strict";

// Regression contract for the normalizer used by the Edge Function and browser player.
function normalize(value) {
  return String(value == null ? "" : value)
    .replace(/\r\n?/g, "\n")
    .replace(/(?:\\n|\/n){2,}/gi, "\n\n")
    .replace(/(?:\\n|\/n)/gi, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

test("converts visible /n/n markers into real paragraph breaks", () => {
  assert.equal(normalize("第一段/n/n第二段"), "第一段\n\n第二段");
});
test("converts literal escaped newline markers", () => {
  assert.equal(normalize("第一段\\n\\n第二段"), "第一段\n\n第二段");
});
test("normalizes CRLF and collapses excessive blank lines", () => {
  assert.equal(normalize("第一段\r\n\r\n\r\n第二段"), "第一段\n\n第二段");
});
test("does not alter ordinary Chinese punctuation or wording", () => {
  assert.equal(normalize("他說：「我會回來。」"), "他說：「我會回來。」");
});
