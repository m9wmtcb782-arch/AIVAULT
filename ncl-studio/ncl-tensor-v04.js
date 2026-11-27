(()=>{'use strict';
function sizeOf(shape){if(!Array.isArray(shape)||shape.length<1||shape.length>4)throw Error('shape 必須是 1–4 維整數陣列');let n=1;for(const d of shape){if(!Number.isSafeInteger(d)||d<1)throw Error('維度必須是正安全整數');n*=d;if(!Number.isSafeInteger(n)||n>10000000)throw Error('Tensor 元素數超過安全上限 10,000,000');}return n;}
function flatten(value,out=[]){if(Array.isArray(value)||ArrayBuffer.isView(value)){for(const v of value)flatten(v,out);}else{if(typeof value!=='number'||!Number.isFinite(value))throw Error('Tensor 只接受有限數字');out.push(value);}return out;}
function strides(shape){const s=new Array(shape.length);let n=1;for(let i=shape.length-1;i>=0;i--){s[i]=n;n*=shape[i];}return s;}
class Tensor{
 constructor(data,shape){const count=sizeOf(shape),flat=flatten(data);if(flat.length!==count)throw Error('資料數量 '+flat.length+' 與 shape 元素數 '+count+' 不符');this.shape=Object.freeze([...shape]);this.data=Float64Array.from(flat);Object.freeze(this);}
 static from(data,shape){return new Tensor(data,shape);}
 static vector(data){return new Tensor(data,[data.length]);}
 static zeros(shape){return new Tensor(new Array(sizeOf(shape)).fill(0),shape);}
 static ones(shape){return new Tensor(new Array(sizeOf(shape)).fill(1),shape);}
 static add(a,b){sameShape(a,b);return new Tensor(a.data.map((v,i)=>v+b.data[i]),a.shape);}
 static subtract(a,b){sameShape(a,b);return new Tensor(a.data.map((v,i)=>v-b.data[i]),a.shape);}
 static scale(a,k){if(typeof k!=='number'||!Number.isFinite(k))throw Error('倍率必須是有限數字');return new Tensor(a.data.map(v=>v*k),a.shape);}
 static relu(a){return new Tensor(a.data.map(v=>Math.max(0,v)),a.shape);}
 static transpose(a){if(a.shape.length!==2)throw Error('transpose 目前只支援二維矩陣');const [r,c]=a.shape,out=new Array(a.data.length);for(let i=0;i<r;i++)for(let j=0;j<c;j++)out[j*r+i]=a.data[i*c+j];return new Tensor(out,[c,r]);}
 static matmul(a,b){if(a.shape.length!==2||b.shape.length!==2)throw Error('matmul 目前只支援二維矩陣');const [m,k]=a.shape,[k2,n]=b.shape;if(k!==k2)throw Error('matmul 維度不相容：'+a.shape+' × '+b.shape);const out=new Array(m*n).fill(0);for(let i=0;i<m;i++)for(let p=0;p<k;p++){const av=a.data[i*k+p];for(let j=0;j<n;j++)out[i*n+j]+=av*b.data[p*n+j];}return new Tensor(out,[m,n]);}
 static softmax(a){if(a.shape.length!==1&&a.shape.length!==2)throw Error('softmax 目前只支援向量或二維矩陣');const cols=a.shape[a.shape.length-1],rows=a.data.length/cols,out=new Array(a.data.length);for(let r=0;r<rows;r++){let max=-Infinity;for(let c=0;c<cols;c++)max=Math.max(max,a.data[r*cols+c]);let sum=0;for(let c=0;c<cols;c++){const e=Math.exp(a.data[r*cols+c]-max);out[r*cols+c]=e;sum+=e;}for(let c=0;c<cols;c++)out[r*cols+c]/=sum;}return new Tensor(out,a.shape);}
 static mse(a,b){sameShape(a,b);let sum=0;for(let i=0;i<a.data.length;i++){const d=a.data[i]-b.data[i];sum+=d*d;}return sum/a.data.length;}
 toArray(){if(this.shape.length===1)return Array.from(this.data);const s=this.shape,st=strides(s);function nest(dim,offset){const out=[];for(let i=0;i<s[dim];i++){const at=offset+i*st[dim];out.push(dim===s.length-1?this.data[at]:nest.call(this,dim+1,at));}return out;}return nest.call(this,0,0);}
}
function sameShape(a,b){if(!(a instanceof Tensor)||!(b instanceof Tensor))throw Error('運算參數必須是 NCL Tensor');if(a.shape.length!==b.shape.length||a.shape.some((v,i)=>v!==b.shape[i]))throw Error('Tensor shape 不一致：'+a.shape+' 與 '+b.shape);}
window.NCLTensor=Object.freeze({Tensor,version:'0.4.0',backend:'cpu-reference',limits:{maxElements:10000000,maxRank:4},ops:{add:Tensor.add,subtract:Tensor.subtract,scale:Tensor.scale,relu:Tensor.relu,transpose:Tensor.transpose,matmul:Tensor.matmul,softmax:Tensor.softmax,mse:Tensor.mse}});
})();