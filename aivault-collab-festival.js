/* AIVAULT 同步協作池節慶動畫層 v1（純加法覆蓋層，與天氣／日夜／路燈層疊加，pointer-events:none）
   以 Asia/Taipei 當天自動判斷；農曆用瀏覽器內建 Intl 中國曆換算（不寫死年份，閏月不算）。
   預覽：?festival=halloween|dragonboat|midautumn|lunarnewyear   關閉：?festival=none
   擴充：在 FESTIVALS 表加一筆 {id,name,match(d),items,css?} 即可（聖誕、元宵、清明…）。 */
(function () {
  if (window.__aivaultCollabFestival) return; window.__aivaultCollabFestival = 1;
  var TZ = 'Asia/Taipei', DAY = 864e5;
  function solar(t) { var p = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, month: 'numeric', day: 'numeric' }).formatToParts(t), o = {}; p.forEach(function (x) { o[x.type] = x.value; }); return { m: +o.month, d: +o.day }; }
  function lunar(t) { try { var p = new Intl.DateTimeFormat('en-u-ca-chinese', { timeZone: TZ, month: 'numeric', day: 'numeric' }).formatToParts(t), o = {}; p.forEach(function (x) { o[x.type] = x.value; });
    return { m: parseInt(o.month, 10), d: parseInt(o.day, 10), leap: /bis|閏/.test(o.month) }; } catch (e) { return null; } }
  function L(t, m, d) { var x = lunar(t); return !!x && !x.leap && x.m === m && x.d === d; }
  var FESTIVALS = [
    { id: 'halloween', name: '萬聖節', match: function (t) { var s = solar(t); return s.m === 10 && s.d === 31; },
      items: [['🎃', 3, 'bob'], ['🦇', 6, 'fly'], ['👻', 4, 'float']], hero: 'pumpkin' /* 必備主角：大南瓜燈（夜晚發光） */ },
    { id: 'dragonboat', name: '端午節', match: function (t) { return L(t, 5, 5); },
      items: [['🐉🚣', 2, 'row'], ['🧧', 3, 'swing']], hero: 'zongzi' /* 必備主角：大粽子＋龍舟 */ },
    { id: 'midautumn', name: '中秋節', match: function (t) { return L(t, 8, 15); },
      items: [['🌕', 1, 'moon'], ['🐇', 2, 'hop'], ['🥮', 2, 'bob'], ['🍊', 3, 'bob']], hero: 'mooncake' /* 必備主角：月餅配滿月 */ },
    { id: 'lunarnewyear', name: '農曆新年', match: function (t) { var x = lunar(t); if (!x || x.leap) return false; if (x.m === 1 && x.d <= 5) return true; return L(new Date(+t + DAY), 1, 1); /* 除夕＝初一前一天 */ },
      items: [['🏮', 6, 'swing'], ['✨', 5, 'firework'], ['🐉', 1, 'fly']], couplet: true, hero: 'firecracker' /* 必備主角：春聯＋炮竹爆開 */ }
    // 範例擴充：{ id:'christmas', name:'聖誕節', match:function(t){var s=solar(t);return s.m===12&&s.d===25;}, items:[['🎄',2,'bob'],['❄️',8,'fall']] }
  ];
  window.AIVAULT_FESTIVALS = FESTIVALS;
  window.AIVAULT_festivalFor = function (t) { for (var i = 0; i < FESTIVALS.length; i++) if (FESTIVALS[i].match(t)) return FESTIVALS[i].id; return null; };
  var q = new URLSearchParams(location.search).get('festival');
  var id = q === 'none' ? null : (q || window.AIVAULT_festivalFor(new Date()));
  var F = FESTIVALS.filter(function (f) { return f.id === id; })[0]; if (!F) return;
  var RM = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  function boot() {
    var st = document.createElement('style');
    st.textContent = '#cpf-root{position:fixed;inset:0;pointer-events:none;z-index:2147482990;overflow:hidden;font-family:"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif}' +
      '.cpf{position:absolute;font-size:clamp(26px,5vw,46px);filter:drop-shadow(0 0 8px rgba(255,210,120,.55))}' +
      '.cpf-bob{animation:cpfBob 3s ease-in-out infinite}@keyframes cpfBob{50%{transform:translateY(-12px)}}' +
      '.cpf-swing{transform-origin:50% -30px;animation:cpfSw 2.6s ease-in-out infinite}@keyframes cpfSw{0%,100%{transform:rotate(-9deg)}50%{transform:rotate(9deg)}}' +
      '.cpf-float{animation:cpfFl 7s ease-in-out infinite;opacity:.85}@keyframes cpfFl{0%,100%{transform:translate(0,0)}50%{transform:translate(30px,-26px)}}' +
      '.cpf-fly{animation:cpfFly 11s linear infinite}@keyframes cpfFly{0%{transform:translate(-20vw,0)}25%{transform:translate(10vw,-4vh)}50%{transform:translate(45vw,3vh)}75%{transform:translate(80vw,-3vh)}100%{transform:translate(125vw,0)}}' +
      '.cpf-row{animation:cpfRow 16s linear infinite;font-size:clamp(36px,7vw,64px)}@keyframes cpfRow{from{transform:translateX(-30vw)}to{transform:translateX(130vw)}}' +
      '.cpf-hop{animation:cpfHop 1.6s ease-in-out infinite}@keyframes cpfHop{0%,100%{transform:translateY(0)}40%{transform:translateY(-22px)}}' +
      '.cpf-moon{font-size:clamp(70px,14vw,130px);filter:drop-shadow(0 0 30px rgba(255,236,170,.95))}' +
      '.cpf-firework{animation:cpfFw 2.4s ease-out infinite;opacity:0}@keyframes cpfFw{0%{transform:scale(.2);opacity:0}30%{opacity:1}100%{transform:scale(1.6);opacity:0}}' +
      '.cpf-fall{animation:cpfFall 9s linear infinite}@keyframes cpfFall{from{transform:translateY(-10vh)}to{transform:translateY(110vh)}}' +
      '.cpf-cp{position:absolute;top:18%;width:clamp(26px,5vw,40px);padding:8px 2px;background:#c8102e;color:#ffd700;font:700 clamp(15px,3vw,24px)/1.25 "PingFang TC","Noto Serif TC",serif;text-align:center;border:2px solid #ffd700;border-radius:3px;writing-mode:vertical-rl;box-shadow:0 3px 10px rgba(0,0,0,.35)}' +
      '.cpf-tag{position:absolute;left:8px;top:calc(env(safe-area-inset-top,0px) + 8px);font:12px system-ui,"PingFang TC",sans-serif;color:#fff;background:rgba(150,20,30,.7);padding:4px 9px;border-radius:10px}' +
      '.cpf-zz{position:absolute;left:50%;bottom:20%;width:clamp(130px,26vw,230px);aspect-ratio:1/1;transform:translateX(-50%);animation:cpfBob 3.4s ease-in-out infinite}'+'.cpf-zz i{position:absolute;inset:0;clip-path:polygon(50% 0,100% 92%,0 92%);background:linear-gradient(135deg,#6fbf3f,#2f7d1f 60%,#1f5a14);border-radius:12px}'+'.cpf-zz b{position:absolute;left:8%;right:8%;top:52%;height:9%;background:#c9a15a;border-radius:3px;box-shadow:0 0 0 2px #8a6a30 inset}'+'.cpf-zz u{position:absolute;left:22%;right:22%;bottom:4%;text-align:center;font:700 clamp(14px,2.6vw,20px) "PingFang TC",sans-serif;color:#fff;text-shadow:0 1px 3px #000;text-decoration:none}'+'.cpf-mc{position:absolute;left:calc(72% - clamp(50px,10vw,90px));top:calc(9% + clamp(70px,14vw,120px));font-size:clamp(70px,13vw,120px);filter:drop-shadow(0 0 18px rgba(255,210,120,.9));animation:cpfBob 3s ease-in-out infinite}'+'.cpf-fc{position:absolute;top:24%;font-size:clamp(34px,6vw,54px);transform-origin:50% 0;animation:cpfFc 3s infinite}'+'@keyframes cpfFc{0%,55%{transform:rotate(-6deg);opacity:1}10%,30%,50%{transform:rotate(6deg)}60%{transform:scale(1.5);opacity:1}64%,100%{transform:scale(.2);opacity:0}}'+'.cpf-bang{position:absolute;top:24%;font-size:clamp(50px,9vw,80px);opacity:0;animation:cpfBang 3s infinite}'+'@keyframes cpfBang{0%,58%{opacity:0;transform:scale(.2)}64%{opacity:1;transform:scale(1.3)}85%,100%{opacity:0;transform:scale(1.8)}}'+
      '.cpf-pk{position:absolute;left:50%;bottom:16%;transform:translateX(-50%);font-size:clamp(110px,22vw,200px);line-height:1;filter:drop-shadow(0 6px 10px rgba(0,0,0,.4));transition:filter 1.5s}'+'#cpw-root.night~#cpf-root .cpf-pk{filter:drop-shadow(0 0 22px rgba(255,150,30,.95)) drop-shadow(0 0 60px rgba(255,120,0,.7)) brightness(1.15);animation:cpfPk 2.2s ease-in-out infinite}'+'@keyframes cpfPk{50%{filter:drop-shadow(0 0 30px rgba(255,170,40,1)) drop-shadow(0 0 90px rgba(255,120,0,.8)) brightness(1.3)}}'+
      '@media (prefers-reduced-motion:reduce){.cpf{animation-duration:30s!important}}';
    document.head.appendChild(st);
    var R = document.createElement('div'); R.id = 'cpf-root'; R.setAttribute('aria-hidden', 'true');
    var h = '<div class="cpf-tag">🎉 ' + F.name + (q ? '（預覽）' : '') + '</div>', seed = 7;
    function rnd() { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }
    F.items.forEach(function (it) { for (var i = 0; i < it[1]; i++) {
      var k = it[2], x = 5 + rnd() * 85, y = k === 'moon' ? 9 : k === 'row' ? 74 + i * 6 : k === 'swing' ? 6 + rnd() * 10 : k === 'fly' ? 12 + rnd() * 25 : k === 'firework' ? 8 + rnd() * 28 : k === 'hop' ? 70 : k === 'fall' ? -5 : 40 + rnd() * 35;
      if (k === 'moon') x = 72;
      h += '<div class="cpf cpf-' + k + '" style="left:' + x.toFixed(1) + '%;top:' + y.toFixed(1) + '%;animation-delay:-' + (rnd() * 8).toFixed(2) + 's">' + it[0] + '</div>'; } });
    if (F.couplet) h += '<div class="cpf-cp" style="left:4%">春滿乾坤福滿門</div><div class="cpf-cp" style="right:4%">天增歲月人增壽</div><div class="cpf-cp" style="left:50%;top:6%;transform:translateX(-50%);writing-mode:horizontal-tb;width:auto;padding:4px 12px">萬象更新</div>';
    if (F.hero === 'zongzi') h += '<div class="cpf-zz"><i></i><b></b><u>粽子</u></div>';
    if (F.hero === 'pumpkin') h += '<div class="cpf-pk">🎃</div>';
    if (F.hero === 'mooncake') h += '<div class="cpf-mc">🥮</div>';
    if (F.hero === 'firecracker') [14, 34, 62, 84].forEach(function (x, i) { var dl = 'animation-delay:-' + (i * .75) + 's'; h += '<div class="cpf-fc" style="left:' + x + '%;' + dl + '">🧨</div><div class="cpf-bang" style="left:' + (x - 2) + '%;' + dl + '">💥</div>'; });
    R.innerHTML = h; if (RM) R.querySelectorAll('.cpf-fly,.cpf-row').forEach(function (e) { e.style.animationDuration = '40s'; });
    document.body.appendChild(R);
  }
  if (document.body) boot(); else document.addEventListener('DOMContentLoaded', boot);
})();
