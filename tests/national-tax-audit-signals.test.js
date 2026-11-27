const assert=require("node:assert/strict");
const rules=[{label:"重大訊號",check:r=>r.actual<0},{label:"注意訊號",check:r=>r.budget!==null&&r.budget>0&&r.actual/r.budget<0.8},{label:"一般訊號",check:r=>r.budget!==null&&r.budget>0&&r.actual/r.budget>=1.2}];
const data=[{actual:-3,budget:100},{actual:79,budget:100},{actual:120,budget:100},{actual:100,budget:0},{actual:120,budget:null},{actual:80,budget:100}];
assert.deepEqual(rules.map(x=>data.filter(x.check).length),[1,2,1]);
console.log("PASS: 3 audit signal thresholds");
