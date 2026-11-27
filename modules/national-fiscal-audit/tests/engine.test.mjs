import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { normalizeFiscalDataset, budgetExecution, compareAcrossYears, detectStatisticalAnomalies, scoreFiscalRisk, buildAuditAnalysis, REVIEW_STATES } from "../engine.js";

const fixture = JSON.parse(await readFile(new URL("../fixtures/fiscal-sample.json", import.meta.url), "utf8"));
const records = normalizeFiscalDataset(fixture.records, {unit:fixture.unit, sourceId:fixture.sourceId});

test("fixture is explicitly synthetic",()=>assert.match(fixture.fixtureType,/SYNTHETIC/));
test("normalizes Traditional Chinese field names and keeps source units",()=>{
  assert.equal(records[0].year,2020); assert.equal(records[0].actual,99000); assert.equal(records[0].unit,"新臺幣千元");
});
test("budget execution calculates variance and rate",()=>{
  const x=budgetExecution(records[0]); assert.equal(x.variance,-1000); assert.equal(x.executionRate,99);
});
test("budget-only and zero-budget records do not divide by zero",()=>{
  assert.equal(budgetExecution({...records[0],actual:null}).analysisStatus,"INSUFFICIENT_ACTUAL");
  assert.equal(budgetExecution({...records[0],budget:0}).analysisStatus,"ZERO_BUDGET");
});
test("year comparison is chronological and calculates growth",()=>{
  const rows=compareAcrossYears(records.filter(x=>x.tax==="所得稅"));
  assert.equal(rows[1].growthRate,((204000-198000)/198000)*100);
});
test("anomaly is a statistical finding, never a confirmed audit issue",()=>{
  const findings=detectStatisticalAnomalies(records,{dimensions:["tax","region"],minimumPeers:4,zThreshold:3.5});
  assert.ok(findings.some(x=>x.year===2024 && x.tax==="營業稅"));
  assert.ok(findings.every(x=>x.state===REVIEW_STATES.STATISTICAL_ANOMALY));
});
test("risk score is bounded and states its non-adjudicative purpose",()=>{
  const x=scoreFiscalRisk({executionRate:60,growthRate:-25,debtRatio:55,dataCompleteness:.8});
  assert.ok(x.score>=0 && x.score<=100); assert.equal(x.state,REVIEW_STATES.AUDIT_LEAD);
});
test("end-to-end analysis includes regional comparison and provenance",()=>{
  const result=buildAuditAnalysis(records,{generatedAt:"2026-11-27T00:00:00+08:00"});
  assert.equal(result.recordCount,12); assert.ok(result.regionalComparisons.length>0);
  assert.equal(result.records[0].sourceId,fixture.sourceId);
});
test("invalid numeric data is rejected, not silently coerced",()=>{
  assert.throws(()=>normalizeFiscalDataset([{年度:2024,預算數:"not-a-number",實徵數:10}]));
});

test("actual-only regional observations do not invent budget values",()=>{
  const result=buildAuditAnalysis([
    {year:2024,tax:"營業稅",region:"臺北市",agency:"UNSPECIFIED",budget:null,actual:300,unit:"千元",sourceId:"fixture",recordType:"TAX_ACTUAL"},
    {year:2024,tax:"營業稅",region:"新北市",agency:"UNSPECIFIED",budget:null,actual:200,unit:"千元",sourceId:"fixture",recordType:"TAX_ACTUAL"}
  ]);
  assert.equal(result.records[0].analysisStatus,"INSUFFICIENT_BUDGET");
  assert.equal(result.regionalComparisons[0].budget,null);
  assert.equal(result.regionalComparisons[0].executionRate,null);
});
test("aggregate rows are excluded from regional rollups to prevent double counting",()=>{
  const result=buildAuditAnalysis([
    {year:2024,tax:"總計",region:"臺北市",agency:"UNSPECIFIED",budget:null,actual:900,unit:"千元",sourceId:"fixture",recordType:"AGGREGATE"},
    {year:2024,tax:"營業稅",region:"臺北市",agency:"UNSPECIFIED",budget:null,actual:300,unit:"千元",sourceId:"fixture",recordType:"TAX_ACTUAL"}
  ]);
  assert.equal(result.regionalComparisons[0].actual,300);
});
