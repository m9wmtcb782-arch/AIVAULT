/* pb5（pb8：iPhone 捲動修正——外層 body overflow:hidden＋#shelfView 是 flex 欄，書架要自己當捲動容器）：🤝 協作池書架（獨立分頁；使用者原本的「我的書架」等分頁與書單完全不變，協作池書不會混進去）。
   資料：aivault_pool_books / aivault_pool_book_chapters（唯讀、匿名可讀已上架書）＋ aivault_pool_book_readers()（從學習紀錄算的真實讀者數與最新讀者）。
   深連結：dark-star-ebook.html?view=pool 。?mock=1 才用測試資料。關閉：localStorage.poolShelfOff='1'。 */
(function(){try{if(localStorage.getItem('poolShelfOff')==='1')return}catch(_){}
var U="https://clcddygkaaqqtsbswgdf.supabase.co/rest/v1/",K="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNsY2RkeWdrYWFxcXRzYnN3Z2RmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY3MzUwNjQsImV4cCI6MjEwMjMxMTA2NH0.kYg6h7n74CtbiIjNjZ2xxJj16SV42INZVzQ9dLNUfKE",MOCK=/[?&]mock=1/.test(location.search);
var H={apikey:K,Authorization:"Bearer "+K,"Content-Type":"application/json"};
function esc(s){return String(s==null?"":s).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})}
function get(p){return fetch(U+p,{headers:H}).then(function(r){if(!r.ok)throw new Error(r.status);return r.json()})}
function rpc(n){return fetch(U+"rpc/"+n,{method:"POST",headers:H,body:"{}"}).then(function(r){return r.ok?r.json():[]}).catch(function(){return[]})}
function tw(t){try{return new Date(t).toLocaleString("zh-TW",{timeZone:"Asia/Taipei",month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit"})+"（台北）"}catch(_){return t}}
var tabs=document.getElementById("shelfTabs"),grid=document.getElementById("shelfGrid");if(!tabs||!grid)return;
var st=document.createElement("style");st.textContent="#poolShelf{flex:1 1 auto;min-height:0;overflow-y:auto;overflow-x:hidden;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;touch-action:pan-y;padding:10px 12px calc(90px + env(safe-area-inset-bottom))}#poolShelf h3{margin:18px 4px 8px;font-size:17px}.pb-card{background:rgba(255,255,255,.92);color:#111;border-radius:12px;padding:12px 14px;margin:8px 0;box-shadow:0 1px 4px rgba(0,0,0,.15)}.pb-card b{font-size:15px}.pb-meta{font-size:12.5px;color:#555;margin-top:4px;line-height:1.5}.pb-tag{display:inline-block;font-size:11px;padding:1px 7px;border-radius:9px;background:#e0e7ff;color:#3730a3;margin-right:4px}.pb-rd{position:fixed;inset:0;height:100%;max-height:100dvh;z-index:9999;overscroll-behavior:contain;touch-action:pan-y;background:#fffdf7;color:#1f2937;overflow:auto;-webkit-overflow-scrolling:touch}.pb-rd header{position:sticky;top:0;background:#1e3a8a;color:#fff;padding:10px 12px;display:flex;gap:8px;align-items:center}.pb-rd header button{background:#fff2;color:#fff;border:0;border-radius:8px;padding:6px 10px;font-size:14px}.pb-rd article{padding:14px 16px 80px;font-size:17px;line-height:1.85;white-space:pre-wrap;word-break:break-word}.pb-rd a{color:#1d4ed8}";document.head.appendChild(st);
var btn=document.createElement("button");btn.setAttribute("data-pooltab","1");btn.textContent="🤝 協作池書架";tabs.appendChild(btn);
var box=document.createElement("div");box.id="poolShelf";box.hidden=true;grid.parentNode.insertBefore(box,grid.nextSibling);
var hid=[];function show(on){var tools=document.querySelector(".shelf-tools"),cat=document.getElementById("catBar");
 if(on){hid=[grid,tools,cat].filter(function(e){return e&&!e.hidden});hid.forEach(function(e){e.hidden=true});box.hidden=false;tabs.querySelectorAll("button").forEach(function(b){b.classList.toggle("on",b===btn)});load()}
 else{box.hidden=true;hid.forEach(function(e){e.hidden=false});hid=[];btn.classList.remove("on")}}
btn.addEventListener("click",function(){show(true)});
tabs.addEventListener("click",function(e){var b=e.target.closest&&e.target.closest("[data-tab]");if(b&&!box.hidden){box.hidden=true;hid.forEach(function(x){if(x.id!=="catBar")x.hidden=false});hid=[];btn.classList.remove("on")}},true);
var BOOKS=[];
function load(){box.innerHTML='<p style="padding:12px">載入中…</p>';
 var P=MOCK?Promise.resolve([[{id:"m1",title:"（測試）協作池基礎",tier:"基礎",kind:"written",chapters:3,author:"mock",domains:["測試"]}],[{book_id:"m1",readers:2,reads:3,last_agent:"ag-0001",last_at:new Date().toISOString()}]]):
  Promise.all([get("aivault_pool_books?status=eq.published&select=id,title,tier,tier_order,sort_order,kind,author,chapters,chars,domains,review,updated_at&order=kind.desc,tier_order.asc,sort_order.asc"),rpc("aivault_pool_book_readers")]);
 P.then(function(r){BOOKS=r[0];var R={};(r[1]||[]).forEach(function(x){R[x.book_id]=x});
  var h='<p class="pb-meta" style="padding:0 4px">協作池 AI 的必讀書，依 基礎 → 入門 → 專業 排序。AI 由排程自動閱讀（不需按鈕、0 token）；讀者數取自每位 AI 的真實閱讀紀錄。這個書架和「我的書架」分開，不會混在一起。</p>';
  [["written","📘 Grok Bot 撰寫的必讀書"],["anthology","🗂️ 資料選輯（AI 閱讀層彙編，經獨立自動檢查後上架）"]].forEach(function(g){var L=BOOKS.filter(function(b){return b.kind===g[0]});if(!L.length&&g[0]==="anthology"){h+='<h3>'+g[1]+'</h3><p class="pb-meta" style="padding:0 4px">還沒有通過檢查的選輯。</p>';return}
   h+='<h3>'+g[1]+'</h3>';L.forEach(function(b){var x=R[b.id];h+='<div class="pb-card" data-pb="'+esc(b.id)+'"><span class="pb-tag">'+esc(b.tier)+'</span><b>'+esc(b.title)+'</b><div class="pb-meta">'+esc((b.domains||[]).join("、"))+'｜'+b.chapters+' 章｜作者：'+esc(b.author)+'<br>'+(x?'👥 已有 <b>'+x.readers+'</b> 位 AI 讀過（共 '+x.reads+' 次閱讀）｜最新讀者 '+esc(x.last_agent)+'，'+esc(tw(x.last_at)):'👥 還沒有 AI 讀過')+'</div></div>'})});
  box.innerHTML=h;box.querySelectorAll("[data-pb]").forEach(function(c){c.onclick=function(){openBook(c.getAttribute("data-pb"))}})})
 .catch(function(e){box.innerHTML='<p style="padding:12px">協作池書架載入失敗（'+esc(e.message)+'）</p>'})}
function linkify(s){return esc(s).replace(/https:\/\/[^\s<）]+/g,function(u){return'<a href="'+u+'" target="_blank" rel="noopener">'+u+'</a>'})}
function openBook(id){var b=BOOKS.filter(function(x){return x.id===id})[0]||{title:id};var d=document.createElement("div");d.className="pb-rd";d.innerHTML='<header><button data-x>‹ 返回</button><div style="flex:1;font-size:14px">'+esc(b.title)+'</div><button data-p>上一章</button><button data-n>下一章</button></header><article>載入中…</article>';document.body.appendChild(d);
 var C=[],i=0,art=d.querySelector("article");function paint(){var c=C[i];art.innerHTML=c?'<h2 style="margin:0 0 10px;font-size:19px">'+esc(c.title)+'</h2>'+linkify(c.content)+'<p class="pb-meta">第 '+(i+1)+' / '+C.length+' 章</p>':'（沒有內容）';d.scrollTop=0}
 d.querySelector("[data-x]").onclick=function(){d.remove()};d.querySelector("[data-p]").onclick=function(){if(i>0){i--;paint()}};d.querySelector("[data-n]").onclick=function(){if(i<C.length-1){i++;paint()}};
 (MOCK?Promise.resolve([{title:"（測試）第 1 章",content:"測試內容"}]):get("aivault_pool_book_chapters?book_id=eq."+encodeURIComponent(id)+"&select=chapter_no,title,content&order=chapter_no")).then(function(r){C=r;paint()}).catch(function(e){art.textContent="載入失敗："+e.message})}
if(/[?&]view=pool\b/.test(location.search))setTimeout(function(){show(true)},300);
window.AIVAULTPoolShelf={show:show,open:openBook};
})();
