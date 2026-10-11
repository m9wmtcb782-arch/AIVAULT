import test from 'node:test';
import assert from 'node:assert/strict';
import {matmulReference,rowSoftmaxReference} from '../aivault-collab-v0.2/gpu-fabric-matrix-v0.1.mjs';
test('rectangular and transposed matrices match independent hand algebra',()=>{
  const args={left:[1,2,3,4,5,6],right:[7,8,9,10,11,12],rows:2,inner:3,columns:2};
  assert.deepEqual(matmulReference(args),[58,64,139,154]);
  assert.deepEqual(matmulReference({...args,right:[7,9,11,8,10,12],transposeRight:true}),[58,64,139,154]);
});
test('stable softmax normalizes each row, handles large offsets and singleton rows',()=>{
  const p=rowSoftmaxReference({input:[1000,1000,1000,-1000,-1000,-1000],rows:2,columns:3});
  for(const x of p)assert.ok(Math.abs(x-1/3)<1e-7);
  assert.deepEqual(rowSoftmaxReference({input:[3e38,-3e38],rows:1,columns:2}),[1,0]);
  assert.deepEqual(rowSoftmaxReference({input:[-100,100],rows:2,columns:1}),[1,1]);
});
test('bad dimensions/shapes/non-finite data and overflow are rejected',()=>{
  const a={left:[1],right:[1],rows:1,inner:1,columns:1};
  for(const patch of [{rows:0},{columns:4097},{inner:1.5},{left:[NaN]},{right:[Infinity]},{right:[]},{transposeRight:'true'},{rows:4096,inner:4096,columns:4096}])assert.throws(()=>matmulReference({...a,...patch}));
  assert.throws(()=>matmulReference({...a,left:[3e38],right:[2]}),/exceeds/);
  assert.throws(()=>rowSoftmaxReference({input:[Infinity],rows:1,columns:1}));
});
