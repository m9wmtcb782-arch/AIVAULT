/* vis1：小鎮畫面升級 B1（Kenney CC0 方塊卡通風）。預設關閉。
   開啟：網址 ?vis=1 或 localStorage.townVisOn='1'；強制關閉：?vis=0（優先）。
   內容：宿舍與工坊外殼換成 Kenney Holiday Kit 木屋模組（合併幾何＋InstancedMesh，冬天換積雪屋頂）、夜晚窗戶亮燈、
         鏡頭附近最多 12 位 AI 換成 Kenney Mini Characters 骨架動畫人物（跟著 ss1 季節／天氣／穿著／雨傘）、
         「🧑 我的人物」3D 角色選擇（存 localStorage.aivaultAvatar3d，不寫資料庫）。
   素材授權：assets/town/CREDITS.md（全部 CC0）。不碰暗星／曙光即時語音視訊。 */
(function(){try{var QS=location.search;if(/[?&]vis=0/.test(QS))return;if(!(/[?&]vis=1/.test(QS)||localStorage.getItem('townVisOn')==='1'))return}catch(_){return}
 var TURL='https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
 var BASE=(/github\.io$/.test(location.hostname)?location.origin+'/AIVAULT/':new URL('./',location.href).href)+'assets/town/';
 var T,GL,SU,BGU,RB,loader,started=false,ready=false,VS={b:[],glow:null,glowMat:null,chars:[],pool:{},near:[],me:null,snow:null};
 var ROSTER=[{id:'male-a',n:'阿澄',s:'工程師・俐落短髮'},{id:'female-b',n:'小晴',s:'設計師・馬尾'},{id:'male-d',n:'大山',s:'工匠・壯碩'},{id:'female-e',n:'語涵',s:'研究員・長髮'},{id:'male-c',n:'子安',s:'書生'},{id:'female-a',n:'阿蓮',s:'探險家・短髮'},{id:'male-f',n:'阿凱',s:'運動員'},{id:'female-d',n:'芊芊',s:'藝術家・溫柔'}];
 var MALE=['male-a','male-b','male-c','male-d','male-e','male-f'],FEM=['female-a','female-b','female-c','female-d','female-e','female-f'];
 function envState(){var s=null;try{s=window.__seasons&&window.__seasons.state()}catch(_){}
  var sea=(s&&s.season)||'autumn',k=(s&&s.wx&&s.wx.kind)||'clear',clo=(s&&s.clothes)||'normal';
  var o=tpParts(),h=(typeof HOUR!=='undefined'&&HOUR!=null)?HOUR:(+o.hour%24)+(+o.minute)/60;
  return{season:sea,rain:k==='rain'||k==='typhoon'||k==='storm',snow:sea==='winter'||sea==='frozen'||k==='snow',clothes:clo,night:h<6||h>=18,h:h}}
 var gcache={};function glb(u){return gcache[u]||(gcache[u]=new Promise(function(res,rej){loader.load(BASE+u,res,undefined,rej)}))}
 /* ---- 建築：Holiday Kit 模組 → 合併成一個幾何 ---- */
 function plan(W,D,rows,open,snow){var P=[],ox=-(W-1)/2,oz=-(D-1)/2,rs=snow?'cabin-roof-snow':'cabin-roof',win=[];
  function p(f,x,y,z,ry){P.push([f,x+ox,y,z+oz,ry]);if(/window/.test(f))win.push([x+ox,y,z+oz,ry])}
  for(var y=0;y<rows;y++){
   for(var i=0;i<W;i++){if(!open)p(i===((W-1)>>1)&&y===0?'cabin-doorway':(i%2?'cabin-window-b':'cabin-window-a'),i,y,D-1,0);p(y===0&&i!==((W-1)>>1)?'cabin-window-a':'cabin-wall',i,y,0,Math.PI)}
   for(var j=0;j<D;j++){p(j%2?'cabin-window-a':'cabin-wall',W-1,y,j,Math.PI/2);p(j%2?'cabin-wall':'cabin-window-a',0,y,j,-Math.PI/2)}
   p('cabin-corner',0,y,D-1,0);p('cabin-corner',W-1,y,D-1,Math.PI/2);p('cabin-corner',W-1,y,0,Math.PI);p('cabin-corner',0,y,0,-Math.PI/2)}
  for(var i2=0;i2<W;i2++)for(var j2=0;j2<D;j2++)p(snow?'floor-wood-snow':'floor-wood',i2,0,j2,0);
  for(var i3=0;i3<W;i3++){p((i3===W-1?rs+'-chimney':rs),i3,rows,D/2,-Math.PI/2);p(rs,i3,rows,D/2-1,Math.PI/2)}
  return{P:P,win:win}}
 async function mergeType(W,D,rows,open,snow){var pl=plan(W,D,rows,open,snow),gs=[],mat=null,M=new T.Matrix4(),E=new T.Euler();
  for(var k=0;k<pl.P.length;k++){var q=pl.P[k],g=await glb('kenney/holiday/'+q[0]+'.glb');g.scene.updateMatrixWorld(true);
   g.scene.traverse(function(m){if(m.isMesh){mat=mat||m.material;var ge=m.geometry.clone();for(var a in ge.attributes)if(['position','normal','uv'].indexOf(a)<0)ge.deleteAttribute(a);
    M.compose(new T.Vector3(q[1],q[2],q[3]),new T.Quaternion().setFromEuler(E.set(0,q[4],0)),new T.Vector3(1,1,1)).multiply(m.matrixWorld);ge.applyMatrix4(M);gs.push(ge.index?ge.toNonIndexed():ge)}})}
  return{geo:BGU.mergeGeometries(gs,false),mat:mat,win:pl.win}}
 var TYPES={long:{W:4,D:2,rows:1,open:false,sc:[3.6,4.2,3.6]},sq:{W:2,D:2,rows:1,open:false,sc:[4,4.2,4]},ws:{W:3,D:2,rows:2,open:true,sc:[13/3,3.1,5]}};
 async function buildings(){var inst={long:[],sq:[],ws:[]};scene.updateMatrixWorld(true);
  WSO.forEach(function(o,i){var g=o.g;for(var c=1;c<=9&&c<g.children.length;c++)g.children[c].visible=false;
   var L=new T.Matrix4().makeRotationY(Math.PI);inst.ws.push({m:g.matrixWorld.clone().multiply(L),col:o.col,o:o})});
  scene.traverse(function(o){if(o.isGroup&&o.userData&&o.userData.w&&o.children.length===4&&!WSO.some(function(w){return w.g===o})&&o.parent&&o.parent!==scene||false){
   if(o.parent&&WSO.some(function(w){return w.g===o.parent}))return;var long=o.userData.w.length>2;
   var side=(o.userData.w[0]||[1])[0]>0?1:-1;o.children.forEach(function(c){c.visible=false});
   var L=new T.Matrix4().makeRotationY(long?(side>0?Math.PI/2:-Math.PI/2):(side>0?Math.PI/2:-Math.PI/2));(long?inst.long:inst.sq).push({m:o.matrixWorld.clone().multiply(L),o:o})}});
  VS.inst=inst;var tot={calls:0};
  for(var k in TYPES){var t=TYPES[k],list=inst[k];if(!list.length)continue;var a=await mergeType(t.W,t.D,t.rows,t.open,false),b=await mergeType(t.W,t.D,t.rows,t.open,true);
   var im=new T.InstancedMesh(a.geo,a.mat,list.length);im.castShadow=true;im.receiveShadow=true;var S=new T.Matrix4().makeScale(t.sc[0],t.sc[1],t.sc[2]),Mi=new T.Matrix4(),cc=new T.Color();
   list.forEach(function(e,i){Mi.multiplyMatrices(e.m,S);im.setMatrixAt(i,Mi);cc.set(e.col!=null?e.col:0xffffff).lerp(new T.Color(0xffffff),.5);im.setColorAt(i,cc);e.M=Mi.clone()});
   im.name='vis1-'+k;im.userData.geoA=a.geo;im.userData.geoB=b.geo;scene.add(im);VS.b.push(im);t.win=a.win;
   /* 讓工坊點擊仍然有效：InstancedMesh 不在 WSO 群組裡，原本的地板（child 0）保留可點 */}
  /* 夜晚窗光：每個窗戶模組一片發光板，一個 InstancedMesh */
  var quads=[],Q=new T.Matrix4(),E=new T.Euler();for(var k2 in TYPES){var t2=TYPES[k2];(inst[k2]||[]).forEach(function(e){(t2.win||[]).forEach(function(w){
    Q.compose(new T.Vector3(w[0],w[1],w[2]),new T.Quaternion().setFromEuler(E.set(0,w[3],0)),new T.Vector3(1,1,1));var L2=new T.Matrix4().makeTranslation(0,.52,.86);quads.push(e.M.clone().multiply(Q).multiply(L2))})})}
  VS.glowMat=new T.MeshBasicMaterial({color:0xffc56b,transparent:true,opacity:.9,side:T.DoubleSide});var gg=new T.PlaneGeometry(.42,.42);VS.glow=new T.InstancedMesh(gg,VS.glowMat,Math.max(1,quads.length));quads.forEach(function(m,i){VS.glow.setMatrixAt(i,m)});VS.glow.count=quads.length;VS.glow.name='vis1-glow';scene.add(VS.glow);await houseDeco(inst)}

 /* ---- 房子細節（vis1b）：圓潤厚雪蓋＋屋簷雪唇、冰柱、屋旁道具群、窗光暈、煙囪煙、暖色點光源 ---- */
 function halo(){var c=document.createElement('canvas');c.width=c.height=64;var x=c.getContext('2d'),g=x.createRadialGradient(32,32,2,32,32,32);g.addColorStop(0,'rgba(255,214,140,1)');g.addColorStop(.35,'rgba(255,170,80,.45)');g.addColorStop(1,'rgba(255,150,60,0)');x.fillStyle=g;x.fillRect(0,0,64,64);var t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;return t}
 function puff(){var c=document.createElement('canvas');c.width=c.height=64;var x=c.getContext('2d'),g=x.createRadialGradient(32,32,4,32,32,30);g.addColorStop(0,'rgba(235,235,240,.9)');g.addColorStop(1,'rgba(235,235,240,0)');x.fillStyle=g;x.fillRect(0,0,64,64);return new T.CanvasTexture(c)}
 function capGeo(t){var D=t.D,W=t.W,top=t.rows+1.28,ey=t.rows+.02,ez=D/2+.28,gs=[],len=Math.hypot(ez,top-ey),ang=Math.atan2(top-ey,ez);
  [1,-1].forEach(function(sg){var b=new RB.RoundedBoxGeometry(W+.36,.2,len+.06,3,.09);b.rotateX(sg*ang);b.translate(0,(top+ey)/2+.11,sg*ez/2);gs.push(b);
   var lip=new T.CylinderGeometry(.13,.13,W+.42,10);lip.rotateZ(Math.PI/2);lip.translate(0,ey+.04,sg*(ez+.02));gs.push(lip);
   for(var i=0;i<4;i++){var bl=new T.SphereGeometry(.16+.05*((i*7)%3),8,6);bl.scale(1.6,.7,1);bl.translate(-W/2+.3+i*(W-.6)/3,ey+.02,sg*(ez+.05));gs.push(bl)}});
  var rg=new T.CylinderGeometry(.16,.16,W+.4,10);rg.rotateZ(Math.PI/2);rg.translate(0,top+.14,0);gs.push(rg);
  return BGU.mergeGeometries(gs.map(function(g){g.deleteAttribute&&g.attributes.uv||0;return g.index?g.toNonIndexed():g}),false)}
 function iceGeo(t){var D=t.D,W=t.W,ey=t.rows-.04,ez=D/2+.3,gs=[],r=7;function rnd(){r=(r*16807)%2147483647;return r/2147483647}
  [1,-1].forEach(function(sg){for(var x=-W/2+.1;x<W/2-.05;x+=.16+rnd()*.12){var h=.12+rnd()*.32,c=new T.ConeGeometry(.035,h,5);c.rotateX(Math.PI);c.translate(x,ey-h/2,sg*ez);gs.push(c.index?c.toNonIndexed():c)}});
  return BGU.mergeGeometries(gs,false)}
 var PROPS=[['survival/barrel',1.25,.7,1.6],['survival/box-large',-1.3,.6,1.3],['survival/box',-1.9,1.1,1.1],['survival/resource-wood',1.6,-.2,1.5],['survival/tree-log',.2,1.4,1.5],['holiday/lantern',.9,.75,1.6],['holiday/sled',-.4,1.25,1.2],['survival/bucket',1.85,.5,1.1]];
 async function houseDeco(inst){var capMat=new T.MeshStandardMaterial({color:0xffffff,roughness:.85}),iceMat=new T.MeshStandardMaterial({color:0xd8f0ff,roughness:.15,metalness:0,transparent:true,opacity:.85,emissive:0x3a5a7a,emissiveIntensity:.25});
  try{var tl=new T.TextureLoader(),tc=tl.load(BASE+'acg/Snow010A_Color.jpg'),tn=tl.load(BASE+'acg/Snow010A_NormalGL.jpg');[tc,tn].forEach(function(x){x.wrapS=x.wrapT=T.RepeatWrapping;x.repeat.set(2,2)});tc.colorSpace=T.SRGBColorSpace;capMat.map=tc;capMat.normalMap=tn;capMat.normalScale.set(.6,.6)}catch(_){}
  VS.snowObj=[];VS.lod=[];var chims=[],halos=[],Mi=new T.Matrix4();
  for(var k in TYPES){var t=TYPES[k],list=inst[k]||[];if(!list.length)continue;
   var cg=capGeo(t),ig=iceGeo(t),cap=new T.InstancedMesh(cg,capMat,list.length),ice=new T.InstancedMesh(ig,iceMat,list.length);cap.castShadow=cap.receiveShadow=true;
   list.forEach(function(e,i){cap.setMatrixAt(i,e.M);ice.setMatrixAt(i,e.M);var cp=new T.Vector3((t.W-1)/2+.28,t.rows+1.75,.32).applyMatrix4(e.M);chims.push(cp)});
   cap.name='vis1-cap-'+k;ice.name='vis1-ice-'+k;scene.add(cap);scene.add(ice);VS.snowObj.push(cap,ice);VS.lod.push(ice);
   /* 屋旁道具群：前門兩側＋側邊，不受房子非等比縮放影響 */
   var front=t.open?-(t.D/2)*t.sc[2]-1.2:(t.D/2)*t.sc[2]+.3,fx=t.sc[0]*t.W/2;
   for(var q=0;q<PROPS.length;q++){var pr=PROPS[q],g=await glb('kenney/'+pr[0]+'.glb');g.scene.updateMatrixWorld(true);var meshes=[];g.scene.traverse(function(m){if(m.isMesh)meshes.push(m)});
    meshes.forEach(function(m){var im=new T.InstancedMesh(m.geometry,m.material,list.length);im.castShadow=true;im.receiveShadow=true;
     list.forEach(function(e,i){var sx=(i%2?-1:1),L=new T.Matrix4().compose(new T.Vector3(sx*pr[1]*fx*.62,0,front+(t.open?-1:1)*pr[2]),new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),q*1.3+i),new T.Vector3(pr[3]*1.25,pr[3]*1.25,pr[3]*1.25));Mi.multiplyMatrices(e.m,L).multiply(m.matrixWorld);im.setMatrixAt(i,Mi)});
     im.name='vis1-prop';scene.add(im);VS.lod.push(im)})}}
  /* 窗光暈（加法混合，像 bloom） */
  if(VS.glow){var hm=new T.MeshBasicMaterial({map:halo(),transparent:true,depthWrite:false,blending:T.AdditiveBlending,side:T.DoubleSide});var hg=new T.InstancedMesh(new T.PlaneGeometry(1.6,1.6),hm,VS.glow.count),m4=new T.Matrix4();
   for(var i=0;i<VS.glow.count;i++){VS.glow.getMatrixAt(i,m4);m4.multiply(new T.Matrix4().makeTranslation(0,0,.02));hg.setMatrixAt(i,m4)}hg.count=VS.glow.count;hg.name='vis1-halo';hg.renderOrder=5;scene.add(hg);VS.halo=hg}
  /* 煙囪煙：一個 Points */
  var NP=8,pos=new Float32Array(chims.length*NP*3),seed=[];for(var c=0;c<chims.length;c++)for(var j=0;j<NP;j++){seed.push([c,j/NP]);}
  var sg=new T.BufferGeometry();sg.setAttribute('position',new T.BufferAttribute(pos,3));var sm=new T.Points(sg,new T.PointsMaterial({map:puff(),size:2.4,transparent:true,depthWrite:false,opacity:.55,color:0xdedfe6}));sm.frustumCulled=false;sm.name='vis1-smoke';scene.add(sm);VS.smoke={pts:sm,ch:chims,seed:seed,NP:NP,t:0};
  /* 暖色點光源：跟著鏡頭附近 3 棟房子 */
  VS.lights=[0,1,2].map(function(){var l=new T.PointLight(0xffa456,0,16,1.6);scene.add(l);return l})}
 function decoTick(dt){var S=VS.smoke;if(S){S.t+=dt;var p=S.pts.geometry.attributes.position;for(var i=0;i<S.seed.length;i++){var s=S.seed[i],c=S.ch[s[0]],u=(S.t*.18+s[1])%1;p.setXYZ(i,c.x+Math.sin(u*6+i)*.5*u,c.y+u*6,c.z+u*1.2)}p.needsUpdate=true}
  var far=CAM.r>230;VS.lod.forEach(function(o){o.visible=!far&&(o.name.indexOf('ice')<0||(ENV&&ENV.snow))});
  if(VS.lights&&ENV){var warm=ENV.night||ENV.h<7.5||ENV.h>16.5||ENV.rain;var all=[];for(var k in VS.inst)(VS.inst[k]||[]).forEach(function(e){all.push(e)});var tx=CAM.tx,tz=CAM.tz;
   all.sort(function(a,b){return(Math.pow(a.m.elements[12]-tx,2)+Math.pow(a.m.elements[14]-tz,2))-(Math.pow(b.m.elements[12]-tx,2)+Math.pow(b.m.elements[14]-tz,2))});
   VS.lights.forEach(function(l,i){var e=all[i];if(!e)return;l.position.set(e.m.elements[12],3.2,e.m.elements[14]).add(new T.Vector3(0,0,3).applyMatrix4(new T.Matrix4().extractRotation(e.m)));l.intensity=warm?(ENV.night?28:10):0})}}
 /* ---- 人物：Kenney Mini Characters ---- */
 function umbrella(col){var u=new T.Group();u.name='vis1-umb';var c=new T.Mesh(new T.ConeGeometry(.5,.2,10,1,true),new T.MeshStandardMaterial({color:col,side:T.DoubleSide,roughness:.6}));c.position.y=1.02;u.add(c);
  var st=new T.Mesh(new T.CylinderGeometry(.012,.012,.72,5),new T.MeshStandardMaterial({color:0x333333}));st.position.y=.66;u.add(st);u.position.set(.16,0,.04);return u}
 function dress(e,env,k){var c=e.c;var rm=[];c.traverse(function(o){if(o.userData.acc)rm.push(o)});rm.forEach(function(o){o.parent.remove(o)});
  var tint=env.clothes==='jacket'?(e.col!=null?e.col:0xb5442f):null;
  c.traverse(function(m){if(m.isMesh&&!m.userData.acc){if(!m.userData.base){m.material=m.material.clone();m.userData.base=m.material.color.clone()}m.material.color.copy(m.userData.base);if(tint!=null)m.material.color.lerp(new T.Color(tint),.35);if(env.clothes==='short')m.material.color.lerp(new T.Color(0xfff4d6),.15)}});
  var torso=c.getObjectByName('torso'),head=c.getObjectByName('head');function add(p,o){o.userData.acc=1;o.traverse(function(x){x.userData.acc=1;x.castShadow=true});p.add(o)}
  if(env.clothes==='jacket'&&torso){var sc=new T.Mesh(new T.TorusGeometry(.11,.04,6,14),new T.MeshStandardMaterial({color:k%2?0xf1e3c6:0x2e5d8a,roughness:1}));sc.rotation.x=Math.PI/2;sc.position.y=.2;add(torso,sc)}
  if(env.clothes==='jacket'&&env.snow&&head){var h=new T.Mesh(new T.SphereGeometry(.15,10,6,0,6.3,0,1.6),new T.MeshStandardMaterial({color:0x8a2b2b,roughness:1}));h.position.y=.2;add(head,h)}
  if(env.clothes==='short'&&head){var s=new T.Mesh(new T.CylinderGeometry(.2,.2,.02,14),new T.MeshStandardMaterial({color:0xe9d39a}));s.position.y=.2;add(head,s)}
  if(env.rain){add(c,umbrella([0x2f6fb3,0xd9534f,0xf0ad4e,0x5cb85c][k%4]))}e.dressSig=env.season+env.clothes+env.rain+env.snow}
 async function mkChar(id,col,k){var g=await glb('kenney/mini/character-'+id+'.glb');var c=SU.clone(g.scene);c.scale.setScalar(4);c.traverse(function(m){if(m.isMesh){m.castShadow=true;m.frustumCulled=false}});
  var mx=new T.AnimationMixer(c),A2={};['idle','walk','sit','holding-right'].forEach(function(n){var cl=T.AnimationClip.findByName(g.animations,n);if(cl)A2[n]=mx.clipAction(cl)});
  var e={c:c,mx:mx,act:A2,cur:null,col:col,k:k,id:id};scene.add(c);return e}
 function play(e,n){if(!e.act[n])n='idle';if(e.cur===n)return;if(e.cur&&e.act[e.cur])e.act[e.cur].fadeOut(.2);e.act[n].reset().fadeIn(.2).play();e.cur=n}
 function hideAgent(i,on){for(var k in CH){var im=CH[k];if(!im||!im.isInstancedMesh)continue;var m=Math.max(1,Math.round(im.count/Math.max(1,A.length)));if(m>2)m=2;
   for(var j=0;j<m;j++){var ix=i*m+j;if(ix<im.count){if(on)im.setMatrixAt(ix,ZERO)}}im.instanceMatrix.needsUpdate=true}}
 var ZERO,NEAR=12,lastPick=0,lastEnv=0,ENV=null,clock=null;
 async function pickNear(){var r=CAM.r;var want=[];if(r<120){var tx=CAM.tx,tz=CAM.tz,R2=Math.max(30,r*.9);R2*=R2;var c=[];
   for(var i=0;i<A.length;i++){var a=A[i];if(a.dead||!a.posed)continue;var dx=a.x-tx,dz=a.z-tz,d=dx*dx+dz*dz;if(d<R2)c.push([d,i])}c.sort(function(x,y){return x[0]-y[0]});want=c.slice(0,NEAR).map(function(x){return x[1]})}
  var keep={};want.forEach(function(i){keep[i]=1});
  VS.near=VS.near.filter(function(n){if(keep[n.i])return true;n.e.c.visible=false;n.e.busy=false;try{poseAgent(A[n.i],n.i);for(var k in CH)if(CH[k]&&CH[k].isInstancedMesh)CH[k].instanceMatrix.needsUpdate=true}catch(_){}return false});
  var have={};VS.near.forEach(function(n){have[n.i]=1});
  for(var w=0;w<want.length;w++){var i2=want[w];if(have[i2])continue;var a2=A[i2],h=0,s=String(a2.id||i2);for(var q=0;q<s.length;q++)h=(h*31+s.charCodeAt(q))>>>0;var id=(a2.fem?FEM:MALE)[h%6];
   var pool=VS.pool[id]=VS.pool[id]||[],e=null;for(var p=0;p<pool.length;p++)if(!pool[p].busy){e=pool[p];break}
   if(!e){e=await mkChar(id,null,pool.length);pool.push(e)}e.busy=true;e.c.visible=true;e.col=(DORMS[a2.dorm]||{}).col;e.dressSig=null;VS.near.push({i:i2,e:e})}}
 function syncChar(e,x,z,yaw,pose,mv){e.c.position.set(x,0,z);e.c.rotation.y=yaw;var sit=pose==='sit'||pose==='rest'||pose==='type';play(e,sit?'sit':mv?'walk':(ENV&&ENV.rain?'holding-right':'idle'));if(sit)e.c.position.y=.15}
 /* ---- 我的人物（3D 選擇器） ---- */
 function myPick(){try{return JSON.parse(localStorage.getItem('aivaultAvatar3d')||'null')}catch(_){return null}}
 async function ensureMe(){var m=myPick();if(!m){if(VS.me){VS.me.c.visible=false}return}if(VS.me&&VS.me.id===m.id){VS.me.c.visible=true;return}if(VS.me)scene.remove(VS.me.c);
  VS.me=await mkChar(m.id,null,1);VS.me.dressSig=null;var mk=new T.Mesh(new T.ConeGeometry(.08,.16,4),new T.MeshBasicMaterial({color:0xffd23f}));mk.rotation.x=Math.PI;mk.position.y=1.15;VS.me.c.add(mk)}
 function picker(){var env=envState(),idx=0,m=myPick();if(m)idx=Math.max(0,ROSTER.findIndex(function(r){return r.id===m.id}));var sea=env.season==='frozen'?'winter':env.season,rain=env.rain;
  var d=document.createElement('div');d.id='vis1Pick';d.style.cssText='position:fixed;inset:0;z-index:60;background:linear-gradient(#24344f,#0f1726);color:#fff;font-family:system-ui,-apple-system,"PingFang TC",sans-serif;display:flex;flex-direction:column;align-items:center;overflow:auto;padding-top:env(safe-area-inset-top)';
  d.innerHTML='<div style="width:100%;display:flex;justify-content:space-between;align-items:center;padding:10px 12px;box-sizing:border-box"><b style="font-size:18px">🧑 選擇你的角色</b><button id="vpX" style="background:#fff2;border:0;color:#fff;border-radius:14px;padding:6px 12px;font-size:15px">✕ 關閉</button></div>'+
   '<div style="position:relative;width:100%"><canvas id="vpC" style="width:100%;height:46vh;display:block;touch-action:pan-y"></canvas><button id="vpL" style="position:absolute;left:8px;top:40%;width:46px;height:46px;border-radius:50%;border:0;background:#fff3;color:#fff;font-size:24px">‹</button><button id="vpR" style="position:absolute;right:8px;top:40%;width:46px;height:46px;border-radius:50%;border:0;background:#fff3;color:#fff;font-size:24px">›</button></div>'+
   '<div id="vpN" style="font-size:22px;font-weight:700"></div><div id="vpS" style="opacity:.8;font-size:14px"></div><div id="vpD" style="margin:6px;letter-spacing:4px;opacity:.7"></div>'+
   '<div id="vpSe" style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center"></div><div style="margin:8px"><span id="vpRa" style="padding:7px 12px;border-radius:16px;border:1px solid #fff3;font-size:14px">☂️ 下雨預覽</span></div>'+
   '<button id="vpOK" style="width:80%;padding:13px;border:0;border-radius:24px;background:linear-gradient(90deg,#ffb347,#ff7a3d);color:#fff;font-size:18px;font-weight:700">確認選擇</button><div id="vpM" style="font-size:13px;color:#9fe6a0;min-height:18px;margin:6px"></div>'+
   (typeof AUTHED!=='undefined'&&AUTHED?'<button id="vpOld" style="background:none;border:0;color:#93c5fd;font-size:13px;margin-bottom:18px">舊版人物設定（男／女／顏色、暱稱）</button>':'');
  document.body.appendChild(d);var cv=d.querySelector('#vpC'),Rr=new T.WebGLRenderer({canvas:cv,antialias:true,alpha:true});Rr.setPixelRatio(Math.min(2,devicePixelRatio||1));Rr.setSize(cv.clientWidth,cv.clientHeight,false);Rr.outputColorSpace=T.SRGBColorSpace;Rr.toneMapping=T.ACESFilmicToneMapping;
  var S2=new T.Scene(),C2=new T.PerspectiveCamera(30,cv.clientWidth/cv.clientHeight,.1,50);C2.position.set(0,1.5,7.2);C2.lookAt(0,1,0);S2.add(new T.HemisphereLight(0xdfeeff,0x554433,1.2));var kl=new T.DirectionalLight(0xffe2b8,2.2);kl.position.set(2,4,3);S2.add(kl);
  var ped=new T.Mesh(new T.CylinderGeometry(.9,1,.15,32),new T.MeshStandardMaterial({color:0xe9eef5,roughness:.8}));ped.position.y=-.075;S2.add(ped);var cur=null,alive=true,ck=new T.Clock();
  async function show(){var r=ROSTER[idx],g=await glb('kenney/mini/character-'+r.id+'.glb');if(cur)S2.remove(cur.c);var c=SU.clone(g.scene);c.scale.setScalar(2.4);var mx=new T.AnimationMixer(c);cur={c:c,mx:mx};
   dress(cur,{season:sea,clothes:sea==='summer'?'short':(sea==='winter'||sea==='autumn')?'jacket':'normal',rain:rain,snow:sea==='winter'},idx);var cl=T.AnimationClip.findByName(g.animations,rain?'holding-right':'idle');if(cl)mx.clipAction(cl).play();S2.add(c);
   d.querySelector('#vpN').textContent=r.n;d.querySelector('#vpS').textContent=r.s;d.querySelector('#vpD').textContent=ROSTER.map(function(_,i){return i===idx?'●':'○'}).join('');window.__visPickReady=true}
  var SN={winter:'❄️ 冬',spring:'🌸 春',summer:'☀️ 夏',autumn:'🍁 秋'},se=d.querySelector('#vpSe');se.innerHTML=Object.keys(SN).map(function(s){return'<span data-s="'+s+'" style="padding:7px 12px;border-radius:16px;border:1px solid #fff3;font-size:14px">'+SN[s]+'</span>'}).join('');
  function sync(){[].forEach.call(se.children,function(c){c.style.background=c.dataset.s===sea?'#ffd23f':'#ffffff1f';c.style.color=c.dataset.s===sea?'#222':'#fff'});var ra=d.querySelector('#vpRa');ra.style.background=rain?'#ffd23f':'#ffffff1f';ra.style.color=rain?'#222':'#fff'}
  se.onclick=function(ev){if(ev.target.dataset.s){sea=ev.target.dataset.s;sync();show()}};d.querySelector('#vpRa').onclick=function(){rain=!rain;sync();show()};
  d.querySelector('#vpL').onclick=function(){idx=(idx+ROSTER.length-1)%ROSTER.length;show()};d.querySelector('#vpR').onclick=function(){idx=(idx+1)%ROSTER.length;show()};
  var sx=null;cv.addEventListener('touchstart',function(e){sx=e.touches[0].clientX},{passive:true});cv.addEventListener('touchend',function(e){if(sx==null)return;var dd=e.changedTouches[0].clientX-sx;if(Math.abs(dd)>40)d.querySelector(dd<0?'#vpR':'#vpL').onclick();sx=null});
  function close(){alive=false;try{Rr.dispose();Rr.forceContextLoss()}catch(_){}d.remove()}
  d.querySelector('#vpX').onclick=close;var old=d.querySelector('#vpOld');if(old)old.onclick=function(){close();showMe()};
  d.querySelector('#vpOK').onclick=function(){var r=ROSTER[idx];localStorage.setItem('aivaultAvatar3d',JSON.stringify({id:r.id,name:r.n,v:1,ts:Date.now()}));d.querySelector('#vpM').textContent='✅ 已選擇「'+r.n+'」，回到小鎮就會看到你（頭上黃色箭頭）';ensureMe()};
  sync();show();(function lp(){if(!alive)return;var dt=ck.getDelta();if(cur){cur.mx.update(dt);cur.c.rotation.y+=dt*.6}Rr.render(S2,C2);requestAnimationFrame(lp)})()}
 function hookButton(){var b=document.getElementById('cMe');if(!b)return;b.style.display='';b.onclick=picker}
 /* ---- 每幀 ---- */
 function applyEnv(){ENV=envState();var sn=ENV.snow;VS.b.forEach(function(im){var g=sn?im.userData.geoB:im.userData.geoA;if(im.geometry!==g)im.geometry=g});
  if(VS.glow){VS.glow.visible=ENV.night||ENV.rain;if(VS.halo)VS.halo.visible=ENV.night}(VS.snowObj||[]).forEach(function(o){o.visible=ENV.snow})
  var all=VS.near.map(function(n){return n.e});if(VS.me)all.push(VS.me);all.forEach(function(e){var sig=ENV.season+ENV.clothes+ENV.rain+ENV.snow;if(e.dressSig!==sig)dress(e,ENV,e.k||0)})}
 var meT=0;
 function tick(ts){requestAnimationFrame(tick);if(!ready||document.hidden)return;var dt=Math.min(.05,clock.getDelta());
  if(ts-lastEnv>2000){lastEnv=ts;applyEnv()}if(ts-lastPick>500){lastPick=ts;pickNear().then(applyEnv)}
  decoTick(dt);VS.near.forEach(function(n){var a=A[n.i];if(!a)return;syncChar(n.e,a.x,a.z,a.yaw,a.pose,a.mv);n.e.mx.update(dt)});
  if(VS.me&&VS.me.c.visible){meT+=dt*.25;var x=Math.cos(meT)*5,z=16+Math.sin(meT)*3;syncChar(VS.me,x,z,-meT,'',true);VS.me.mx.update(dt)}}
 async function start(){started=true;try{T=await import(TURL);GL=await import(BASE+'lib/GLTFLoader.js');SU=await import(BASE+'lib/SkeletonUtils.js');BGU=await import(BASE+'lib/BufferGeometryUtils.js');RB=await import(BASE+'lib/RoundedBoxGeometry.js');loader=new GL.GLTFLoader();ZERO=new T.Matrix4().makeScale(0,0,0);clock=new T.Clock();
   await buildings();var ob=scene.onBeforeRender;scene.onBeforeRender=function(){if(ob)try{ob.apply(this,arguments)}catch(_){}VS.near.forEach(function(n){hideAgent(n.i,true)})};
   hookButton();await ensureMe();ready=true;applyEnv();window.__vis={on:true,stats:function(){return{calls:R.info.render.calls,tris:R.info.render.triangles,near:VS.near.length,buildings:VS.b.map(function(b){return b.name+':'+b.count}),glow:VS.glow?VS.glow.count:0}},env:function(){return ENV},picker:picker,focus:function(k,i,r){var e=(VS.inst[k]||[])[i||0];if(!e)return null;var rot=new T.Vector3(0,0,1).applyMatrix4(new T.Matrix4().extractRotation(e.m));CAM.tx=e.m.elements[12]+rot.x*3;CAM.tz=e.m.elements[14]+rot.z*3;CAM.th=Math.atan2(rot.x,rot.z)+.5;CAM.ph=.78;CAM.r=r||45;camApply();return[CAM.tx,CAM.tz]}}}
  catch(e){console.warn('vis1 failed, town stays original',e);window.__vis={on:false,err:String(e)}}}
 (function wait(){if(typeof scene!=='undefined'&&scene&&WSO&&WSO.length&&CH&&CH.body&&A&&A.length&&typeof CAM!=='undefined'){if(!started){start();requestAnimationFrame(tick)}}else setTimeout(wait,500)})();
})();
