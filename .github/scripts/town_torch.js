/* ===== tc1：夜晚火把（只在台北夜晚；白天完全隱藏）=====
   不調亮環境光：光只來自火把。最近 10 人用真的 PointLight，其他人用加色光暈＋地面光斑（假光）。關閉：localStorage.torchOff='1' */
(function(){try{if(localStorage.getItem('torchOff')==='1')return}catch(_){return}
 var on=false,G=null,ST,FL,HA,GD,LT=[],N=1300,dm=new THREE_DUMMY();function THREE_DUMMY(){}
 function tex(){var c=document.createElement('canvas');c.width=c.height=64;var x=c.getContext('2d'),g=x.createRadialGradient(32,32,0,32,32,32);g.addColorStop(0,'rgba(255,190,110,1)');g.addColorStop(.35,'rgba(255,130,40,.45)');g.addColorStop(1,'rgba(255,90,10,0)');x.fillStyle=g;x.fillRect(0,0,64,64);var t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t}
 function build(){G=new THREE.Group();var T=tex(),O=new THREE.Object3D();dm=O;
  ST=new THREE.InstancedMesh(new THREE.CylinderGeometry(.035,.045,.7,6),new THREE.MeshLambertMaterial({color:0x5b3a1e}),N);
  FL=new THREE.InstancedMesh(new THREE.ConeGeometry(.09,.28,8),new THREE.MeshBasicMaterial({color:0xffb347}),N);
  var add={map:T,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending};
  HA=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial(Object.assign({opacity:.55},add)),N);
  var gp=new THREE.PlaneGeometry(1,1);gp.rotateX(-Math.PI/2);GD=new THREE.InstancedMesh(gp,new THREE.MeshBasicMaterial(Object.assign({opacity:.28},add)),N);
  [ST,FL,HA,GD].forEach(function(m){m.frustumCulled=false;m.castShadow=false;m.receiveShadow=false;G.add(m)});
  for(var i=0;i<10;i++){var l=new THREE.PointLight(0xff9a3c,0,7,2);l.castShadow=false;LT.push(l);G.add(l)}
  G.visible=false;scene.add(G)}
 function list(){var P=[];for(var i=0;i<A.length;i++){var a=A[i];if(a.dead||!a.posed)continue;P.push([a.x,a.z,a.yaw||0,1.35])}
  Object.keys(HUM||{}).forEach(function(k){var h=HUM[k];if(h.g.visible)P.push([h.x,h.z,h.g.rotation.y,h.g.scale.x])});return P}
 var t=0;function tick(){requestAnimationFrame(tick);if(document.hidden||typeof scene==='undefined'||!scene||!cam)return;if(!G)build();
  var night=TPd>.5;if(night!==on){on=night;G.visible=on;if(!on)LT.forEach(function(l){l.intensity=0})}if(!on)return;t+=.016;
  var P=list(),n=Math.min(N,P.length),q=cam.quaternion,cx=CAM.tx,cz=CAM.tz;
  for(var i=0;i<n;i++){var p=P[i],s=p[3]/1.35,c=Math.cos(p[2]),sn=Math.sin(p[2]),ox=.42*s,oz=.25*s,x=p[0]+ox*c+oz*sn,z=p[1]-ox*sn+oz*c,y=1.75*s,f=1+Math.sin(t*14+i*1.7)*.12+Math.sin(t*23+i)*.06;
   dm.quaternion.set(0,0,0,1);dm.position.set(x,y,z);dm.scale.set(s,s,s);dm.updateMatrix();ST.setMatrixAt(i,dm.matrix);
   dm.position.y=y+.45*s;dm.scale.set(s,s*f,s);dm.updateMatrix();FL.setMatrixAt(i,dm.matrix);
   dm.quaternion.copy(q);dm.scale.setScalar(1.1*s*f);dm.updateMatrix();HA.setMatrixAt(i,dm.matrix);
   dm.quaternion.set(0,0,0,1);dm.position.set(x,.06,z);dm.scale.setScalar(3.6*s*(.95+.05*f));dm.updateMatrix();GD.setMatrixAt(i,dm.matrix)}
  [ST,FL,HA,GD].forEach(function(m){m.count=n;m.instanceMatrix.needsUpdate=true});
  var idx=[];for(var j=0;j<n;j++)idx.push(j);idx.sort(function(a,b){var A1=P[a],B1=P[b];return(A1[0]-cx)*(A1[0]-cx)+(A1[1]-cz)*(A1[1]-cz)-((B1[0]-cx)*(B1[0]-cx)+(B1[1]-cz)*(B1[1]-cz))});
  LT.forEach(function(l,k){var ii=idx[k];if(ii==null){l.intensity=0;return}var p=P[ii],s=p[3]/1.35;l.position.set(p[0]+.42*s*Math.cos(p[2]),2.4*s,p[1]-.42*s*Math.sin(p[2]));l.intensity=(2.2+Math.sin(t*13+k)*.35+Math.sin(t*29+k*2)*.2)*s})}
 window.__torch={on:function(){return on},n:function(){return HA?HA.count:0}};
 setTimeout(tick,1500)})();
