// Regression tests for the local CSV parser used by national-tax-audit-center.html.
// Run: node tests/national-tax-audit-csv.test.js
const assert=require("node:assert/strict");
function csvParse(text){text=String(text||"").replace(/^\\uFEFF/,"");const rows=[];let row=[],field="",quoted=false;for(let i=0;i<text.length;i++){const c=text[i];if(quoted){if(c==='"'&&text[i+1]==='"'){field+='"';i++;}else if(c==='"'){quoted=false;}else field+=c;}else if(c==='"'){quoted=true;}else if(c===','){row.push(field);field="";}else if(c==='\\n'){row.push(field);rows.push(row);row=[];field="";}else if(c==='\\r'){if(text[i+1]==='\\n')i++;row.push(field);rows.push(row);row=[];field="";}else field+=c;}if(field.length||row.length){row.push(field);rows.push(row);}return rows.filter(r=>r.some(x=>x.trim()));}
assert.deepEqual(csvParse("年度,稅目,實徵\r\n112,營業稅,100\r\n113,營業稅,120"),[["年度","稅目","實徵"],["112","營業稅","100"],["113","營業稅","120"]]);
assert.deepEqual(csvParse('稅目,說明,金額\n所得稅,"文字含,逗號",55'),[["稅目","說明","金額"],["所得稅","文字含,逗號","55"]]);
assert.deepEqual(csvParse('項目,描述,值\nA,"第一行\n第二行",9'),[["項目","描述","值"],["A","第一行\n第二行","9"]]);
assert.deepEqual(csvParse('\uFEFF年度,稅目,金額\n112,營業稅,3'),[["年度","稅目","金額"],["112","營業稅","3"]]);
assert.deepEqual(csvParse('年度,稅目,金額\n112,營業稅,3\n\n113,所得稅,4\n'),[["年度","稅目","金額"],["112","營業稅","3"],["113","所得稅","4"]]);
console.log("PASS: 5 CSV parser regression tests");
