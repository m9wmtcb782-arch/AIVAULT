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
  assert.match(html, /evidenceManifest\.review_history=reviewEntries/);
  assert.match(html, /LOCAL_ONLY_NOT_REGISTERED/);
});

test("human review interface requires reviewer identity label and rationale", () => {
  assert.match(html, /id="reviewDecision"/);
  assert.match(html, /id="reviewerName"/);
  assert.match(html, /id="reviewNote"/);
  assert.match(html, /if\(!reviewer\|\|!note\)/);
  assert.match(html, /record_status:"LOCAL_ONLY_NOT_REGISTERED"/);
});


test("corrective action interface requires owner, deadline and response", () => {
  assert.match(html, /id="actionTitle"/);
  assert.match(html, /id="actionOwner"/);
  assert.match(html, /id="actionDue"/);
  assert.match(html, /id="actionStatus"/);
  assert.match(html, /id="actionResponse"/);
  assert.match(html, /record_status:"LOCAL_ONLY_NOT_REGISTERED"/);
  assert.match(html, /action_history=actionEntries/);
});


test("audit page inline JavaScript parses without syntax errors", () => {
  const scriptStart = html.lastIndexOf("<script>");
  const scriptEnd = html.indexOf("</script>", scriptStart);
  assert.ok(scriptStart >= 0 && scriptEnd > scriptStart, "audit page inline script must exist");
  const source = html.slice(scriptStart + "<script>".length, scriptEnd);
  assert.doesNotThrow(() => new vm.Script(source));
});

const trendStart = html.indexOf("function buildYearTrends(");
const trendEnd = html.indexOf("function normalizeYear", trendStart);
assert.ok(trendStart >= 0 && trendEnd > trendStart, "cross-year aggregation helper must exist");
const buildYearTrends = vm.runInNewContext(html.slice(trendStart, trendEnd) + "\nbuildYearTrends");
const row = (year, item, region, actual) => ({year:String(year),yearValid:true,item,actual,raw:[String(region)]});

test("keeps regional series separate instead of mixing regions", () => {
  const trends = buildYearTrends([
    row(2023,"營業稅","臺北市",100),
    row(2024,"營業稅","臺北市",120),
    row(2023,"營業稅","高雄市",1000),
    row(2024,"營業稅","高雄市",900)
  ],0);
  assert.equal(trends.length,2);
  assert.deepEqual(trends.map(x=>[x.region,x.pct]).sort(),[["臺北市",20],["高雄市",-10]].sort());
});

test("does not compare across a missing year", () => {
  const trends = buildYearTrends([
    row(2021,"營業稅","臺北市",100),
    row(2023,"營業稅","臺北市",130)
  ],0);
  assert.equal(trends.length,0);
});

test("aggregates same-year rows before calculating the annual change", () => {
  const trends = buildYearTrends([
    row(2023,"營業稅","臺北市",40),
    row(2023,"營業稅","臺北市",60),
    row(2024,"營業稅","臺北市",150)
  ],0);
  assert.equal(trends.length,1);
  assert.equal(trends[0].previous,100);
  assert.equal(trends[0].pct,50);
});

test("does not calculate a percentage from a zero baseline", () => {
  const trends = buildYearTrends([
    row(2023,"營業稅","臺北市",0),
    row(2024,"營業稅","臺北市",50)
  ],0);
  assert.equal(trends.length,0);
});

const matrixStart = html.indexOf("function buildFiscalRiskMatrix(");
const matrixEnd = html.indexOf("function normalizeYear", matrixStart);
assert.ok(matrixStart >= 0 && matrixEnd > matrixStart, "fiscal risk matrix helper must exist");
const buildFiscalRiskMatrix = vm.runInNewContext(html.slice(matrixStart, matrixEnd) + "\nbuildFiscalRiskMatrix");
const matrixRow = (year, region, actual, budget) => ({year:String(year),yearValid:true,item:"營業稅",actual,budget,raw:[region]});

test("fiscal risk matrix separates regions and aggregates same-year values", () => {
  const matrix = buildFiscalRiskMatrix([
    matrixRow(2024,"臺北市",40,100),
    matrixRow(2024,"臺北市",30,100),
    matrixRow(2024,"高雄市",150,100)
  ],0);
  assert.equal(matrix.length,2);
  const taipei = matrix.find(x=>x.region==="臺北市");
  const kaohsiung = matrix.find(x=>x.region==="高雄市");
  assert.equal(taipei.actual,70);
  assert.equal(taipei.achievement,35);
  assert.ok(taipei.signals.some(x=>x.includes("80%")));
  assert.equal(kaohsiung.achievement,150);
  assert.ok(kaohsiung.signals.some(x=>x.includes("120%")));
});

