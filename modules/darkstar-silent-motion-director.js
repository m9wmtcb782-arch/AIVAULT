/**
 * Dark Star internal, silent nonverbal intent selector.
 * Not an AI consciousness model: maps conversational cues to motor intent.
 * NEVER append intent labels to spoken text or transcript.
 * Preview-only until the digital human rig/video scheduler is bound.
 */
const VARIANTS=Object.freeze({
 greet:['greet','nod','smile'],
 friendly:['smile','nod','blink'],
 attentive:['nod','blink'],
 thoughtful:['nod','blink'],
 neutral:['blink']
});
export function inferNonverbalContext({assistantText='',userText='',phase='speaking'}={}){
 const text=String(assistantText).slice(0,500);
 const user=String(userText).slice(0,500);
 if(/你好|歡迎|早安|午安|晚安|很高興見到|你來了|回來了/u.test(text))return 'greet';
 if(/謝謝|太好了|開心|很棒|喜歡|高興/u.test(text))return 'friendly';
 if(/想一想|讓我想|可能|需要分析|考慮/u.test(text))return 'thoughtful';
 if(phase==='listening'||/為什麼|怎麼|如何|請問/u.test(user))return 'attentive';
 return 'neutral';
}
export function createSilentMotionDirector({emit,now=()=>Date.now(),cooldownMs=2200}={}){
 if(typeof emit!=='function')throw Error('EMIT_REQUIRED');
 let history=[],lastTime=-Infinity;
 function decide({assistantText='',userText='',phase='speaking'}={}){
  const time=now();
  if(time-lastTime<cooldownMs)return {scheduled:false,reason:'COOLDOWN'};
  const context=inferNonverbalContext({assistantText,userText,phase});
  const candidates=VARIANTS[context];
  const recent=new Set(history.slice(-2));
  const name=candidates.find(n=>!recent.has(n))??candidates[0];
  lastTime=time;history.push(name);if(history.length>20)history.shift();
  const command={name,context,channel:'internal-motor',silent:true,previewOnly:true,actuationAllowed:false};
  emit(command);
  return {scheduled:true,name,context,spokenOutputChanged:false};
 }
 function reset(){history=[];lastTime=-Infinity}
 return {decide,reset,getHistory:()=>[...history]};
}
