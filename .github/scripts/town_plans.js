/* ===== pl1：📋 每日學習計畫（唯讀）=====
   計畫由各區學階最高的 AI 撰寫、審核 AI 審核（資料來自 degree/plans_public）。
   關閉：localStorage.townPlansOff='1'（計畫按鈕） */
(function(){
 function showPlans(){open('<h3>📋 今日學習計畫</h3><p class="muted">載入中…</p>');(MOCK?Promise.resolve({plans:[{district:'av',author:'（測試）影·星',rank:'大學 4 階 10 級',plan:{goal:'掌握串流 ASR',topics:[{topic:'Silero VAD 參數調整'},{topic:'WebRTC Opus 20ms 封包'}]},reviewer:'審核 AI',decision:'approve',reason:'（測試）主題具體'}]}):api('degree','plans_public',{})).then(function(d){var D={av:'🎬 影片與語音',code:'💻 程式與代理',llm:'🧠 大型語言模型',img:'🎨 圖像生成'};var L=d.plans||[];
  open('<h3>📋 今日學習計畫（唯讀）</h3><p class="muted">每天由各區學階最高的 AI 撰寫，審核 AI 審核；核准的計畫決定該區當天的學習主題，退回就用預設課程（口語化即時語音模組＋本區考試主題）。</p>'+(L.map(function(p){var pl=p.plan||{};return'<div class="card"><b>'+esc(D[p.district]||p.district)+'</b> · '+esc(p.author)+'（'+esc(p.rank)+'）<div>目標：'+esc(pl.goal||'')+'</div><ul>'+(pl.topics||[]).map(function(t){return'<li>'+esc(t.topic||t)+(t.why?'<span class="muted"> — '+esc(t.why)+'</span>':'')+'</li>'}).join('')+'</ul><div style="color:'+(p.decision==='approve'?'#86efac':'#fca5a5')+'">🔎 審核 AI：'+(p.decision==='approve'?'✅ 核准':'❌ 退回')+' — '+esc(p.reason||'')+'</div></div>'}).join('')||'<p class="muted">今天的計畫還沒產生（每 10 分鐘的學習排程會先產生計畫）。</p>'))}).catch(function(e){sh.innerHTML+='<p class="muted">'+esc(e.message)+'</p>'})}
 function chip(){if(!$('cHum')){setTimeout(chip,800);return}try{if(localStorage.getItem('townPlansOff')==='1')return}catch(_){}var b=document.createElement('span');b.className='chip';b.id='cPlan';b.textContent='📋 計畫';b.style.cursor='pointer';b.onclick=showPlans;$('cHum').parentNode.appendChild(b)}
 setTimeout(chip,1200);
 window.__plans={show:showPlans}})();
