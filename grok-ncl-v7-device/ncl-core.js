// Grok NCL v7 device kit core: pure logic, no DOM, no network. Shared by browser and Node tests.
export const XOR_LIMIT=0xffffffff;
export function xorshift(r){r=(r^(r<<13))>>>0;r=(r^(r>>>17))>>>0;r=(r^(r<<5))>>>0;return r;}
export function advance(r,k){for(let i=0;i<k;i++)r=xorshift(r);return r;}
export function hex(u8){return Array.from(u8,x=>x.toString(16).padStart(2,'0')).join('');}
export async function sha256(buf){return hex(new Uint8Array(await crypto.subtle.digest('SHA-256',buf)));}
export function validate({prompt,n,seed,rounds,chunk}){
 const p=new TextEncoder().encode(prompt);const err=[];
 if(p.length<1||p.length>512)err.push('提示詞需1..512 UTF-8 bytes');
 if(!Number.isInteger(n)||n<1||n>4096)err.push('生成長度需1..4096');
 if(!Number.isInteger(seed)||seed<1||seed>XOR_LIMIT)err.push('seed需1..4294967295');
 if(!Number.isInteger(rounds)||rounds<1||rounds>200)err.push('輪數需1..200');
 if(!Number.isInteger(chunk)||!(chunk===0||(chunk>=1&&chunk<=4096)))err.push('每次dispatch步數需0(單次)或1..4096');
 if(err.length)throw Error(err.join('；'));return p;
}
export function stats(a){const x=[...a].sort((p,q)=>p-q),n=x.length;if(!n)return null;const mean=x.reduce((s,v)=>s+v,0)/n;const q=f=>{const h=(n-1)*f,l=Math.floor(h),u=Math.ceil(h);return x[l]+(x[u]-x[l])*(h-l);};const sd=n>1?Math.sqrt(x.reduce((s,v)=>s+(v-mean)**2,0)/(n-1)):0;return {n,mean,median:q(.5),P95:q(.95),std_sample:sd,min:x[0],max:x[n-1]};}
// Exact copy of the trained model math in float64 (reference). GPU uses FP32.
export class CpuReference{
 constructor(spec,blob){
  const P=spec.parts.map(p=>new Uint32Array(blob,p.offset,p.bytes/4));
  this.nodes=P[0];this.links=P[1];this.edges=P[2];this.edgesF=new Float32Array(P[2].buffer,P[2].byteOffset,P[2].length);this.prior=new Float32Array(P[3].buffer,P[3].byteOffset,256);this.g=new Float32Array(P[5].buffer,P[5].byteOffset,P[5].length);
  const d=spec.dims;this.W=d.width;this.D=d.embedding;this.R=d.hidden;this.B=d.banks;this.order=d.order;this.alpha=spec.alpha;this.discount=spec.discount;
  const W=this.W,D=this.D,R=this.R;this.oE=0;this.oH=256*D;this.oO=this.oH+W*D*R;this.oh=this.oO+R*256;this.oo=this.oh+R;this.oc=this.oo+256;
  if(this.oc+2*this.B!==this.g.length)throw Error('genome長度與維度不符');
 }
 static hash(x){x>>>=0;x=Math.imul(x^(x>>>16),0x7feb352d)>>>0;x=Math.imul(x^(x>>>15),0x846ca68b)>>>0;return (x^(x>>>16))>>>0;}
 static seed(i,off){return (CpuReference.hash((i+Math.imul(120+off,1000003))>>>0)&65535)/32768-1;}
 child(at,t){const s=this.nodes[at*6],n=this.nodes[at*6+1];let lo=0,hi=n;while(lo<hi){const m=(lo+hi)>>1;if(this.links[(s+m)*2]<t)lo=m+1;else hi=m;}return lo<n&&this.links[(s+lo)*2]===t?this.links[(s+lo)*2+1]:-1;}
 graph(ctx){const path=[];let at=0;for(let d=0;d<Math.min(this.order,ctx.length);d++){at=this.child(at,ctx[ctx.length-1-d]);if(at<0)break;path.push(at);}
  const p=new Float64Array(256);for(let t=0;t<256;t++){let v=this.prior[t];for(const node of path){const s=this.nodes[node*6+2],n=this.nodes[node*6+3],total=this.nodes[node*6+4];let lo=0,hi=n;while(lo<hi){const m=(lo+hi)>>1;if(this.edges[(s+m)*2]<t)lo=m+1;else hi=m;}const c=lo<n&&this.edges[(s+lo)*2]===t?this.edgesF[(s+lo)*2+1]:0;v=(Math.max(0,c-this.discount)+this.discount*n*v)/total;}p[t]=v;}return p;}
 neural(ctx){const {W,D,R,g}=this;const take=Math.min(W,ctx.length);const tok=j=>j<W-take?0:ctx[ctx.length-W+j];let bank=0;for(let j=0;j<W;j++)bank=(Math.imul((bank^tok(j))>>>0,16777619)+j+1)>>>0;bank%=this.B;
  const s=g[this.oc+2*bank],v=g[this.oc+2*bank+1];const x=new Float64Array(W*D);for(let j=0;j<W;j++){const t=tok(j);for(let k=0;k<D;k++){const f=j*D+k;x[f]=g[this.oE+t*D+k]*(1+s*CpuReference.seed(bank*W*D+f,0));}}
  const h=new Float64Array(R);for(let r=0;r<R;r++)h[r]=g[this.oh+r]+v*CpuReference.seed(bank*R+r,1);for(let k=0;k<W*D;k++){const a=x[k],row=this.oH+k*R;for(let r=0;r<R;r++)h[r]+=a*g[row+r];}for(let r=0;r<R;r++)h[r]=Math.tanh(h[r]);
  const z=new Float64Array(256);for(let t=0;t<256;t++)z[t]=g[this.oo+t];for(let r=0;r<R;r++){const a=h[r],row=this.oO+r*256;for(let t=0;t<256;t++)z[t]+=a*g[row+t];}let mx=-Infinity;for(const q of z)mx=Math.max(mx,q);let sum=0;for(let t=0;t<256;t++){z[t]=Math.exp(z[t]-mx);sum+=z[t];}for(let t=0;t<256;t++)z[t]/=sum;return z;}
 distribution(ctx){const n=this.neural(ctx),p=this.graph(ctx),o=new Float64Array(256);for(let t=0;t<256;t++)o[t]=(1-this.alpha)*p[t]+this.alpha*n[t];return o;}
 // FP32 replay of the shader's CDF sampling; probabilities from the float64 reference.
 static sample(p,rng){const f=Math.fround;let sum=0;for(let t=0;t<256;t++)sum=f(sum+f(p[t]));const draw=f(f(f(rng)/4294967296)*sum);let cum=0,best=Infinity;for(let t=0;t<256;t++){cum=f(cum+f(p[t]));best=Math.min(best,Math.abs(cum-draw));if(cum>=draw){return {token:t,draw,boundary:nearest(p,draw)};}}return {token:255,draw,boundary:nearest(p,draw)};}
 // Teacher-forced on device bytes: each step checks what the reference would sample.
 verify(prompt,out,seed,limit=out.length){let rng=seed>>>0;const stream=Array.from(prompt);const mismatches=[];let maxBoundary=0;for(let i=0;i<Math.min(limit,out.length);i++){rng=xorshift(rng);const p=this.distribution(stream);const s=CpuReference.sample(p,rng);if(s.token!==out[i]){mismatches.push({step:i,device:out[i],reference:s.token,cdf_distance:s.boundary});maxBoundary=Math.max(maxBoundary,s.boundary);}stream.push(out[i]);}
  const checked=Math.min(limit,out.length);const status=!mismatches.length?'MATCH':mismatches.every(m=>m.cdf_distance<2e-5)?'BOUNDARY_ONLY':'FAILED';return {checked,mismatches:mismatches.slice(0,50),mismatch_count:mismatches.length,status,max_mismatch_cdf_distance:maxBoundary};}
}
function nearest(p,draw){const f=Math.fround;let cum=0,best=Infinity;for(let t=0;t<256;t++){cum=f(cum+f(p[t]));best=Math.min(best,Math.abs(cum-draw));}return best;}
// Chunk planner: identical results to a single dispatch because only the last 32 bytes are read by the shader ring.
export async function generate(engine,prompt,n,seed,chunk){
 const stream=Array.from(prompt);let rng=seed>>>0;const per=chunk||n;const timings=[];const out=[];
 while(out.length<n){const steps=Math.min(per,n-out.length);const tail=Uint8Array.from(stream.slice(-Math.min(32,stream.length)));const r=await engine.generateChunk(tail,steps,rng);if(!r||r.bytes.length!==steps)throw Error('GPU輸出長度錯誤');for(const b of r.bytes){if(b<0||b>255)throw Error('GPU輸出非byte');out.push(b);stream.push(b);}timings.push(r.timing);rng=advance(rng,steps);}
 const sum=k=>timings.reduce((s,t)=>s+(t[k]||0),0);return {bytes:Uint8Array.from(out),dispatches:timings.length,submit_to_done_ms:sum('submit_to_done_ms'),submit_to_readback_ms:sum('submit_to_readback_ms'),timings};
}
export async function runBenchmark(engine,ref,cfg,log=()=>{}){
 const prompt=validate(cfg);const rounds=[];const warm=[];
 for(let w=0;w<(cfg.warmup??1);w++){const t=performance.now();const g=await generate(engine,prompt,cfg.n,cfg.seed+1000003+w>>>0||1,cfg.chunk);warm.push({wall_ms:performance.now()-t,dispatches:g.dispatches});}
 for(let i=0;i<cfg.rounds;i++){const seed=((cfg.seed+i-1)%XOR_LIMIT)+1;const t=performance.now();const g=await generate(engine,prompt,cfg.n,seed,cfg.chunk);const wall=performance.now()-t;
  const row={round:i,seed,wall_ms:wall,submit_to_done_ms:g.submit_to_done_ms,submit_to_readback_ms:g.submit_to_readback_ms,dispatches:g.dispatches,bytes_per_second:cfg.n/(wall/1000),output_sha256:await sha256(g.bytes),output_hex:g.bytes.length<=4096?hex(g.bytes):null};
  if(ref&&(cfg.verify==='all'||(cfg.verify!=='none'&&i===0)))row.cpu_reference_check=ref.verify(prompt,g.bytes,seed,cfg.verify_steps||g.bytes.length);
  if(i===0)row.text_lossy=new TextDecoder('utf-8',{fatal:false}).decode(g.bytes);rounds.push(row);log(`第${i+1}/${cfg.rounds}輪 ${row.bytes_per_second.toFixed(1)} B/s`);}
 const distinct=new Set(rounds.map(r=>r.output_sha256)).size;const checks=rounds.filter(r=>r.cpu_reference_check);
 return {config:{...cfg,prompt_utf8_bytes:prompt.length,prompt_sha256:await sha256(prompt)},warmup:warm,rounds,summary:{wall_ms:stats(rounds.map(r=>r.wall_ms)),bytes_per_second:stats(rounds.map(r=>r.bytes_per_second)),submit_to_done_ms:stats(rounds.map(r=>r.submit_to_done_ms)),ms_per_byte:stats(rounds.map(r=>r.wall_ms/cfg.n)),distinct_outputs:distinct,reference_checked_rounds:checks.length,reference_status:checks.length?(checks.every(r=>r.cpu_reference_check.status==='MATCH')?'MATCH':checks.some(r=>r.cpu_reference_check.status==='FAILED')?'FAILED':'BOUNDARY_ONLY'):'NOT_RUN'}};
}
export const TOKEN_NOTE='1 token = 1個UTF-8 byte類別（0..255）；byte/s不是BPE token/s，也不是中文字/s。';
// One-click flow. All side effects are injected so the sequence and failure rules are testable without a browser.
export async function runOneClick(d,cfg,ui=()=>{}){
 const steps=[];let chunk=cfg.chunk||0,fatal=null,cacheOk=false;const out={started:new Date().toISOString(),steps,config:{...cfg}};
 const step=async(name,label,fn,soft=false)=>{if(fatal)return null;const s={name,label,status:'RUNNING'};steps.push(s);ui(steps);const t=performance.now();try{const r=await fn();s.status=r&&r.status?r.status:'PASS';s.detail=r&&r.detail;s.ms=performance.now()-t;ui(steps);return r;}catch(e){s.ms=performance.now()-t;s.detail=String(e&&e.message||e);s.status=soft?'WARN':'FAIL';if(!soft)fatal=s;ui(steps);return null;}};
 await step('environment','檢查HTTPS與WebGPU',async()=>({detail:await d.checkEnv()}));
 await step('offline_cache','安裝離線快取並驗SHA',async()=>{const r=await d.install();if(!r.all_ok)throw Error('快取檔案SHA不符');cacheOk=true;return {detail:'全部檔案SHA吻合'};},true);
 await step('load_model','載入真實v7模型＋GPU首次分布核對',async()=>({detail:await d.load(cacheOk?'cache':'network')}));
 await step('gpu_golden','GPU固定案例對照NumPy參考',async()=>{const g=await d.golden();if(!g.distribution_pass)throw Error('GPU分布與參考不符');const bad=g.sequences.filter(s=>!s.exact_match&&s.cpu_reference_check.status!=='BOUNDARY_ONLY');if(bad.length)throw Error(bad.length+'組生成序列與參考不符');return {detail:`分布通過；序列逐byte一致 ${g.sequences_exact}/${g.sequences.length}`};});
 const short=await step('short_test','短測（3輪×256 bytes）',async()=>{try{return {detail:await d.bench({...cfg,rounds:3,n:256,warmup:1,chunk,verify:'first'},'short')};}catch(e){if(chunk!==0)throw e;ui(steps);await d.load(cacheOk?'cache':'network');chunk=64;const r=await d.bench({...cfg,rounds:3,n:256,warmup:1,chunk,verify:'first'},'short');return {status:'PASS',detail:'單次dispatch失敗（'+String(e.message||e)+'），已自動改為每次64步重試成功：'+r};}});
 await step('full_test',`正式量測（${cfg.rounds}輪×${cfg.n} bytes）`,async()=>({detail:await d.bench({...cfg,chunk},'full')}));
 out.chunk_used=chunk;out.finished=new Date().toISOString();out.overall=fatal?'FAIL':'PASS';out.offline_ready=cacheOk;out.failed_step=fatal&&fatal.name;ui(steps);return out;
}
