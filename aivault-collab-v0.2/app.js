/* AIVAULT Agent Collaboration Pool v0.3
 * Restores the missing v0.2 runtime and binds the existing UI.
 * Additive only: no Gateway/Dark Star core/Compute Mesh changes.
 */
(function(root){
  'use strict';
  const KEY='AIVAULT_COLLAB_V02';
  const AGENTS=[
    {agent_id:'chatgpt',display_name:'ChatGPT / Codex',role:'Architect',capability:'architecture / review / gate',abilities:'architecture,review,gate',status:'WAITING',connection_status:'not_connected',color:'#5ec8ff'},
    {agent_id:'grok',display_name:'Grok',role:'Builder',capability:'coding / implementation',abilities:'coding,implementation',status:'WAITING',connection_status:'not_connected',color:'#e0b14a'},
    {agent_id:'gemini',display_name:'Gemini',role:'Researcher',capability:'research / analysis',abilities:'research,analysis',status:'WAITING',connection_status:'not_connected',color:'#8b7dff'},
    {agent_id:'darkstar',display_name:'Technical Dark Star',role:'Engineer',capability:'engineering / testing / learning',abilities:'engineering,testing,learning',status:'WAITING',connection_status:'not_connected',color:'#3dcc8a'},
    {agent_id:'auditor',display_name:'Auditor',role:'Auditor',capability:'security / compliance / risk',abilities:'security,compliance,risk',status:'WAITING',connection_status:'not_connected',color:'#e85d5d'}
  ];
  const TYPES=['MESSAGE','CODE','REVIEW_REQUEST','REVIEW','FIX','TEST','PASS','FAIL','WARNING','QUESTION','ANSWER','DECISION','GATE','OWNER','SYSTEM'];
  const STATUS=['DRAFT','READY','RUNNING','WAITING','REVIEW','FIXING','TESTING','GATE','COMPLETED','BLOCKED','PAUSED'];
  const now=()=>new Date().toISOString();
  const id=(p)=>p+'-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7);
  const clone=x=>JSON.parse(JSON.stringify(x));
  const empty=()=>({agents:clone(AGENTS),tasks:[],members:[],subtasks:[],messages:[],actions:[],codes:[],reviews:[],tests:[],decisions:[],gates:[],learning:[],events:[]});
  class MemoryAdapter{
    constructor(seed){this.data=seed?clone(seed):empty();}
    load(){return clone(this.data);}
    save(d){this.data=clone(d);return this.load();}
  }
  class LocalAdapter extends MemoryAdapter{
    constructor(){super();try{const x=root.localStorage&&root.localStorage.getItem(KEY);this.data=x?JSON.parse(x):empty();}catch(e){this.data=empty();}}
    save(d){this.data=clone(d);try{root.localStorage&&root.localStorage.setItem(KEY,JSON.stringify(this.data));}catch(e){}return this.load();}
  }
  class SupabaseAdapter extends MemoryAdapter{
    constructor(url,key){super();this.url=(url||'').replace(/\/$/,'');this.key=key||'';this.connected=!!(this.url&&this.key);}
    async table(name,query=''){if(!this.connected)throw Error('NOT_CONNECTED');const r=await fetch(this.url+'/rest/v1/'+name+'?'+query,{headers:{apikey:this.key,Authorization:'Bearer '+this.key}});if(!r.ok)throw Error(name+' '+r.status+' '+await r.text());return r.json();}
    async loadLive(){if(!this.connected)throw Error('NOT_CONNECTED');const d=empty();const maps={agents:'agent_registry',tasks:'agent_tasks',members:'agent_task_members',subtasks:'agent_subtasks',messages:'agent_messages',actions:'agent_actions',codes:'agent_code_refs',reviews:'agent_reviews',tests:'agent_test_results',decisions:'agent_decisions',gates:'agent_task_gates',learning:'agent_learning_candidates',events:'agent_events'};for(const k of Object.keys(maps)){try{d[k]=await this.table(maps[k],'select=*');}catch(e){d[k]=[];}}this.data=d;return this.load();}
  }
  class Engine{
    constructor(adapter){this.adapter=adapter||new MemoryAdapter();this.data=this.adapter.load();}
    persist(){return this.adapter.save(this.data);}
    agent(a){return this.data.agents.find(x=>x.agent_id===a)||null;}
    task(t){return this.data.tasks.find(x=>x.task_id===t)||null;}
    event(type,actor,payload,task_id){this.data.events.push({event_id:id('evt'),task_id:task_id||null,event_type:type,actor_id:actor||'owner',payload:payload||{},created_at:now()});}
    addAgent(agent){if(!agent.agent_id)throw Error('agent_id required');if(this.agent(agent.agent_id))return this.agent(agent.agent_id);const a=Object.assign({display_name:agent.agent_id,role:'agent',capability:'',abilities:'',status:'WAITING',connection_status:'not_connected',color:'#8aa0b8'},agent);this.data.agents.push(a);this.event('AGENT_ASSIGNED','owner',{agent_id:a.agent_id});this.persist();return a;}
    createTask(o){const t=Object.assign({task_id:id('task'),parent_task_id:null,title:'',name:'Untitled Task',description:'',owner_id:'owner',status:'DRAFT',priority:'NORMAL',current_gate:'g1_architecture',progress:'',progress_note:'',contract_id:null,created_by:'owner',created_at:now(),updated_at:now(),last_activity_at:now()},o||{});if(this.task(t.task_id))throw Error('duplicate task');this.data.tasks.push(t);this.event('TASK_CREATED',t.created_by,{task_id:t.task_id},t.task_id);this.persist();return t;}
    assign(task_id,agent_id){if(!this.task(task_id)||!this.agent(agent_id))throw Error('task/agent missing');if(!this.data.members.some(x=>x.task_id===task_id&&x.agent_id===agent_id))this.data.members.push({task_id,agent_id,assigned_at:now()});const a=this.agent(agent_id);a.status='ASSIGNED';a.current_task_id=task_id;this.event('AGENT_ASSIGNED','owner',{task_id,agent_id},task_id);this.persist();return a;}
    subtask(task_id,agent_id,description){const s={subtask_id:id('sub'),parent_task_id:task_id,assigned_agent:agent_id||null,status:'DRAFT',description:description||'',result:null,created_at:now(),updated_at:now()};this.data.subtasks.push(s);this.event('SUBTASK_CREATED','owner',{subtask_id:s.subtask_id},task_id);this.persist();return s;}
    message(task_id,sender,content,type,receiver,meta){const m=Object.assign({message_id:id('msg'),task_id,sender_agent_id:sender||'owner',receiver_agent_id:receiver||null,message_type:type||'MESSAGE',content:content||'',reply_to:null,status:'posted',action:null,evidence:null,decision_id:null,review_id:null,test_id:null,code_ref_id:null,gate_id:null,mentions:[],owner_proxy:sender!=='owner',created_at:now()},meta||{});this.data.messages.push(m);this.event('MESSAGE_POSTED',sender,{message_id:m.message_id,type:m.message_type},task_id);this.persist();return m;}
    review(task_id,reviewer,target,status,findings){const r={review_id:id('rev'),task_id,reviewer_agent_id:reviewer||null,target_agent_id:target||null,status:status||'PENDING',findings:findings||'',required_changes:'',created_at:now(),resolved_at:status&&status!=='PENDING'?now():null,finding_id:null,requested_by:'owner'};this.data.reviews.push(r);this.event(status==='PENDING'?'REVIEW_REQUESTED':'REVIEW_COMPLETED',reviewer||'owner',{review_id:r.review_id,status:r.status},task_id);this.persist();return r;}
    action(task_id,agent_id,type,input){const a={action_id:id('act'),task_id,agent_id,action_type:type,input:input||'',output:null,status:'WAITING',started_at:null,completed_at:null,evidence:null,created_at:now()};this.data.actions.push(a);this.event('ACTION_CREATED',agent_id,{action_id:a.action_id},task_id);this.persist();return a;}
    code(task_id,agent_id,path,sha,branch){const c={code_ref_id:id('code'),task_id,agent_id:agent_id||null,repository:'m9wmtcb782-arch/AIVAULT',branch:branch||'main',file_path:path,commit_hash:sha||null,diff_url:null,message_id:null,created_at:now()};this.data.codes.push(c);this.event('CODE_SUBMITTED',agent_id||'owner',{code_ref_id:c.code_ref_id,file_path:path},task_id);this.persist();return c;}
    test(task_id,agent_id,result,status,evidence){const t={test_id:id('test'),task_id,agent_id:agent_id||null,test_type:'manual',command:'',result:result||'',status:status||'NOT_RUN',evidence:evidence||'',created_at:now()};this.data.tests.push(t);this.event('TEST_COMPLETED',agent_id||'owner',{test_id:t.test_id,status:t.status},task_id);this.persist();return t;}
    decision(task_id,agent,type,proposal,reason,owner_only){const d={decision_id:id('dec'),task_id,agent_id:agent||'owner',decision_type:type||'DECISION',proposal:proposal||'',alternatives:'',reason:reason||'',evidence:'',owner_only:!!owner_only,approved:null,created_at:now()};this.data.decisions.push(d);this.event('DECISION_CREATED',agent||'owner',{decision_id:d.decision_id},task_id);this.persist();return d;}
    gate(task_id,key,state,note){const g={task_id,gate_key:key,state:state||'NOT_STARTED',note:note||'',updated_at:now()};const i=this.data.gates.findIndex(x=>x.task_id===task_id&&x.gate_key===key);if(i>=0)this.data.gates[i]=g;else this.data.gates.push(g);this.event('GATE_CHANGED','owner',g,task_id);this.persist();return g;}
    learning(task_id,source,problem,proposals,reason){const l={candidate_id:id('learn'),task_id,message_id:null,source_agent_id:source,problem:problem||'',proposals:proposals||'',debate:'',counter_arguments:'',chosen_solution:'',reason:reason||'',code_changes:'',tests:'',errors:'',corrections:'',architect_decision:'',evidence:'',verification_status:'candidate',promoted:false,created_at:now()};this.data.learning.push(l);this.event('LEARNING_CANDIDATE',source,{candidate_id:l.candidate_id},task_id);this.persist();return l;}
    owner(task_id,action){const t=this.task(task_id);if(!t)return null;const map={start:'RUNNING',pause:'PAUSED',resume:'RUNNING',rereview:'REVIEW',approve_change:'FIXING',reject:'BLOCKED',approve_gate:'GATE',approve_prod:'COMPLETED'};if(map[action])t.status=map[action];t.updated_at=now();this.event('TASK_STATUS','owner',{action,status:t.status},task_id);this.persist();return t;}
    runAcceptance(){const e=new Engine(new MemoryAdapter()),out=[];const ok=(name,fn)=>{try{fn();out.push({ok:true,name,detail:'PASS'});}catch(x){out.push({ok:false,name,detail:x.message});}};const t=e.createTask({task_id:'accept-task',name:'Acceptance Task'});ok('Test 1 create Task',()=>{if(!e.task(t.task_id))throw Error('missing');});ok('Test 2 Assign Grok',()=>e.assign(t.task_id,'grok'));ok('Test 3 Assign Dark Star',()=>e.assign(t.task_id,'darkstar'));ok('Test 4 Grok Message → Pool',()=>{const m=e.message(t.task_id,'grok','implementation ready','MESSAGE');if(!m.owner_proxy)throw Error('proxy flag');});ok('Test 5 Dark Star Reply → Pool',()=>e.message(t.task_id,'darkstar','technical reply','ANSWER'));ok('Test 6 @ChatGPT Review',()=>e.review(t.task_id,'chatgpt','grok','PENDING','review requested'));ok('Test 7 Review → NEED_FIX',()=>e.review(t.task_id,'chatgpt','grok','NEED_FIX','fix required'));ok('Test 8 Grok → FIX',()=>e.message(t.task_id,'grok','fix applied','FIX'));ok('Test 9 Dark Star → TEST',()=>{const x=e.test(t.task_id,'darkstar','not run','NOT_RUN');if(x.status==='PASS')throw Error('fake pass');});ok('Test 10 Test → PASS',()=>e.test(t.task_id,'owner','owner verified','PASS'));ok('Test 11 Architect → Review',()=>e.action(t.task_id,'chatgpt','REVIEW','architecture'));ok('Test 12 Gate → WAITING',()=>e.gate(t.task_id,'g3_verification','WAITING'));ok('Test 13 Owner → Approve Gate',()=>e.gate(t.task_id,'g3_verification','PASS','owner approved'));ok('Test 14 Events traceable',()=>{if(e.data.events.length<8)throw Error('events missing');});ok('Test 15 Reload persistence',()=>{const a=new MemoryAdapter(e.data);const x=new Engine(a);if(!x.task('accept-task'))throw Error('reload missing');});return out;}
  }
  root.AIVAULT_COLLAB={Engine,MemoryAdapter,LocalAdapter,SupabaseAdapter,constants:{KEY,AGENTS,TYPES,STATUS}};
  function boot(){
    if(!root.document)return;
    let engine=new Engine(new LocalAdapter());
    let selected=(engine.data.tasks[0]||engine.createTask({task_id:'task-demo',name:'AIVAULT Collaboration Demo',title:'AI Alliance Collaboration'})).task_id;
    const $=id=>root.document.getElementById(id);
    const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    function task(){return engine.task(selected)}
    function render(){
      const tasks=engine.data.tasks; $('taskList').innerHTML=tasks.map(t=>`<div class="card ${t.task_id===selected?'active':''}" data-task="${esc(t.task_id)}"><div class="row"><span class="name">${esc(t.title||t.name)}</span><span class="status ${t.status==='COMPLETED'?'ok':t.status==='BLOCKED'?'fail':'wait'}">${esc(t.status)}</span></div><div class="muted">${esc(t.task_id)} · ${esc(t.priority)}</div></div>`).join('')||'<div class="empty">尚無 Task</div>';
      root.document.querySelectorAll('[data-task]').forEach(x=>x.onclick=()=>{selected=x.dataset.task;render();});
      $('agentList').innerHTML=engine.data.agents.map(a=>`<div class="card"><div class="row"><span class="name">${esc(a.display_name)}</span><span class="status ${a.status==='WORKING'?'ok':'idle'}">${esc(a.status)}</span></div><div class="muted">${esc(a.role)} · ${esc(a.connection_status)}</div><div class="muted">${esc(a.capability)}</div></div>`).join('');
      $('msgType').innerHTML=TYPES.map(x=>`<option>${x}</option>`).join('');
      $('msgAs').innerHTML='<option value="owner">Owner</option>'+engine.data.agents.map(a=>`<option value="${esc(a.agent_id)}">${esc(a.display_name)}</option>`).join('');
      $('msgTo').innerHTML='<option value="">廣播 / 不指定</option>'+engine.data.agents.map(a=>`<option value="${esc(a.agent_id)}">${esc(a.display_name)}</option>`).join('');
      $('filterType').innerHTML='<option value="">全部類型</option>'+TYPES.map(x=>`<option>${x}</option>`).join('');
      $('pool').innerHTML=(engine.data.messages.filter(m=>m.task_id===selected&&(!$('filterType').value||m.message_type===$('filterType').value)).slice().reverse().map(m=>`<div class="msg"><div class="meta"><span class="tag ${esc(m.message_type)}">${esc(m.message_type)}</span>${esc((engine.agent(m.sender_agent_id)||{}).display_name||m.sender_agent_id)} → ${esc((engine.agent(m.receiver_agent_id)||{}).display_name||m.receiver_agent_id||'Pool')} · ${esc(m.created_at)}</div><div>${esc(m.content)}</div>${m.owner_proxy?'<div class="muted">OWNER_PROXY · agent action is recorded, not fabricated as external execution</div>':''}</div>`).join(''))||'<div class="empty">尚無工作紀錄</div>';
      const gates=engine.data.gates.filter(g=>g.task_id===selected);$('gates').innerHTML=(gates.map(g=>`<div class="gate"><span>${esc(g.gate_key)}</span><span>${esc(g.state)}</span></div>`).join(''))||'<div class="muted">尚無 Gate</div>';
      $('subs').innerHTML=engine.data.subtasks.filter(s=>s.parent_task_id===selected).map(s=>`<div class="card"><b>${esc(s.subtask_id)}</b><div class="muted">${esc(s.assigned_agent||'unassigned')} · ${esc(s.status)}</div>${esc(s.description)}</div>`).join('')||'<div class="muted">尚無 Subtask</div>';
      $('codes').innerHTML=engine.data.codes.filter(c=>c.task_id===selected).map(c=>`<div class="card"><b>${esc(c.file_path)}</b><div class="muted">${esc(c.branch)} · ${esc(c.commit_hash||'NOT AVAILABLE')}</div></div>`).join('')||'<div class="muted">尚無 Code Ref</div>';
      $('reviews').innerHTML=engine.data.reviews.filter(r=>r.task_id===selected).map(r=>`<div class="card"><b>${esc(r.status)}</b><div class="muted">${esc(r.reviewer_agent_id)} → ${esc(r.target_agent_id)}</div>${esc(r.findings)}</div>`).join('')||'<div class="muted">尚無 Review</div>';
      $('tests').innerHTML=engine.data.tests.filter(t=>t.task_id===selected).map(t=>`<div class="card"><b>${esc(t.status)}</b><div class="muted">${esc(t.agent_id)} · ${esc(t.test_type)}</div>${esc(t.result)}</div>`).join('')||'<div class="muted">尚無 Test</div>';
      $('actions').innerHTML=engine.data.actions.filter(a=>a.task_id===selected).map(a=>`<div class="card"><b>${esc(a.action_type)}</b><div class="muted">${esc(a.agent_id)} · ${esc(a.status)}</div></div>`).join('')||'<div class="muted">尚無 Action</div>';
      $('events').innerHTML=engine.data.events.filter(e=>e.task_id===selected).slice(-15).reverse().map(e=>`<div class="muted">${esc(e.created_at)} · ${esc(e.event_type)} · ${esc(e.actor_id)}</div>`).join('')||'<div class="muted">尚無 Event</div>';
      $('learn').innerHTML=engine.data.learning.filter(l=>l.task_id===selected).map(l=>`<div class="card"><b>candidate</b><div>${esc(l.problem)}</div><div class="muted">promoted=${esc(l.promoted)}</div></div>`).join('')||'<div class="muted">尚無 Learning Candidate</div>';
      $('poolMeta').textContent=`目前 Task：${task()?task().name:selected} · ${engine.data.messages.filter(m=>m.task_id===selected).length} 筆協作紀錄`;
    }
    $('btnNewTask').onclick=()=>{const t=engine.createTask({name:prompt('Task 名稱','新的 AI 協作任務')||'新的 AI 協作任務',title:'新的 AI 協作任務'});selected=t.task_id;render();};
    $('btnAddAgent').onclick=()=>{const a=engine.addAgent({agent_id:$('newAgentId').value.trim(),display_name:$('newAgentName').value.trim()||$('newAgentId').value.trim(),role:$('newAgentRole').value.trim()||'agent',capability:$('newAgentCap').value.trim()||''});$('newAgentId').value='';$('newAgentName').value='';$('newAgentRole').value='';$('newAgentCap').value='';render();};
    $('btnSend').onclick=()=>{const body=$('msgBody').value.trim();if(!body)return;engine.message(selected,$('msgAs').value,body,$('msgType').value,$('msgTo').value||null,{mentions:(body.match(/@[A-Za-z0-9_-]+/g)||[]).map(x=>x.slice(1))});if($('asLearning').checked)engine.learning(selected,$('msgAs').value,$('learnProblem').value,$('learnProposal').value,$('learnReason').value);$('msgBody').value='';render();};
    $('btnReviewReq').onclick=()=>{engine.review(selected,$('msgAs').value==='owner'?'chatgpt':$('msgAs').value,$('msgTo').value||null,'PENDING','Owner requested review');render();};
    $('btnSubtask').onclick=()=>{engine.subtask(selected,$('msgTo').value||null,'由 Owner 建立的協作子任務');render();};
    $('btnTest').onclick=()=>{engine.test(selected,$('msgAs').value,'Test record created','NOT_RUN','尚未執行；不得偽造 PASS');render();};
    $('btnDecision').onclick=()=>{engine.decision(selected,$('msgAs').value,'DECISION',$('msgBody').value||'待決策方案','協作池決策紀錄',true);render();};
    $('filterType').onchange=render;
    root.document.querySelectorAll('[data-own]').forEach(b=>b.onclick=()=>{engine.owner(selected,b.dataset.own);render();});
    root.document.querySelectorAll('[data-pane]').forEach(b=>b.onclick=()=>root.document.getElementById('pane-'+b.dataset.pane).scrollIntoView({behavior:'smooth'}));
    $('btnExport').onclick=()=>{const blob=new Blob([JSON.stringify(engine.data,null,2)],{type:'application/json'});const a=root.document.createElement('a');a.href=URL.createObjectURL(blob);a.download='aivault-collaboration-'+Date.now()+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500);};
    $('btnReloadDb').onclick=()=>{engine=new Engine(new LocalAdapter());selected=(engine.data.tasks[0]||selected).task_id||selected;render();$('connNote').textContent='LOCAL STORE LOADED';};
    $('btnConnect').onclick=async()=>{const url=$('sbUrl').value.trim(),key=$('sbKey').value.trim();if(!url||!key){$('connNote').textContent='請提供 TEST Supabase URL + anon key';return;}try{const ad=new SupabaseAdapter(url,key);const d=await ad.loadLive();engine=new Engine(new MemoryAdapter(d));selected=(engine.data.tasks[0]||{}).task_id||selected;engine.data.agents.forEach(a=>a.connection_status='connected');$('badgeConn').textContent='SUPABASE CONNECTED';$('badgeConn').className='badge';$('connNote').textContent='LIVE ROWS LOADED · CLIENT USES ANON KEY ONLY';render();}catch(e){$('connNote').textContent='連線失敗：'+e.message;}};
    render();
  }
  if(root.document)root.document.readyState==='loading'?root.document.addEventListener('DOMContentLoaded',boot):boot();
})(typeof globalThis!=='undefined'?globalThis:this);
