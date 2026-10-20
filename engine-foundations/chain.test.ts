import { strict as assert } from "node:assert";
import { infer } from "./chain.ts";
const evidence = [{id:"e1",proposition:"A",supports:true,sourceUrl:"https://example.org/a",verified:true}];
const rules = [
{id:"r1",premises:["A"],conclusion:"B",supports:true,sourceUrl:"https://example.org/r1",verified:true},
{id:"r2",premises:["B"],conclusion:"C",supports:true,sourceUrl:"https://example.org/r2",verified:true}
];
const output=infer(evidence,rules);
assert.equal(output.facts.find(f=>f.proposition==="C")?.truth,"PROVEN");
assert.deepEqual(output.facts.find(f=>f.proposition==="C")?.ruleIds,["r2"]);
const unknown=infer([{...evidence[0],verified:false}],rules);
assert.equal(unknown.facts.find(f=>f.proposition==="C"),undefined);
const conflict=infer([...evidence,{id:"e2",proposition:"B",supports:false,sourceUrl:"https://example.org/b",verified:true}],rules);
assert.equal(conflict.facts.find(f=>f.proposition==="B")?.truth,"CONFLICT");
const cycle=infer(evidence,[...rules,{id:"r3",premises:["C"],conclusion:"A",supports:true,sourceUrl:"https://example.org/r3",verified:true}]);
assert.equal(cycle.truncated,false);
console.log("chain v0.2 tests passed");
