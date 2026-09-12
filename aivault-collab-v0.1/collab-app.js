(function(){
var LS="aivault.collab.v0.1";
var REPO="https://github.com/m9wmtcb782-arch/AIVAULT";
var HEAD="3892d482549357083ef811ad1baa26c36d7d4556";
var TYPES=["MESSAGE","CODE","REVIEW","FIX","TEST","PASS","FAIL","WARNING","DECISION","GATE","OWNER"];
var GATES=[["contract","Contract"],["coordinator","Coordinator"],["router","Router"],["reserve","Reserve"],["execution","Execution"],["verification","Verification"],["settlement","Settlement"],["gate1","Gate 1"],["gate2","Gate 2"],["gate3","Gate 3"],["production","Production"]];
var SEED=[
{agent_id:"chatgpt",display_name:"ChatGPT",role:"architect",capability:"architecture / review / gate",color:"#5ec8ff"},
{agent_id:"grok",display_name:"Grok",role:"builder",capability:"implementation / coding",color:"#e0b14a"},
{agent_id:"gemini",display_name:"Gemini",role:"researcher",capability:"research / analysis",color:"#8b7dff"},
{agent_id:"darkstar",display_name:"Technical Dark Star",role:"engineer",capability:"engineering / testing / learning",color:"#3dcc8a"},
{agent_id:"auditor",display_name:"Auditor",role:"auditor",capability:"security / compliance / risk",color:"#e85d5d"}
];
var ALIAS={architect:"chatgpt",builder:"grok",researcher:"gemini",darkstar:"darkstar",engineer:"darkstar",auditor:"auditor"};
function $(i){return document.getElementById(i);}
function uid(p){return p+"-"+crypto.randomUUID();}
function now(){return new Date().toISOString();}
function esc(s){return String(s).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c];});}
function sl(s){return {working:"\uD83D\uDFE2 Working",review:"\uD83D\uDFE1 Reviewing",reviewing:"\uD83D\uDFE1 Reviewing",researching:"\uD83D\uDFE2 Researching",testing:"\uD83D\uDFE2 Testing",blocked:"\uD83D\uDD34 Blocked",paused:"\uD83D\uDFE1 Paused",waiting:"\uD83D\uDFE1 Waiting"}[s]||s;}
function gd(st){return st==="pass"?'<span class="ok">PASS</span>':st==="waiting"?'<span class="wait">WAITING</span>':(st==="fail"||st==="blocked")?'<span class="fail">'+(st==="fail"?"FAIL":"BLOCKED")+"</span>":'<span class="idle">NOT STARTED</span>';}
function taskGates(){
  var g={}; GATES.forEach(function(k){g[k[0]]={state:"not_started",note:""};});
  g.contract={state:"waiting",note:"Frozen contract file present; online not run"};
  g.coordinator={state:"waiting",note:"RPC code in repo; not deployed"};
  g.router={state:"waiting",note:"router.v0.1 code present; not deployed"};
  g.reserve={state:"waiting",note:"aivault_reserve_attempt in SQL; no live race"};
  g.settlement={state:"waiting",note:"claim RPC in SQL; no live race"};
  g.gate1={state:"waiting",note:"code review only"};
  g.gate2={state:"blocked",note:"online tests not executed"};
  g.production={state:"blocked",note:"Owner-only; not approved; not deployed"};
  return g;
}
function mk(id,parent,name,members,note){return {task_id:id,parent_task_id:parent,name:name,status:parent?"draft":"blocked",current_gate:"gate2",progress_note:note,created_by:"owner",created_at:now(),updated_at:now(),last_activity_at:now(),members:members};}
function empty(){
  var agents=SEED.map(function(a){return Object.assign({},a,{status:"waiting",current_task_id:null,current_action:"",last_activity_at:null});});
  var files=["aivault-task-001/sql/001_task001_additive.sql","aivault-task-001/supabase/functions/aivault-task-coordinator/index.ts","aivault-task-001/IMPLEMENTATION_REPORT.md"];
  return {agents:agents,tasks:[
    mk("task-001",null,"Image Classification - Frozen Contract v0.1",SEED.map(function(a){return a.agent_id;}),"Code exists. Online integration BLOCKED. Not a live run."),
    mk("task-001-A","task-001","Concurrent Reserve Test",["grok"],"Planned. Not executed against live Postgres."),
    mk("task-001-B","task-001","Timeout Release Test",["darkstar"],"Planned. Not executed against live Postgres."),
    mk("task-001-C","task-001","Security Review",["auditor"],"Planned. Auditor has not posted a live review.")
  ],messages:[],reviews:[],actions:[],decisions:[],learning:[],
    code_refs:files.map(function(p){return {ref_id:uid("ref"),task_id:"task-001",message_id:null,file_path:p,commit_sha:HEAD,repo:"m9wmtcb782-arch/AIVAULT",created_by:"owner",created_at:now()};}),
    tests:[{test_id:uid("test"),task_id:"task-001",suite:"online_integration",result:"BLOCKED",detail:"POST /functions/v1/aivault-task-submit -> 404 NOT_FOUND.",created_by:"owner",created_at:now()}],
    gates:{"task-001":taskGates()},selected:"task-001",paused:false};
}
function load(){try{var r=localStorage.getItem(LS);if(!r)return empty();var d=JSON.parse(r);if(!d.tasks||!d.agents)return empty();if(!Array.isArray(d.messages))d.messages=[];return d;}catch(e){return empty();}}
var db=load();
function save(){localStorage.setItem(LS,JSON.stringify(db));}
function ag(id){return db.agents.find(function(a){return a.agent_id===id;});}
function cur(){return db.tasks.find(function(t){return t.task_id===db.selected;});}
function resolve(token){var t=token.replace(/^@/,"").toLowerCase();if(ALIAS[t])return ALIAS[t];var a=db.agents.find(function(x){return x.agent_id.toLowerCase()===t||x.display_name.toLowerCase().replace(/\s+/g,"")===t||x.role.toLowerCase()===t;});return a?a.agent_id:null;}
function mentions(text){var out=[],re=/@([A-Za-z][A-Za-z0-9_-]*)/g,m;while((m=re.exec(text))){var id=resolve(m[1]);if(id&&out.indexOf(id)<0)out.push(id);}return out;}
function hi(text){return esc(text).replace(/@([A-Za-z][A-Za-z0-9_-]*)/g,'<span class="mention">@$1</span>');}
function refHTML(r){var f=REPO+"/blob/"+(r.commit_sha||"main")+"/"+r.file_path;var c=r.commit_sha?REPO+"/commit/"+r.commit_sha:"";return '<div class="links"><a href="'+f+'" target="_blank" rel="noopener">View Code</a>'+(c?' <a href="'+c+'" target="_blank" rel="noopener">View Diff / Commit</a>':'')+' <button type="button" class="btn" data-ask-review="'+r.ref_id+'">Request Review</button><div class="muted">'+esc(r.file_path)+(r.commit_sha?" · "+r.commit_sha.slice(0,7):"")+"</div></div>";}
function fill(){
  var ct=$("msgType").value,cf=$("filterType").value;
  $("msgType").innerHTML=TYPES.map(function(t){return "<option>"+t+"</option>";}).join("");
  $("filterType").innerHTML='<option value="">ALL</option>'+TYPES.map(function(t){return '<option value="'+t+'">'+t+"</option>";}).join("");
  if(TYPES.indexOf(ct)>=0)$("msgType").value=ct; if(TYPES.indexOf(cf)>=0)$("filterType").value=cf;
  $("msgTo").innerHTML='<option value="">ALL</option>'+db.agents.map(function(a){return '<option value="'+a.agent_id+'">@'+esc(a.display_name)+" ("+esc(a.role)+")</option>";}).join("");
  $("msgAs").innerHTML='<option value="owner">Owner</option>'+db.agents.map(function(a){return '<option value="'+a.agent_id+'">Owner proxy as '+esc(a.display_name)+" (DEMO / NOT CONNECTED)</option>";}).join("");
  var chips=["@Architect","@Builder","@Researcher","@DarkStar","@Auditor"];
  db.agents.forEach(function(a){if(["chatgpt","grok","gemini","darkstar","auditor"].indexOf(a.agent_id)<0)chips.push("@"+a.display_name);});
  $("mentionChips").innerHTML=chips.map(function(c){return '<button type="button" class="chip" data-chip="'+c+'">'+c+"</button>";}).join("");
}
function renderTasks(){
  $("taskList").innerHTML=db.tasks.filter(function(t){return !t.parent_task_id;}).map(function(t){
    var last=t.last_activity_at?new Date(t.last_activity_at).toLocaleString():"-";
    var n=db.tasks.filter(function(s){return s.parent_task_id===t.task_id;}).length;
    return '<div class="card '+(t.task_id===db.selected?"active":"")+'" data-task="'+t.task_id+'"><div class="row"><span class="name">'+esc(t.task_id)+'</span><span class="status">'+sl(t.status)+"</span></div><div>"+esc(t.name)+'</div><div class="muted">'+(t.members||[]).length+" Agents · "+esc(t.current_gate||"-")+" · "+n+' subtasks</div><div class="muted">'+esc(t.progress_note||"")+'</div><div class="muted">Last: '+last+"</div></div>";
  }).join("")||'<div class="empty">No task</div>';
}
function renderAgents(){
  $("agentList").innerHTML=db.agents.map(function(a){return '<div class="card"><div class="row"><span class="name"><span class="dot" style="background:'+(a.color||"#8aa0b8")+'"></span>'+esc(a.display_name)+'</span><span class="muted">'+sl(a.status)+'</span></div><div class="muted">'+esc(a.role)+" · "+esc(a.capability)+'</div><div class="muted">Task: '+esc(a.current_task_id||"-")+'</div><div class="muted">Action: '+esc(a.current_action||"waiting")+"</div></div>";}).join("");
}
function renderPool(){
  var task=cur(); if(!task){$("pool").innerHTML='<div class="empty">No task selected</div>';return;}
  var filter=$("filterType").value;
  var all=db.messages.filter(function(m){return m.task_id===task.task_id;});
  var msgs=all.filter(function(m){return !filter||m.message_type===filter;}).sort(function(a,b){return a.created_at.localeCompare(b.created_at);});
  $("poolMeta").textContent=task.task_id+" · "+msgs.length+" shown / "+all.length+" total · no auto agent replies";
  if(!msgs.length){$("pool").innerHTML='<div class="empty">Pool is empty. No generated agent dialogue, fake tests, or fake commits.</div>';return;}
  $("pool").innerHTML=msgs.map(function(m){
    var from=m.sender_agent_id==="owner"?"Owner":((ag(m.sender_agent_id)||{}).display_name||m.sender_agent_id);
    var to=!m.receiver_agent_id?"ALL":((ag(m.receiver_agent_id)||{}).display_name||m.receiver_agent_id);
    var refs=db.code_refs.filter(function(r){return r.message_id===m.message_id;});
    var proxy=m.owner_proxy?'<div class="proxy">OWNER_PROXY / DEMO / NOT CONNECTED</div>':"";
    return '<article class="msg"><div class="meta"><span class="tag '+m.message_type+'">'+m.message_type+"</span><b>"+esc(from)+"</b> -> "+esc(to)+" · "+new Date(m.created_at).toLocaleString()+"</div>"+proxy+"<div>"+hi(m.content)+"</div>"+refs.map(refHTML).join("")+"</article>";
  }).join("");
}
function renderRight(){
  var task=cur(); if(!task) return;
  var g=db.gates[task.task_id]||db.gates[task.parent_task_id]||{};
  var root=task.parent_task_id||task.task_id;
  $("gates").innerHTML=GATES.map(function(k){var st=g[k[0]]||{state:"not_started",note:""};return '<div class="gate"><span>'+k[1]+"</span>"+gd(st.state)+"</div>"+(st.note?'<div class="muted">'+esc(st.note)+"</div>":"");}).join("");
  var subs=db.tasks.filter(function(t){return t.parent_task_id===root;});
  $("subs").innerHTML=subs.length?'<div class="tree">'+subs.map(function(s){return "- "+esc(s.task_id)+" "+esc(s.name)+" / "+esc(s.status)+" / "+((s.members||[]).join(", ")||"unassigned");}).join("<br>")+"</div>":'<div class="muted">No subtask</div>';
  var codes=db.code_refs.filter(function(r){return r.task_id===task.task_id||r.task_id===root;});
  $("codes").innerHTML=codes.length?codes.map(function(r){return '<div class="card">'+refHTML(r)+"</div>";}).join(""):'<div class="muted">No code ref</div>';
  var revs=db.reviews.filter(function(r){return r.task_id===task.task_id||r.task_id===root;});
  $("reviews").innerHTML=revs.length?revs.map(function(r){return '<div class="card"><div class="row"><span>'+esc(r.finding_id||r.review_id)+"</span><span>"+esc(r.verdict)+"</span></div><div>"+esc(r.summary)+'</div><div class="btn-row"><button class="btn" data-verdict="pass" data-review="'+r.review_id+'">PASS</button><button class="btn" data-verdict="need_fix" data-review="'+r.review_id+'">NEED FIX</button><button class="btn" data-verdict="reject" data-review="'+r.review_id+'">REJECT</button></div></div>';}).join(""):'<div class="muted">No review</div>';
  var tests=db.tests.filter(function(t){return t.task_id===task.task_id||t.task_id===root;});
  $("tests").innerHTML=tests.length?tests.map(function(t){return '<div class="card"><div class="row"><span>'+esc(t.suite)+'</span><span class="fail">'+esc(t.result)+"</span></div><div class=\"muted\">"+esc(t.detail||"")+"</div></div>";}).join(""):'<div class="muted">No test record</div>';
  var learn=db.learning.filter(function(x){return x.task_id===task.task_id||x.task_id===root;});
  $("learn").innerHTML=learn.length?learn.map(function(x){return '<div class="card">'+esc(x.summary)+'<div class="muted">candidate · not promoted</div></div>';}).join(""):'<div class="muted">No learning candidate. Messages are not Dark Star memory.</div>';
}
function touch(){var t=cur();if(!t)return;t.updated_at=now();t.last_activity_at=now();}
function act(type,p){db.actions.push({action_id:uid("act"),task_id:db.selected,actor_id:"owner",action_type:type,payload:p||{},created_at:now()});}
function post(content,type,to){var task=cur();db.messages.push({message_id:uid("msg"),task_id:task.task_id,sender_agent_id:"owner",receiver_agent_id:to||null,mentions:to?[to]:[],message_type:type||"OWNER",content:content,reply_to:null,status:"posted",owner_proxy:false,created_at:now()});}
function render(){fill();renderTasks();renderAgents();renderPool();renderRight();save();}
$("taskList").onclick=function(e){var c=e.target.closest("[data-task]");if(!c)return;db.selected=c.getAttribute("data-task");render();};
$("mentionChips").onclick=function(e){var c=e.target.closest("[data-chip]");if(!c)return;$("msgBody").value=($("msgBody").value?$("msgBody").value+" ":"")+c.getAttribute("data-chip")+" ";};
$("filterType").onchange=render;
$("btnNewTask").onclick=function(){var name=prompt("Task name");if(!name)return;var id=uid("task"),gates={};GATES.forEach(function(k){gates[k[0]]={state:"not_started",note:""};});db.tasks.push({task_id:id,parent_task_id:null,name:name,status:"draft",current_gate:"gate1",progress_note:"Owner created. No agent auto-run.",created_by:"owner",created_at:now(),updated_at:now(),last_activity_at:now(),members:db.agents.map(function(a){return a.agent_id;})});db.gates[id]=gates;db.selected=id;act("create_task",{name:name});render();};
$("btnAddAgent").onclick=function(){var id=$("newAgentId").value.trim().toLowerCase().replace(/[^a-z0-9_-]/g,"");var name=$("newAgentName").value.trim();if(!id||!name)return;if(db.agents.some(function(a){return a.agent_id===id;})){alert("exists");return;}db.agents.push({agent_id:id,display_name:name,role:$("newAgentRole").value.trim()||"agent",capability:$("newAgentCap").value.trim()||"",color:"#8aa0b8",status:"waiting",current_task_id:null,current_action:"",last_activity_at:null});act("add_agent",{agent_id:id});render();};
$("btnSend").onclick=function(){var task=cur();if(!task)return;if(db.paused&&$("msgType").value!=="OWNER"){alert("paused");return;}var content=$("msgBody").value.trim();if(!content)return;var as=$("msgAs").value,ms=mentions(content);var msg={message_id:uid("msg"),task_id:task.task_id,sender_agent_id:as,receiver_agent_id:$("msgTo").value||ms[0]||null,mentions:ms,message_type:$("msgType").value,content:content,reply_to:$("replyTo").value.trim()||null,status:"posted",owner_proxy:as!=="owner",created_at:now()};db.messages.push(msg);var path=$("codePath").value.trim(),sha=$("codeSha").value.trim();if(path)db.code_refs.push({ref_id:uid("ref"),task_id:task.task_id,message_id:msg.message_id,file_path:path,commit_sha:sha||null,repo:"m9wmtcb782-arch/AIVAULT",created_by:as,created_at:now()});if($("asLearning").checked)db.learning.push({candidate_id:uid("learn"),task_id:task.task_id,message_id:msg.message_id,source_agent_id:as,summary:content.slice(0,240),verification_status:"candidate",promoted:false,created_at:now()});if(as!=="owner"){var a=ag(as);if(a){a.last_activity_at=now();a.current_task_id=task.task_id;a.current_action=$("msgType").value;}}$("msgBody").value=$("codePath").value=$("codeSha").value="";$("asLearning").checked=false;touch();act("post_message",{message_id:msg.message_id});render();};
$("btnReviewReq").onclick=function(){var task=cur();if(!task)return;var summary=$("msgBody").value.trim()||prompt("Review finding");if(!summary)return;var assigned=$("msgTo").value||"grok";var review={review_id:uid("rev"),task_id:task.task_id,finding_id:"F-"+String(db.reviews.length+1).padStart(3,"0"),requested_by:"owner",assigned_to:assigned,verdict:"requested",summary:summary,created_at:now(),updated_at:now()};db.reviews.push(review);post("REVIEW REQUEST "+review.finding_id+": "+summary,"REVIEW",assigned);touch();act("review_request",{});render();};
$("reviews").onclick=function(e){var btn=e.target.closest("[data-review]");if(!btn)return;var r=db.reviews.find(function(x){return x.review_id===btn.getAttribute("data-review");});if(!r)return;r.verdict=btn.getAttribute("data-verdict");var type=r.verdict==="pass"?"PASS":r.verdict==="reject"?"FAIL":"REVIEW";post("REVIEW "+r.finding_id+" = "+r.verdict.toUpperCase(),type,r.assigned_to);touch();render();};
document.body.addEventListener("click",function(e){var ask=e.target.closest("[data-ask-review]");if(!ask)return;var ref=db.code_refs.find(function(r){return r.ref_id===ask.getAttribute("data-ask-review");});if(!ref)return;$("msgType").value="REVIEW";$("msgBody").value="@Architect please review "+ref.file_path;$("codePath").value=ref.file_path;$("codeSha").value=ref.commit_sha||"";});
$("btnSubtask").onclick=function(){var task=cur();if(!task)return;var parent=task.parent_task_id?db.tasks.find(function(t){return t.task_id===task.parent_task_id;}):task;var name=prompt("Subtask name");if(!name)return;var n=db.tasks.filter(function(t){return t.parent_task_id===parent.task_id;}).length+1;var id=parent.task_id+"-"+String.fromCharCode(64+n);db.tasks.push({task_id:id,parent_task_id:parent.task_id,name:name,status:"open",current_gate:parent.current_gate,progress_note:"Owner created.",created_by:"owner",created_at:now(),updated_at:now(),last_activity_at:now(),members:$("msgTo").value?[$("msgTo").value]:[]});touch();render();};
$("btnTest").onclick=function(){var task=cur();if(!task)return;var suite=prompt("Test suite","online_integration");if(!suite)return;var result=prompt("Result","NOT_RUN");if(!result)return;var detail=prompt("Detail","Not executed.")||"";db.tests.push({test_id:uid("test"),task_id:task.task_id,suite:suite,result:result,detail:detail,created_by:"owner",created_at:now()});post("TEST "+suite+" = "+result+". "+detail,"TEST");touch();render();};
document.querySelectorAll("[data-own]").forEach(function(btn){btn.onclick=function(){var task=cur();if(!task)return;var a=btn.getAttribute("data-own");if(a==="start"){db.paused=false;task.status="working";task.progress_note="Owner started workspace. Agents waiting; no auto calls.";db.agents.forEach(function(x){if((task.members||[]).indexOf(x.agent_id)>=0){x.status="waiting";x.current_task_id=task.task_id;x.current_action="assigned, not auto-running";}});}if(a==="pause"){db.paused=true;task.status="paused";}if(a==="rereview")task.status="review";if(a==="approve_change")db.decisions.push({decision_id:uid("dec"),task_id:task.task_id,decision_type:"approve_change",actor_id:"owner",owner_required:true,approved:true,note:"local only",created_at:now()});if(a==="reject"){task.status="blocked";db.decisions.push({decision_id:uid("dec"),task_id:task.task_id,decision_type:"reject",actor_id:"owner",owner_required:true,approved:false,note:"rejected locally",created_at:now()});}if(a==="approve_gate"){var key=task.current_gate||"gate1";if(key==="production"){alert("Production cannot pass via approve gate");return;}var g=db.gates[task.task_id]||db.gates[task.parent_task_id];if(g&&g[key]){g[key].state="waiting";g[key].note="local intent only";}db.decisions.push({decision_id:uid("dec"),task_id:task.task_id,decision_type:"approve_gate",actor_id:"owner",owner_required:true,approved:true,note:"does not deploy",created_at:now()});}if(a==="approve_prod"){if(!confirm("Record production intent? This page will not deploy. Gate stays BLOCKED."))return;db.decisions.push({decision_id:uid("dec"),task_id:task.task_id,decision_type:"approve_production",actor_id:"owner",owner_required:true,approved:false,note:"PRODUCTION NOT DEPLOYED",created_at:now()});}post("OWNER_ACTION "+a,"OWNER");touch();act("owner_"+a,{});render();};});
$("btnExport").onclick=function(){var a=document.createElement("a");a.href=URL.createObjectURL(new Blob([JSON.stringify(db,null,2)],{type:"application/json"}));a.download="aivault-collab-v0.1.json";a.click();};
$("btnReset").onclick=function(){if(!confirm("Reset local Collaboration Pool?"))return;localStorage.removeItem(LS);db=empty();render();};
$("tabs").onclick=function(e){var b=e.target.closest("[data-pane]");if(!b)return;var pane=b.getAttribute("data-pane");["left","mid","right"].forEach(function(p){$("pane-"+p).style.display=p===pane?"block":"none";});};
if(window.matchMedia("(max-width:980px)").matches){$("pane-left").style.display="block";$("pane-mid").style.display="none";$("pane-right").style.display="none";}
render();
})();
