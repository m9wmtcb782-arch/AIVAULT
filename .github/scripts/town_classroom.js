/* ===== cr1：露天電腦教室（1000 個座位，沒有屋頂）=====
   只有「真的正在上網學習」的 AI（學習鎖未到期或 10 分鐘內有學習紀錄，資料來自 degree/learning_now）才會走進來坐下，頭上出現 📶＋學習領域。?mock=1 才用測試資料。
   桌子／螢幕／椅子用 InstancedMesh（iPhone Safari 也順）。⚙️ 設定 可顯示／隱藏。關閉：localStorage.classroomOff='1'（完全不載入）；設定裡的開關存在 localStorage.classroomHide */
(function(){try{if(localStorage.getItem('classroomOff')==='1')return}catch(_){return}
 var CX0=70,CZ0=-46,COLS=40,ROWS=25,DX=1.2,DZ=.96,G=null,LIVE={},TAGS={},HIDE=false;try{HIDE=localStorage.getItem('classroomHide')==='1'}catch(_){}
 var DN={llm:'語言',img:'圖像',av:'影音語音',code:'程式與代理'};
 function distOf(d){d=String(d||'');if(/coding|code|data|guard|security|agent|devops/.test(d))return'code';if(/image|3d|design|art/.test(d))return'img';if(/video|voice|music|audio|speech/.test(d))return'av';return'llm'}
 function seat(id){var n=parseInt(String(id).replace(/\D/g,''),10);n=isFinite(n)?(n-1)%(COLS*ROWS):0;var c=n%COLS,r=Math.floor(n/COLS);return[CX0+c*DX+.6,CZ0+r*DZ+.75]}
 function build(){G=new THREE.Group();var W=COLS*DX+3,H=ROWS*DZ+3,cx=CX0+COLS*DX/2,cz=CZ0+ROWS*DZ/2;
  var fl=new THREE.Mesh(new THREE.PlaneGeometry(W,H).rotateX(-Math.PI/2),new THREE.MeshStandardMaterial({color:0x8b9bb4,roughness:.9}));fl.position.set(cx,.05,cz);fl.receiveShadow=true;G.add(fl);
  var rim=new THREE.Mesh(new THREE.BoxGeometry(W+.6,.35,H+.6),new THREE.MeshStandardMaterial({color:0x475569}));rim.position.set(cx,-.1,cz);G.add(rim);
  var N=COLS*ROWS,M=new THREE.Matrix4(),q=new THREE.Quaternion(),s=new THREE.Vector3(1,1,1),p=new THREE.Vector3();
  var desk=new THREE.InstancedMesh(new THREE.BoxGeometry(1,.08,.5),new THREE.MeshStandardMaterial({color:0xd6b48a,roughness:.7}),N),legs=new THREE.InstancedMesh(new THREE.BoxGeometry(.9,.6,.06),new THREE.MeshStandardMaterial({color:0x64748b}),N),
      mon=new THREE.InstancedMesh(new THREE.BoxGeometry(.55,.36,.04),new THREE.MeshStandardMaterial({color:0x111827,emissive:0x1d4ed8,emissiveIntensity:.35}),N),chair=new THREE.InstancedMesh(new THREE.BoxGeometry(.42,.42,.42),new THREE.MeshStandardMaterial({color:0x334155}),N);
  for(var i=0;i<N;i++){var c=i%COLS,r=Math.floor(i/COLS),x=CX0+c*DX+.6,z=CZ0+r*DZ+.3;
   M.compose(p.set(x,.68,z),q,s);desk.setMatrixAt(i,M);M.compose(p.set(x,.34,z),q,s);legs.setMatrixAt(i,M);M.compose(p.set(x,.92,z-.12),q,s);mon.setMatrixAt(i,M);M.compose(p.set(x,.21,z+.45),q,s);chair.setMatrixAt(i,M)}
  [desk,legs,mon,chair].forEach(function(m){m.instanceMatrix.needsUpdate=true;m.castShadow=false;m.frustumCulled=true;G.add(m)});
  try{var sg=label(['🖥️ 露天電腦教室（1000 座）'],420,70,'rgba(30,64,175,.92)');sg.scale.set(9,1.5,1);sg.position.set(cx,5.5,CZ0+ROWS*DZ+1.5);G.add(sg)}catch(_){}
  G.visible=!HIDE;scene.add(G);try{AREAS.cls={c0:[cx,cz],c:[cx,cz],an:Math.atan2(cx,cz)}}catch(_){}}
 function tag(a,txt,rd){var t=TAGS[a.id];if(!t||t.txt!==txt){if(t)scene.remove(t.s);var s=label(['📶 '+txt],340,64,rd?'rgba(71,85,105,.94)':'rgba(14,116,144,.94)');s.scale.set(3.6,.68,1);
  /* lb1：標籤永遠畫在最上層（不被桌子／螢幕／人擋住） */try{var mm=s.material;(Array.isArray(mm)?mm:[mm]).forEach(function(m){m.depthTest=false;m.depthWrite=false;m.transparent=true});s.renderOrder=999}catch(_){}
  scene.add(s);t=TAGS[a.id]={s:s,txt:txt}}return t}
 async function pull(){try{var d;if(MOCK){var ids=(window.__floor&&__floor.A?__floor.A():[]).slice(0,24);d={rows:ids.map(function(a,i){return[a.id,['llm','img','av','code'][i%4],'（測試）模型架構','mock',i%2?'reading':'llm']})}}else d=await api('degree','learning_now',{});var nl={};(d.rows||[]).forEach(function(r){nl[r[0]]={d:r[1],topic:r[2],rd:r[4]==='reading'}});LIVE=nl}catch(_){}}
 /* 包住原本的 think：真的在學習的人走到自己的座位坐下打字；其他照舊 */
 var think0=think;think=function(a,dt,qn,dn){var L=!HIDE&&LIVE[a.id]&&!a.fs&&!a.asm&&!a.carryTask&&!a.dead;
  if(L){a.learnT=Math.max(a.learnT||0,5);if(a.goal!=='learn'||!a.cls){var st=seat(a.id);a.cls=st;a.goal='learn';try{a.path=areaRoute(a,'cls',st)}catch(_){a.path=[[a.x,a.z],st]}a.pi=0;a.loc='city'}}
  else if(a.cls){a.cls=null;if(a.goal==='learn'){a.learnT=0;a.goal='back'}}
  think0(a,dt,qn,dn);if(L&&!a.path&&a.cls){a.yaw=Math.PI;a.pose='type';a.reading=0}};
 function tick(){requestAnimationFrame(tick);var on={};if(!HIDE)Object.keys(LIVE).forEach(function(id){var a=window.__floor&&__floor.A?null:null});
  var A0=(window.__floor&&__floor.A)?__floor.A():[];for(var i=0;i<A0.length;i++){var a=A0[i];if(!a.cls)continue;var L=LIVE[a.id];var t=tag(a,(L&&L.rd?'📖閱讀 ':'🧠深度學習 ')+(L&&L.topic&&!MOCK?(DN[L.d]||DN[distOf(a.dom)])+'｜'+L.topic:(DN[L&&L.d]||DN[distOf(a.dom)])+(MOCK?'（測試）':'')),L&&L.rd);t.s.position.set(a.x,3.4+(i%3)*.75+Math.sin(performance.now()/400+i)*.12,a.z);t.s.visible=true;on[a.id]=1}
  Object.keys(TAGS).forEach(function(id){if(!on[id]){scene.remove(TAGS[id].s);delete TAGS[id]}})}
 function settings(){var b=document.createElement('span');b.className='chip';b.id='cSet';b.textContent='⚙️ 設定';b.style.cursor='pointer';b.onclick=function(){open('<h3>⚙️ 設定</h3><p><label><input type="checkbox" id="setCls" '+(HIDE?'':'checked')+'> 顯示露天電腦教室</label></p><p class="muted">教室裡只會出現真的正在上網學習的 AI（現在 '+Object.keys(LIVE).length+' 位）。</p>');$('setCls').onchange=function(){HIDE=!this.checked;try{localStorage.setItem('classroomHide',HIDE?'1':'0')}catch(_){}if(G)G.visible=!HIDE}};var h=$('cHum');if(h)h.parentNode.appendChild(b)}
 function start(){if(typeof scene==='undefined'||!scene||typeof label!=='function'||!$('cHum')){setTimeout(start,1000);return}build();settings();pull();setInterval(function(){if(!document.hidden)pull()},30000);requestAnimationFrame(tick)}
 setTimeout(start,1600);window.__classroom={live:function(){return LIVE},look:function(){var C=__floor.CAM;C.tx=CX0+COLS*DX/2;C.tz=CZ0+ROWS*DZ/2;C.r=45;C.ph=.9;C.th=.6;__floor.camApply()}}})();
