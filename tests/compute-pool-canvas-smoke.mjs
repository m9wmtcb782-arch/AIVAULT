// Executes the real drawing script against a minimal DOM/canvas API stub.
// This catches runtime errors; it is not browser rendering or visual QA.
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {SPECIES,classify,waterState,transitions} from '../assets/compute-pool/pool-view.mjs';
const html=readFileSync(new URL('../aivault-compute-mesh.html',import.meta.url),'utf8');
const source=readFileSync(new URL('../assets/compute-pool/aquarium.mjs',import.meta.url),'utf8').replace(/^import .*;\n/,'');
const ids=new Set([...html.matchAll(/id="([^"]+)"/g)].map(m=>m[1]));
const methods=['beginPath','moveTo','lineTo','quadraticCurveTo','bezierCurveTo','closePath','fill','stroke','ellipse','save','restore','translate','rotate','scale','fillRect','setTransform','clearRect','clip','fillText'];
const ctx=Object.fromEntries(methods.map(m=>[m,()=>{}]));ctx.createLinearGradient=()=>({addColorStop(){}});
function element(){return {value:'20',children:[],dataset:{},clientWidth:360,width:0,height:0,hidden:false,handlers:{},getContext:()=>ctx,setAttribute(){},addEventListener(type,fn){this.handlers[type]=fn;},replaceChildren(){this.children=[];},prepend(x){this.children.unshift(x);},append(x){this.children.push(x);},get lastChild(){return {remove:()=>this.children.pop()};}};}
const nodes=new Map([...ids].map(id=>[id,element()]));let frame;
const document={hidden:false,getElementById:id=>{assert(nodes.has(id),'Missing DOM ID '+id);return nodes.get(id);},createElement:()=>element(),addEventListener(){}};
const calls=[];
vm.runInNewContext(source,{SPECIES,classify,waterState,transitions,document,window:{},devicePixelRatio:2,localStorage:{getItem:()=>null,setItem(){}},matchMedia:()=>({matches:false}),requestAnimationFrame:fn=>{frame=fn;},setInterval(){},performance,Date,Math,Map,Set,AbortSignal,fetch:async(url,options)=>{calls.push(JSON.parse(options.body));return {ok:true,json:async()=>({success:true,nodes:[],fetched_at:new Date().toISOString()})};}});
await new Promise(resolve=>setImmediate(resolve));
assert.deepEqual(calls,[{type:'mesh.pool'}]);
frame(100);nodes.get('poolDemo').handlers.click();frame(200);nodes.get('poolCatchDemo').handlers.click();frame(300);
assert.equal(nodes.get('poolDemoNotice').hidden,false);assert.equal(nodes.get('poolGpuCount').textContent,18);
nodes.get('poolDemo').handlers.click();frame(400);assert.equal(nodes.get('poolGpuCount').textContent,0);
console.log('Canvas initialization, all fish demo, catch demo, return to live: PASS');
