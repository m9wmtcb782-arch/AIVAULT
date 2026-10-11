// Actual Metal subprocess conformance. No API key, network or model download.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {matmulReference,rowSoftmaxReference} from '../aivault-collab-v0.2/gpu-fabric-matrix-v0.1.mjs';
const binary=process.argv[2];if(!binary)throw Error('compiled native Metal binary required');
const cases=[];
for(const [rows,inner,columns] of [[1,1,1],[2,3,2],[3,2,5],[7,9,3],[4,5,6]]) {
  const left=Array.from({length:rows*inner},(_,i)=>(i%7-3)/2),right=Array.from({length:inner*columns},(_,i)=>(i%11-5)/4);
  cases.push({operation:'matmul',left,right,rows,inner,columns});
  const transposed=Array.from({length:right.length},(_,i)=>right[(i%inner)*columns+Math.floor(i/inner)]);
  cases.push({operation:'matmul',left,right:transposed,rows,inner,columns,transposeRight:true});
}
for(const item of [{input:[1000,1001,999,-1000,-1001,-999],rows:2,columns:3},
 {input:[3e38,-3e38],rows:1,columns:2},{input:[-4,6],rows:2,columns:1},
 {input:Array.from({length:51},(_,i)=>(i%13-6)/2),rows:3,columns:17}])cases.push({operation:'row_softmax',...item});
const validCount=cases.length;
cases.push({operation:'matmul',left:[3e38],right:[2],rows:1,inner:1,columns:1},
 {operation:'matmul',left:[1],right:[1],rows:0,inner:1,columns:1},
 {operation:'matmul',left:[1],right:[],rows:1,inner:1,columns:1},
 {operation:'matmul',left:[1],right:[1],rows:4096,inner:4096,columns:4096},
 {operation:'row_softmax',input:[1],rows:1,columns:2},
 {operation:'row_softmax',input:[1],rows:4097,columns:1});
const result=JSON.parse(execFileSync(binary,[],{input:JSON.stringify(cases),encoding:'utf8',timeout:30000,maxBuffer:1024*1024}));
assert.equal(result.cases.length,cases.length);
function close(actual,expected){assert.equal(actual.length,expected.length);for(let i=0;i<expected.length;i++)assert.ok(Math.abs(actual[i]-expected[i])<=1e-5*Math.max(1,Math.abs(expected[i])),`mismatch ${i}: ${actual[i]} vs ${expected[i]}`);}
for(let i=0;i<validCount;i++){
  assert.equal(result.cases[i].error,undefined);
  close(result.cases[i].output,cases[i].operation==='matmul'?matmulReference(cases[i]):rowSoftmaxReference(cases[i]));
}
assert.equal(result.cases[validCount].error,'execution_failed');
for(let i=validCount+1;i<cases.length;i++)assert.equal(result.cases[i].error,'invalid_input');
const p=Math.exp(1/Math.sqrt(2))/(1+Math.exp(1/Math.sqrt(2)));
close(result.attention,[2*p+6*(1-p),4*p+8*(1-p),2*(1-p)+6*p,4*(1-p)+8*p]);
console.log(`CONFIRMED: actual local Metal matmul/transpose and stable row softmax matched CPU references; ${cases.length} cases; device=${result.device}`);
console.log('CONFIRMED: real local Metal QK^T -> scale -> softmax -> PV chain matched independent attention algebra; NaN/Infinity and overflow rejected');
console.log('NOT VERIFIED: deployed creative model, weight loading, multi-head/masked attention, two physical GPUs or iPhone installation');
