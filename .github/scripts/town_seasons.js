/* ===== ss1：台灣四季・節日・天氣・穿著（冬天下雪是唯一跟台灣不同的地方）=====
   關閉：localStorage.seasonsOff='1'、網址 ?seasons=0，或伺服器端 aivault_town_weather.data.off=true。
   預覽：?date=2027-02-06  ?season=spring|summer|autumn|winter|frozen  ?wx=clear|cloudy|rain|snow|typhoon  ?temp=30
   節日：行政院人事行政總處〈政府行政機關辦公日曆表〉115、116 年（data.gov.tw 資料集 14718）。元宵＝官方春節初一＋14 天。
   颱風名：中央氣象署颱風中文譯名對照表（2026 更新）＋RSMC 東京（JMA）即時颱風。真實天氣：排程寫入 aivault_town_weather，過期 2 小時就改用日期推算的模擬天氣，畫面上會標明來源。 */
(function(){try{if(localStorage.getItem('seasonsOff')==='1'||/[?&]seasons=0/.test(location.search))return}catch(_){return}
 var HOL={"20260101":[2,"開國紀念日"],"20260215":[2,"小年夜"],"20260216":[2,"農曆除夕"],"20260217":[2,"春節"],"20260218":[2,"春節"],"20260219":[2,"春節"],"20260220":[2,"補假"],"20260227":[2,"補假"],"20260228":[2,"和平紀念日"],"20260403":[2,"補假"],"20260404":[2,"兒童節"],"20260405":[2,"清明節"],"20260406":[2,"補假"],"20260501":[2,"勞動節"],"20260619":[2,"端午節"],"20260925":[2,"中秋節"],"20260928":[2,"孔子誕辰紀念日/教師節"],"20261009":[2,"補假"],"20261010":[2,"國慶日"],"20261025":[2,"臺灣光復暨金門古寧頭大捷紀念日"],"20261026":[2,"補假"],"20261225":[2,"行憲紀念日"],"20270101":[2,"開國紀念日"],"20270204":[2,"小年夜"],"20270205":[2,"農曆除夕"],"20270206":[2,"春節"],"20270207":[2,"春節"],"20270208":[2,"春節"],"20270209":[2,"補假"],"20270210":[2,"補假"],"20270228":[2,"和平紀念日"],"20270301":[2,"補假"],"20270404":[2,"兒童節"],"20270405":[2,"清明節"],"20270406":[2,"補假"],"20270430":[2,"補假"],"20270501":[2,"勞動節"],"20270609":[2,"端午節"],"20270915":[2,"中秋節"],"20270928":[2,"孔子誕辰紀念日/教師節"],"20271010":[2,"國慶日"],"20271011":[2,"補假"],"20271025":[2,"臺灣光復暨金門古寧頭大捷紀念日"],"20271224":[2,"補假"],"20271225":[2,"行憲紀念日"],"20271231":[2,"補假"]},TYN=[["丹瑞","Damrey"],["天馬","Tianma"],["鴻雁","Kirogi"],["鴛鴦","Yun-yeung"],["小犬","Koinu"],["布拉萬","Bolaven"],["三巴","Sanba"],["鯉魚","Jelawat"],["蒂魯","Tirou"],["馬力斯","Maliksi"],["凱米","Gaemi"],["巴比侖","Prapiroon"],["瑪莉亞","Maria"],["山神","Son-Tinh"],["安比","Ampil"],["悟空","Wukong"],["雲雀","Jongdari"],["珊珊","Shanshan"],["船尾","Tomo"],["麗琵","Leepi"],["貝碧佳","Bebinca"],["葡萄桑","Pulasan"],["蘇力","Soulik"],["西馬隆","Cimaron"],["娜尼","Narae"],["布拉帕","Burapha"],["百里嘉","Barijat"],["花斑","Hoaban"],["高基","Koki"],["銀杏","Yinxing"],["青蛙","Gaeguri"],["點心","Dim-Sum"],["希比","Hebi"],["帕布","Pabuk"],["蝴蝶","Wutip"],["聖帕","Sepat"],["木恩","Mun"],["丹娜絲","Danas"],["百合","Nari"],["薇帕","Wipha"],["范斯高","Francisco"],["竹節草","Co-may"],["柯羅莎","Krosa"],["白鹿","Bailu"],["楊柳","Podul"],["玲玲","Lingling"],["劍魚","Kajiki"],["藍湖","Nongfa"],["琵琶","Peipah"],["塔巴","Tapah"],["米塔","Mitag"],["樺加沙","Ragasa"],["浣熊","Neoguri"],["博羅依","Bualoi"],["麥德姆","Matmo"],["哈隆","Halong"],["娜克莉","Nakri"],["風神","Fengshen"],["海鷗","Kalmaegi"],["鳳凰","Fung-wong"],["天琴","Koto"],["洛鞍","Nokaen"],["西望洋","Penha"],["鸚鵡","Nuri"],["辛樂克","Sinlaku"],["哈格比","Hagupit"],["薔蜜","Jangmi"],["米克拉","Mekkhala"],["無花果","Higos"],["巴威","Bavi"],["梅莎","Maysak"],["海神","Haishen"],["紅霞","Noul"],["白海豚","Dolphin"],["鯨魚","Kujira"],["昌鴻","Chan-hom"],["琵鷺","Peilou"],["南卡","Nangka"],["沙德爾","Saudel"],["紫檀","Narra"],["簡拉維","Gaenari"],["閃電","Atsani"],["艾陶","Etau"],["班朗","Bang-lang"],["科羅旺","Krovanh"],["杜鵑","Dujuan"],["舒力基","Surigae"],["彩雲","Choi-wan"],["小熊","Koguma"],["薔琵","Champi"],["煙花","In-Fa"],["查帕卡","Cempaka"],["尼伯特","Nepartak"],["盧碧","Lupit"],["銀河","Mirinae"],["妮妲","Nida"],["奧麥斯","Omais"],["布袋蓮","Luc-Binh"],["璨樹","Chanthu"],["電母","Dianmu"],["蒲公英","Mindulle"],["獅子山","Lionrock"],["時鐘","Tokei"],["南修","Namtheun"],["瑪瑙","Malou"],["妮亞圖","Nyatoh"],["沙布爾","Sarbul"],["阿穆丘","Amuyao"],["古莎莉","Gosari"],["芙蓉","Chaba"],["艾利","Aere"],["桑達","Songda"],["翠絲","Trases"],["木蘭","Mulan"],["米雷","Meari"],["青馬","Tsing-ma"],["蝎虎","Tokage"],["坡鹿","Ong-mang"],["梅花","Muifa"],["莫柏","Merbok"],["南瑪都","Nanmadol"],["塔拉斯","Talas"],["核桃","Hodu"],["庫拉","Kulap"],["洛克","Roke"],["桑卡","Sonca"],["尼莎","Nesat"],["海棠","Haitang"],["蜻蜓","Jamjari"],["榕樹","Banyan"],["山貓","Yamaneko"],["帕卡","Pakhar"],["珊瑚","Sanvu"],["瑪娃","Mawar"],["谷超","Guchol"],["泰利","Talim"],["大麥","Bori"],["卡努","Khanun"],["蘭恩","Lan"],["海星","Saobien"]],TY_FALLBACK_LAST='Champi';
 var P=new URLSearchParams(location.search),FD=P.get('date'),FS=P.get('season')||(function(){try{return localStorage.getItem('townTheme')==='frozen'?'frozen':null}catch(_){return null}})(),FW=P.get('wx'),FT=P.get('temp');
 function today(){if(FD&&/^\d{4}-\d\d-\d\d$/.test(FD)){var p=FD.split('-');return{y:+p[0],m:+p[1],d:+p[2]}}var o={};new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).forEach(function(x){o[x.type]=x.value});return{y:+o.year,m:+o.month,d:+o.day}}
 function key(t){return ''+t.y+(t.m<10?'0':'')+t.m+(t.d<10?'0':'')+t.d}
 function addDays(t,n){var d=new Date(Date.UTC(t.y,t.m-1,t.d+n));return{y:d.getUTCFullYear(),m:d.getUTCMonth()+1,d:d.getUTCDate()}}
 function hash(s){var h=2166136261;for(var i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return((h>>>0)%100000)/100000}
 var SN={spring:'春',summer:'夏',autumn:'秋',winter:'冬',frozen:'冰雪'},SI={spring:'🌸',summer:'☀️',autumn:'🍂',winter:'❄️',frozen:'🧊'};
 function seasonOf(t){if(FS&&SN[FS])return FS;var m=t.m;return m>=3&&m<=5?'spring':m<=8&&m>=6?'summer':m>=9&&m<=11?'autumn':'winter'}
 /* 節日：官方表＋國曆節慶（非放假日只是氣氛） */
 function lunarNY(y){for(var k in HOL)if(k.slice(0,4)==''+y&&HOL[k][1]==='春節')return{y:+k.slice(0,4),m:+k.slice(4,6),d:+k.slice(6,8)};return null}
 function festival(t){var k=key(t),md=k.slice(4),o=HOL[k],ev={off:false,name:'',deco:''};
  if(o){ev.off=o[0]===2;ev.name=o[1]}
  var ny=lunarNY(t.y);if(ny){var yx=addDays(ny,14);if(key(yx)===k){ev.name=ev.name?ev.name+'・元宵節':'元宵節';ev.deco='lantern'}}
  if(/除夕|春節|小年夜/.test(ev.name))ev.deco='cny';else if(ev.name==='補假'&&ny){var dd=(Date.UTC(t.y,t.m-1,t.d)-Date.UTC(ny.y,ny.m-1,ny.d))/864e5;if(dd>0&&dd<6)ev.deco='cny'}
  if(/中秋/.test(ev.name))ev.deco='moon';if(/端午/.test(ev.name))ev.deco='boat';if(/國慶/.test(ev.name))ev.deco='fire';
  if(md==='1224'||md==='1225'){ev.deco='xmas';ev.name=md==='1224'?'平安夜':(ev.name?ev.name+'・聖誕節':'聖誕節')}
  if(md==='1231'){ev.deco='fire';ev.name=ev.name?ev.name+'・跨年夜':'跨年夜'}if(md==='0101')ev.deco='fire';
  var keyY=''+t.y;ev.known=Object.keys(HOL).some(function(x){return x.slice(0,4)===keyY});return ev}
 /* 天氣 */
 var SNAP=null,SNAPT=0;
 function tyNext(lastEn){var i=-1;for(var j=0;j<TYN.length;j++)if(TYN[j][1].toLowerCase()===String(lastEn||'').toLowerCase())i=j;if(i<0)return null;return TYN[(i+1)%TYN.length]}
 function tyZh(en){for(var j=0;j<TYN.length;j++)if(TYN[j][1].toLowerCase()===String(en||'').toLowerCase())return TYN[j][0];return''}
 function weather(t,s){var k=key(t),w={kind:'clear',temp:0,src:'sim',ty:null,note:''};
  var base={spring:22,summer:31,autumn:25,winter:15,frozen:-2}[s],h=hash(k+'wx');w.temp=Math.round(base+(hash(k+'t')-.5)*6);
  var pr={spring:.33,summer:.35,autumn:.2,winter:.4,frozen:.6}[s];w.kind=h<pr?'rain':h<pr+.25?'cloudy':'clear';
  if(t.m>=7&&t.m<=10&&!FS){var b=Math.floor((Date.UTC(t.y,t.m-1,t.d)/864e5)/9);if(hash('ty'+b)<.22&&(Date.UTC(t.y,t.m-1,t.d)/864e5)%9<2)w.kind='typhoon'}
  var fresh=SNAP&&!FD&&!FS&&(Date.now()-SNAPT<2*3600e3);
  if(fresh){var tp=SNAP.taipei;if(tp&&tp.temp!=null){w.src='cwa';w.temp=Math.round(tp.temp);var x=String(tp.wx||'');w.kind=(tp.rain_mm>0||/雨/.test(x))?'rain':/陰|雲/.test(x)?'cloudy':'clear';w.note=x}
   var cw=SNAP.cwa_warning;if(cw&&cw.active){w.kind='typhoon';w.src='cwa';w.ty={zh:cw.name_zh||tyZh(cw.name_en),en:cw.name_en||'',real:true}}else if(w.kind==='typhoon'&&w.src==='cwa')w.kind='rain'}
  if(s==='winter'||s==='frozen'){if(w.kind==='rain'&&(w.temp<=16||w.src!=='cwa'))w.kind='snow'}
  if(FW)w.kind=FW;if(FT)w.temp=+FT;
  if(w.kind==='typhoon'&&!w.ty){var last=(SNAP&&SNAP.latest_name_en)||TY_FALLBACK_LAST,n=tyNext(last);w.ty=n?{zh:n[0],en:n[1],real:false,after:last}:null}
  return w}
 /* 外觀 */
 var C3=null,ST={},built=false,cur='';
 var GROUND={spring:0x9cc97a,summer:0x6fa84e,autumn:0x9cab60,winter:0xffffff,frozen:0xffffff},YARD={spring:0xc7e3a8,summer:0x9dc77c,autumn:0xc0c48c,winter:0xf2f6fb,frozen:0xeef4fb};
 function findGround(){scene.traverse(function(o){if(o.isMesh&&o.geometry&&o.geometry.type==='PlaneGeometry'&&o.material&&o.material.map){var w=o.geometry.parameters.width;if(Math.abs(w-700*K)<1)ST.gr=o;else if(Math.abs(w-300*K)<1&&Math.abs(o.position.y-.02)<.01)ST.yard=o}})}
 function findSnow(){ST.snow=[];scene.traverse(function(o){if(o.parent&&o.parent.name==='ss1')return;var m=o.material;if(!m||!m.color||o.instanceColor)return;var hx=m.color.getHexString(),g=o.geometry&&o.geometry.type,pr=(o.geometry&&o.geometry.parameters)||{};
   if(o.isPoints&&hx==='ffffff'&&o.geometry.attributes.position.count===900){ST.snow.push(o);return}if(!o.isMesh)return;
   if(hx==='fbfdff'||hx==='f7fbff'||(o.isInstancedMesh&&hx==='ffffff'&&g==='ConeGeometry'&&o.count>100)||(hx==='ffffff'&&g==='SphereGeometry'&&pr.thetaLength&&pr.thetaLength<Math.PI*.9))ST.snow.push(o)})}
 function build(){built=true;if(/[?&]ssprobe=1/.test(location.search))window.__ssScene=scene;window.__ssCam=function(r){var b=null,best=0;A.forEach(function(a){if(a.dead||!a.posed)return;var n=0;A.forEach(function(c){if(Math.abs(c.x-a.x)<8&&Math.abs(c.z-a.z)<8)n++});if(n>best&&!a.mv){best=n;b=a}});if(b){CAM.tx=b.x;CAM.tz=b.z}CAM.r=r;camApply()};C3=THREE.Color;GREY=new C3(0x7d8792);DARK=new C3(0x4b5560);findGround();var g=new THREE.Group();g.name='ss1';scene.add(g);ST.g=g;
  /* 遠山（冬天山頂積雪） */var nM=20,mg=new THREE.ConeGeometry(1,1,7),cg=new THREE.ConeGeometry(1,1,7);
  ST.mt=new THREE.InstancedMesh(mg,new THREE.MeshLambertMaterial({color:0x56745a}),nM);ST.cap=new THREE.InstancedMesh(cg,new THREE.MeshLambertMaterial({color:0xffffff}),nM);
  var o=new THREE.Object3D();for(var i=0;i<nM;i++){var a=i/nM*Math.PI*2+hash('m'+i)*.2,r=(320+hash('r'+i)*40)*K,h=(55+hash('h'+i)*55)*K,w=h*(.9+hash('w'+i)*.5);
   o.position.set(Math.cos(a)*r,h/2-2,Math.sin(a)*r);o.scale.set(w,h,w);o.rotation.set(0,a,0);o.updateMatrix();ST.mt.setMatrixAt(i,o.matrix);
   o.position.y=h-2-h*.14;o.scale.set(w*.29,h*.29,w*.29);o.updateMatrix();ST.cap.setMatrixAt(i,o.matrix)}
  [ST.mt,ST.cap].forEach(function(m){m.castShadow=m.receiveShadow=false;g.add(m)});
  /* 行道樹（四季換色） */var nT=170;ST.nT=nT;ST.trunk=new THREE.InstancedMesh(new THREE.CylinderGeometry(.35,.5,4,6),new THREE.MeshLambertMaterial({color:0x6b4a2e}),nT);
  ST.can=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(2.6,1),new THREE.MeshLambertMaterial({color:0xffffff}),nT);ST.tp=[];
  for(i=0;i<nT;i++){var a2=hash('ta'+i)*Math.PI*2,r2=(158+hash('tr'+i)*120)*K;var x=Math.cos(a2)*r2,z=Math.sin(a2)*r2,s=.8+hash('ts'+i)*.7;ST.tp.push([x,z,s]);
   o.position.set(x,2*s,z);o.scale.set(s,s,s);o.rotation.set(0,0,0);o.updateMatrix();ST.trunk.setMatrixAt(i,o.matrix);o.position.y=5.2*s;o.scale.set(s,s*.9,s);o.updateMatrix();ST.can.setMatrixAt(i,o.matrix)}
  [ST.trunk,ST.can].forEach(function(m){m.castShadow=true;m.receiveShadow=false;g.add(m)});
  /* 雨傘（每人一把，雨天才出現；instanced） */var NU=Math.min(1300,CAP||1300);ST.NU=NU;var cgeo=new THREE.ConeGeometry(.95,.42,10,1,true);
  ST.um=new THREE.InstancedMesh(cgeo,new THREE.MeshLambertMaterial({color:0xffffff,side:THREE.DoubleSide}),NU);ST.pole=new THREE.InstancedMesh(new THREE.CylinderGeometry(.03,.03,1.3,4),new THREE.MeshLambertMaterial({color:0x333333}),NU);
  var UC=[0xe63946,0x1d4ed8,0xfacc15,0x10b981,0x7c3aed,0xf97316,0x0f172a,0xec4899],cc=new C3();for(i=0;i<NU;i++){cc.setHex(UC[i%UC.length]);ST.um.setColorAt(i,cc)}
  [ST.um,ST.pole].forEach(function(m){m.frustumCulled=false;m.castShadow=false;m.visible=false;m.count=0;g.add(m)});
  /* 降水粒子 */var mob=matchMedia('(max-width:700px)').matches;ST.NP=mob?2600:6000;var pv=new Float32Array(ST.NP*6);
  for(i=0;i<ST.NP;i++){var px=(Math.random()-.5)*160,py=Math.random()*70,pz=(Math.random()-.5)*160;pv.set([px,py,pz,px,py-1.4,pz],i*6)}
  var lg=new THREE.BufferGeometry();lg.setAttribute('position',new THREE.BufferAttribute(pv,3));ST.rain=new THREE.LineSegments(lg,new THREE.LineBasicMaterial({color:0xaec4dc,transparent:true,opacity:.55,depthWrite:false}));
  var sv=new Float32Array(ST.NP*3);for(i=0;i<ST.NP;i++)sv.set([(Math.random()-.5)*160,Math.random()*70,(Math.random()-.5)*160],i*3);var sgeo=new THREE.BufferGeometry();sgeo.setAttribute('position',new THREE.BufferAttribute(sv,3));
  ST.flake=new THREE.Points(sgeo,new THREE.PointsMaterial({color:0xffffff,size:mob?.32:.26,transparent:true,opacity:.9,depthWrite:false}));
  [ST.rain,ST.flake].forEach(function(m){m.frustumCulled=false;m.visible=false;g.add(m)});
  /* 節日裝飾群組 */ST.deco=new THREE.Group();g.add(ST.deco)}
 function treeColors(s,t){var c=new C3();for(var i=0;i<ST.nT;i++){var r=hash('tc'+i),hx;
   if(s==='spring')hx=(t.m<=4&&r<.35)?0xf6b8cf:(r<.45?0xe86a8a:0x8cc56a);
   else if(s==='summer')hx=(t.m===6&&r<.18)?0xe8552e:(r<.5?0x4f8f3a:0x3d7a34);
   else if(s==='autumn')hx=r<.25?0xd9a521:(r<.4?0xc0442b:(r<.6?0x8aa04a:0x5d8a3c));
   else hx=(t.m<=2&&r<.25)?0xf5f2ea:(r<.7?0xe9f0f2:0x5f7f66);
   c.setHex(hx).offsetHSL(0,0,(hash('tl'+i)-.5)*.08);ST.can.setColorAt(i,c)}ST.can.instanceColor.needsUpdate=true}
 var CLO='',WX=null,SEA='',FEST=null;
 function dress(){if(!CH||!CH.arm||!A.length)return;var tier=WX.temp>=27?'short':(WX.temp<=17||SEA==='winter'||SEA==='frozen')?'jacket':'normal';if(tier===CLO&&A.length===dress.n)return;CLO=tier;dress.n=A.length;
  colorChars();if(tier==='normal')return;var c=new THREE.Color();
  A.forEach(function(a,i){if(tier==='short'){c.setHex(SKIN[i%4]);CH.arm.setColorAt(2*i,c);CH.arm.setColorAt(2*i+1,c);c.setHex(0xe9d8a6);CH.hat.setColorAt(i,c);CH.pom.setColorAt(i,c)}
   else{c.setHex(DORMS[a.dorm].col).offsetHSL(0,-.15,-.2);CH.body.setColorAt(i,c);CH.arm.setColorAt(2*i,c);CH.arm.setColorAt(2*i+1,c)}});
  ['body','arm','hat','pom'].forEach(function(k){CH[k].instanceColor.needsUpdate=true})}
 function mkDeco(kind){var d=ST.deco;while(d.children.length)d.remove(d.children[0]);ST.fw=null;ST.lan=null;if(!kind&&!(FEST&&FEST.name))return;
  try{if(FEST&&FEST.name){var b=label(['🎉 '+FEST.name+(FEST.off?'（放假）':'')],520,72,FEST.deco==='cny'||FEST.deco==='lantern'?'rgba(185,28,28,.92)':'rgba(124,58,237,.9)');b.scale.set(26,3.6,1);b.position.set(0,22,0);d.add(b)}}catch(_){}
  var o=new THREE.Object3D(),i;
  if(kind==='cny'||kind==='lantern'){var n=48,L=new THREE.InstancedMesh(new THREE.SphereGeometry(.7,10,8),new THREE.MeshStandardMaterial({color:0xd62828,emissive:0xb91c1c,emissiveIntensity:.8}),n);
   for(i=0;i<n;i++){var a=i/n*Math.PI*2,r=22+(i%2)*4;o.position.set(Math.cos(a)*r,6+(i%3)*.6,Math.sin(a)*r);o.scale.set(1,1.15,1);o.updateMatrix();L.setMatrixAt(i,o.matrix)}d.add(L);ST.lan=L;
   if(kind==='lantern'){var n2=60,S=new THREE.InstancedMesh(new THREE.BoxGeometry(.8,1,.8),new THREE.MeshBasicMaterial({color:0xffb347}),n2);S.userData.sky=1;d.add(S);ST.sky=S;ST.skyp=[];for(i=0;i<n2;i++)ST.skyp.push([(Math.random()-.5)*120,Math.random()*80,(Math.random()-.5)*120])}}
  if(kind==='moon'){var cv=document.createElement('canvas');cv.width=cv.height=128;var x=cv.getContext('2d'),gg=x.createRadialGradient(64,64,30,64,64,64);gg.addColorStop(0,'#fff6c8');gg.addColorStop(.75,'#ffe58a');gg.addColorStop(1,'rgba(255,229,138,0)');x.fillStyle=gg;x.fillRect(0,0,128,128);
   var m=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(cv),fog:false,depthWrite:false}));m.scale.set(34*K,34*K,1);m.position.set(-30*K,60*K,-110*K);d.add(m);ST.moon=m}
  if(kind==='xmas'){var tr=new THREE.Mesh(new THREE.ConeGeometry(5,14,10),new THREE.MeshLambertMaterial({color:0x1f6f3a}));tr.position.set(0,7.5,0);d.add(tr);var st=new THREE.Mesh(new THREE.OctahedronGeometry(1.1),new THREE.MeshBasicMaterial({color:0xffd700}));st.position.set(0,15.3,0);d.add(st)}
  if(kind==='boat'){for(i=0;i<3;i++){var bt=new THREE.Mesh(new THREE.BoxGeometry(12,.8,1.6),new THREE.MeshLambertMaterial({color:[0xd62828,0x15803d,0x1d4ed8][i]}));bt.position.set(-8+i*8,.5,30+i*3);d.add(bt);var hd=new THREE.Mesh(new THREE.ConeGeometry(.7,2,6),new THREE.MeshLambertMaterial({color:0xfacc15}));hd.rotation.z=-Math.PI/2;hd.position.set(-8+i*8+6.5,1.2,30+i*3);d.add(hd)}}
  if(kind==='fire'){var NF=900,fv=new Float32Array(NF*3),fc=new Float32Array(NF*3),fg=new THREE.BufferGeometry();fg.setAttribute('position',new THREE.BufferAttribute(fv,3));fg.setAttribute('color',new THREE.BufferAttribute(fc,3));
   ST.fw=new THREE.Points(fg,new THREE.PointsMaterial({size:1.2,vertexColors:true,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,fog:false}));ST.fw.frustumCulled=false;ST.fwB=[];d.add(ST.fw)}}
 function applyEnv(){var t=today();SEA=seasonOf(t);FEST=festival(t);WX=weather(t,SEA);var sig=SEA+WX.kind+key(t)+(FEST.deco||'')+(FEST.name||'');
  if(sig!==cur){cur=sig;var gs=SEA==='frozen'?'winter':SEA;if(ST.gr)ST.gr.material.color.setHex(GROUND[SEA]);if(ST.yard)ST.yard.material.color.setHex(YARD[SEA]);
   treeColors(gs,t);(ST.snow||[]).forEach(function(o){o.visible=(gs==='winter')});ST.cap.visible=(gs==='winter');ST.mt.material.color.setHex(gs==='winter'?0x6b7f86:gs==='autumn'?0x6d7550:0x4f6e52);
   ST.rain.visible=WX.kind==='rain'||WX.kind==='typhoon';ST.flake.visible=WX.kind==='snow'||SEA==='frozen';ST.flake.material.color.setHex(0xffffff);
   mkDeco(FEST.deco);hud()}
  CLO=CLO;dress()}
 var GREY=null,DARK=null;
 var _dl=daylight;daylight=function(){_dl();if(!WX)return;var k=WX.kind==='typhoon'?.75:WX.kind==='rain'?.5:WX.kind==='snow'?.35:WX.kind==='cloudy'?.28:0;if(!k)return;var G=WX.kind==='typhoon'?DARK:GREY;
  sky.material.uniforms.top.value.lerp(G,k);sky.material.uniforms.bot.value.lerp(G,k*.8);scene.fog.color.lerp(G,k*.8);sun.intensity*=(1-k*.7);hemi.intensity*=(1-k*.25)};
 /* HUD */
 function hud(){var el=document.getElementById('ss1Hud');if(!el){el=document.createElement('div');el.id='ss1Hud';el.style.cssText='position:fixed;left:8px;bottom:calc(8px + env(safe-area-inset-bottom));z-index:30;max-width:calc(100vw - 16px);background:rgba(15,23,42,.82);color:#f1f5f9;font:12px -apple-system,"PingFang TC",sans-serif;border-radius:10px;padding:5px 9px;line-height:1.45;pointer-events:auto';document.body.appendChild(el);el.onclick=function(){el.classList.toggle('x');hud()}}
  var t=today(),W={clear:'☀️ 晴',cloudy:'☁️ 多雲',rain:'🌧️ 雨（撐傘）',snow:'🌨️ 下雪',typhoon:'🌀 颱風'}[WX.kind]||WX.kind;
  var src=WX.src==='cwa'?'中央氣象署實測':'模擬天氣（依日期推算）';if(FD||FS||FW)src='預覽模式';
  var s=SI[SEA]+' '+SN[SEA]+'・'+t.m+'/'+t.d+'・'+W+' '+WX.temp+'°C';
  if(WX.ty)s+='<br>🌀 '+(WX.ty.real?'颱風 '+WX.ty.zh+' '+WX.ty.en+'（中央氣象署警報）':'模擬颱風日・下一個輪替名：'+WX.ty.zh+' '+WX.ty.en);
  if(FEST.name)s+='<br>🎉 '+FEST.name+(FEST.off?'（國定放假）':'');if(!FEST.known)s+='<br>⚠️ 本年度節日表未更新';
  if(el.classList.contains('x'))s+='<br><span style="opacity:.75">來源：'+src+(SNAP&&SNAP.typhoons&&SNAP.typhoons.length?'｜西北太平洋現有颱風：'+SNAP.typhoons.map(function(y){return(tyZh(y.name_en)||'')+' '+y.name_en}).join('、')+'（RSMC 東京）':'')+'<br>節日：人事行政總處辦公日曆表｜關閉：設定 seasonsOff</span>';
  else s+=' <span style="opacity:.6">ⓘ</span>';el.innerHTML=s}
 /* 動畫 */
 var lastT=0;function tick(ts){requestAnimationFrame(tick);if(document.hidden||typeof scene==='undefined'||!scene||!cam)return;if(!built){if(!sky||!A)return;build();findSnow();applyEnv();_dl&&daylight()}
  var dt=Math.min(.05,(ts-lastT)/1000||0);lastT=ts;var cx=CAM.tx,cz=CAM.tz;
  if(ST.rain.visible){var p=ST.rain.geometry.attributes.position.array,sp=WX.kind==='typhoon'?60:34,wd=WX.kind==='typhoon'?18:2;ST.rain.position.set(cx,0,cz);for(var i=0;i<p.length;i+=6){p[i+1]-=sp*dt;p[i]+=wd*dt;if(p[i+1]<0){p[i+1]=70;p[i]=(Math.random()-.5)*160}p[i+3]=p[i]+wd*.04;p[i+4]=p[i+1]-1.4;p[i+5]=p[i+2]}ST.rain.geometry.attributes.position.needsUpdate=true}
  if(ST.flake.visible){var q=ST.flake.geometry.attributes.position.array;ST.flake.position.set(cx,0,cz);for(i=0;i<q.length;i+=3){q[i+1]-=3.2*dt;q[i]+=Math.sin(ts/900+i)*dt*.6;if(q[i+1]<0)q[i+1]=70}ST.flake.geometry.attributes.position.needsUpdate=true}
  var rainy=WX&&(WX.kind==='rain'||WX.kind==='typhoon');ST.um.visible=ST.pole.visible=rainy;
  if(rainy){var o=ST.o||(ST.o=new THREE.Object3D()),n=0;for(i=0;i<A.length&&n<ST.NU;i++){var a=A[i];if(a.dead||!a.posed)continue;var tl=WX.kind==='typhoon'?.35*Math.sin(ts/300+i):0;
    o.position.set(a.x+.25,3.55,a.z);o.rotation.set(tl,0,0);o.scale.set(1,1,1);o.updateMatrix();ST.um.setMatrixAt(n,o.matrix);o.position.y=2.85;o.updateMatrix();ST.pole.setMatrixAt(n,o.matrix);n++}
   ST.um.count=ST.pole.count=n;ST.um.instanceMatrix.needsUpdate=ST.pole.instanceMatrix.needsUpdate=true}
  if(ST.can&&WX&&WX.kind==='typhoon')ST.can.rotation.z=Math.sin(ts/400)*.012;
  if(ST.sky){var on=TPd>.4;ST.sky.visible=on;if(on){var o2=ST.o2||(ST.o2=new THREE.Object3D());for(i=0;i<ST.skyp.length;i++){var s2=ST.skyp[i];s2[1]+=dt*2;if(s2[1]>90)s2[1]=5;o2.position.set(s2[0],s2[1],s2[2]);o2.updateMatrix();ST.sky.setMatrixAt(i,o2.matrix)}ST.sky.instanceMatrix.needsUpdate=true}}
  if(ST.fw){var night=TPd>.5||P.get('fw')==='1';ST.fw.visible=night;if(night){if(!ST.fwB.length||Math.random()<dt*1.2)ST.fwB.push({x:(Math.random()-.5)*80,y:40+Math.random()*25,z:-30-Math.random()*40,t:0,c:new C3().setHSL(Math.random(),1,.6),s:ST.fwB.length*90%900});
    var fv=ST.fw.geometry.attributes.position.array,fc=ST.fw.geometry.attributes.color.array;ST.fwB=ST.fwB.filter(function(b){return b.t<2.2});ST.fwB.slice(-10).forEach(function(b,bi){b.t+=dt;for(var j=0;j<90;j++){var idx=((bi*90)+j)*3,an=j*2.39,el=Math.acos(1-2*((j+.5)/90)),r=b.t*14;fv[idx]=b.x+Math.sin(el)*Math.cos(an)*r;fv[idx+1]=b.y+Math.cos(el)*r-b.t*b.t*3;fv[idx+2]=b.z+Math.sin(el)*Math.sin(an)*r;var f=Math.max(0,1-b.t/2.2);fc[idx]=b.c.r*f;fc[idx+1]=b.c.g*f;fc[idx+2]=b.c.b*f}});
    ST.fw.geometry.attributes.position.needsUpdate=ST.fw.geometry.attributes.color.needsUpdate=true}}}
 requestAnimationFrame(tick);
 /* 真實天氣快照（排程寫入；讀不到就用模擬） */
 async function snap(){try{var r=await fetch(C.url+'/rest/v1/aivault_town_weather?select=data,updated_at&id=eq.1',{headers:{apikey:C.anon,Authorization:'Bearer '+C.anon},cache:'no-store'});if(r.ok){var j=await r.json();if(j[0]){if(j[0].data&&j[0].data.off===true){var g=ST.g;if(g)g.visible=false;return}SNAP=j[0].data;SNAPT=Date.parse(j[0].updated_at)}}}catch(_){}
  if(!SNAP||!(SNAP.typhoons)){try{var t1=await fetch('https://www.jma.go.jp/bosai/typhoon/data/targetTc.json',{cache:'no-store'});if(t1.ok){var L=await t1.json(),ty=[];for(var i=0;i<L.length&&i<4;i++){var s=await (await fetch('https://www.jma.go.jp/bosai/typhoon/data/'+L[i].tropicalCyclone+'/specifications.json')).json();var nm=s[0]&&s[0].name&&s[0].name.en;if(nm)ty.push({name_en:nm,num:L[i].typhoonNumber})}
   SNAP=SNAP||{};SNAP.typhoons=ty;if(ty.length){ty.sort(function(a,b){return(+b.num||0)-(+a.num||0)});SNAP.latest_name_en=ty[0].name_en}}}catch(_){}}
  if(built){cur='';applyEnv()}}
 snap();setInterval(snap,30*60e3);setInterval(function(){if(built)applyEnv()},60e3);
 window.__ssScene=null;window.__seasons={state:function(){return{season:SEA,wx:WX,fest:FEST,clothes:CLO,snapAgeMin:SNAPT?Math.round((Date.now()-SNAPT)/6e4):null}}};
})();
