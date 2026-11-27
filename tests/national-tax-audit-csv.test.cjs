const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const { webcrypto } = require("node:crypto");

const html = fs.readFileSync("national-tax-audit-center.html", "utf8");
const start = html.indexOf("function csvParse(text){");
const end = html.indexOf("function norm(s){", start);
assert.ok(start >= 0 && end > start, "CSV parser must exist in the audit page");
const parserSource = html.slice(start, end);
const csvParse = vm.runInNewContext(parserSource + "\ncsvParse");

test("parses ordinary CSV with CRLF", () => {
  assert.deepEqual(JSON.parse(JSON.stringify(csvParse("年度,稅目,實徵數\r\n2024,營業稅,100\r\n"))), [["年度","稅目","實徵數"],["2024","營業稅","100"]]);
});
test("preserves quoted commas and escaped quotes", () => {
  assert.deepEqual(JSON.parse(JSON.stringify(csvParse('稅目,備註\n"營業稅","含,逗號與""引號"""'))), [["稅目","備註"],["營業稅",'含,逗號與"引號"']]);
});
test("preserves newlines inside quoted fields", () => {
  assert.deepEqual(JSON.parse(JSON.stringify(csvParse('稅目,備註\n營業稅,"第一行\n第二行"'))), [["稅目","備註"],["營業稅","第一行\n第二行"]]);
});
test("removes UTF-8 BOM", () => {
  assert.equal(csvParse("\uFEFF年度,稅目\n2024,營業稅")[0][0], "年度");
});
test("rejects unterminated quoted fields", () => {
  assert.throws(() => csvParse('稅目,備註\n營業稅,"未結束'), /未閉合/);
});
test("rejects quotes embedded in unquoted fields", () => {
  assert.throws(() => csvParse('稅目,備註\n營"業稅,測試'), /欄位開頭/);
});


function extractFunction(name, nextMarker) {
  const start = html.indexOf("function " + name + "(");
  const end = html.indexOf(nextMarker, start);
  assert.ok(start >= 0 && end > start, name + " helper must exist");
  return html.slice(start, end);
}

const numberSource = extractFunction("number", "\nfunction normalizeYear");
const parseNumber = vm.runInNewContext(numberSource + "\nnumber");
const yearSource = extractFunction("normalizeYear", "\nfunction clearAnalysis");
const normalizeYear = vm.runInNewContext(yearSource + "\nnormalizeYear");

test("parses formatted numeric amounts and decimals", () => {
  assert.equal(parseNumber("1,234.50"), 1234.5);
  assert.equal(parseNumber("－100"), null);
  assert.equal(parseNumber("-100"), -100);
});
test("does not coerce blank or malformed amounts to zero", () => {
  assert.equal(parseNumber(""), null);
  assert.equal(parseNumber("   "), null);
  assert.equal(parseNumber("N/A"), null);
  assert.equal(parseNumber("12abc"), null);
});
test("normalizes ROC years to Gregorian years", () => {
  assert.deepEqual(JSON.parse(JSON.stringify(normalizeYear("民國113年"))), {year:"2024",valid:true});
  assert.deepEqual(JSON.parse(JSON.stringify(normalizeYear("2024"))), {year:"2024",valid:true});
});
test("rejects unrecognized year values", () => {
  assert.equal(normalizeYear("未知").valid, false);
  assert.equal(normalizeYear("301").valid, false);
  assert.equal(normalizeYear("24").valid, false);
});


test("computes a stable SHA-256 fingerprint for file bytes", async () => {
  const htmlSource = fs.readFileSync("national-tax-audit-center.html", "utf8");
  const start = htmlSource.indexOf("async function sha256Hex(buffer){");
  const end = htmlSource.indexOf("\nfunction normalizeYear", start);
  assert.ok(start >= 0 && end > start, "SHA-256 helper must exist in the audit page");
  const helper = vm.runInNewContext(htmlSource.slice(start, end) + "\nsha256Hex", { crypto: webcrypto });
  const digest = await helper(new TextEncoder().encode("audit-evidence").buffer);
  assert.equal(digest, "2071e29393ba7f1f11c702bcba27add19865ed6c0e53c15e4ba958002e1fdea6");
});


test("evidence manifest supports explicit version lineage and local review history", () => {
  assert.match(html, /id="priorEvidenceId"/);
  assert.match(html, /id="evidenceVersion"/);
  assert.match(html, /id="supersessionReason"/);
  assert.match(html, /supersedes_evidence_id:priorEvidenceId\|\|null/);
  assert.match(html, /review_history:reviewEntries/);
  assert.match(html, /LOCAL_ONLY_NOT_REGISTERED/);
});

test("human review interface requires reviewer identity label and rationale", () => {
  assert.match(html, /id="reviewDecision"/);
  assert.match(html, /id="reviewerName"/);
  assert.match(html, /id="reviewNote"/);
  assert.match(html, /if\(!reviewer\|\|!note\)/);
  assert.match(html, /record_status:"LOCAL_ONLY_NOT_REGISTERED"/);
});
