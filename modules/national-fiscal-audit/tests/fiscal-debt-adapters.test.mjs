import test from "node:test";
import assert from "node:assert/strict";
import { mapPublicDebtActual, mapPublicDebtBudget, mapNationalDebtClock } from "../fiscal-debt-adapters.js";

const actual=[{"資料所屬年度":"2025","資料所屬截止月份":"10","政府別":"中央","債務未償餘額":"58000","歲出(不含保留數)_新臺幣億元":"30000","未償餘額/歲出比率_百分比":"193.3","當年度舉債額度超限註記":"未超限"}];
test("maps actual public debt with month, government scope and source units",()=>{
 const [x]=mapPublicDebtActual(actual,{sourceUrl:"https://data.gov.tw/dataset/30955",rawSha256:"abc"});
 assert.equal(x.period,"2025-10");assert.equal(x.debtOutstanding,58000);
 assert.equal(x.unit,"新臺幣億元");assert.equal(x.governmentScope,"中央");
 assert.equal(x.debtToExpenditureRate,193.3);assert.equal(x.rawSha256,"abc");
});
test("budget and actual debt remain explicitly distinguishable",()=>{
 const row=[{"資料所屬年度":2025,"資料所屬截止月份":12,"政府別":"地方","債務未償餘額":"100","當年度預算編列舉債數_新臺幣億元":"5"}];
 assert.equal(mapPublicDebtBudget(row)[0].dataKind,"budget");
 assert.equal(mapPublicDebtActual(row)[0].dataKind,"actual");
});
test("rejects rows with missing debt period instead of guessing",()=>{
 assert.throws(()=>mapPublicDebtActual([{"政府別":"中央"}]),/Missing debt period/);
});
test("maps central debt clock fields separately",()=>{
 const [x]=mapNationalDebtClock([{"日期":"2025年10月","中央政府1年以上債務未償餘額_新臺幣億元":"58000","中央政府短期債務未償餘額_新臺幣億元":"300","臺灣人口數_人":"23000000","人均負擔債務_新臺幣萬元":"25.3"}]);
 assert.equal(x.governmentScope,"CENTRAL");assert.equal(x.longTermDebt,58000);assert.equal(x.shortTermDebt,300);
});
