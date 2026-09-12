(function () {
  "use strict";
  var LS = "aivault.collab.v011.demo";
  var REPO = "https://github.com/m9wmtcb782-arch/AIVAULT";
  var HEAD = "3892d482549357083ef811ad1baa26c36d7d4556";
  var TYPES = ["MESSAGE","CODE","REVIEW","FIX","TEST","PASS","FAIL","WARNING","DECISION","GATE","OWNER"];
  var GATES = [["contract","Contract"],["coordinator","Coordinator"],["router","Router"],["reserve","Reserve"],["execution","Execution"],["verification","Verification"],["settlement","Settlement"],["gate1","Gate 1"],["gate2","Gate 2"],["gate3","Gate 3"],["production","Production"]];
  var SEED = [
    {agent_id:"chatgpt",display_name:"ChatGPT",role:"architect",capability:"architecture / review / gate",color:"#5ec8ff"},
    {agent_id:"grok",display_name:"Grok",role:"builder",capability:"implementation / coding",color:"#e0b14a"},
    {agent_id:"gemini",display_name:"Gemini",role:"researcher",capability:"research / analysis",color:"#8b7dff"},
    {agent_id:"darkstar",display_name:"Technical Dark Star",role:"engineer",capability:"engineering / testing / learning",color:"#3dcc8a"},
    {agent_id:"auditor",display_name:"Auditor",role:"auditor",capability:"security / compliance / risk",color:"#e85d5d"}
  ];
  var ALIAS = {architect:"chatgpt",builder:"grok",researcher:"gemini",darkstar:"darkstar",engineer:"darkstar",auditor:"auditor"};
  function $(id){return document.getElementById(id);}
  function uid(p){return p+"-"+crypto.randomUUID();}
  function now(){return new Date().toISOString();}
  function esc(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return {"&":"&","<":"<",">":">","\"":""","'":"&#39;"}[c];});}
  function sl(s){return {working:"Working",review:"Review",blocked:"Blocked",paused:"Paused",waiting:"Waiting",draft:"Draft",open:"Open"}[s]||s||"";}
  function gd(st){if(st==="pass")return '<span class="ok">PASS</span>';if(st==="waiting")return '<span class="wait">WAITING</span>';if(st==="fail"||st==="blocked")return '<span class="fail">'+(st==="fail"?"FAIL":"BLOCKED")+"</span>";return '<span class="idle">NOT STARTED</span>';}
  function defaultGates(){
    var g={}; GATES.forEach(function(k){g[k[0]]={state:"not_started",note:""};});
    g.contract={state:"waiting",note:"Frozen contract present; online not run"};
    g.coordinator={state:"waiting",note:"RPC code in repo; not deployed"};
    g.router={state:"waiting",note:"router.v0.1 present; not deployed"};
    g.reserve={state:"waiting",note:"reserve RPC in SQL; no live race"};
    g.execution={state:"not_started",note:"WAITING FOR LIVE EXECUTION"};
    g.verification={state:"not_started",note:"WAITING FOR LIVE EXECUTION"};
    g.settlement={state:"waiting",note:"claim RPC in SQL; no live race"};
    g.gate1={state:"waiting",note:"code review only"};
    g.gate2={state:"blocked",note:"online tests not executed"};
    g.production={state:"blocked",note:"Owner-only; not approved; not deployed"};
    return g;
  }
  function mkTask(id,parent,name,status,note,members){
    return {task_id:id,parent_task_id:parent,name:name,status:status,current_gate:"gate2",contract_id:"task.batch.image.classify.v0.1",progress_note:note,created_by:"owner",created_at:now(),updated_at:now(),last_activity_at:now(),members:members};
  }
  function emptyState(){
    var agents=SEED.map(function(a){return Object.assign({},a,{status:"waiting",connection_status:"not_connected",current_task_id:null,current_action:"",last_activity_at:null});});
    var files=["aivault-task-001/sql/001_task001_additive.sql","aivault-task-001/supabase/functions/aivault-task-coordinator/index.ts","aivault-task-001/IMPLEMENTATION_REPORT.md"];
    return {agents:agents,tasks:[
      mkTask("task-001",null,"Image Classification Frozen Contract v0.1","blocked","WAITING FOR LIVE EXECUTION. Not complete.",["chatgpt","grok","gemini","darkstar","auditor"]),
      mkTask("task-001-A","task-001","Concurrent Reserve Test","draft","Planned. WAITING FOR LIVE EXECUTION.",["grok"]),
      mkTask("task-001-B","task-001","Timeout Release Test","draft","Planned. WAITING FOR LIVE EXECUTION.",["darkstar"]),
      mkTask("task-001-C","task-001","Security Review","draft","Planned. No live auditor review.",["auditor"])
    ],messages:[],reviews:[],actions:[],decisions:[],learning:[],
      code_refs:files.map(function(p){return {ref_id:uid("ref"),task_id:"task-001",message_id:null,file_path:p,commit_sha:HEAD,repo:"m9wmtcb782-arch/AIVAULT",created_by:"owner",created_at:now();}}),
      tests:[{test_id:uid("test"),task_id:"task-001",suite:"online_integration",result:"BLOCKED",detail:"WAITING FOR LIVE EXECUTION.",created_by:"owner",created_at:now()}],
      gates:{"task-001":defaultGates()},selected:"task-001",paused:false};
  }
  function load(){
    try{var raw=localStorage.getItem(LS);if(!raw)return emptyState();var d=JSON.parse(raw);if(!d||!Array.isArray(d.tasks)||!Array.isArray(d.agents))return emptyState();d.messages=d.messages||[];d.reviews=d.reviews||[];d.learning=d.learning||[];d.code_refs=d.code_refs||[];d.tests=d.tests||[];d.gates=d.gates||{};return d;}
    catch(e){return emptyState();}
  }
  var db=load();
  function save(){localStorage.setItem(LS,JSON.stringify(db));}
  function ag(id){return db.agents.find(function(a){return a.agent_id===id;});}
  function cur(){return db.tasks.find(function(t){return t.task_id===db.selected;});}
  function resolve(token){var t=String(token||"").replace(/^@/,"").toLowerCase();if(ALIAS[t])return ALIAS[t];var a=db.agents.find(function(x){return x.agent_id.toLowerCase()===t||String(x.display_name).toLowerCase().replace(/\s+/g,"")===t||String(x.role).toLowerCase()===t;});return a?a.agent_id:null;}
  function mentions(text){var out=[],re=/@([A-Za-z][A-Za-z0-9_-]*)/g,m;while((m=re.exec(text))){var id=resolve(m[1]);if(id&&out.indexOf(id)<0)out.push(id);}return out;}
  function hi(text){return esc(text).replace(/@([A-Za-z][A-Za-z0-9_-]*)/g,'<span class="mention">@$1</span>');}
  function refHTML(r){var f=REPO+"/blob/"+(r.commit_sha||"main")+"/"+r.file_path;var c=r.commit_sha?REPO+"/commit/"+r.commit_sha:"";return '<div class="links"><a href="'+f+'" target="_blank" rel="noopener">View Code</a>'+(c?' <a href="'+c+'" target="_blank" rel="noopener">View Commit</a>':'')+' <button type="button" class="btn" data-ask-review="'+esc(r.ref_id)+'">Request Review</button><div class="muted">'+esc(r.file_path)+(r.commit_sha?" · "+String(r.commit_sha).slice(0,7):"")+"</div></div>";}
  function fill(){
    if(!$("msgType")||!$("filterType"))return;
    var ct=$("msgType").value,cf=$("filterType").value;
    $("msgType").innerHTML=TYPES.map(function(t){return "<option>"+t+"</option>";}).join("");
    $("filterType").innerHTML='<option value="">ALL</option>'+TYPES.map(function(t){return '<option value="'+t+'">'+t+"</option>";}).join("");
    if(TYPES.indexOf(ct)>=0)$("msgType").value=ct; if(TYPES.indexOf(cf)>=0)$("filterType").value=cf;
    $("msgTo").innerHTML='<option value="">ALL</option>'+db.agents.map(function(a){return '<option value="'+esc(a.agent_id)+'">@'+esc(a.display_name)+" ("+esc(a.role)+")</option>";}).join("");
    $("msgAs").innerHTML='<option value="owner">Owner</option>'+db.agents.map(function(a){return '<option value="'+esc(a.agent_id)+'">Owner proxy '+esc(a.display_name)+" (OWNER PROXY / DEMO / NOT CONNECTED)</option>";}).join("");
    var chips=["@Architect","@Builder","@Researcher","@DarkStar","@Auditor"];
    db.agents.forEach(function(a){if(["chatgpt","grok","gemini","darkstar","auditor"].indexOf(a.agent_id)<0)chips.push("@"+a.display_name);});
    $("mentionChips").innerHTML=chips.map(function(c){return '<button type="button" class="chip" data-chip="'+esc(c)+'">'+esc(c)+"</button>";}).join("");
  }
  function renderTasks(){
    if(!$("taskList"))return;
    var roots=db.tasks.filter(function(t){return !t.parent_task_id;});
    $("taskList").innerHTML=roots.map(function(t){var n=db.tasks.filter(function(s){return s.parent_task_id===t.task_id;}).length;var last=t.last_activity_at?new Date(t.last_activity_at).toLocaleString():"-";return '<div class="card '+(t.task_id===db.selected?"active":"")+'" data-task="'+esc(t.task_id)+'"><div class="row"><span class="name">'+esc(t.task_id)+'</span><span class="status">'+sl(t.status)+"</span></div><div>"+esc(t.name)+'</div><div class="muted">'+((t.members||[]).length)+" Agents · "+esc(t.current_gate||"-")+" · "+n+' subtasks</div><div class="muted">'+esc(t.contract_id||"")+'</div><div class="muted">'+esc(t.progress_note||"")+'</div><div class="muted">Last: '+last+"</div></div>";}).join("")||'<div class="empty">No task</div>';
  }
  function renderAgents(){
    if(!$("agentList"))return;
    $("agentList").innerHTML=db.agents.map(function(a){return '<div class="card"><div class="row"><span class="name"><span class="dot" style="background:'+esc(a.color||"#8aa0b8")+'"></span>'+esc(a.display_name)+'</span><span class="muted">'+sl(a.status)+'</span></div><div class="muted">'+esc(a.role)+" · "+esc(a.capability)+'</div><div class="muted">NOT CONNECTED</div><div class="muted">Task: '+esc(a.current_task_id||"-")+"</div></div>";}).join("");
  }
  function renderPool(){
    if(!$("pool"))return;
    var task=cur(); if(!task){$("pool").innerHTML='<div class="empty">No task</div>';return;}
    var filter=$("filterType")?$("filterType").value:"";
    var all=db.messages.filter(function(m){return m.task_id===task.task_id;});
    var msgs=all.filter(function(m){return !filter||m.message_type===filter;}).sort(function(a,b){return String(a.created_at).localeCompare(String(b.created_at));});
    if($("poolMeta"))$("poolMeta").textContent=task.task_id+" · "+msgs.length+" / "+all.length+" · no auto agent replies";
    if(!msgs.length){$("pool").innerHTML='<div class="empty">Pool is empty. No fake agent dialogue, fake commit, or fake test PASS.</div>';return;}
    $("pool").innerHTML=msgs.map(function(m){var from=m.sender_agent_id==="owner"?"Owner":((ag(m.sender_agent_id)||{}).display_name||m.sender_agent_id);var to=!m.receiver_agent_id?"ALL":((ag(m.receiver_agent_id)||{}).display_name||m.receiver_agent_id);var refs=db.code_refs.filter(function(r){return r.message_id===m.message_id;});var proxy=m.owner_proxy?'<div class="proxy">OWNER PROXY / DEMO / NOT CONNECTED</div>':"";return '<article class="msg"><div class="meta"><span class="tag '+esc(m.message_type)+'">'+esc(m.message_type)+"</span><b>"+esc(from)+"</b> -> "+esc(to)+" · "+new Date(m.created_at).toLocaleString()+"</div>"+proxy+"<div>"+hi(m.content)+"</div>"+refs.map(refHTML).join("")+"</article>";}).join("");
  }
  function renderRight(){
    var task=cur(); if(!task)return;
    var g=db.gates[task.task_id]||db.gates[task.parent_task_id]||{};
    var root=task.parent_task_id||task.task_id;
    if($("gates"))$("gates").innerHTML=GATES.map(function(k){var st=g[k[0]]||{state:"not_started",note:""};return '<div class="gate"><span>'+k[1]+"</span>"+gd(st.state)+"</div>"+(st.note?'<div class="muted">'+esc(st.note)+"</div>":"");}).join("");
    var subs=db.tasks.filter(function(t){return t.parent_task_id===root;});
    if($("subs"))$("subs").innerHTML=subs.length?'<div class="tree">'+subs.map(function(s){return "- "+esc(s.task_id)+" "+esc(s.name)+" / "+esc(s.status)+" / "+((s.members||[]).join(", ")||"unassigned");}).join("<br>")+"</div>":'<div class="muted">No subtask</div>';
    var codes=db.code_refs.filter(function(r){return r.task_id===task.task_id||r.task_id===root;});
    if($("codes"))$("codes").innerHTML=codes.length?codes.map(function(r){return '<div class="card">'+refHTML(r)+"</div>";}).join(""):'<div class="muted">No code ref</div>';
    var revs=db.reviews.filter(function(r){return r.task_id===task.task_id||r.task_id===root;});
    if($("reviews"))$("reviews").innerHTML=revs.length?revs.map(function(r){return '<div class="card"><div class="row"><span>'+esc(r.finding_id||r.review_id)+"</span><span>"+esc(r.status||"")+"</span></div><div>"+esc(r.findings||"")+'</div><div class="btn-row"><button class="btn" data-verdict="pass" data-review="'+esc(r.review_id)+'">PASS</button><button class="btn" data-verdict="need_fix" data-review="'+esc(r.review_id)+'">NEED FIX</button><button class="btn" data-verdict="reject" data-review="'+esc(r.review_id)+'">REJECT</button></div></div>';}).join(""):'<div class="muted">No review</div>';
    var tests=db.tests.filter(function(t){return t.task_id===task.task_id||t.task_id===root;});
    if($("tests"))$("tests").innerHTML=tests.length?tests.map(function(t){return '<div class="card"><div class="row"><span>'+esc(t.suite)+'</span><span class="fail">'+esc(t.result)+"</span></div><div class=\"muted\">"+esc(t.detail||"")+"</div></div>";}).join(""):'<div class="muted">No test</div>';
    var learn=db.learning.filter(function(x){return x.task_id===task.task_id||x.task_id===root;});
    if($("learn"))$("learn").innerHTML=learn.length?learn.map(function(x){return '<div class="card"><div>'+esc(x.problem||x.summary||"")+'</div><div class="muted">'+(x.verification_status||"candidate")+" · not promoted</div></div>";}).join(""):'<div class="muted">No learning candidate. Not written to Dark Star.</div>';
    if($("connNote"))$("connNote").textContent="LOCAL DEMO / SUPABASE NOT CONNECTED";
    if($("badgeConn")){$("badgeConn").className="badge warn";$("badgeConn").textContent="LOCAL DEMO / SUPABASE NOT CONNECTED";}
  }
  function touch(){var t=cur();if(!t)return;t.updated_at=now();t.last_activity_at=now();}
  function render(){fill();renderTasks();renderAgents();renderPool();renderRight();save();}
  function bind(){
    if($("taskList"))$("taskList").addEventListener("click",function(e){var card=e.target.closest("[data-task]");if(!card)return;db.selected=card.getAttribute("data-task");render();});
    if($("mentionChips"))$("mentionChips").addEventListener("click",function(e){var chip=e.target.closest("[data-chip]");if(!chip||!$("msgBody"))return;$("msgBody").value=($("msgBody").value?$("msgBody").value+" ":"")+chip.getAttribute("data-chip")+" ";});
    if($("filterType"))$("filterType").addEventListener("change",render);
    if($("btnNewTask"))$("btnNewTask").onclick=function(){var name=prompt("Task name");if(!name)return;var id=uid("task");db.tasks.push({task_id:id,parent_task_id:null,name:name,status:"draft",current_gate:"gate1",contract_id:"",progress_note:"Owner created. No agent auto-run.",created_by:"owner",created_at:now(),updated_at:now(),last_activity_at:now(),members:db.agents.map(function(a){return a.agent_id;})});db.gates[id]={};GATES.forEach(function(k){db.gates[id][k[0]]={state:"not_started",note:""};});db.selected=id;render();};
    if($("btnAddAgent"))$("btnAddAgent").onclick=function(){var id=((($("newAgentId")&&$("newAgentId").value)||"").trim().toLowerCase().replace(/[^a-z0-9_-]/g,""));var name=((($("newAgentName")&&$("newAgentName").value)||"").trim());if(!id||!name)return;if(db.agents.some(function(a){return a.agent_id===id;})){alert("exists");return;}db.agents.push({agent_id:id,display_name:name,role:((($("newAgentRole")&&$("newAgentRole").value)||"agent").trim()||"agent"),capability:((($("newAgentCap")&&$("newAgentCap").value)||"").trim()),color:"#8aa0b8",status:"waiting",connection_status:"not_connected",current_task_id:null,current_action:"",last_activity_at:null});var t=cur();if(t&&!t.parent_task_id){t.members=t.members||[];if(t.members.indexOf(id)<0)t.members.push(id);}render();};
    if($("btnSend"))$("btnSend").onclick=function(){var task=cur();if(!task)return;var content=((($("msgBody")&&$("msgBody").value)||"").trim());if(!content)return;var as=($("msgAs")&&$("msgAs").value)||"owner";var ms=mentions(content);var msg={message_id:uid("msg"),task_id:task.task_id,sender_agent_id:as,receiver_agent_id:($("msgTo")&&$("msgTo").value)||ms[0]||null,message_type:($("msgType")&&$("msgType").value)||"MESSAGE",content:content,reply_to:((($("replyTo")&&$("replyTo").value)||"").trim())||null,status:"posted",owner_proxy:as!=="owner",created_at:now()};db.messages.push(msg);var path=((($("codePath")&&$("codePath").value)||"").trim());var sha=((($("codeSha")&&$("codeSha").value)||"").trim());if(path)db.code_refs.push({ref_id:uid("ref"),task_id:task.task_id,message_id:msg.message_id,file_path:path,commit_sha:sha||null,repo:"m9wmtcb782-arch/AIVAULT",created_by:as,created_at:now()});if($("asLearning")&&$("asLearning").checked)db.learning.push({candidate_id:uid("learn"),task_id:task.task_id,message_id:msg.message_id,source_agent_id:as,problem:((($("learnProblem")&&$("learnProblem").value)||content).slice(0,240)),proposals:($("learnProposal")&&$("learnProposal").value)||"",debate:"",chosen_solution:($("learnReason")&&$("learnReason").value)||"",reason:($("learnReason")&&$("learnReason").value)||"",code_changes:"",tests:"",errors:"",corrections:"",architect_decision:"",summary:content.slice(0,240),verification_status:"candidate",promoted:false,created_at:now()});if($("msgBody"))$("msgBody").value="";if($("codePath"))$("codePath").value="";if($("codeSha"))$("codeSha").value="";if($("asLearning"))$("asLearning").checked=false;touch();render();};
    if($("btnReviewReq"))$("btnReviewReq").onclick=function(){var task=cur();if(!task)return;var summary=((($("msgBody")&&$("msgBody").value)||"").trim())||prompt("Review finding");if(!summary)return;var assigned=($("msgTo")&&$("msgTo").value)||"grok";var review={review_id:uid("rev"),task_id:task.task_id,finding_id:"F-"+String(db.reviews.length+1).padStart(3,"0"),requested_by:"owner",reviewer_agent_id:"chatgpt",target_agent_id:assigned,status:"requested",findings:summary,required_changes:"",created_at:now(),resolved_at:null};db.reviews.push(review);db.messages.push({message_id:uid("msg"),task_id:task.task_id,sender_agent_id:"owner",receiver_agent_id:assigned,message_type:"REVIEW",content:"REVIEW REQUEST "+review.finding_id+": "+summary,reply_to:null,status:"posted",owner_proxy:false,created_at:now()});touch();render();};
    if($("reviews"))$("reviews").addEventListener("click",function(e){var btn=e.target.closest("[data-review]");if(!btn)return;var r=db.reviews.find(function(x){return x.review_id===btn.getAttribute("data-review");});if(!r)return;r.status=btn.getAttribute("data-verdict");r.resolved_at=(r.status==="pass"||r.status==="reject")?now():null;var type=r.status==="pass"?"PASS":r.status==="reject"?"FAIL":"REVIEW";db.messages.push({message_id:uid("msg"),task_id:r.task_id,sender_agent_id:"owner",receiver_agent_id:r.target_agent_id,message_type:type,content:"REVIEW "+(r.finding_id||r.review_id)+" = "+String(r.status).toUpperCase()+" (OWNER recorded; not a live agent verdict)",reply_to:null,status:"posted",owner_proxy:false,created_at:now()});touch();render();});
    document.body.addEventListener("click",function(e){var ask=e.target.closest("[data-ask-review]");if(!ask)return;var ref=db.code_refs.find(function(r){return r.ref_id===ask.getAttribute("data-ask-review");});if(!ref)return;if($("msgType"))$("msgType").value="REVIEW";if($("msgBody"))$("msgBody").value="@Architect please review "+ref.file_path;if($("codePath"))$("codePath").value=ref.file_path;if($("codeSha"))$("codeSha").value=ref.commit_sha||"";});
    if($("btnSubtask"))$("btnSubtask").onclick=function(){var task=cur();if(!task)return;var parent=task.parent_task_id?db.tasks.find(function(t){return t.task_id===task.parent_task_id;}):task;var name=prompt("Subtask name");if(!name)return;var n=db.tasks.filter(function(t){return t.parent_task_id===parent.task_id;}).length+1;var id=parent.task_id+"-"+String.fromCharCode(64+n);var assignee=($("msgTo")&&$("msgTo").value)||"";db.tasks.push({task_id:id,parent_task_id:parent.task_id,name:name,status:"open",current_gate:parent.current_gate,contract_id:parent.contract_id||"",progress_note:"Owner created. Not a live agent run.",created_by:"owner",created_at:now(),updated_at:now(),last_activity_at:now(),members:assignee?[assignee]:[]});touch();render();};
    if($("btnTest"))$("btnTest").onclick=function(){var task=cur();if(!task)return;var suite=prompt("Test suite","online_integration");if(!suite)return;var result=prompt("Result","NOT_RUN");if(!result)return;var detail=prompt("Detail","Not executed.")||"";db.tests.push({test_id:uid("test"),task_id:task.task_id,suite:suite,result:result,detail:detail,created_by:"owner",created_at:now()});db.messages.push({message_id:uid("msg"),task_id:task.task_id,sender_agent_id:"owner",receiver_agent_id:null,message_type:"TEST",content:"TEST "+suite+" = "+result+". "+detail,reply_to:null,status:"posted",owner_proxy:false,created_at:now()});touch();render();};
    document.querySelectorAll("[data-own]").forEach(function(btn){btn.onclick=function(){var task=cur();if(!task)return;if($("msgAs")&&$("msgAs").value!=="owner"){alert("Owner-only");return;}var act=btn.getAttribute("data-own");if(act==="start"){db.paused=false;task.status="working";task.progress_note="Owner started workspace. WAITING FOR LIVE EXECUTION.";}if(act==="pause"){db.paused=true;task.status="paused";}if(act==="rereview")task.status="review";if(act==="reject")task.status="blocked";if(act==="approve_prod"){if(!confirm("Record production intent? Will not deploy."))return;}db.messages.push({message_id:uid("msg"),task_id:task.task_id,sender_agent_id:"owner",receiver_agent_id:null,message_type:"OWNER",content:"OWNER_ACTION "+act,reply_to:null,status:"posted",owner_proxy:false,created_at:now()});touch();render();};});
    if($("btnExport"))$("btnExport").onclick=function(){var a=document.createElement("a");a.href=URL.createObjectURL(new Blob([JSON.stringify(db,null,2)],{type:"application/json"}));a.download="aivault-collab-v0.1.1.json";a.click();};
    if($("btnConnect"))$("btnConnect").onclick=function(){alert("LOCAL DEMO / SUPABASE NOT CONNECTED");};
    if($("btnReloadDb"))$("btnReloadDb").onclick=function(){db=load();render();};
    if($("tabs"))$("tabs").addEventListener("click",function(e){var b=e.target.closest("[data-pane]");if(!b)return;var pane=b.getAttribute("data-pane");["left","mid","right"].forEach(function(p){if($("pane-"+p))$("pane-"+p).style.display=p===pane?"block":"none";});});
    if(window.matchMedia&&window.matchMedia("(max-width:980px)").matches){if($("pane-left"))$("pane-left").style.display="block";if($("pane-mid"))$("pane-mid").style.display="none";if($("pane-right"))$("pane-right").style.display="none";}
  }
  function boot(){bind();render();}
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot);else boot();
})();
