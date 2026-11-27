import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { mapMof16910, mapDot46025, mapMofWideTaxRows } from "../adapters.js";
const fx=JSON.parse(await readFile(new URL("../fixtures/adapter-sample.json",import.meta.url),"utf8"));
const meta={sourceId:"fixture-adapter-v1",unit:"新臺幣千元",rawSha256:"a".repeat(64)};
test("adapter fixture is synthetic",()=>assert.match(fx.fixtureType,/SYNTHETIC/));
test("16910 maps annual budget and actual with supplied year",()=>{
 const r=mapMof16910(fx.mof16910,{...meta,year:2024});
 assert.equal(r[0].year,2024);assert.equal(r[0].budget,1200000);assert.equal(r[0].actual,1250000);
});
test("16910 refuses missing year instead of guessing",()=>assert.throws(()=>mapMof16910(fx.mof16910,meta)));
test("46025 maps year series and units",()=>{
 const r=mapDot46025(fx.dot46025,meta);assert.equal(r[1].year,2022);assert.equal(r[1].actual,106000);
});
test("6742 maps each tax column and flags aggregates to prevent double count",()=>{
 const r=mapMofWideTaxRows(fx.mof6742,{...meta,year:2024,dimension:"region"});
 assert.ok(r.some(x=>x.region==="臺北市"&&x.tax==="營業稅"&&x.actual===300000));
 assert.equal(r.find(x=>x.tax==="總計").recordType,"AGGREGATE");
 assert.equal(r.find(x=>x.tax==="營利事業所得稅").recordType,"TAX_ACTUAL");
});
test("wide adapter requires explicit dimension",()=>assert.throws(()=>mapMofWideTaxRows(fx.mof6742,{...meta,year:2024})));
