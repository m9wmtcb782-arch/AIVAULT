(()=>{
'use strict';
if(window.__AIVAULT_DARK_STAR_EMOTION_AVATAR_V2__)return;
window.__AIVAULT_DARK_STAR_EMOTION_AVATAR_V2__=true;

const EMOTIONS={
 neutral:{label:'平靜',brow:'0',eye:'1',mouth:'0'},
 touched:{label:'感動',brow:'1',eye:'1',mouth:'2'},
 angry:{label:'憤怒',brow:'-1',eye:'2',mouth:'-1'},
 sad:{label:'悲傷',brow:'-1',eye:'0',mouth:'-2'},
 fear:{label:'恐懼',brow:'2',eye:'3',mouth:'3'},
 nostalgia:{label:'懷念',brow:'0',eye:'0',mouth:'1'},
 regret:{label:'遺憾',brow:'-1',eye:'0',mouth:'-1'},
 happy:{label:'開心',brow:'1',eye:'2',mouth:'3'},
 surprised:{label:'驚訝',brow:'2',eye:'3',mouth:'3'},
 thinking:{label:'思考',brow:'-1',eye:'4',mouth:'0'}
};

const KEYWORDS=[
 ['touched',/感動|感謝|欣慰|溫暖|感人|珍惜|謝謝/],
 ['angry',/憤怒|生氣|火大|荒謬|不可接受|惱火|憤慨|氣憤/],
 ['sad',/悲傷|難過|傷心|失落|痛苦|心疼|哭泣|眼淚/],
 ['fear',/恐懼|害怕|危險|可怕|恐慌|擔心|不安/],
 ['nostalgia',/懷念|想念|回憶|往事|曾經|記得那時/],
 ['regret',/遺憾|可惜|後悔|錯過|沒能|未能|如果當時/],
 ['surprised',/驚訝|竟然|沒想到|哇|原來|居然/],
 ['happy',/哈哈|開心|高興|太棒|成功|恭喜|喜歡|太好了/],
 ['thinking',/思考|分析|首先|其次|原因|因此|判斷|考慮|推理|結論/]
];

function detect(text){
 const s=String(text||'');
 for(const [name,re] of KEYWORDS)if(re.test(s))return name;
 return 'neutral';
}

function install(){
 if(document.getElementById('dsEmotionAvatarV2'))return;
 const style=document.createElement('style');
 style.textContent=`
#dsEmotionAvatarV2{position:fixed;right:14px;bottom:92px;width:180px;z-index:999;background:#fff;border:1px solid #e9e9e9;border-radius:18px;box-shadow:0 8px 30px rgba(0,0,0,.10);overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans TC",sans-serif;transition:transform .45s ease,opacity .35s ease}
#dsEmotionAvatarV2 .head{padding:8px 10px 5px;font-size:11px;font-weight:600;display:flex;justify-content:space-between;gap:5px}
#dsEmotionAvatarV2 .emotion{font-weight:500;color:#777}
#dsEmotionAvatarV2 .stage{height:150px;position:relative;display:flex;align-items:center;justify-content:center;background:linear-gradient(#fff,#fafafa)}
#dsEmotionAvatarV2 .face{width:112px;height:112px;border-radius:50%;background:#ffe0bd;border:2px solid #f2c59d;position:relative;transition:transform .55s cubic-bezier(.2,.8,.2,1)}
#dsEmotionAvatarV2 .hair{position:absolute;left:-3px;top:-5px;width:118px;height:55px;background:#4b342b;border-radius:60px 60px 25px 25px;z-index:2}
#dsEmotionAvatarV2 .brow{position:absolute;top:43px;width:27px;height:6px;border-radius:8px;background:#4b342b;z-index:4;transition:transform .55s ease}
#dsEmotionAvatarV2 .brow.l{left:19px}.brow.r{right:19px}
#dsEmotionAvatarV2 .eye{position:absolute;top:55px;width:25px;height:17px;border-radius:50%;background:#fff;z-index:3;overflow:hidden;transition:height .45s ease,transform .45s ease}
#dsEmotionAvatarV2 .eye.l{left:18px}.eye.r{right:18px}
#dsEmotionAvatarV2 .pupil{position:absolute;width:9px;height:9px;border-radius:50%;background:#222;left:8px;top:4px;transition:transform .45s ease}
#dsEmotionAvatarV2 .mouth{position:absolute;left:42px;top:79px;width:28px;height:8px;border-radius:0 0 18px 18px;background:#9b4d55;z-index:4;transition:all .5s cubic-bezier(.2,.8,.2,1)}
#dsEmotionAvatarV2 .status{padding:6px 10px 9px;border-top:1px solid #f0f0f0;text-align:center;font-size:10px;color:#777}
#dsEmotionAvatarV2.speaking .mouth{animation:dsMouth .16s infinite alternate}
@keyframes dsMouth{from{transform:scaleY(.55)}to{transform:scaleY(1.55)}}
#dsEmotionAvatarV2[data-emotion="happy"] .mouth{height:15px;border-radius:5px 5px 20px 20px}
#dsEmotionAvatarV2[data-emotion="touched"] .mouth{height:12px;border-radius:0 0 20px 20px}
#dsEmotionAvatarV2[data-emotion="sad"] .mouth,#dsEmotionAvatarV2[data-emotion="regret"] .mouth{height:5px;border-radius:20px 20px 0 0;transform:rotate(180deg)}
#dsEmotionAvatarV2[data-emotion="angry"] .brow.l{transform:rotate(16deg)}
#dsEmotionAvatarV2[data-emotion="angry"] .brow.r{transform:rotate(-16deg)}
#dsEmotionAvatarV2[data-emotion="fear"] .eye,#dsEmotionAvatarV2[data-emotion="surprised"] .eye{height:23px}
#dsEmotionAvatarV2[data-emotion="fear"] .mouth,#dsEmotionAvatarV2[data-emotion="surprised"] .mouth{height:20px;border-radius:50%}
#dsEmotionAvatarV2[data-emotion="thinking"] .pupil{transform:translate(5px,-3px)}
#dsEmotionAvatarV2[data-emotion="nostalgia"] .face{transform:rotate(-2deg)}
@media(max-width:600px){#dsEmotionAvatarV2{right:8px;bottom:82px;width:148px}#dsEmotionAvatarV2 .stage{height:125px}#dsEmotionAvatarV2 .face{transform:scale(.82)}#dsEmotionAvatarV2[data-emotion="nostalgia"] .face{transform:scale(.82) rotate(-2deg)}}
`;
 document.head.appendChild(style);
 const box=document.createElement('div');box.id='dsEmotionAvatarV2';box.dataset.emotion='neutral';
 box.innerHTML='<div class="head"><span>🌟 暗星數字人</span><span class="emotion">平靜</span></div><div class="stage"><div class="face"><div class="hair"></div><div class="brow l"></div><div class="brow r"></div><div class="eye l"><i class="pupil"></i></div><div class="eye r"><i class="pupil"></i></div><div class="mouth"></div></div></div><div class="status">已連結暗星</div>';
 document.body.appendChild(box);
 window.DarkStarEmotionAvatar={
  setEmotion(name){
   if(!EMOTIONS[name])name='neutral';
   box.dataset.emotion=name;box.querySelector('.emotion').textContent=EMOTIONS[name].label;
  },
  setSpeaking(on){box.classList.toggle('speaking',!!on)},
  detect
 };
 let last='neutral',pending=null,timer=null;
 function transition(text){
  const next=detect(text);if(next===last)return;
  clearTimeout(timer);pending=next;
  timer=setTimeout(()=>{last=pending;window.DarkStarEmotionAvatar.setEmotion(last)},180);
 }
 const observer=new MutationObserver(ms=>{for(const m of ms)for(const n of m.addedNodes){if(!(n instanceof Element))continue;const t=n.querySelector?.('.message-text')?.textContent||n.textContent||'';if(t.trim())transition(t)}});
 const start=()=>{const root=document.querySelector('.messages')||document.body;observer.observe(root,{childList:true,subtree:true});document.querySelectorAll('.message.ai .message-text').forEach(n=>transition(n.textContent));};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();
