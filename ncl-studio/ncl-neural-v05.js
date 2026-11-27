(()=>{'use strict';
const Tensor=window.NCLTensor&&window.NCLTensor.Tensor;
if(!Tensor)throw Error('請先載入 ncl-tensor-v04.js');
function assertTensor(t,shape,label){if(!(t instanceof Tensor))throw Error(label+' 必須是 NCL Tensor');if(shape&& (t.shape.length!==shape.length||t.shape.some((v,i)=>v!==shape[i])))throw Error(label+' shape 應為 ['+shape+']，實際為 ['+t.shape+']');}
function finite(v,label){if(!Number.isFinite(v))throw Error(label+' 出現非有限數值');return v;}
function seeded(seed){let s=(Number(seed)>>>0)||0x6d2b79f5;return()=>{s+=0x6D2B79F5;let t=s;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;};}
class Dense{
 constructor(inputSize,outputSize,options={}){
  if(!Number.isSafeInteger(inputSize)||inputSize<1||!Number.isSafeInteger(outputSize)||outputSize<1)throw Error('Dense 輸入與輸出維度必須是正整數');
  if(inputSize*outputSize>10000000)throw Error('Dense 權重數量超過 10,000,000');
  this.inputSize=inputSize;this.outputSize=outputSize;this.mode=options.weightMode||'variable';
  if(!['fixed','variable','half-restore'].includes(this.mode))throw Error('未知權重模式：'+this.mode);
  const random=seeded(options.seed===undefined?1:options.seed),limit=Math.sqrt(6/(inputSize+outputSize));
  this.w=new Float64Array(inputSize*outputSize);for(let i=0;i<this.w.length;i++)this.w[i]=(random()*2-1)*limit;
  this.b=new Float64Array(outputSize);this.gw=new Float64Array(this.w.length);this.gb=new Float64Array(outputSize);
  this.lastInput=null;this.hasGradients=false;this.halfPhase='update';this.restoreSnapshot=null;
 }
 setWeightMode(mode){if(!['fixed','variable','half-restore'].includes(mode))throw Error('未知權重模式：'+mode);this.mode=mode;this.halfPhase='update';this.restoreSnapshot=null;return this;}
 forward(input){
  assertTensor(input,null,'Dense 輸入');if(input.shape.length!==2||input.shape[1]!==this.inputSize)throw Error('Dense 輸入 shape 應為 [batch, '+this.inputSize+']');
  const batch=input.shape[0],out=new Float64Array(batch*this.outputSize);
  for(let n=0;n<batch;n++)for(let j=0;j<this.outputSize;j++){let sum=this.b[j];for(let i=0;i<this.inputSize;i++)sum+=input.data[n*this.inputSize+i]*this.w[i*this.outputSize+j];out[n*this.outputSize+j]=finite(sum,'forward');}
  this.lastInput=new Tensor(input.data,[batch,this.inputSize]);this.hasGradients=false;return new Tensor(out,[batch,this.outputSize]);
 }
 backward(gradient){
  if(!this.lastInput)throw Error('backward 前必須先呼叫 forward');
  const batch=this.lastInput.shape[0];assertTensor(gradient,[batch,this.outputSize],'梯度');
  const dx=new Float64Array(batch*this.inputSize);this.gw.fill(0);this.gb.fill(0);
  for(let n=0;n<batch;n++)for(let j=0;j<this.outputSize;j++){
   const g=gradient.data[n*this.outputSize+j];this.gb[j]+=g;
   for(let i=0;i<this.inputSize;i++){this.gw[i*this.outputSize+j]+=this.lastInput.data[n*this.inputSize+i]*g;dx[n*this.inputSize+i]+=this.w[i*this.outputSize+j]*g;}
  }
  for(const v of this.gw)finite(v,'weight gradient');for(const v of this.gb)finite(v,'bias gradient');
  this.hasGradients=true;return new Tensor(dx,[batch,this.inputSize]);
 }
 applyGradients(learningRate){
  if(!this.hasGradients)throw Error('沒有可更新的梯度；請先呼叫 backward');
  if(typeof learningRate!=='number'||!Number.isFinite(learningRate)||learningRate<=0)throw Error('learningRate 必須是正的有限數字');
  if(this.mode==='fixed'){this.hasGradients=false;return {updated:false,mode:this.mode,phase:'locked'};}
  if(this.mode==='half-restore'){
   const total=this.w.length+this.b.length,half=Math.ceil(total/2);
   if(this.halfPhase==='update'){
    this.restoreSnapshot=[];
    for(let i=0;i<half;i++){const old=i<this.w.length?this.w[i]:this.b[i-this.w.length];this.restoreSnapshot.push(old);const grad=i<this.w.length?this.gw[i]:this.gb[i-this.w.length];const next=finite(old-learningRate*grad,'half-restore update');if(i<this.w.length)this.w[i]=next;else this.b[i-this.w.length]=next;}
    this.halfPhase='restore';this.hasGradients=false;return {updated:true,mode:this.mode,phase:'half-updated',parametersChanged:half};
   }
   for(let i=0;i<half;i++){if(i<this.w.length)this.w[i]=this.restoreSnapshot[i];else this.b[i-this.w.length]=this.restoreSnapshot[i];}
   this.restoreSnapshot=null;this.halfPhase='update';this.hasGradients=false;return {updated:true,mode:this.mode,phase:'restored',parametersChanged:half};
  }
  for(let i=0;i<this.w.length;i++)this.w[i]=finite(this.w[i]-learningRate*this.gw[i],'weight update');
  for(let i=0;i<this.b.length;i++)this.b[i]=finite(this.b[i]-learningRate*this.gb[i],'bias update');
  this.hasGradients=false;return {updated:true,mode:this.mode,phase:'variable'};
 }
 weights(){return {weight:new Tensor(this.w,[this.inputSize,this.outputSize]),bias:new Tensor(this.b,[this.outputSize])};}
}
function mseGradient(prediction,target){assertTensor(prediction,null,'prediction');assertTensor(target,prediction.shape,'target');const n=prediction.data.length,out=new Float64Array(n);for(let i=0;i<n;i++)out[i]=2*(prediction.data[i]-target.data[i])/n;return new Tensor(out,prediction.shape);}
window.NCLNeural=Object.freeze({Dense,mseGradient,version:'0.5.0',backend:'cpu-reference',weightModes:['fixed','variable','half-restore']});
})();