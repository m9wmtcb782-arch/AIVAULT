/* ===== ts1：真人社交層（真人互看、男女外型、即時在線名單、世界頻道快速更新）=====
   關閉：localStorage.townSocialOff='1'（回到原本行為）。只用真實 aivault_presence / aivault_world_chat 資料列；?mock=1 才用假資料。 */
(function(){try{if(localStorage.getItem('townSocialOff')==='1')return}catch(_){return}
 window.__townSocial=1;
 function sub(){try{var s=sess();return JSON.parse(atob(s.access_token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).sub||''}catch(_){return''}}
 /* 1) 根因修正：協作城頁面本身沒有送心跳，待在城裡 2 分鐘後就從名單消失。這裡在城內每 25 秒送一次 */
 async function beat(av){if(MOCK||!AUTHED||document.hidden&&!av)return;try{var t=await token();if(!t)return;var b={workshop:''};if(av)b.avatar=av;var r=await fetch(C.url+'/rest/v1/aivault_presence?on_conflict=user_id',{method:'POST',headers:{apikey:C.anon,Authorization:'Bearer '+t,'Content-Type':'application/json',Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(b)});return r.ok}catch(_){return false}}
 /* 2) 外型：只分男女，細節（髮色、外套色、帽子、道具、膚色、鬍子）依帳號種子決定；不用擁有者的戰甲／全息造型 */
 function gOf(u){var a=String(u.avatar||'');if(/^woman:/.test(a))return'woman';if(/^man:/.test(a))return'man';var sd=u.seed||0;if(/^(elder|child):/.test(a))return(sd>>3)%2?'woman':'man';return sd%2?'woman':'man'}
 var HS0=humanSync;
 var SELF=null;try{if(!MOCK)SELF=JSON.parse(localStorage.getItem('townSelf')||'null')}catch(_){}
 humanSync=function(list){list=(list||[]).slice();if(SELF&&AUTHED&&!OWNER&&!list.some(function(u){return u.display_name===SELF.display_name&&u.seed===SELF.seed}))list.unshift(Object.assign({},SELF,{last_seen:new Date().toISOString()}));var own=false,out=[];(list||[]).forEach(function(u){if(/^👑/.test(u.display_name||'')){own=true;return}var sd=u.seed||0;out.push(Object.assign({},u,{avatar:gOf(u)+':'+(sd%8)}))});
  if(own&&typeof ownerOut==='function'&&OWN&&!OWN.online)ownerOut(true);
  HS0(out);Object.keys(HUM).forEach(function(k){var g=HUM[k].g;if(!g.userData.ts1){g.scale.setScalar(1.85);g.userData.ts1=1}});
  markSelf();
  window.__onlineRows=list||[];if($('cHum'))$('cHum').textContent='🟢 在線 '+(list||[]).length;if($('olL'))olRender()};
 /* ts2：自己一定看得到——從自己的 presence 列（user_id=本人）取得暱稱／種子，先在本機畫出來，再加金色光柱＋「📍 我」標記；📍我 按鈕把鏡頭移到自己 */
 function selfKey(){return SELF?SELF.display_name+'|'+SELF.seed:''}
 function markSelf(){var h=HUM[selfKey()];if(!h||h.g.userData.me)return;h.g.userData.me=1;try{var m=label(['📍 我'],160,56,'rgba(234,179,8,.95)');m.scale.set(1.1,.38,1);m.position.set(0,4.4,0);h.g.add(m);var bm=new THREE.Mesh(new THREE.CylinderGeometry(.35,.35,30,12,1,true),new THREE.MeshBasicMaterial({color:0xfacc15,transparent:true,opacity:.18,depthWrite:false,side:THREE.DoubleSide}));bm.position.y=15;h.g.add(bm);var rg=new THREE.Mesh(new THREE.RingGeometry(.7,.95,32),new THREE.MeshBasicMaterial({color:0xfacc15,transparent:true,opacity:.7,side:THREE.DoubleSide}));rg.rotation.x=-Math.PI/2;rg.position.y=.05;h.g.add(rg)}catch(_){}}
 function goSelf(){var h=HUM[selfKey()];if(!h){if($('cMeGo'))$('cMeGo').textContent='📍 我（載入中）';loadSelf();return}CAM.tx=h.x;CAM.tz=h.z;CAM.r=22;camApply();FOLLOW=performance.now()+8000}
 var FOLLOW=0;function follow(){requestAnimationFrame(follow);if(performance.now()<FOLLOW){var h=HUM[selfKey()];if(h){CAM.tx+=(h.x-CAM.tx)*.15;CAM.tz+=(h.z-CAM.tz)*.15;camApply()}}}
 async function loadSelf(){if(MOCK){if(Q0.get('as')==='member'&&!SELF){SELF={display_name:'（測試）我',seed:777,workshop:'',avatar:(localStorage.getItem('townGender')||'man')+':0'}}}else{var id=sub();if(!id)return;try{var r=await rget('aivault_presence?select=display_name,seed,workshop,avatar,last_seen&user_id=eq.'+id);if(!r.length){await beat();r=await rget('aivault_presence?select=display_name,seed,workshop,avatar,last_seen&user_id=eq.'+id)}if(r.length){SELF=r[0];localStorage.setItem('townSelf',JSON.stringify(SELF))}else if($('cMeGo'))$('cMeGo').textContent='📍 我（帳號尚未核准？）'}catch(e){}}
  if(SELF&&$('cMeGo'))$('cMeGo').textContent='📍 我';sideData()}
 /* 3) 在線名單：點「🟢 在線」看現在誰在線（2 分鐘內有心跳），每 8 秒更新 */
 var WN={};function where(w){if(!w)return'🏰 協作城／首頁逛街';try{var i=wsBySlug(w);if(i>=0&&WS[i])return(WS[i].ic||'🏠')+' '+WS[i].n}catch(_){}return'🏠 '+w}
 function olRender(){var L=window.__onlineRows||[];$('olL').innerHTML=L.map(function(u){var s=Math.max(0,Math.round((Date.now()-Date.parse(u.last_seen))/1000));return'<div class="msg"><span class="n">'+(/^👑/.test(u.display_name)?'':(gOf(u)==='woman'?'👩 ':'👨 '))+esc(u.display_name)+'</span><span class="t">'+s+' 秒前</span><div class="muted">'+esc(where(u.workshop))+'</div></div>'}).join('')||'<p class="muted">目前沒有人在線（只算 2 分鐘內有心跳的登入帳號）。</p>'}
 function showOnline(){open('<h3>🟢 現在在線</h3><p class="muted">真實資料：2 分鐘內有心跳的登入帳號，每 8 秒更新。只顯示暱稱，不顯示 email。</p><div id="olL"><p class="muted">載入中…</p></div><p><button class="btn" id="olC">💬 去世界頻道聊天</button></p>');$('olC').onclick=showChat;olRender();sideData()}
 /* 首次進城：問男女＋自選暱稱（ts3）。暱稱存在帳號 user_metadata.name，資料庫觸發器再驗證一次；名牌、在線名單、世界頻道都用它 */
 var BAD=/(擁有者|owner|admin|管理員|官方|暗星|dark ?star|aivault|grok|👑|系統|客服)/i,PROF=/(幹|操你|肏|靠北|靠杯|雞掰|機掰|雞巴|屌|婊|賤|妓|三小|白癡|白痴|智障|去死|fuck|shit|bitch|cunt|dick|nigg|asshole|傻逼|傻b|他媽|你媽|尼瑪)/i;
 function checkName(n){n=String(n||'').replace(/[\u0000-\u001F<>]/g,'').trim();if(!n)return[null,'請輸入暱稱'];if(Array.from(n).length>12)return[null,'最多 12 個字'];if(BAD.test(n))return[null,'不能使用擁有者／暗星／官方等名稱'];if(PROF.test(n))return[null,'暱稱含不雅字詞'];return[n,'']}
 async function saveName(n){var t=await token();var r=await fetch(C.url+'/auth/v1/user',{method:'PUT',headers:{apikey:C.anon,Authorization:'Bearer '+t,'Content-Type':'application/json'},body:JSON.stringify({data:{name:n}})});if(!r.ok)throw new Error('暱稱儲存失敗 HTTP '+r.status);
  var s=sess(),rr=await fetch(C.url+'/auth/v1/token?grant_type=refresh_token',{method:'POST',headers:{apikey:C.anon,'Content-Type':'application/json'},body:JSON.stringify({refresh_token:s.refresh_token})});if(rr.ok){var ns=await rr.json();var raw=JSON.parse(localStorage.getItem(KEY)||'null');if(raw&&raw.currentSession)raw.currentSession=Object.assign(raw.currentSession,ns);else raw=Object.assign(raw||{},ns);localStorage.setItem(KEY,JSON.stringify(raw))}}
 function curName(){var n=SELF&&SELF.display_name||'';return/^會員 /.test(n)?'':n}
 function nameForm(){return'<p><label>你的暱稱（1–12 字，會顯示在人物頭上、在線名單和世界頻道）<br><input id="nmI" maxlength="12" value="'+esc(curName())+'" placeholder="例如：小明" style="width:100%;font-size:17px;padding:8px;border-radius:10px;border:1px solid #334155;background:#0a0f17;color:#fff;box-sizing:border-box"></label></p>'}
 async function doSave(g,el){var c=checkName($('nmI').value);if(!c[0]){el.textContent=c[1];return false}el.textContent='儲存中…';try{if(!MOCK){if(c[0]!==curName())await saveName(c[0]);var ok=await beat(g?g+':0':'');if(!ok)throw new Error('儲存失敗，請稍後再試（帳號可能尚未核准）')}else if(SELF){SELF.display_name=c[0];if(g)SELF.avatar=g+':0'}
   if(g){localStorage.setItem('townGender',g)}localStorage.removeItem('townSelf');await loadSelf();el.textContent='已儲存：'+c[0];return true}catch(e){el.textContent=e.message;return false}}
 async function askGender(){if(MOCK?Q0.get('ask')!=='1':(!AUTHED||OWNER))return;var cur=SELF&&SELF.avatar||'';
  if(/^(man|woman):/.test(cur)&&curName()&&localStorage.getItem('townGender'))return;if(!MOCK&&/^(man|woman):/.test(cur)&&curName())return;
  var g=(cur.split(':')[0]==='woman')?'woman':(/^man:/.test(cur)?'man':'');
  open('<h3>👋 歡迎進入協作城</h3><p>請選擇人物性別並取一個暱稱，系統會依你的帳號產生專屬外型（髮型、服裝顏色、道具都不同），身高和擁有者一樣。</p><p><button class="btn" data-g="man" style="font-size:18px">👨 男</button> <button class="btn" data-g="woman" style="font-size:18px">👩 女</button> <span id="gS" class="muted"></span></p>'+nameForm()+'<p><button class="btn ok" id="gOK">✅ 進城</button></p><p class="muted" id="gE"></p>');
  function mark(){$('gS').textContent=g?('已選：'+(g==='man'?'男':'女')):'尚未選擇'}mark();
  sh.querySelectorAll('[data-g]').forEach(function(b){b.onclick=function(){g=b.dataset.g;mark()}});
  $('gOK').onclick=async function(){if(!g){$('gE').textContent='請先選男或女';return}if(await doSave(g,$('gE')))setTimeout(function(){sh.classList.remove('on')},700)}}
 /* 之後可在「🧑 我的人物」修改暱稱 */
 var SM0=showMe;showMe=function(){SM0();if(!AUTHED||OWNER)return;var d=document.createElement('div');d.innerHTML='<hr style="border-color:#1f2937"><h3>✏️ 暱稱</h3>'+nameForm()+'<p><button class="btn ok" id="nmS">儲存暱稱</button> <span class="muted" id="nmE"></span></p>';sh.appendChild(d);$('nmS').onclick=function(){doSave('',$('nmE'))}};
 function start(){if(!$('cHum')||typeof scene==='undefined'||!scene){setTimeout(start,800);return}
  $('cHum').style.cursor='pointer';$('cHum').onclick=showOnline;
  if(AUTHED&&!OWNER){var b=document.createElement('span');b.className='chip';b.id='cMeGo';b.textContent='📍 我';b.style.cursor='pointer';b.style.background='rgba(250,204,21,.9)';b.style.color='#111';b.onclick=goSelf;$('cHum').parentNode.insertBefore(b,$('cHum'));loadSelf().then(function(){setTimeout(goSelf,1500);askGender()});follow()}
  beat().then(function(){sideData()});setInterval(function(){beat()},25000);setInterval(function(){if(!document.hidden)sideData()},8000);}
 window.__ts1={hum:function(){return Object.values(HUM).map(function(h){return{av:h.av,s:h.g.scale.x,x:h.x,z:h.z}})},look:function(i){var h=Object.values(HUM)[i];CAM.tx=h.x;CAM.tz=h.z;CAM.r=16;camApply()},close:function(){sh.classList.remove('on')}};
 setTimeout(start,1000)})();
