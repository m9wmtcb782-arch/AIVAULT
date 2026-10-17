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
 humanSync=function(list){var own=false,out=[];(list||[]).forEach(function(u){if(/^👑/.test(u.display_name||'')){own=true;return}var sd=u.seed||0;out.push(Object.assign({},u,{avatar:gOf(u)+':'+(sd%8)}))});
  if(own&&typeof ownerOut==='function'&&OWN&&!OWN.online)ownerOut(true);
  HS0(out);Object.keys(HUM).forEach(function(k){var g=HUM[k].g;if(!g.userData.ts1){g.scale.setScalar(1.85);g.userData.ts1=1}});
  window.__onlineRows=list||[];if($('cHum'))$('cHum').textContent='🟢 在線 '+(list||[]).length;if($('olL'))olRender()};
 /* 3) 在線名單：點「🟢 在線」看現在誰在線（2 分鐘內有心跳），每 8 秒更新 */
 var WN={};function where(w){if(!w)return'🏰 協作城／首頁逛街';try{var i=wsBySlug(w);if(i>=0&&WS[i])return(WS[i].ic||'🏠')+' '+WS[i].n}catch(_){}return'🏠 '+w}
 function olRender(){var L=window.__onlineRows||[];$('olL').innerHTML=L.map(function(u){var s=Math.max(0,Math.round((Date.now()-Date.parse(u.last_seen))/1000));return'<div class="msg"><span class="n">'+(/^👑/.test(u.display_name)?'':(gOf(u)==='woman'?'👩 ':'👨 '))+esc(u.display_name)+'</span><span class="t">'+s+' 秒前</span><div class="muted">'+esc(where(u.workshop))+'</div></div>'}).join('')||'<p class="muted">目前沒有人在線（只算 2 分鐘內有心跳的登入帳號）。</p>'}
 function showOnline(){open('<h3>🟢 現在在線</h3><p class="muted">真實資料：2 分鐘內有心跳的登入帳號，每 8 秒更新。只顯示暱稱，不顯示 email。</p><div id="olL"><p class="muted">載入中…</p></div><p><button class="btn" id="olC">💬 去世界頻道聊天</button></p>');$('olC').onclick=showChat;olRender();sideData()}
 /* 首次進城問男女 */
 async function askGender(){if(MOCK?Q0.get('ask')!=='1':(!AUTHED||OWNER))return;var cur='';try{if(!MOCK){var id=sub();var r=id?await rget('aivault_presence?select=avatar&user_id=eq.'+id):[];cur=(r[0]||{}).avatar||''}}catch(_){}
  if(/^(man|woman):/.test(cur)||localStorage.getItem('townGender'))return;
  open('<h3>👋 歡迎進入協作城</h3><p>請選擇你的人物性別，系統會依你的帳號產生專屬外型（髮型、服裝顏色、道具都不同），身高和擁有者一樣。</p><p><button class="btn ok" data-g="man" style="font-size:18px">👨 男</button> <button class="btn ok" data-g="woman" style="font-size:18px">👩 女</button></p><p class="muted" id="gE"></p>');
  sh.querySelectorAll('[data-g]').forEach(function(b){b.onclick=async function(){var g=b.dataset.g;$('gE').textContent='儲存中…';var ok=MOCK?true:await beat(g+':0');if(!ok){$('gE').textContent='儲存失敗，請稍後再試（帳號可能尚未核准）';return}localStorage.setItem('townGender',g);$('gE').textContent='已儲存';sideData();setTimeout(function(){sh.classList.remove('on')},600)}})}
 function start(){if(!$('cHum')||typeof scene==='undefined'||!scene){setTimeout(start,800);return}
  $('cHum').style.cursor='pointer';$('cHum').onclick=showOnline;
  beat().then(function(){sideData()});setInterval(function(){beat()},25000);setInterval(function(){if(!document.hidden)sideData()},8000);setTimeout(askGender,1500)}
 window.__ts1={hum:function(){return Object.values(HUM).map(function(h){return{av:h.av,s:h.g.scale.x,x:h.x,z:h.z}})},look:function(i){var h=Object.values(HUM)[i];CAM.tx=h.x;CAM.tz=h.z;CAM.r=16;camApply()},close:function(){sh.classList.remove('on')}};
 setTimeout(start,1000)})();
