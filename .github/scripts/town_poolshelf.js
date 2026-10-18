/* ===== pb7：協作池書架（電腦教室旁＋圖書館若存在）＝點書架打開電子書 App 的 🤝 協作池書架 =====
   書架只是入口；書目與讀者數都在電子書 App 顯示真資料。關閉：localStorage.poolShelfOff3d='1'。 */
(function(){try{if(localStorage.getItem('poolShelfOff3d')==='1')return}catch(_){return}
 var URL1='dark-star-ebook.html?view=pool',HITS=[];
 function shelfAt(x,z,ry,name){var g=new THREE.Group(),wood=new THREE.MeshStandardMaterial({color:0x7c4a21,roughness:.8});
  var back=new THREE.Mesh(new THREE.BoxGeometry(3.2,2.6,.25),wood);back.position.y=1.3;g.add(back);
  var cols=[0x2563eb,0xdc2626,0x16a34a,0xf59e0b,0x7c3aed,0x0891b2];
  for(var r=0;r<3;r++){var pl=new THREE.Mesh(new THREE.BoxGeometry(3.2,.08,.6),wood);pl.position.set(0,.35+r*.8,.2);g.add(pl);
   for(var i=0;i<9;i++){var bk=new THREE.Mesh(new THREE.BoxGeometry(.24,.55+((i*7+r)%3)*.06,.42),new THREE.MeshStandardMaterial({color:cols[(i+r)%6]}));bk.position.set(-1.35+i*.33,.68+r*.8,.22);g.add(bk)}}
  try{var s=label(['📚 '+name,'點我打開'],360,92,'rgba(30,58,138,.95)');s.scale.set(4.2,1.08,1);s.position.set(0,3.4,0);try{s.material.depthTest=false;s.renderOrder=998}catch(_){}g.add(s)}catch(_){}
  g.position.set(x,0,z);g.rotation.y=ry||0;scene.add(g);HITS.push(g);return g}
 try{var cx=70+40*1.2/2,cz=-46+25*.96+3.2;shelfAt(cx-8,cz,Math.PI,'協作池書架（教室）')}catch(_){}
 try{var A=(typeof AREAS!=='undefined')?AREAS:{};Object.keys(A).forEach(function(k){if(/lib|book|read|書/.test(k)&&A[k]&&A[k].c){shelfAt(A[k].c[0]+3,A[k].c[1]+3,0,'協作池書架（圖書館）')}})}catch(_){}
 function open(){location.href=URL1+(/[?&]mock=1/.test(location.search)?'&mock=1':'')}
 try{var cv=(typeof renderer!=='undefined'&&renderer.domElement)||document.querySelector('canvas');var rc=new THREE.Raycaster(),v=new THREE.Vector2(),t0=0,p0=null;
  cv.addEventListener('pointerdown',function(e){t0=performance.now();p0=[e.clientX,e.clientY]});
  cv.addEventListener('pointerup',function(e){if(!p0||performance.now()-t0>400||Math.abs(e.clientX-p0[0])+Math.abs(e.clientY-p0[1])>10)return;if(typeof camera==='undefined')return;var r=cv.getBoundingClientRect();v.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);rc.setFromCamera(v,camera);if(rc.intersectObjects(HITS,true).length)open()})}catch(_){}
 try{var b=document.createElement('a');b.href=URL1;b.textContent='📚 協作池書架';b.style.cssText='position:fixed;right:10px;bottom:calc(120px + env(safe-area-inset-bottom));z-index:50;background:#1e3a8a;color:#fff;padding:8px 12px;border-radius:18px;font-size:14px;text-decoration:none;box-shadow:0 2px 6px #0005';document.body.appendChild(b)}catch(_){}
})();