test("fiscal risk matrix does not calculate achievement when any budget value is missing", () => {
  const matrix = buildFiscalRiskMatrix([
    matrixRow(2024,"臺北市",50,100),
    matrixRow(2024,"臺北市",50,null)
  ],0);
  assert.equal(matrix[0].achievement,null);
  assert.ok(matrix[0].signals.length===0);
});

test("fiscal risk matrix preserves negative-value signals without treating missing budget as zero", () => {
  const matrix = buildFiscalRiskMatrix([
    matrixRow(2024,"臺北市",-10,null)
  ],0);
  assert.equal(matrix[0].achievement,null);
  assert.ok(matrix[0].signals.some(x=>x.includes("負值")));
});

const mapStart = html.indexOf("function mapFiscalHeaders(");
const mapEnd = html.indexOf("function number(", mapStart);
assert.ok(mapStart >= 0 && mapEnd > mapStart, "official fiscal header mapper must exist");
const mapFiscalHeaders = vm.runInNewContext("function norm(s){return String(s||\"\").trim().toLowerCase();}\n" + html.slice(mapStart, mapEnd) + "\nmapFiscalHeaders");

test("maps common Ministry of Finance fiscal CSV header aliases", () => {
  const mapped = mapFiscalHeaders(["年度", "稅目別", "縣市別", "預算數", "實徵淨額", "單位"]);
  assert.deepEqual(mapped.map(x=>x.status), ["已辨識","已辨識","已辨識","已辨識","已辨識","已辨識"]);
  assert.equal(mapped.find(x=>x.key==="actual").index,4);
  assert.equal(mapped.find(x=>x.key==="region").index,2);
});

test("marks ambiguous required fiscal columns and missing optional fields explicitly", () => {
  const mapped = mapFiscalHeaders(["稅目","稅目別","實徵淨額"]);
  assert.equal(mapped.find(x=>x.key==="item").status,"欄位名稱有歧義，待人工確認");
  assert.equal(mapped.find(x=>x.key==="budget").status,"未提供");
  assert.equal(mapped.find(x=>x.key==="actual").status,"已辨識");
});

test("fiscal risk matrix keeps different tax items separate within the same region and year", () => {
  const rows = [
    {...matrixRow(2024,"臺北市",80,100),item:"營業稅"},
    {...matrixRow(2024,"臺北市",120,100),item:"綜合所得稅"}
  ];
  const matrix = buildFiscalRiskMatrix(rows,0);
  assert.equal(matrix.length,2);
  assert.notEqual(matrix[0].item,matrix[1].item);
  assert.deepEqual(matrix.map(x=>x.achievement).sort((a,b)=>a-b),[80,120]);
});

const unitStart = html.indexOf("function detectFiscalUnit(");
const unitEnd = html.indexOf("function number(", unitStart);
assert.ok(unitStart >= 0 && unitEnd > unitStart, "fiscal unit detector must exist");
const detectFiscalUnit = vm.runInNewContext(html.slice(unitStart, unitEnd) + "\ndetectFiscalUnit");

test("infers thousand-dollar unit from official fiscal CSV headers", () => {
  const result = detectFiscalUnit(["實徵淨額(千元)","預算數(千元)"],[], -1,0,1);
  assert.equal(result.unit,"千元");
  assert.equal(result.status,"由欄位標題推定，仍須核對來源");
});

test("rejects conflicting amount units instead of aggregating incompatible values", () => {
  const result = detectFiscalUnit(["實徵淨額(千元)","預算數(元)"],[], -1,0,1);
  assert.equal(result.unit,null);
  assert.equal(result.status,"單位衝突或多種單位");
});

test("rejects a single file whose explicit unit column mixes units", () => {
  const result = detectFiscalUnit(["實徵數","單位"],[["100","千元"],["200","元"]],1,0,-1);
  assert.equal(result.status,"單位衝突或多種單位");
});

test("wide region-by-tax datasets are explicitly identified as requiring reshape", () => {
  assert.match(html,/已辨識為「地區 × 稅目」寬表格式/);
});
