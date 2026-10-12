import {SPECIES,classify,deviceLabel,formatPoolNumber,waterState,transitions} from './pool-view.mjs?v=token-headline-v7';
const root=document.getElementById('computePoolAquarium');
if(root){
  const $=id=>document.getElementById(id),canvas=$('poolCanvas'),ctx=canvas.getContext('2d');
  const endpoint='https://clcddygkaaqqtsbswgdf.supabase.co/functions/v1/aivault-compute-coordinator';
  let realTokens=null,realCapacity=null,realNodes=[],previous=null,hasSnapshot=false,demo=false,water=1,target=1,registeredWater=0,color='#fc6374',fish=[],catches=[],visible=true,lastFrame=0,lastPoll=0,fetching=false,refreshQueued=false,reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const reference=$('poolReference');reference.value='自動調整（待驗證）';
  const seed=s=>Array.from(s).reduce((a,c)=>(a*31+c.charCodeAt(0))>>>0,17);
  const demoNodes=()=>Array.from({length:18},(_,i)=>({id:'demo-'+i,name:'示意節點 '+(i+1),platform:['iPhone','iPad','Windows','Windows','Windows','Windows'][i%6],gpu_rating:{version:'pool-u32-v1',units:[.5,5,50,200,700,1500][i%6]},video_rating:{status:'VALIDATED',unit:'standard_5s_videos_per_hour',workload_id:'DEMO',units:[.5,5,50,500,5000,15000][i%6]},hardware:i%6>=3?{gpu:{description:['RTX 4090','RTX 5090','RTX 6000 Ada'][i%6-3]}}:null,online:true,gpu_reported:true,available:true,source:'demo',status:'示意',last_seen:null}));
  function event(text){const p=document.createElement('p');p.textContent=new Date().toLocaleTimeString('zh-TW')+' · '+text;$('poolEvents').prepend(p);while($('poolEvents').children.length>8)$('poolEvents').lastChild.remove();}
  function display(nodes){
    const view=waterState(nodes,demo?{status:'VALIDATED',unit:'standard_5s_videos_per_hour',workload_id:'DEMO',scope:'pool',units:63166.5}:realCapacity);reference.value=view.validated?formatPoolNumber(view.reference)+' VCU/h':'自動調整（待驗證）';target=1;registeredWater=0;color='#3da6f6';
    const diagnostic=view.active.filter(n=>n.gpu_rating?.version==='pool-u32-v1'&&Number.isFinite(n.gpu_rating.units)&&n.gpu_rating.units>0).reduce((sum,n)=>sum+n.gpu_rating.units,0);
    const tokenReady=!demo&&realTokens?.status==='VALIDATED'&&realTokens.unit==='tokens_per_second'&&realTokens.scope==='pool'&&realTokens.workload_id&&Number.isFinite(realTokens.units)&&realTokens.units>=0;
    $('poolPercent').textContent=tokenReady?formatPoolNumber(realTokens.units)+' Token/s':'— Token/s';
    $('poolLevel').textContent=!hasSnapshot&&!demo?'正在取得運算診斷':formatPoolNumber(diagnostic)+' PGU · '+view.active.length+' 個可提供 GPU 節點';
    $('poolTokenNote').textContent=tokenReady?'Token/s：固定模型與工作負載的整池實測生成速度':'Token/s 尚未測得 · PGU 不換算成 token';
    $('poolGpuCount').textContent=!hasSnapshot&&!demo?'—':view.count;$('poolOnlineCount').textContent=!hasSnapshot&&!demo?'—':nodes.filter(n=>n.online===true).length;$('poolRecordedCount').textContent=!hasSnapshot&&!demo?'—':nodes.length;$('poolIdleCount').textContent=!hasSnapshot&&!demo?'—':view.active.filter(n=>n.available===true).length;
    $('poolEmpty').hidden=view.members.length>0;$('poolEmpty').textContent=hasSnapshot||demo?'目前沒有在線裝置；離線登記仍保留在清單。':'正在取得節點資料…';
    const old=new Map(fish.map(f=>[f.id,f]));
    fish=view.members.slice(0,80).map(n=>({...old.get(n.id),id:n.id,node:n,kind:classify(n),seed:seed(n.id),phase:seed(n.id)%100}));
    $('poolDensity').textContent=view.members.length>80?'畫面聚合顯示 80 條魚，完整節點請看清單。':'';
    const tbody=$('poolNodeRows');tbody.replaceChildren();
    for(const n of nodes){const tr=document.createElement('tr'),kind=SPECIES[classify(n)];for(const v of [deviceLabel(n)+' · '+String(n.id).slice(-8),deviceLabel(n)+' · '+kind.fish+' · '+(n.video_rating?.status==='VALIDATED'?formatPoolNumber(n.video_rating.units)+' VCU/h':'影片算力待測')+(n.gpu_rating?' · 基礎診斷 '+formatPoolNumber(n.gpu_rating.units)+' PGU':''),n.online?(n.gpu_reported?'在線 / GPU 回報':'在線 / 未回報 GPU'):'離線',String(n.status||'—'),n.source==='registered'?'帳號登記':n.source==='demo'?'示意':'運算節點',n.runtime==='webgl2'?'WebGL2':n.runtime==='webgpu'?'WebGPU':'待確認',n.reason||n.tensor_reason||'—']){const td=document.createElement('td');td.textContent=v;tr.append(td);}tbody.append(tr);}
    $('poolListCount').textContent='查看全部裝置與 GPU 狀態（'+nodes.length+'）';
    if(reduced) {water=target;draw(performance.now());}
  }
  async function poll(){
    if(fetching){refreshQueued=true;return;}if(document.hidden)return;fetching=true;$('poolStage').setAttribute('aria-busy','true');
    try{
      const r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'mesh.pool'}),signal:AbortSignal.timeout(10000)});
      if(!r.ok)throw Error('HTTP '+r.status);const data=await r.json();if(data.success!==true||!Array.isArray(data.nodes))throw Error('節點資料尚未可用');
      realNodes=data.nodes;realCapacity=data.video_capacity||null;realTokens=data.token_capacity||null;hasSnapshot=true;
      const departed=transitions(previous,realNodes,{truncated:data.truncated});
      if(!demo)for(const n of departed){const kind=classify(n),f=fish.find(f=>f.id===n.id);queueCatch(kind,f?.x||450,f?.y||400);event(deviceLabel(n)+' 節點離線 · 使用'+SPECIES[kind].tool+'捕撈，裝置紀錄保留。');}
      previous=realNodes.map(n=>({...n}));
      $('poolLive').dataset.live='true';$('poolLiveText').textContent='資料已更新';$('poolDataNote').textContent='更新於 '+new Date(data.fetched_at).toLocaleTimeString('zh-TW')+(data.truncated?' · 顯示最近節點，清單有截取':'');
      if(!demo)display(realNodes);
    }catch(e){$('poolLive').dataset.live='false';$('poolLiveText').textContent=hasSnapshot?'資料暫停更新':'尚未取得資料';$('poolDataNote').textContent='連線暫時無法更新，保留最後資料；不判定節點離線。';if(!hasSnapshot)$('poolEmpty').textContent='尚未取得真實資料，水位與設備數不作推估。';}
    finally{fetching=false;lastPoll=Date.now();$('poolStage').setAttribute('aria-busy','false');if(refreshQueued){refreshQueued=false;poll();}}
  }
  window.addEventListener('aivault:gpu-provider-updated',poll);
  $('poolDemo').addEventListener('click',()=>{demo=!demo;fish=[];catches=[];$('poolDemo').setAttribute('aria-pressed',String(demo));$('poolDemo').textContent=demo?'返回真實水池':'查看魚種示意';$('poolDemoNotice').hidden=!demo;display(demo?demoNodes():realNodes);});
  $('poolRefresh').addEventListener('click',poll);
  // The demo is explicitly separate from every live statistic and only runs on request.
  $('poolCatchDemo').addEventListener('click',()=>{if(!demo)return;const kinds=Object.keys(SPECIES).filter(k=>k!=='unknown'),kind=kinds[Math.floor(Math.random()*kinds.length)];queueCatch(kind,430,365);event('示意捕撈 · '+SPECIES[kind].name+' / '+SPECIES[kind].tool);});
  function basin(){ctx.beginPath();ctx.moveTo(135,153);ctx.lineTo(135,375);ctx.quadraticCurveTo(135,535,310,535);ctx.lineTo(590,535);ctx.quadraticCurveTo(765,535,765,375);ctx.lineTo(765,153);ctx.closePath();}
  function ellipse(x,y,rx,ry,fill){ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fillStyle=fill;ctx.fill();}
  function drawFish(x,y,kind,dir=1,angle=0){const s=SPECIES[kind],z=s.size;ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.scale(dir,1);ctx.globalAlpha=kind==='unknown'?.6:1;ctx.fillStyle=s.color;
    if(['whale','leviathan'].includes(kind)){
      ctx.beginPath();ctx.moveTo(-z*.7,0);ctx.bezierCurveTo(-z*.4,-z*.38,z*.65,-z*.4,z*.65,0);ctx.bezierCurveTo(z*.65,z*.33,-z*.35,z*.25,-z*.7,0);ctx.fill();
      ctx.beginPath();ctx.moveTo(-z*.55,0);ctx.lineTo(-z*.95,-z*.22);ctx.quadraticCurveTo(-z*.94,z*.03,-z*.76,z*.08);ctx.quadraticCurveTo(-z*.91,z*.22,-z*.97,z*.24);ctx.lineTo(-z*.52,z*.06);ctx.fill();
      ellipse(z*.16,z*.11,z*.36,z*.1,'#d3edff88');ctx.beginPath();ctx.moveTo(-z*.06,z*.08);ctx.lineTo(-z*.22,z*.4);ctx.lineTo(z*.16,z*.18);ctx.fillStyle=s.color;ctx.fill();
    }else{
      ellipse(0,0,z*.66,z*.24,s.color);ctx.beginPath();ctx.moveTo(-z*.48,0);ctx.lineTo(-z*.94,-z*.3);ctx.lineTo(-z*.94,z*.3);ctx.closePath();ctx.fill();
      ctx.beginPath();ctx.moveTo(-z*.13,-z*.2);ctx.lineTo(z*.07,-z*(kind==='shark'?.65:.42));ctx.lineTo(z*.32,-z*.12);ctx.fill();
      if(kind==='shark'){ellipse(z*.1,z*.08,z*.43,z*.1,'#dce6ee99');ctx.fillStyle=s.color;ctx.beginPath();ctx.moveTo(0,z*.1);ctx.lineTo(-z*.32,z*.45);ctx.lineTo(z*.16,z*.13);ctx.fill();}
    }
    ellipse(z*.39,-z*.06,Math.max(1.7,z*.025),Math.max(1.7,z*.025),'#0a1925');ctx.restore();
  }
  function fisher(t){
    // Small seated fisherman, never a pre-recorded or generated persona.
    ctx.strokeStyle='#54728d';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(745,145);ctx.lineTo(820,145);ctx.stroke();
    ctx.fillStyle='#203b57';ctx.fillRect(767,121,29,10);ctx.fillRect(772,129,5,18);ctx.fillRect(791,129,5,18);
    ctx.strokeStyle='#748fb0';ctx.lineWidth=11;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(778,108);ctx.lineTo(754,115);ctx.lineTo(747,139);ctx.stroke();
    ctx.beginPath();ctx.moveTo(779,110);ctx.lineTo(789,136);ctx.lineTo(810,139);ctx.stroke();
    ctx.strokeStyle='#4c8097';ctx.lineWidth=18;ctx.beginPath();ctx.moveTo(782,76);ctx.lineTo(778,106);ctx.stroke();ellipse(784,60,11,12,'#e0b797');
    ellipse(784,49,17,4,'#c7a975');ctx.fillStyle='#c7a975';ctx.fillRect(775,41,18,10);
    ctx.strokeStyle='#e0b797';ctx.lineWidth=7;ctx.beginPath();ctx.moveTo(779,78);ctx.lineTo(762,88);ctx.lineTo(742,83);ctx.stroke();
    ctx.strokeStyle='#bc9b70';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(744,88);ctx.quadraticCurveTo(718,34,637,50);ctx.stroke();
    ctx.strokeStyle='#8fb4ce88';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(637,50);ctx.quadraticCurveTo(629,117,620,200+Math.sin(t*.001)*4);ctx.stroke();ellipse(620,201+Math.sin(t*.001)*4,3,5,'#fd9878');
  }
  function queueCatch(kind,x,y){
    const now=performance.now(),large=['whale','leviathan'].includes(kind);
    const last=large?catches.filter(c=>['whale','leviathan'].includes(c.kind)).at(-1):null;
    const start=last?Math.max(now,last.start+8000):now;
    catches.push({kind,x,y,start,shipFrom:patrol(now).x});
  }
  function patrol(t){return {x:450+Math.sin(t*.00018)*205,dir:Math.cos(t*.00018)>=0?1:-1};}
  function shipPose(t){
    const c=catches.find(c=>['whale','leviathan'].includes(c.kind)&&t>=c.start&&t-c.start<8000);
    if(!c)return {...patrol(t),y:169+Math.sin(t*.0018)*3};
    const approach=Math.min(1,(t-c.start)/1800),dest=Math.max(225,Math.min(680,c.x));
    return {x:c.shipFrom+(dest-c.shipFrom)*approach,y:169+Math.sin(t*.0018)*3,dir:dest>=c.shipFrom?1:-1};
  }
  function ship(t,pose){
    ctx.save();ctx.translate(pose.x,pose.y);ctx.scale(pose.dir,1);
    ctx.fillStyle='#edf2f7';ctx.beginPath();ctx.moveTo(-76,-7);ctx.lineTo(81,-7);ctx.lineTo(61,15);ctx.lineTo(-54,15);ctx.closePath();ctx.fill();
    ctx.fillStyle='#c86848';ctx.fillRect(-53,7,113,5);ctx.fillStyle='#274562';ctx.fillRect(-35,-40,47,32);
    ctx.fillStyle='#9bdef7';ctx.fillRect(-29,-34,12,10);ctx.fillRect(-12,-34,12,10);ctx.fillStyle='#47657c';ctx.fillRect(-23,-53,9,13);
    ctx.strokeStyle='#c5dae5';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(33,-7);ctx.lineTo(33,-65);ctx.lineTo(63,-54);ctx.stroke();
    ctx.strokeStyle='#f5d185';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(62,-54);ctx.lineTo(62,-12);ctx.stroke();
    ctx.font='10px system-ui';ctx.fillStyle='#132e47';ctx.fillText('AIVAULT',-21,3);ctx.restore();
  }
  function whaleCatch(c,t,pose){
    const age=t-c.start;if(age<1800||age>=8000)return;
    const s=SPECIES[c.kind],cast=Math.min(1,(age-1800)/1700),lift=Math.max(0,Math.min(1,(age-3500)/3500));
    const hookX=pose.x+pose.dir*62,hookY=pose.y-54;
    const x=c.x+(pose.x+15-c.x)*lift,y=c.y+(pose.y-24-c.y)*lift;
    if(age>=3500)drawFish(x,y,c.kind,pose.dir,-lift*.12);
    else drawFish(c.x,c.y,c.kind,1,0);
    const ny=hookY+(y-hookY)*cast,rx=Math.max(7,s.size*.85*cast),ry=Math.max(4,s.size*.5*cast);
    ctx.strokeStyle='#c6e9fa';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(hookX,hookY);ctx.lineTo(x,ny);ctx.stroke();
    ctx.beginPath();ctx.ellipse(x,ny,rx,ry,0,0,Math.PI*2);ctx.stroke();
    for(let i=-3;i<=3;i++){ctx.beginPath();ctx.moveTo(x+i*rx/4,ny-ry*.7);ctx.lineTo(x-i*rx/4,ny+ry*.7);ctx.stroke();}
    ctx.font='12px system-ui';ctx.fillStyle='#eaf7ff';ctx.textAlign='center';ctx.fillText(age<3500?'撒網捕撈':age<7000?'收網上船':'已收上船',pose.x,pose.y-78);ctx.textAlign='left';
  }
  function draw(t){
    const dpr=Math.min(devicePixelRatio||1,1.5),w=canvas.clientWidth||800;const h=w*590/900;if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}ctx.setTransform(canvas.width/900,0,0,canvas.height/590,0,0);ctx.clearRect(0,0,900,590);
    ctx.strokeStyle='#233a5155';ctx.lineWidth=1;for(let x=40;x<900;x+=50){ctx.beginPath();ctx.moveTo(x,210);ctx.lineTo(x,555);ctx.stroke();}
    const surface=525-water*355;
    basin();ctx.fillStyle='#08111d';ctx.fill();ctx.save();basin();ctx.clip();
    if(registeredWater>0){ctx.fillStyle='#52799238';ctx.fillRect(100,525-registeredWater*355,700,450);}
    if(water>0){const gradient=ctx.createLinearGradient(0,surface,0,550);gradient.addColorStop(0,color+'c0');gradient.addColorStop(1,color+'24');ctx.fillStyle=gradient;ctx.beginPath();ctx.moveTo(100,surface);for(let x=100;x<=800;x+=8)ctx.lineTo(x,surface+Math.sin(x*.025+t*.0014)*4+Math.sin(x*.052-t*.001)*2);ctx.lineTo(800,570);ctx.lineTo(100,570);ctx.closePath();ctx.fill();ctx.strokeStyle=color+'bb';ctx.lineWidth=1;ctx.beginPath();for(let x=135;x<766;x+=8){const y=surface+Math.sin(x*.025+t*.0014)*4+Math.sin(x*.052-t*.001)*2;if(x===135)ctx.moveTo(x,y);else ctx.lineTo(x,y);}ctx.stroke();}
    for(const f of fish){const s=SPECIES[f.kind],phase=f.phase;const cycle=(t*.000025*(.7+(phase%5)*.12)+phase*.017)%2;const dir=cycle<1?1:-1;const q=cycle<1?cycle:2-cycle;f.x=220+s.size*.2+q*(470-s.size*.4);const minY=Math.min(surface+s.size*.38+16,490),maxY=490-s.size*.1;f.y=minY+Math.max(0,maxY-minY)*((Math.sin(phase*3+t*.00025)+1)/2);drawFish(f.x,f.y,f.kind,dir,Math.sin(t*.001+phase)*.03);ctx.save();ctx.textAlign='center';ctx.font='11px system-ui';ctx.fillStyle='#eaf5ff';ctx.fillText((deviceLabel(f.node)+' '+s.fish+' #'+String(f.id).slice(-4))+' · '+(f.node.gpu_reported&&!['PAUSED','STOPPED'].includes(String(f.node.status||'').toUpperCase())?'GPU':'待提供 GPU'),f.x,f.y+SPECIES[f.kind].size*.65+12);ctx.restore();}
    ctx.fillStyle='#b0def630';for(let i=0;i<12;i++){const y=535-((t*.016+i*33)%Math.max(20,535-surface));if(y>surface+5)ellipse(195+(i*57)%520,y,1.5+i%3,1.5+i%3,'#c6efff25');}ctx.restore();
    ctx.strokeStyle='#84a9c6';ctx.lineWidth=9;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(135,145);ctx.lineTo(135,375);ctx.quadraticCurveTo(135,535,310,535);ctx.lineTo(590,535);ctx.quadraticCurveTo(765,535,765,375);ctx.lineTo(765,145);ctx.stroke();
    ctx.strokeStyle='#345b7d';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(120,145);ctx.lineTo(120,375);ctx.quadraticCurveTo(120,552,310,552);ctx.lineTo(590,552);ctx.quadraticCurveTo(780,552,780,375);ctx.lineTo(780,145);ctx.stroke();
    for(let i=0;i<5;i++){const y=185+i*72;ctx.strokeStyle='#7eabc66e';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(100,y);ctx.lineTo(117,y);ctx.stroke();ctx.fillStyle='#7895ac';ctx.font='11px system-ui';ctx.fillText('≈',88,y+4);}
    fisher(t);const pose=shipPose(t);ship(t,pose);
    catches=catches.filter(c=>t-c.start<(['whale','leviathan'].includes(c.kind)?8000:4000));
    for(const c of catches){if(t<c.start)continue;if(['whale','leviathan'].includes(c.kind)){whaleCatch(c,t,pose);continue;}const p=Math.min(1,(t-c.start)/2800),x=c.x+(770-c.x)*p,y=c.y+(92-c.y)*p-Math.sin(p*Math.PI)*70,s=SPECIES[c.kind];drawFish(x,y,c.kind,1,-p*.9);ctx.strokeStyle='#d9eaff99';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(770,45);ctx.lineTo(x,y);ctx.stroke();
      if(c.kind!=='phone'){ctx.strokeStyle='#9dc8e6';ctx.lineWidth=c.kind==='leviathan'?5:2;ctx.beginPath();ctx.ellipse(x,y+s.size*.05,s.size*.8,s.size*.48,0,0,Math.PI);ctx.stroke();for(let j=-2;j<=2;j++){ctx.beginPath();ctx.moveTo(x+j*s.size*.2,y);ctx.lineTo(x+j*s.size*.1,y+s.size*.5);ctx.stroke();}}
      if(['leviathan','whale'].includes(c.kind)){ctx.strokeStyle='#b4c9da';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(818,145);ctx.lineTo(818,13);ctx.lineTo(755,13);ctx.lineTo(755,45);ctx.stroke();}
      ctx.font='12px system-ui';ctx.fillStyle='#e4f2fc';ctx.textAlign='center';ctx.fillText(s.tool,Math.min(x,750),Math.max(y-s.size*.45,65));ctx.textAlign='left';
    }
    if(!fish.length&&!catches.length){ctx.textAlign='center';ctx.fillStyle='#7492aa';ctx.font='15px system-ui';ctx.fillText(hasSnapshot?'等待裝置加入':'正在讀取真實節點',450,365);ctx.textAlign='left';}
  }
  function frame(t){requestAnimationFrame(frame);if(document.hidden||!visible||reduced||t-lastFrame<50)return;lastFrame=t;water+=(target-water)*.09;draw(t);}
  if('IntersectionObserver'in window)new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;},{threshold:.02}).observe(root);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){if(Date.now()-lastPoll>30000)poll();if(reduced)draw(performance.now());}});
  setInterval(()=>{if(visible&&!document.hidden&&Date.now()-lastPoll>=30000)poll();},5000);
  display([]);draw(performance.now());requestAnimationFrame(frame);poll();
}
