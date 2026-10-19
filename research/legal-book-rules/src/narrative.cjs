'use strict';
// Delimiters and offsets are kept in the user's original UTF-16 text.
function splitOutside(text, delimiters) {
  const pairs=new Map([['「','」'],['『','』'],['“','”'],['‘','’'],['（','）'],['(',')'],['【','】'],['[',']']]);
  const stack=[],rows=[];let ascii=false,start=0;
  for(let i=0;i<text.length;i++){
    const c=text[i];if(c==='"')ascii=!ascii;
    if(!ascii){if(pairs.has(c))stack.push(pairs.get(c));else if(stack[stack.length-1]===c)stack.pop();}
    if(!ascii&&!stack.length&&delimiters.includes(c)){rows.push({start,end:i+1,text:text.slice(start,i+1)});start=i+1;}
  }
  if(start<text.length)rows.push({start,end:text.length,text:text.slice(start)});
  return rows;
}
function narrativeClauses(text){
  const rows=[];
  for(const sentence of splitOutside(text,'。；;\n')){
    // Conditional, interrogative and quoted text stays in its whole scope.
    const guarded=/[?？「」『』“”"!！]|如果|假如|假設|假设|除非|只要|只有|若|即使|即便|倘|一旦/u.test(sentence.text);
    if(guarded){rows.push({...sentence,sentenceStart:sentence.start,guarded:true});continue;}
    for(const clause of splitOutside(sentence.text,'，,'))rows.push({start:sentence.start+clause.start,end:sentence.start+clause.end,sentenceStart:sentence.start,text:clause.text,guarded:false});
  }
  return rows;
}
function createResolver(subjectAliases,roles=[]){
  if(!Array.isArray(subjectAliases)||!subjectAliases.length||subjectAliases.length>12||subjectAliases.some(a=>typeof a!=='string'||a.length<2||a.length>40)||new Set(subjectAliases).size!==subjectAliases.length)throw Error('INVALID_SUBJECT_ALIASES');
  if(!Array.isArray(roles)||roles.length>8)throw Error('INVALID_NARRATIVE_ROLES');
  const states=roles.map(r=>{
    if(!r||typeof r.canonical!=='string'||!subjectAliases.includes(r.canonical)||!Array.isArray(r.aliases)||!Array.isArray(r.references)||!r.aliases.length||r.aliases.length>12||r.aliases.some(a=>!subjectAliases.includes(a))||r.references.length>12||[...r.aliases,...r.references].some(a=>typeof a!=='string'||a.length<2||a.length>40))throw Error('INVALID_NARRATIVE_ROLE');
    return{...r,active:false,names:new Set(),bindings:[],antecedents:[]};
  });
  const canonicalIds=new Set(),surfaces=new Map();
  for(const state of states){
    if(canonicalIds.has(state.canonical))throw Error('AMBIGUOUS_NARRATIVE_ROLE');canonicalIds.add(state.canonical);
    for(const surface of [...state.aliases,...state.references]){
      if(surfaces.has(surface)&&surfaces.get(surface)!==state.canonical)throw Error('AMBIGUOUS_NARRATIVE_ROLE');surfaces.set(surface,state.canonical);
      if(subjectAliases.includes(surface)&&!state.aliases.includes(surface)&&surface!==state.canonical)throw Error('AMBIGUOUS_NARRATIVE_ROLE');
    }
  }
  const esc=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  function bind(compact,origin){
    if(/不是|並非|并非|不為|不为/u.test(compact))return{matched:false};
    for(const state of states)for(const alias of state.aliases){
      const forward=compact.match(new RegExp('^'+esc(alias)+'(?:名為|名为|名稱為|名称为)([\\p{Script=Han}A-Za-z0-9]{2,30})$','u'));
      const reverse=compact.match(new RegExp('^([\\p{Script=Han}A-Za-z0-9]{2,30})(?:是|為|为)'+esc(alias)+'$','u'));
      const name=(forward||reverse)?.[1];if(!name)continue;
      // Ambiguous/conditional definitions are never silently accepted as identity.
      if(/可能|不是|未必|是否|不一定|假如|如果|公行政|私行政/u.test(name))return{matched:false};
      state.active=true;state.names.add(name);state.bindings.push({...origin,name,canonical:state.canonical});
      return{matched:true,ambiguous:state.names.size>1,binding:state.bindings[state.bindings.length-1]};
    }
    return{matched:false};
  }
  function resolve(compact){
    const candidates=[];
    for(const state of states){
      for(const a of state.aliases)if(compact.startsWith(a))candidates.push({surface:a,canonical:state.canonical,state,kind:'explicit_role'});
      if(state.active&&state.names.size===1)for(const name of state.names)if(compact.startsWith(name))candidates.push({surface:name,canonical:state.canonical,state,kind:'named_binding'});
      if(state.active&&state.names.size<=1)for(const a of state.references)if(compact.startsWith(a))candidates.push({surface:a,canonical:state.canonical,state,kind:'resolved_reference'});
    }
    for(const a of subjectAliases)if(!states.some(s=>s.aliases.includes(a))&&compact.startsWith(a))candidates.push({surface:a,canonical:a,kind:'explicit_role'});
    candidates.sort((a,b)=>b.surface.length-a.surface.length);if(!candidates.length)return null;
    const longest=candidates.filter(c=>c.surface.length===candidates[0].surface.length);
    if(new Set(longest.map(c=>c.canonical)).size!==1||longest.some(c=>c.state?.names.size>1))return null;
    const c=longest[0];return{surface:c.surface,canonical:c.canonical,kind:c.kind,binding:c.kind==='explicit_role'?null:c.state.bindings[c.state.bindings.length-1]||c.state.antecedents[c.state.antecedents.length-1]||null,
      activate:origin=>{if(c.state){c.state.active=true;c.state.antecedents.push({...origin,canonical:c.canonical});}}};
  }
  return{bind,resolve,bindings:()=>states.flatMap(s=>s.bindings)};
}
module.exports={narrativeClauses,createResolver};
