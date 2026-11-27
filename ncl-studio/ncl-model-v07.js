(()=>{'use strict';
const T=window.NCLTensor&&window.NCLTensor.Tensor,N=window.NCLNeural,M=window.NCLModel;
if(!T||!N||!M)throw Error('請先載入 NCL Tensor v0.4、Neural v0.5 與 Model v0.6');
function finite(v,label){if(!Number.isFinite(v))throw Error(label+' 出現非有限數值');return v;}
class Activation{
 constructor(kind){if(!['relu','sigmoid','tanh'].includes(kind))throw Error('不支援的啟用函數：'+kind);this.kind=kind;this.input=null;this.output=null;}
 forward(x){if(!(x instanceof T))throw Error('Activation 輸入必須是 Tensor');this.input=x;let out;
  if(this.kind==='relu')out=x.data.map(v=>Math.max(0,v));
  else if(this.kind==='sigmoid')out=x.data.map(v=>v>=0?1/(1+Math.exp(-v)):Math.exp(v)/(1+Math.exp(v)));
  else out=x.data.map(v=>Math.tanh(v));
  this.output=new T(out,x.shape);return this.output;
 }
 backward(g){if(!this.input||!this.output)throw Error('Activation backward 前必須先 forward');if(!(g instanceof T)||g.shape.length!==this.output.shape.length||g.shape.some((v,i)=>v!==this.output.shape[i]))throw Error('Activation 梯度 shape 不符');
  const out=new Float64Array(g.data.length);for(let i=0;i<out.length;i++){const y=this.output.data[i],x=this.input.data[i],d=this.kind==='relu'?(x>0?1:0):this.kind==='sigmoid'?y*(1-y):1-y*y;out[i]=finite(g.data[i]*d,'activation backward');}return new T(out,g.shape);
 }
}
class Adam{
 constructor(options={}){this.beta1=options.beta1??0.9;this.beta2=options.beta2??0.999;this.epsilon=options.epsilon??1e-8;this.m=new WeakMap();this.steps=new WeakMap();
  if(!(this.beta1>=0&&this.beta1<1&&this.beta2>=0&&this.beta2<1&&this.epsilon>0&&Number.isFinite(this.epsilon)))throw Error('Adam 參數不合法');}
 step(layer,rate){if(!(layer instanceof N.Dense))throw Error('Adam 目前只更新 Dense 層');if(!layer.hasGradients)throw Error('Dense 層沒有可更新梯度');if(!(rate>0&&Number.isFinite(rate)))throw Error('learningRate 必須是正有限數');
  if(layer.mode==='fixed'){layer.hasGradients=false;return {updated:false,mode:'fixed'};}
  if(layer.mode==='half-restore')throw Error('Adam 不支援 half-restore；請改用 variable 或 fixed');
  let state=this.m.get(layer);if(!state){state={mw:new Float64Array(layer.w.length),vw:new Float64Array(layer.w.length),mb:new Float64Array(layer.b.length),vb:new Float64Array(layer.b.length)};this.m.set(layer,state);}
  const step=(this.steps.get(layer)||0)+1;this.steps.set(layer,step);const c1=1-Math.pow(this.beta1,step),c2=1-Math.pow(this.beta2,step);
  const update=(p,g,m,v)=>{for(let i=0;i<p.length;i++){m[i]=this.beta1*m[i]+(1-this.beta1)*g[i];v[i]=this.beta2*v[i]+(1-this.beta2)*g[i]*g[i];p[i]=finite(p[i]-rate*(m[i]/c1)/(Math.sqrt(v[i]/c2)+this.epsilon),'Adam update');}};
  update(layer.w,layer.gw,state.mw,state.vw);update(layer.b,layer.gb,state.mb,state.vb);layer.hasGradients=false;return {updated:true,step,mode:'adam'};
 }
}
class Sequential{
 constructor(layers=[]){if(!Array.isArray(layers)||!layers.length)throw Error('模型至少需要一層');this.layers=[...layers];for(const l of this.layers)if(!(l instanceof N.Dense)&&!(l instanceof Activation))throw Error('只接受 Dense 與 Activation 層');let prev=null;for(const l of this.layers){if(l instanceof N.Dense){if(prev!==null&&prev!==l.inputSize)throw Error('相鄰層維度不相容');prev=l.outputSize;}else if(prev===null)throw Error('Activation 前必須有 Dense 層');}this.lastOutput=null;}
 forward(x){for(const l of this.layers)x=l.forward(x);this.lastOutput=x;return x;}
 backward(g){if(!this.lastOutput)throw Error('backward 前必須先 forward');for(let i=this.layers.length-1;i>=0;i--)g=this.layers[i].backward(g);return g;}
 applyGradients(rate,optimizer=null){const out=[];for(const l of this.layers)if(l instanceof N.Dense)out.push(optimizer?optimizer.step(l,rate):l.applyGradients(rate));return out;}
 setWeightMode(mode){for(const l of this.layers)if(l instanceof N.Dense)l.setWeightMode(mode);return this;}
 save(){const payload={format:'NCL-MODEL',version:2,layers:this.layers.map(l=>l instanceof N.Dense?({type:'Dense',inputSize:l.inputSize,outputSize:l.outputSize,weightMode:l.mode,weights:Array.from(l.w),bias:Array.from(l.b)}):({type:'Activation',kind:l.kind}))};const body=JSON.stringify(payload);return {payload,checksum:M.checksum(body)};}
 static load(record){if(!record||!record.payload||typeof record.checksum!=='string')throw Error('模型存檔格式錯誤');if(M.checksum(JSON.stringify(record.payload))!==record.checksum)throw Error('模型 checksum 不符');const p=record.payload;if(p.format!=='NCL-MODEL'||p.version!==2||!Array.isArray(p.layers)||!p.layers.length||p.layers.length>128)throw Error('不支援的 NCL-MODEL/2 格式');const layers=p.layers.map((x,i)=>{if(x.type==='Activation')return new Activation(x.kind);if(x.type!=='Dense')throw Error('第 '+i+' 層類型不支援');const d=new N.Dense(x.inputSize,x.outputSize,{weightMode:x.weightMode});if(!Array.isArray(x.weights)||!Array.isArray(x.bias)||x.weights.length!==d.w.length||x.bias.length!==d.b.length||x.weights.some(v=>!Number.isFinite(v))||x.bias.some(v=>!Number.isFinite(v)))throw Error('第 '+i+' 層權重資料錯誤');d.w.set(x.weights);d.b.set(x.bias);return d;});return new Sequential(layers);}
}
window.NCLModelV07=Object.freeze({Sequential,Activation,Adam,version:'0.7.0',serialization:'NCL-MODEL/2',optimizers:['adam'],activations:['relu','sigmoid','tanh']});
})();