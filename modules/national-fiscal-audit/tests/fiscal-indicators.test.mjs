import test from "node:test";
import assert from "node:assert/strict";
import { calculateFiscalBalance, calculateDebtToGDP, calculateInterestBurden, compareFiscalPeriods, sumFiscalAmounts } from "../fiscal-indicators.js";

test("fiscal balance reports surplus or deficit without changing source unit",()=>{
  const x=calculateFiscalBalance({revenue:120,expenditure:130,unit:"億元",period:"2024",accountingBasis:"決算"});
  assert.equal(x.balance,-10); assert.equal(x.balanceRate,-10/120*100); assert.equal(x.unit,"億元");
});
test("debt ratio requires a real non-zero GDP denominator",()=>{
  assert.equal(calculateDebtToGDP({debt:40,gdp:0}).value,null);
  assert.equal(calculateDebtToGDP({debt:40,gdp:200}).value,20);
});
test("interest burden is computed only from supplied actual inputs",()=>{
  assert.equal(calculateInterestBurden({interestExpense:5,revenue:100}).value,5);
  assert.equal(calculateInterestBurden({interestExpense:5,revenue:null}).value,null);
});
test("period comparison separates calendar/fiscal years and accounting bases",()=>{
  const out=compareFiscalPeriods([
    {period:"2023",value:100,unit:"億元",periodType:"calendar",accountingBasis:"cash",governmentScope:"central",indicator:"revenue"},
    {period:"2024",value:110,unit:"億元",periodType:"calendar",accountingBasis:"cash",governmentScope:"central",indicator:"revenue"},
    {period:"2024",value:120,unit:"億元",periodType:"fiscal",accountingBasis:"cash",governmentScope:"central",indicator:"revenue"}
  ]);
  assert.equal(out.length,3);
  assert.ok(out.some(x=>x.changeRate===10));
});
test("amount aggregation keeps unlike units and bases apart",()=>{
  const out=sumFiscalAmounts([
    {amount:1,unit:"億元",periodType:"annual",accountingBasis:"budget",region:"A"},
    {amount:2,unit:"千元",periodType:"annual",accountingBasis:"budget",region:"A"},
    {amount:3,unit:"億元",periodType:"annual",accountingBasis:"actual",region:"A"}
  ],["region"]);
  assert.equal(out.length,3);
});
