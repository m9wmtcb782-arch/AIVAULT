/* AIVAULT 法律電子書無 Token 回退：純 CPU、無網路、無模型呼叫。
   輸入為已授權檢索且可核對的書頁；不代替權限檢查，也不虛構法律結論。 */
(function(root){
"use strict";
function clean(v){return String(v==null?"":v).replace(/\s+/g," ").trim();}
function terms(q){
  var stop=/^(什麼|什么|如何|為何|为何|請問|请问|說明|说明|比較|比较|分析|論述|论述|關於|关于|是否|以及|並且|并且)$/;
  var x=clean(q).replace(/[，。！？；：、（）《》〈〉,.!?;:()]/g," ");
  var out=[],seen={};
  x.split(/\s+/).forEach(function(s){
    if(s.length>=2&&!stop.test(s)&&!seen[s]){out.push(s);seen[s]=1;}
    var m=s.match(/第[一二三四五六七八九十百千零〇\d]+條/g)||[];
    m.forEach(function(t){if(!seen[t]){out.push(t);seen[t]=1;}});
  });
  return out.slice(0,24);
}
function solve(question,pages,opts){
  opts=opts||{};
  var q=clean(question),ts=terms(q), rows=[];
  if(!q)return {status:"INVALID_QUESTION",mode:"CPU_EVIDENCE_ONLY",answer:"請提供法律問題。",sources:[]};
  (Array.isArray(pages)?pages:[]).forEach(function(p){
    var text=clean(p&&p.text),title=clean(p&&p.title),page=Number(p&&p.page),bid=clean(p&&p.bid);
    if(!text||!title||!Number.isInteger(page)||page<1)return;
    var score=0;
    ts.forEach(function(t){if(text.includes(t))score+=t.startsWith("第")&&t.endsWith("條")?5:2;});
    var compact=q.replace(/\s/g,"");if(compact.length>=4&&text.includes(compact.slice(0,Math.min(compact.length,30))))score+=5;
    if(score>0)rows.push({title:title,page:page,bid:bid,text:text,score:score});
  });
  rows.sort(function(a,b){return b.score-a.score||a.page-b.page;});
  var best=rows.slice(0,Math.min(6,Math.max(1,Number(opts.limit)||4)));
  if(!best.length)return {status:"NO_EVIDENCE",mode:"CPU_EVIDENCE_ONLY",answer:"目前未找到可核對的電子書原文，無法依書作出法律結論。請指定書名、法條或章節後重新檢索。",sources:[]};
  var sources=best.map(function(p){return {title:p.title,page:p.page,bid:p.bid,excerpt:p.text.slice(0,Math.min(650,Math.max(100,Number(opts.excerptLength)||400)))};});
  var answer="【離線證據檢索｜非完整法律推理】\n問題："+q+"\n\n找到以下相關書頁，請先核對原文：\n"+sources.map(function(p,i){return (i+1)+". 《"+p.title+"》PDF第"+p.page+"頁："+p.excerpt;}).join("\n\n")+"\n\n【尚待分析】上述內容只代表檢索命中，尚未完成法條效力、構成要件、學說爭議或個案涵攝。不能直接視為確定法律答案。";
  return {status:"EVIDENCE_FOUND",mode:"CPU_EVIDENCE_ONLY",answer:answer,sources:sources};
}
root.AIVAULTLegalCpuFallback={solve:solve,terms:terms};
})(typeof globalThis!=="undefined"?globalThis:this);
