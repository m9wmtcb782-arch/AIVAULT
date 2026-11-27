import test from "node:test";
import assert from "node:assert/strict";
import { analyzeFiscalRiskLinkages } from "../fiscal-risk-linkage.js";

const base={governmentScope:"中央政府",periodType:"calendar-year",accountingBasis:"final-actual",unit:"億元"};
test("links revenue shortfall, expenditure growth, debt growth and interest burden with traceable evidence",()=>{
 const rows=[
  {...base,period:"2023",revenueBudget:1000,revenueActual:1000,expenditureActual:900,debtOutstanding:500,interestExpense:20,sourceId:"S23"},
  {...base,period:"2024",revenueBudget:1000,revenueActual:900,expenditureActual:1100,debtOutstanding:600,interestExpense:30,sourceId:"S24"}
 ];
 const [x]=analyzeFiscalRiskLinkages(rows);
 assert.equal(x.state,"PENDING_AUDIT");assert.equal(x.signalCount,4);
 assert.equal(x.riskLevel,"HIGH");assert.deepEqual(x.evidenceRefs,["S24","S23"]);
 assert.equal(x.trace.causalInference,false);assert.equal(x.comparisonPeriod,"2023");
});
test("does not compare different government scopes, units, accounting bases or period types",()=>{
 const rows=[
  {...base,period:"2023",revenueBudget:100,revenueActual:100,expenditureActual:100,debtOutstanding:100,interestExpense:1},
  {...base,period:"2024",revenueBudget:100,revenueActual:80,expenditureActual:150,debtOutstanding:150,interestExpense:2},
  {...base,governmentScope:"地方政府",period:"2024",revenueBudget:100,revenueActual:80,expenditureActual:150,debtOutstanding:150,interestExpense:2},
  {...base,unit:"千元",period:"2024",revenueBudget:100,revenueActual:80,expenditureActual:150,debtOutstanding:150,interestExpense:2},
  {...base,accountingBasis:"budget",period:"2024",revenueBudget:100,revenueActual:80,expenditureActual:150,debtOutstanding:150,interestExpense:2}
 ];
 const out=analyzeFiscalRiskLinkages(rows);
 assert.ok(out.every(x=>x.comparisonPeriod===null));
});
test("missing metrics are explicit and do not get imputed",()=>{
 const rows=[{...base,period:"2024",revenueBudget:100,revenueActual:80,expenditureActual:null,debtOutstanding:null,interestExpense:null}];
 const [x]=analyzeFiscalRiskLinkages(rows);
 assert.equal(x.dataStatus,"PARTIAL_DATA");assert.ok(x.missingMetrics.includes("debtOutstanding"));
 assert.equal(x.metrics.debtGrowthPct,null);
});
test("thresholds are configurable and are research screening rules, not legal limits",()=>{
 const rows=[{...base,period:"2024",revenueBudget:100,revenueActual:96,expenditureActual:100,debtOutstanding:100,interestExpense:1}];
 assert.equal(analyzeFiscalRiskLinkages(rows).length,0);
 assert.equal(analyzeFiscalRiskLinkages(rows,{revenueShortfallPct:3}).length,1);
});
test("rejects observations without strict alignment metadata",()=>{
 assert.throws(()=>analyzeFiscalRiskLinkages([{period:"2024"}]),/Missing alignment key/);
});
