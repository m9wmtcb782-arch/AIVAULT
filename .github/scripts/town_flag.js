/* ===== fg1：軍營旗幟改成紅底暗星圖標旗（只換軍營那面 3.4×2 紫旗；城門小旗不動）=====
   紅底＋暗星圖標（白色四芒星、青色核心、青色斷環；向量重繪自 assets/darkstar/darkstar-emblem-source.jpg，去掉深藍底）。
   正反兩面都正向可讀，輕微飄動，微自發光（夜晚也看得到）。關閉：網址 ?flag=0 或 localStorage.townFlagOff='1'；不注入：TOWN_FLAG_OFF=1 */
(function(){try{if(/[?&]flag=0/.test(location.search)||localStorage.getItem('townFlagOff')==='1')return}catch(_){return}
 function tex(){var W=512,H=Math.round(512/1.7),c=document.createElement('canvas');c.width=W;c.height=H;var x=c.getContext('2d');
  var g=x.createLinearGradient(0,0,0,H);g.addColorStop(0,'#e11d2a');g.addColorStop(1,'#b3121d');x.fillStyle=g;x.fillRect(0,0,W,H);
  x.strokeStyle='rgba(255,215,120,.85)';x.lineWidth=8;x.strokeRect(10,10,W-20,H-20);
  var S=Math.round(H*.86),L=(typeof darkLogo==='function')?darkLogo(S):null;if(L)x.drawImage(L,(W-S)/2,(H-S)/2);
  var t=new THREE.CanvasTexture(c);if(THREE.SRGBColorSpace)t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return t}
 function apply(){var hit=null;scene.traverse(function(o){var p=o.geometry&&o.geometry.parameters;if(!hit&&o.isMesh&&o.geometry.type==='PlaneGeometry'&&p&&p.width===3.4&&p.height===2&&o.material&&o.material.color&&o.material.color.getHex()===0x7c3aed)hit=o});
  if(!hit)return false;var T=tex(),TB=T.clone();TB.wrapS=THREE.RepeatWrapping;TB.repeat.x=-1;TB.offset.x=1;TB.needsUpdate=true;
  var geo=new THREE.PlaneGeometry(3.4,2,16,6),pos=geo.attributes.position,X0=new Float32Array(pos.count);for(var i=0;i<pos.count;i++)X0[i]=pos.getX(i);
  var F=new THREE.Mesh(geo,new THREE.MeshLambertMaterial({map:T,emissive:0xffffff,emissiveMap:T,emissiveIntensity:.35,side:THREE.FrontSide})),B=new THREE.Mesh(geo,new THREE.MeshLambertMaterial({map:TB,emissive:0xffffff,emissiveMap:TB,emissiveIntensity:.35,side:THREE.BackSide}));
  var G=new THREE.Group();G.position.copy(hit.position);G.rotation.copy(hit.rotation);G.add(F);G.add(B);F.castShadow=B.castShadow=true;
  hit.visible=false;hit.parent.add(G);var wp=new THREE.Vector3();G.updateWorldMatrix(true,false);G.getWorldPosition(wp);window.__townFlag={group:G,old:hit,pos:[wp.x,wp.y,wp.z],off:function(){G.visible=false;hit.visible=true}};
  (function wave(){var t=performance.now()/1000;for(var i=0;i<pos.count;i++){var u=(X0[i]+1.7)/3.4;pos.setZ(i,Math.sin(u*5.5-t*3.2)*.16*u)}pos.needsUpdate=true;geo.computeVertexNormals();requestAnimationFrame(wave)})();return true}
 var n=0;(function tryit(){try{if(typeof scene!=='undefined'&&apply())return}catch(e){console.warn('fg1',e);return}if(++n<40)setTimeout(tryit,500)})();
})();
