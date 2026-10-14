"""Install / upgrade the 暗星數字人 panel in technical-dark-star.html.

The panel face is the black orb bot from darkstar-orb.js.
- If the orb version is already installed: skip.
- If the old drawn-face version is present: replace it in place (upgrade).
- Otherwise: inject.
"""
import re
from pathlib import Path

p = Path('technical-dark-star.html')
s = p.read_text(encoding='utf-8')
ORB_MARKER = 'data-ds-orb-avatar="2"'
if ORB_MARKER in s:
    print('avatar (orb version) already installed')
    raise SystemExit(0)

css = r'''
<style id="aivault-darkstar-avatar-css">
#aivault-darkstar-avatar{position:fixed;right:14px;top:72px;width:190px;z-index:80;border:1px solid #e8e4f5;border-radius:18px;background:rgba(255,255,255,.96);box-shadow:0 10px 32px rgba(40,30,80,.14);backdrop-filter:blur(12px);overflow:hidden}
#aivault-darkstar-avatar .dsah{display:flex;align-items:center;justify-content:space-between;padding:9px 11px;border-bottom:1px solid #eeeaf7;font-size:12px;font-weight:700}
#aivault-darkstar-avatar .dslink{font-size:10px;color:#777;display:flex;gap:5px;align-items:center}
#aivault-darkstar-avatar .dsdot{width:7px;height:7px;border-radius:50%;background:#bbb}.dsdot.on{background:#42b96b;box-shadow:0 0 0 3px #e9f8ee}
#aivault-darkstar-avatar .dsfacebox{height:190px;position:relative;display:flex;align-items:center;justify-content:center;padding-bottom:16px;box-sizing:border-box;background:radial-gradient(circle at 50% 38%,#fff,#f3efff 68%,#ebe6ff)}
#aivault-darkstar-avatar .dsfacebox .ds-orb{width:120px!important;height:120px!important}
#aivault-darkstar-avatar .dsstate{position:absolute;bottom:6px;left:50%;transform:translateX(-50%);white-space:nowrap;padding:3px 7px;border-radius:99px;background:rgba(255,255,255,.84);font-size:9px;color:#70697c}
#aivault-darkstar-avatar .dsfoot{display:flex;gap:6px;padding:8px}.dsbtn{flex:1;border:1px solid #ddd7ed;background:#fff;border-radius:8px;padding:6px 5px;font-size:10px;color:#444}.dsbtn.primary{background:#171717;color:#fff;border-color:#171717}
@media(max-width:700px){#aivault-darkstar-avatar{right:9px;top:auto;bottom:92px;width:164px}#aivault-darkstar-avatar .dsfacebox{height:166px}#aivault-darkstar-avatar .dsfacebox .ds-orb{width:100px!important;height:100px!important}#aivault-darkstar-avatar .dsah{padding:7px 9px}.dsbtn{padding:5px 3px}}
</style>
'''

html = r'''
<div id="aivault-darkstar-avatar" data-ds-orb-avatar="2" aria-label="暗星數字人">
  <div class="dsah"><span>🌟 暗星數字人</span><span class="dslink"><i id="dsdot" class="dsdot"></i><span id="dstxt">未連結</span></span></div>
  <div class="dsfacebox" id="dsfacebox">
    <span id="dsorb" data-darkstar-orb data-size="120" title="暗星"></span>
    <div id="dsstate" class="dsstate">等待暗星說話</div>
  </div>
  <div class="dsfoot"><button id="dsconnect" class="dsbtn primary">🔗 連結即時暗星</button><button id="dsdemo" class="dsbtn">▶ 表情測試</button></div>
</div>
'''

