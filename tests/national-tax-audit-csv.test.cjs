const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const html = fs.readFileSync("national-tax-audit-center.html", "utf8");
const start = html.indexOf("function csvParse(text){");
const end = html.indexOf("function norm(s){", start);
assert.ok(start >= 0 && end > start, "CSV parser must exist in the audit page");
const parserSource = html.slice(start, end);
const csvParse = vm.runInNewContext(parserSource + "\\ncsvParse");

test("parses ordinary CSV with CRLF", () => {
  assert.deepEqual(JSON.parse(JSON.stringify(csvParse("年度,稅目,實徵數\\r\\n2024,營業稅,100\\r\\n"))), [["年度","稅目","實徵數"],["2024","營業稅","100"]]);
});
test("preserves quoted commas and escaped quotes", () => {
  assert.deepEqual(JSON.parse(JSON.stringify(csvParse('稅目,備註\\n"營業稅","含,逗號與""引號"""'))), [["稅目","備註"],["營業稅",'含,逗號與"引號"']]);
});
test("preserves newlines inside quoted fields", () => {
  assert.deepEqual(JSON.parse(JSON.stringify(csvParse('稅目,備註\\n營業稅,"第一行\\n第二行"'))), [["稅目","備註"],["營業稅","第一行\\n第二行"]]);
});
test("removes UTF-8 BOM", () => {
  assert.equal(csvParse("\\uFEFF年度,稅目\\n2024,營業稅")[0][0], "年度");
});
test("rejects unterminated quoted fields", () => {
  assert.throws(() => csvParse('稅目,備註\\n營業稅,"未結束'), /未閉合/);
});
test("rejects quotes embedded in unquoted fields", () => {
  assert.throws(() => csvParse('稅目,備註\\n營"業稅,測試'), /欄位開頭/);
});
