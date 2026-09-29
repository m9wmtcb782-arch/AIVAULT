/* AIVAULT Classroom Handwriting — additive module only.
 * Does not replace PPT/eBook/voice/audio/navigation logic.
 * Teacher strokes are normalized (0..1) and broadcast over the existing classroom channel.
 * Students redraw locally so the same handwriting scales to each device.
 */
(function(){
  'use strict';

  const TA = window;
  const isTeacher = !!document.getElementById('start') && !!document.getElementById('exit');
  const isStudent = !!document.getElementById('connect') && !!document.getElementById('lesson');
  if(!isTeacher && !isStudent)return;

  let open=false, canvas=null, ctx=null, strokes=[], activeStroke=null;
  let studentCanvas=null, studentCtx=null;

  function el(id){return document.getElementById(id)}
  function css(node,s){Object.assign(node.style,s)}

  function makeCanvas(host, transparent){
    const c=document.createElement('canvas');
    c.className='aivault-handwriting-canvas';
    css(c,{
      position:'absolute',inset:'0',width:'100%',height:'100%',
      display:'block',touchAction:'none',zIndex:'1',
      background:transparent?'transparent':'#fff'
    });
    host.appendChild(c);
    return c;
  }

  function resize(c, context){
    const r=c.getBoundingClientRect();
    const d=Math.max(1,Math.min(window.devicePixelRatio||1,2));
    c.width=Math.max(1,Math.round(r.width*d));
    c.height=Math.max(1,Math.round(r.height*d));
    context.setTransform(d,0,0,d,0,0);
    redraw(c,context,strokes);
  }

  function point(e,c){
    const r=c.getBoundingClientRect();
    return {
      x:Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),
      y:Math.max(0,Math.min(1,(e.clientY-r.top)/r.height)),
      p:Math.max(0,Math.min(1,Number(e.pressure)||0.5))
    };
  }

  function drawStroke(c,context,s){
    if(!s||!Array.isArray(s.points)||!s.points.length)return;
    const w=c.clientWidth||1,h=c.clientHeight||1;
    context.save();
    context.lineCap='round';context.lineJoin='round';
    const base=Number(s.width)||4;
    context.strokeStyle=s.color||'#111';
    context.beginPath();
    const p0=s.points[0];
    context.moveTo(p0.x*w,p0.y*h);
    for(let i=1;i<s.points.length;i++){
      const p=s.points[i];
      context.lineWidth=base*(0.75+0.5*(Number(p.p)||0.5));
      context.lineTo(p.x*w,p.y*h);
    }
    if(s.points.length===1){
      context.lineWidth=base;context.lineTo(p0.x*w+0.1,p0.y*h+0.1);
    }
    context.stroke();
    context.restore();
  }

  function redraw(c,context,list){
    context.clearRect(0,0,c.clientWidth,c.clientHeight);
    (Array.isArray(list)?list:[]).forEach(s=>drawStroke(c,context,s));
  }

  async function broadcast(event,payload){
    try{
      if(typeof classroomChannel!=='undefined'&&classroomChannel?.send){
        await classroomChannel.send({type:'broadcast',event,payload});
      }
    }catch(e){console.warn('classroom handwriting broadcast',e)}
  }

  function addTeacherButton(){
    const start=el('start');
    if(!start||el('handwriteToggle'))return;
    const b=document.createElement('button');
    b.id='handwriteToggle';b.type='button';b.className='b';
    b.textContent='✍️ 手寫';b.style.display='none';
    start.parentElement.insertBefore(b,start);
    b.onclick=()=>setTeacherOpen(!open);
  }

  function buildTeacherOverlay(){
    const panel=el('panel');
    if(!panel||el('aivaultHandwritingLayer'))return;
    const layer=document.createElement('div');
    layer.id='aivaultHandwritingLayer';
    css(layer,{position:'absolute',inset:'0',zIndex:'80',display:'none',pointerEvents:'none'});
    canvas=makeCanvas(layer,true);ctx=canvas.getContext('2d');
    css(canvas,{pointerEvents:'auto'});
    const tools=document.createElement('div');
    css(tools,{position:'absolute',top:'10px',right:'10px',zIndex:'82',display:'flex',gap:'6px',flexWrap:'wrap',pointerEvents:'auto'});
    const clear=document.createElement('button');
    clear.className='b';clear.textContent='🧹 清除';
    const close=document.createElement('button');
    close.className='b';close.textContent='✕ 關閉手寫';
    tools.append(clear,close);layer.appendChild(tools);panel.appendChild(layer);
    clear.onclick=async()=>{
      strokes=[];redraw(canvas,ctx,strokes);
      await broadcast('handwriting_clear',{});
      try{
        if(typeof lastClassroomPayload!=='undefined'&&lastClassroomPayload){
          lastClassroomPayload.handwriting=[];
          await classroomChannel?.send({type:'broadcast',event:'classroom_state',payload:{...lastClassroomPayload,handwriting:[]}});
        }
      }catch(e){console.warn('handwriting snapshot clear',e)}
    };
    close.onclick=()=>setTeacherOpen(false);
    canvas.addEventListener('pointerdown',e=>{
      if(!open)return;
      e.preventDefault();canvas.setPointerCapture?.(e.pointerId);
      activeStroke={id:String(Date.now())+'-'+Math.random().toString(36).slice(2),color:'#111',width:4,points:[point(e,canvas)]};
      strokes.push(activeStroke);drawStroke(canvas,ctx,activeStroke);
    });
    canvas.addEventListener('pointermove',e=>{
      if(!activeStroke||!open)return;
      e.preventDefault();
      const p=point(e,canvas),last=activeStroke.points[activeStroke.points.length-1];
      if(Math.abs(p.x-last.x)+Math.abs(p.y-last.y)<0.001)return;
      activeStroke.points.push(p);drawStroke(canvas,ctx,{...activeStroke,points:[last,p]});
      broadcast('handwriting_stroke',{stroke:{...activeStroke,points:[last,p]}}); 
    });
    const end=async e=>{
      if(!activeStroke)return;
      e.preventDefault();
      const done=activeStroke;activeStroke=null;
      try{
        if(typeof lastClassroomPayload!=='undefined'&&lastClassroomPayload){
          lastClassroomPayload.handwriting=strokes.map(s=>({...s,points:s.points.map(p=>({...p}))}));
          await classroomChannel?.send({type:'broadcast',event:'classroom_state',payload:{...lastClassroomPayload,handwriting:lastClassroomPayload.handwriting}});
        }
      }catch(x){console.warn('handwriting snapshot',x)}
    };
    canvas.addEventListener('pointerup',end);canvas.addEventListener('pointercancel',end);
    new ResizeObserver(()=>{if(ctx)resize(canvas,ctx)}).observe(layer);
  }

  function setTeacherOpen(v){
    open=!!v;
    const b=el('handwriteToggle'),layer=el('aivaultHandwritingLayer');
    if(!b||!layer)return;
    b.style.display=(typeof classroomActive!=='undefined'&&classroomActive)?'inline-block':'none';
    layer.style.display=open?'block':'none';
    if(open){resize(canvas,ctx);b.textContent='✍️ 手寫中';}
    else b.textContent='✍️ 手寫';
  }

  function hookTeacherClass(){
    addTeacherButton();buildTeacherOverlay();
    const originalEnter=enter;
    if(typeof originalEnter==='function'){
      enter=async function(){const r=await originalEnter.apply(this,arguments);setTeacherOpen(false);const b=el('handwriteToggle');if(b)b.style.display='inline-block';return r};
    }
    const originalExit=exit;
    if(typeof originalExit==='function'){
      exit=async function(){setTeacherOpen(false);return originalExit.apply(this,arguments)};
    }
  }

  function ensureStudentCanvas(){
    const lesson=el('lesson');
    if(!lesson||studentCanvas)return;
    const wrap=document.createElement('div');
    wrap.id='aivaultStudentHandwriting';
    css(wrap,{display:'none',position:'relative',width:'100%',height:'min(72vh,720px)',margin:'12px 0',border:'1px solid #dfe4ec',borderRadius:'12px',overflow:'hidden',background:'#fff'});
    const label=document.createElement('div');
    label.textContent='✍️ 老師手寫';
    css(label,{position:'absolute',left:'10px',top:'8px',zIndex:'2',padding:'4px 8px',borderRadius:'8px',background:'rgba(255,255,255,.86)',fontWeight:'800',fontSize:'16px'});
    wrap.appendChild(label);studentCanvas=makeCanvas(wrap,false);studentCtx=studentCanvas.getContext('2d');
    lesson.insertBefore(wrap,el('videoBox'));
    new ResizeObserver(()=>{if(studentCtx)resize(studentCanvas,studentCtx)}).observe(wrap);
  }

  function renderStudent(list){
    ensureStudentCanvas();
    if(!studentCanvas)return;
    strokes=Array.isArray(list)?list:[];
    const wrap=el('aivaultStudentHandwriting');
    wrap.style.display=strokes.length?'block':'none';
    resize(studentCanvas,studentCtx);
  }

  function hookStudent(){
    ensureStudentCanvas();
    const originalRender=renderState;
    if(typeof originalRender==='function'){
      renderState=function(state){
        const r=originalRender.apply(this,arguments);
        renderStudent(state?.handwriting||[]);
        return r;
      };
    }
    const originalLeave=leaveClassroom;
    if(typeof originalLeave==='function'){
      leaveClassroom=function(){renderStudent([]);return originalLeave.apply(this,arguments)};
    }
    const oldConnect=connect;
    if(typeof oldConnect==='function'){
      connect=async function(){const r=await oldConnect.apply(this,arguments);return r};
    }
    const originalSendSignal=sendSignal;
    if(typeof originalSendSignal==='function'){
      /* No change to audio signaling; handwriting uses its own Broadcast event. */
    }
    const originalChannelFactory=window.supabase?.createClient;
    /* Channel listeners are attached after connect by polling for the existing channel. */
    const timer=setInterval(()=>{
      const ch=channel;
      if(ch&&ch.__aivaultHandwritingBound)return;
      if(ch?.on){
        ch.__aivaultHandwritingBound=true;
        if(isStudent) ch.send({type:'broadcast',event:'classroom_request',payload:{source:'handwriting'}}).catch(()=>{});
        if(isTeacher) ch.on('broadcast',{event:'classroom_request'},()=>{
          if(typeof lastClassroomPayload!=='undefined'&&lastClassroomPayload)
            ch.send({type:'broadcast',event:'classroom_state',payload:{...lastClassroomPayload,handwriting:Array.isArray(strokes)?strokes:[]}}).catch(()=>{});
        });
        ch.on('broadcast',{event:'handwriting_stroke'},({payload})=>{
          const s=payload?.stroke;if(!s)return;
          strokes.push(s);renderStudent(strokes);
        });
        ch.on('broadcast',{event:'handwriting_clear'},()=>{strokes=[];renderStudent([])});
      }
    },250);
    setTimeout(()=>clearInterval(timer),120000);
  }

  if(isTeacher){
    hookTeacherClass();
    const t=setInterval(()=>{if((typeof classroomActive!=='undefined'&&classroomActive)){const b=el('handwriteToggle');if(b)b.style.display='inline-block'}else{setTeacherOpen(false)}},300);
    setTimeout(()=>clearInterval(t),86400000);
  }else{
    hookStudent();
  }
})();