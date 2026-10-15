/* AIVAULT 仿真捲頁（只負責翻頁動畫）。flat-fold 模型：clip-path + 鏡射 matrix + 陰影。
   window.AIVAULTPageCurl.run(book, before, after, dir, opts) -> Promise
   opts.corner: "top" | "bottom"；opts.slope: 手指縱橫比（0~1）
   next = 右→左（往後翻）；prev = 左→右（往前翻，鏡射）。可 cancel 以配合連點佇列。 */
(function(){
  "use strict";
  var active = null;
  function clip(poly,M,n,keepPositive){
    var out=[],L=poly.length;
    function s(p){var v=(p[0]-M[0])*n[0]+(p[1]-M[1])*n[1];return keepPositive?v:-v;}
    for(var i=0;i<L;i++){
      var a=poly[i],b=poly[(i+1)%L],sa=s(a),sb=s(b);
      if(sa>=0)out.push(a);
      if((sa>=0)!==(sb>=0)){var t=sa/(sa-sb);out.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);}
    }
    return out;
  }
  function cp(poly){return poly.length<3?"polygon(0 0,0 0,0 0)":"polygon("+poly.map(function(p){return p[0].toFixed(1)+"px "+p[1].toFixed(1)+"px";}).join(",")+")";}
  function el(cls,css){var d=document.createElement("div");d.className=cls;if(css)d.style.cssText=css;return d;}
  function strip(cls,M,n,L,s,bg){
    var d=el(cls,"position:absolute;left:0;top:0;width:"+L+"px;height:"+s+"px;transform-origin:0 0;pointer-events:none;background:"+bg);
    var ux=-n[1],uy=n[0],ang=Math.atan2(uy,ux);
    d.style.transform="translate("+M[0]+"px,"+M[1]+"px) rotate("+ang+"rad) translate("+(-L/2)+"px,"+(-s)+"px)";
    return d;
  }
  function cancelActive(){
    if(active&&active.cancel){try{active.cancel();}catch(e){}}
    active=null;
  }
  function run(book,before,after,dir,opts){
    opts=opts||{};
    cancelActive();
    return new Promise(function(resolve){
      var w=book.clientWidth,h=book.clientHeight;
      if(w<1||h<1){resolve();return;}
      var corner=opts.corner==="top"?"top":"bottom";
      var slope=Math.max(.12,Math.min(.9,Number(opts.slope)||.3));
      var next=dir!=="prev"; // next: RTL；prev: LTR
      var host=el("qq-curl-host qq-real-curl");host.setAttribute("aria-hidden","true");
      host.style.cssText="position:absolute;inset:0;z-index:30;pointer-events:none;overflow:hidden;background:transparent";
      // 一律掀起「離開的那一頁」(before)；底下 DOM 已是目標頁 (after)
      var sheet=el("qq-rc-sheet","position:absolute;inset:0;background:var(--qq-paper,#fbf7ef);overflow:hidden");
      sheet.appendChild(before);
      var cast=el("qq-rc-cast","position:absolute;inset:0;overflow:hidden;pointer-events:none");
      var flapWrap=el("qq-rc-flapwrap","position:absolute;inset:0;filter:drop-shadow(0 0 10px rgba(0,0,0,.28))");
      var flap=el("qq-rc-flap","position:absolute;left:0;top:0;width:"+w+"px;height:"+h+"px;transform-origin:0 0;background:var(--qq-paper,#fbf7ef);overflow:hidden");
      var back=before.cloneNode(true);back.style.opacity=".22";back.style.filter="grayscale(1)";
      flap.appendChild(back);
      var shade=el("qq-rc-shade","position:absolute;inset:0");flap.appendChild(shade);
      flapWrap.appendChild(flap);
      host.append(sheet,cast,flapWrap);book.appendChild(host);
      // next: 右下/右上角；prev: 左下/左上角（鏡射）
      var C=[next?w:0,corner==="bottom"?h:0];
      var vsign=corner==="bottom"?-1:1;
      var rect=[[0,0],[w,0],[w,h],[0,h]],L=3*Math.max(w,h);
      var dur=opts.duration!=null?opts.duration:300,t0=null,finished=false;
      function frame(t){
        t=Math.max(.0001,Math.min(.9999,t));
        // next: tip 右→左；prev: tip 左→右
        var px=next?w-2*w*t:2*w*t;
        var py=C[1]+vsign*slope*h*.55*Math.sin(Math.PI*t);
        var P=[px,py],M=[(C[0]+P[0])/2,(C[1]+P[1])/2];
        var dx=C[0]-P[0],dy=C[1]-P[1],len=Math.hypot(dx,dy)||1,n=[dx/len,dy/len];
        sheet.style.clipPath=sheet.style.webkitClipPath=cp(clip(rect,M,n,false));
        var cornerPoly=cp(clip(rect,M,n,true));
        flap.style.clipPath=flap.style.webkitClipPath=cornerPoly;
        var mn=M[0]*n[0]+M[1]*n[1];
        flap.style.transform="matrix("+[1-2*n[0]*n[0],-2*n[0]*n[1],-2*n[0]*n[1],1-2*n[1]*n[1],2*mn*n[0],2*mn*n[1]].map(function(v){return v.toFixed(5);}).join(",")+")";
        var depth=Math.min(len/2,Math.max(w,h))*.9+20;
        shade.innerHTML="";
        shade.appendChild(strip("",M,n,L,depth,"linear-gradient(to top,rgba(0,0,0,.26),rgba(255,255,255,.35) 18%,rgba(0,0,0,.06) 60%,rgba(0,0,0,.14))"));
        cast.style.clipPath=cast.style.webkitClipPath=cornerPoly;
        cast.innerHTML="";
        cast.appendChild(strip("",M,n,L,Math.min(60,depth),"linear-gradient(to top,rgba(0,0,0,.38),rgba(0,0,0,0))"));
      }
      function ease(x){return 1-Math.pow(1-x,3);}
      function done(){
        if(finished)return;finished=true;
        if(active&&active.host===host)active=null;
        try{host.remove();}catch(e){}
        resolve();
      }
      function tick(ts){
        if(finished)return;
        if(t0==null)t0=ts;
        var x=Math.min(1,(ts-t0)/dur),e=ease(x);
        try{frame(e);}catch(err){console.warn("[AIVAULT curl]",err);done();return;}
        if(x<1)requestAnimationFrame(tick);else setTimeout(done,12);
      }
      try{frame(0.0001);}catch(e){done();return;}
      if(opts.hold!=null){frame(opts.hold);active={host:host,cancel:done};return;}
      active={host:host,cancel:done};
      requestAnimationFrame(tick);
      setTimeout(done,dur+800);
    });
  }
  window.AIVAULTPageCurl={run:run,cancel:cancelActive};
})();
