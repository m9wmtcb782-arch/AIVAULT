// Float32 CPU conformance references. Never GPU or deployed model evidence.
const finite = values => Array.isArray(values) && values.every(x=>typeof x==='number'&&Number.isFinite(Math.fround(x)));
const dimension = n => Number.isSafeInteger(n)&&n>0&&n<=4096;
export function matmulReference({left,right,rows,inner,columns,transposeRight=false}) {
  if(![rows,inner,columns].every(dimension)||typeof transposeRight!=='boolean'||rows*inner+inner*columns+rows*columns>1048576||
     !finite(left)||!finite(right)||left.length!==rows*inner||right.length!==inner*columns) throw Error('invalid bounded Float32 matrix');
  return Array.from({length:rows*columns},(_,i)=>{
    const row=Math.floor(i/columns),col=i%columns;let sum=0;
    for(let k=0;k<inner;k++)sum=Math.fround(sum+Math.fround(Math.fround(left[row*inner+k])*Math.fround(right[transposeRight?col*inner+k:k*columns+col])));
    if(!Number.isFinite(sum))throw Error('matrix accumulation exceeds Float32 range');return sum;
  });
}
export function rowSoftmaxReference({input,rows,columns}) {
  if(![rows,columns].every(dimension)||2*rows*columns>1048576||!finite(input)||input.length!==rows*columns)throw Error('invalid bounded Float32 softmax');
  const out=[];
  for(let row=0;row<rows;row++){
    const values=input.slice(row*columns,(row+1)*columns).map(Math.fround),maximum=Math.max(...values);
    const exp=values.map(x=>Math.fround(Math.exp(Math.fround(x-maximum))));let total=0;
    for(const x of exp)total=Math.fround(total+x);
    out.push(...exp.map(x=>Math.fround(x/total)));
  }
  return out;
}
