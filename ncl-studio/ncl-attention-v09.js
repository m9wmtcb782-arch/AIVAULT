(()=>{'use strict';
const T=window.NCLTensor&&window.NCLTensor.Tensor;
if(!T)throw Error('請先載入 NCL Tensor v0.4');
function same3(a,b,label){if(!(a instanceof T)||!(b instanceof T)||a.shape.length!==3||b.shape.join(',')!==a.shape.join(','))throw Error(label+' 必須是相同 shape 的 [batch, sequence, dimension] Tensor');}
class PositionalEncoding{
 constructor(dimension,maxLength=4096){if(!Number.isSafeInteger(dimension)||dimension<1||!Number.isSafeInteger(maxLength)||maxLength<1||dimension*maxLength>10000000)throw Error('PositionalEncoding 參數不合法');this.dimension=dimension;this.maxLength=maxLength;}
 forward(x){if(!(x instanceof T)||x.shape.length!==3||x.shape[2]!==this.dimension)throw Error('PositionalEncoding 輸入 shape 不符');const [b,s,d]=x.shape;if(s>this.maxLength)throw Error('序列長度超過 maxLength');const out=new Float64Array(x.data.length);for(let n=0;n<b;n++)for(let p=0;p<s;p++)for(let j=0;j<d;j++){const angle=p/Math.pow(10000,2*Math.floor(j/2)/d),pe=j%2===0?Math.sin(angle):Math.cos(angle),i=(n*s+p)*d+j;out[i]=x.data[i]+pe;}return new T(out,x.shape);}
 backward(g){if(!(g instanceof T)||g.shape.length!==3||g.shape[2]!==this.dimension)throw Error('PositionalEncoding 梯度 shape 不符');return new T(g.data,g.shape);}
}
class CausalSelfAttention{
 constructor(dimension){if(!Number.isSafeInteger(dimension)||dimension<1||dimension>4096)throw Error('Attention dimension 不合法');this.dimension=dimension;this.q=null;this.k=null;this.v=null;this.weights=null;this.batch=0;this.sequence=0;}
 forward(q,k,v){same3(q,k,'Query/Key');same3(q,v,'Query/Value');const [b,s,d]=q.shape;if(d!==this.dimension||s>4096||b*s*s>10000000)throw Error('Attention shape 或運算量超過限制');const w=new Float64Array(b*s*s),out=new Float64Array(b*s*d),scale=1/Math.sqrt(d);
  for(let n=0;n<b;n++)for(let i=0;i<s;i++){let max=-Infinity;for(let j=0;j<=i;j++){let dot=0;for(let z=0;z<d;z++)dot+=q.data[(n*s+i)*d+z]*k.data[(n*s+j)*d+z];const score=dot*scale;w[(n*s+i)*s+j]=score;max=Math.max(max,score);}let sum=0;for(let j=0;j<=i;j++){const ix=(n*s+i)*s+j,e=Math.exp(w[ix]-max);w[ix]=e;sum+=e;}for(let j=0;j<=i;j++){const ix=(n*s+i)*s+j;w[ix]/=sum;for(let z=0;z<d;z++)out[(n*s+i)*d+z]+=w[ix]*v.data[(n*s+j)*d+z];}}
  this.q=new T(q.data,q.shape);this.k=new T(k.data,k.shape);this.v=new T(v.data,v.shape);this.weights=w;this.batch=b;this.sequence=s;return new T(out,[b,s,d]);
 }
 backward(g){if(!this.weights)throw Error('Attention backward 前必須先 forward');const {batch:b,sequence:s,dimension:d}=this; if(!(g instanceof T)||g.shape.join(',')!==[b,s,d].join(','))throw Error('Attention 梯度 shape 不符');const dq=new Float64Array(b*s*d),dk=new Float64Array(b*s*d),dv=new Float64Array(b*s*d),scale=1/Math.sqrt(d),dw=new Float64Array(s);
  for(let n=0;n<b;n++)for(let i=0;i<s;i++){let weighted=0;for(let j=0;j<=i;j++){let dot=0;for(let z=0;z<d;z++){const oi=(n*s+i)*d+z,vj=(n*s+j)*d+z;dot+=g.data[oi]*this.v.data[vj];dv[vj]+=this.weights[(n*s+i)*s+j]*g.data[oi];}dw[j]=dot;weighted+=this.weights[(n*s+i)*s+j]*dot;}for(let j=0;j<=i;j++){const ix=(n*s+i)*s+j,ds=this.weights[ix]*(dw[j]-weighted)*scale;for(let z=0;z<d;z++){const qi=(n*s+i)*d+z,kj=(n*s+j)*d+z;dq[qi]+=ds*this.k.data[kj];dk[kj]+=ds*this.q.data[qi];}}}
  return {query:new T(dq,[b,s,d]),key:new T(dk,[b,s,d]),value:new T(dv,[b,s,d])};
 }
}
window.NCLAttentionV09=Object.freeze({PositionalEncoding,CausalSelfAttention,version:'0.9.0',backend:'cpu-reference',attention:'single-head-scaled-dot-product-causal',limits:{maxSequenceLength:4096,maxAttentionCells:10000000}});
})();