js = r'''
<script id="aivault-darkstar-avatar-js">
(()=>{
  const q=id=>document.getElementById(id); let level=0,target=0,linked=false;
  // 臉部改由暗星黑色小球（darkstar-orb.js）呈現；小球腳本較晚載入，所以延遲取得
  const orb=()=>{const el=q('dsorb');if(!el)return null;return el.__dsOrb||(window.DarkStarOrb?window.DarkStarOrb.mount(el,{size:120}):null)};
  const set=(on,text)=>{linked=on;q('dsdot').classList.toggle('on',on);q('dstxt').textContent=text||'未連結'};
  const speak=(v)=>{target=Math.max(0,Math.min(1,v));const st=target>.035?'🗣️ 暗星正在說話':(linked?'👂 暗星正在聆聽':'等待暗星說話');if(target>.035||speak.was){if(q('dsstate').textContent!==st)q('dsstate').textContent=st}speak.was=target>.035};
  const expr=t=>{const o=orb();if(t==='happy'){q('dsstate').textContent='😊 暗星很開心'}else if(t==='surprise'){q('dsstate').textContent='😮 暗星有點驚訝'}else if(t==='think'){q('dsstate').textContent='🤔 暗星正在思考'}else if(t==='angry'){q('dsstate').textContent='😠 暗星有點生氣'}else if(t==='sad'){q('dsstate').textContent='😢 暗星有點難過'}else if(t==='joy'){q('dsstate').textContent='🤩 暗星好興奮'}
    const m={surprise:'surprised',surprised:'surprised',think:'curious',happy:'happy',angry:'angry',sad:'sad',joy:'joy'};
    if(o)o.setExpression(m[t]||'neutral',m[t]?3000:0)};
  const loop=()=>{level+=(target-level)*.3;const o=orb();if(o)o.setTalking(level>.02?Math.min(1,level*1.6):0);requestAnimationFrame(loop)};loop();
  // 優先在本頁內連線（darkstar-inpage-live.js）；沒有該模組時維持舊行為（開啟視訊頁）
  q('dsconnect').onclick=()=>{if(window.AIVAULTDarkStarLive){window.AIVAULTDarkStarLive.toggle();return}set(true,'已連結');q('dsstate').textContent='👂 暗星正在聆聽';window.open('technical-dark-star-live-video-test.html','_blank','noopener');};
  q('dsdemo').onclick=async()=>{set(true,'表情測試');expr('happy');for(let i=0;i<26;i++){speak(Math.abs(Math.sin(i*.72))*.8);await new Promise(r=>setTimeout(r,75))}speak(0);setTimeout(()=>expr('neutral'),500)};
  // 視線：滑鼠／手指位置讓小球眼睛左右看
  document.addEventListener('pointermove',e=>{const o=orb(),b=q('dsorb');if(!o||!b||target>.035)return;const r=b.getBoundingClientRect();o.look((e.clientX-(r.left+r.width/2))/Math.max(200,innerWidth/2))},{passive:true});
  // Drive the face from speech/audio activity already present on the page.
  const hookAudio=()=>{document.querySelectorAll('audio,video').forEach(el=>{if(el.__dsHook)return;el.__dsHook=1;el.addEventListener('play',()=>{set(true,'已連結');q('dsstate').textContent='🗣️ 暗星正在說話';});el.addEventListener('pause',()=>speak(0));el.addEventListener('ended',()=>speak(0));});};
  new MutationObserver(hookAudio).observe(document.documentElement,{childList:true,subtree:true});hookAudio();
  // Text-response emotion cue: only visual expression; it never changes Dark Star's reply.
  // 只在最後一則訊息文字改變時才判斷（避免 expr 改狀態文字 → 再觸發觀察器的無限迴圈）
  let lastMsg='';const obs=new MutationObserver(()=>{const nodes=[...document.querySelectorAll('.message-text')];const last=nodes[nodes.length-1];if(!last)return;const t=last.textContent||'';if(t===lastMsg)return;lastMsg=t;if(/哈哈|開心|太好了|成功|很棒/.test(t))expr('happy');else if(/等等|真的嗎|驚訝|沒想到/.test(t))expr('surprise');else if(/思考|分析|考慮|應該/.test(t))expr('think');});obs.observe(document.body,{childList:true,subtree:true});
  const setLink=(on,text,stateText)=>{set(on,text);q('dsstate').textContent=stateText||(on?'👂 暗星正在聆聽':'等待暗星說話')};
  window.AIVAULTDarkStarAvatar={speak:speak,expr:expr,setLink:setLink};
})();
</script>
'''

ORB_SCRIPT = '<script src="darkstar-orb.js?v=20261014-emo2"></script>'
LIVE_SCRIPT = '<script src="darkstar-inpage-live.js?v=20261014-live1"></script>'

# Remove any previous (drawn-face) install so the old face is never kept/re-injected.
s = re.sub(r'\n?<style id="aivault-darkstar-avatar-css">.*?</style>\n?', '\n', s, count=1, flags=re.S)
s = re.sub(r'\n?<div id="aivault-darkstar-avatar"[^>]*>.*?</div>\n</div>\n?', '\n', s, count=1, flags=re.S)
s = re.sub(r'\n?<script id="aivault-darkstar-avatar-js">.*?</script>\n?', '\n', s, count=1, flags=re.S)
assert 'id="aivault-darkstar-avatar"' not in s, 'old avatar block not fully removed'

s = s.replace('</head>', css + '\n</head>', 1)
i = s.rfind('</body>')
s = s[:i] + html + '\n' + js + '\n' + s[i:]
if 'src="darkstar-orb.js' in s:
    s = re.sub(r'<script src="darkstar-orb\.js[^"]*"></script>', ORB_SCRIPT, s)
else:
    i = s.rfind('</body>')
    s = s[:i] + ORB_SCRIPT + '\n' + s[i:]
if 'src="darkstar-inpage-live.js' in s:
    s = re.sub(r'<script src="darkstar-inpage-live\.js[^"]*"></script>', LIVE_SCRIPT, s)
else:
    i = s.rfind('</body>')
    s = s[:i] + LIVE_SCRIPT + '\n' + s[i:]
p.write_text(s, encoding='utf-8')
print('avatar (orb version) installed')
