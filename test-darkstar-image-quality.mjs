import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {stripTypeScriptTypes} from 'node:module';

const backend=fs.readFileSync(new URL('./supabase/functions/technical-dark-star/index.ts',import.meta.url),'utf8');
const page=fs.readFileSync(new URL('./technical-dark-star.html',import.meta.url),'utf8');
const q='成年女性，黑色晚禮服，微笑與鏡頭對視，微微側頭，暖色側光，近景，只有一人，不要拼貼';
const start=backend.indexOf('function deterministicVisualIntent(');
const end=backend.indexOf('function extractGatewayText',start);
const fallbackBox={cleanText:x=>x};vm.createContext(fallbackBox);
vm.runInContext(stripTypeScriptTypes(backend.slice(start,end))+';this.f=deterministicVisualIntent;',fallbackBox);
assert.equal(fallbackBox.f(q).prompt_zh,q,'fallback must retain the complete request');
const a=backend.indexOf('async function imageGenerate('), b=backend.indexOf('serve(async',a);
let payload;
const box={str:(x,d='')=>typeof x==='string'?x:d,SUPABASE:'https://example.invalid',
 understandVisualIntent:async()=>({intent:{prompt_zh:'女性'},semantic_source:'mock-lossy-summary'}),
 secret:()=>'',json:(value,status=200)=>({value,status}),
 fetch:async(url,options)=>{payload=JSON.parse(options.body);return {ok:true,status:200,text:async()=>JSON.stringify({ok:true})}}};
vm.createContext(box);
vm.runInContext(stripTypeScriptTypes(backend.slice(a,b))+';this.run=imageGenerate;',box);
await box.run({prompt:q,user_request:q,mime_type:'image/jpeg'});
assert.equal(payload.prompt,q,'lossy model summary cannot replace original request');
assert.equal(payload.user_request,q);
assert.equal(payload.mime_type,'image/jpeg');

const appearanceSource=page.slice(page.indexOf('function getRequestedImageAppearanceGuidance('),page.indexOf('\nfunction isImageContinuationIntent'));
const appearance=vm.runInNewContext(appearanceSource+';getRequestedImageAppearanceGuidance');
assert.ok(appearance('成年女性黑色晚禮服').includes('優先呈現亞洲'));
assert.ok(!appearance('非洲成年女性').includes('優先呈現亞洲'));
assert.ok(!appearance('歐洲成年男性').includes('優先呈現亞洲'));
assert.equal(appearance('畫一隻貓'),'');

const framingSource=page.slice(page.indexOf('function getRequestedImageFraming('),page.indexOf('\nfunction getRequestedImageAppearanceGuidance'));
const framingBox={};vm.createContext(framingBox);
vm.runInContext(framingSource+';this.frame=getRequestedImageFraming;this.ratio=getRequestedImageAspectRatio;this.contract=getImageFramingContract;',framingBox);
for(const [text,expected] of [
 ['我要全身，從頭到腳','full'], ['不要全身，改成半身','half'],
 ['不是半身，我要全身','full'], ['半身，不要全身','half'],
 ['全身，不要半身','full'], ['不要全身',''], ['臉部特寫','close'],
 ['全身改成腰部以上','half'], ['full body, no close up','full']
]) assert.equal(framingBox.frame(text),expected,text);
assert.equal(framingBox.ratio('全身，1:1'),'1:1');
assert.equal(framingBox.ratio('不要全身，改半身'),'3:4');
assert.equal(framingBox.ratio('換成黑色晚禮服','全身構圖：從頭到腳'),'2:3');
assert.ok(framingBox.contract('half').includes('腰部'));
assert.ok(framingBox.contract('full').includes('雙腳'));
assert.equal(framingBox.ratio('換衣服',framingBox.contract('half')),'3:4');

const ma=page.indexOf('async function makeJpgImageWithDarkStar('),mb=page.indexOf('async function makeDrawWithDarkStar(',ma);
let imageBody;
const g={updateDarkStarWorkLocation(){},getLatestImageTask:()=>null,isImageContinuationIntent:()=>false,
 buildImageTaskState:()=>({}),imageTaskLockPrompt:()=>'',getRequestedImageAppearanceGuidance:appearance,
 getRequestedImageAspectRatio:()=> '1:1',SUPABASE_URL:'https://example.invalid',
 fetch:async(url,options)=>{imageBody=JSON.parse(options.body);throw Error('MOCK_STOP')}};
vm.createContext(g);vm.runInContext(page.slice(ma,mb)+';this.run=makeJpgImageWithDarkStar;',g);
await assert.rejects(g.run(q,[]),/MOCK_STOP/);
assert.ok(imageBody.prompt.includes(q) && imageBody.prompt.includes('優先呈現亞洲'));
assert.ok(imageBody.prompt.includes('不要拼貼、縮圖、對照小窗'));
await assert.rejects(g.run('製作三視圖拼貼',[]),/MOCK_STOP/);
assert.ok(!imageBody.prompt.includes('構圖要求：只輸出一張連貫的單一場景'));
console.log('PASS: full fallback text, unchanged downstream request despite lossy summary, JPEG contract, Asian default with explicit overrides, no animal contamination, composition constraint and intentional collage exemption. No network or image API calls.');
