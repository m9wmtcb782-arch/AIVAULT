/* ===== rv1：🟡 待審 批次審核（只限擁有者）=====
   全選（預設全勾）＋逐筆勾選；✅ 核准已勾選／❌ 退回已勾選，逐筆呼叫原本的 floor/review（和單筆審核同一條路）。點一列展開全文。關閉：localStorage.reviewBulkOff='1' */
(function(){try{if(localStorage.getItem('reviewBulkOff')==='1')return}catch(_){return}
 var SR0=showReviews;
 function typ(t){var nv=t.plan&&!Array.isArray(t.plan)&&t.plan.novel;if(t.kind==='spawn')return'🧬 分身申請';if(nv&&nv.stage==='outline')return'📖 小說大綱';if(nv&&nv.stage==='chapter')return'📖 小說章節';if(/衛教/.test(t.order_text||''))return'🩺 衛教文章';if(/學習|learn/i.test(t.order_text||''))return'📚 學習';return'🛠️ 作品'}
 function one(s,n){s=String(s||'').replace(/\s+/g,' ').trim();return s.length>n?s.slice(0,n)+'…':s}
 showReviews=async function(){if(!OWNER)return SR0();
  open('<h3>🟡 審核佇列</h3><p class="muted">載入中…</p>');var d;try{d=await api('floor','reviews',{limit:300})}catch(e){sh.innerHTML+='<p class="muted">'+esc(e.message)+'</p>';return}
  var L=d.tasks||[],cnt={};L.forEach(function(t){var k=typ(t);cnt[k]=(cnt[k]||0)+1});
  open('<h3>🟡 審核佇列（'+L.length+'）</h3><p class="muted">'+Object.keys(cnt).map(function(k){return esc(k)+' '+cnt[k]}).join('　')+'</p>'+
   '<p style="position:sticky;top:0;background:#0b1018;padding:6px 0;z-index:2"><label style="font-size:15px"><input type="checkbox" id="rvAll" checked> 全選</label> <span class="muted" id="rvN"></span><br><button class="btn ok" id="rvOk">✅ 核准已勾選</button> <button class="btn" id="rvNo" style="background:#7f1d1d">❌ 退回已勾選</button> <span class="muted" id="rvE"></span></p>'+
   '<div id="rvL">'+(L.map(function(t,i){return'<div class="card" data-i="'+i+'" style="margin:6px 0"><label style="display:flex;gap:8px;align-items:flex-start"><input type="checkbox" class="rvC" data-id="'+esc(t.id)+'" checked style="margin-top:4px"><span style="flex:1"><b>'+esc(typ(t))+'</b> · '+esc(t.agent_name||t.agent_id)+' <span class="muted">'+esc(t.zone_label||t.zone||'')+' · '+esc(tp(t.updated_at))+'</span><br>'+esc(one(t.order_text,60))+'<div class="muted rvS">'+esc(one(t.result,80))+'</div></span></label><div class="rvF" style="display:none;white-space:pre-wrap;font-size:14px;line-height:1.5;margin-top:6px;border-top:1px solid #1f2937;padding-top:6px">'+esc(t.result||'（沒有內容）')+'</div></div>'}).join('')||'<p class="muted">沒有待審項目。</p>')+'</div>');
  function cs(){return Array.prototype.slice.call(sh.querySelectorAll('.rvC'))}
  function upd(){var n=cs().filter(function(c){return c.checked}).length;$('rvN').textContent='已勾選 '+n+' / '+L.length;$('rvAll').checked=n===L.length&&n>0}
  upd();$('rvAll').onchange=function(){var v=this.checked;cs().forEach(function(c){c.checked=v});upd()};cs().forEach(function(c){c.onchange=upd;c.onclick=function(e){e.stopPropagation()}});
  sh.querySelectorAll('#rvL .card').forEach(function(cd){cd.querySelector('span').onclick=function(e){e.preventDefault();var f=cd.querySelector('.rvF');f.style.display=f.style.display==='none'?'block':'none'}});
  async function bulk(dec){var ids=cs().filter(function(c){return c.checked}).map(function(c){return c.dataset.id});if(!ids.length){$('rvE').textContent='沒有勾選任何項目';return}
   if(!confirm((dec==='approve'?'核准':'退回')+'已勾選的 '+ids.length+' 筆？'+(dec==='reject'?'\n（小說大綱／章節退回會排入重寫任務）':'')))return;
   $('rvOk').disabled=$('rvNo').disabled=true;var ok=0,bad=0;
   for(var i=0;i<ids.length;i++){$('rvE').textContent='處理中 '+(i+1)+'/'+ids.length+'…';try{await api('floor','review',{task_id:ids[i],decision:dec});ok++;var c=sh.querySelector('.rvC[data-id="'+ids[i]+'"]');if(c)c.closest('.card').remove()}catch(e){bad++}}
   $('rvE').textContent='完成：'+ok+' 筆成功'+(bad?('，'+bad+' 筆失敗'):'');$('rvOk').disabled=$('rvNo').disabled=false;L=L.filter(function(t){return!!sh.querySelector('.rvC[data-id="'+t.id+'"]')});upd();try{load()}catch(_){}}
  $('rvOk').onclick=function(){bulk('approve')};$('rvNo').onclick=function(){bulk('reject')}};
 try{$('cRev').onclick=showReviews}catch(_){}})();
