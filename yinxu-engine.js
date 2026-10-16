/* 因序小說 原型播放引擎：旁白/角色語音、提問自動開麥、逾時重問、主角 AI 代答、劇情依回答調整、不可逆時間線。
   關閉 AI 改寫：localStorage yinxuAiOff=1；Gemini 語音：頁面開關（失敗自動退回瀏覽器語音）。 */
(function () {
  var Q = new URLSearchParams(location.search);
  var MOCK = Q.get('mock') === '1';
  var SILENCE = +Q.get('silence') || 8000;
  var CFG = window.YINXU_CFG || {};
  var book = YinxuStore.get(Q.get('book') || 'lighthouse-night');
  var $ = function (id) { return document.getElementById(id); };
  if (!book) { document.body.innerHTML = '<p style="padding:24px">找不到這本書。<a href="yinxu-shelf.html">回書架</a></p>'; return; }
  var RUN_KEY = 'yinxu.run.' + book.book_id;
  var chars = {}; book.characters.forEach(function (c) { chars[c.id] = c; });
  chars.__me = { id: '__me', name: (book.protagonist && book.protagonist.name) || '主角', voice_type: 'protagonist' };
  var st = load() || { idx: 0, decisions: [], transcript: [], segment: null, ended: false, started_at: new Date().toISOString() };
  var paused = false, resumeWaiters = [], cancelCur = null, ttsGemini = localStorage.getItem('yinxuGeminiTts') === '1', geminiBroken = false;
  function load() { try { var r = JSON.parse(localStorage.getItem(RUN_KEY) || 'null'); return r && !r.ended ? r : null; } catch (_) { return null; } }
  function persist() { localStorage.setItem(RUN_KEY, JSON.stringify(st)); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  /* ---------- 音訊：BGM + SFX（WebAudio 生成，無版權） ---------- */
  var ac = null, bgmGain = null, bgmOn = localStorage.getItem('yinxuBgmOff') !== '1', bgmTimer = null;
  function audio() { if (!ac) { var C = window.AudioContext || window.webkitAudioContext; if (C) ac = new C(); } if (ac && ac.state === 'suspended') ac.resume(); return ac; }
  function noise(dur, f, q, vol, attack) {
    var a = audio(); if (!a) return; var n = a.createBuffer(1, a.sampleRate * dur, a.sampleRate), d = n.getChannelData(0);
    for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    var s = a.createBufferSource(); s.buffer = n; var bp = a.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = q;
    var g = a.createGain(); var t = a.currentTime; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + (attack || dur / 3)); g.gain.linearRampToValueAtTime(0, t + dur);
    s.connect(bp); bp.connect(g); g.connect(a.destination); s.start();
  }
  function tone(freq, dur, vol, type, when, slideTo) {
    var a = audio(); if (!a) return; var t = a.currentTime + (when || 0); var o = a.createOscillator(), g = a.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t); if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + dur + 0.05);
  }
  var SFX = {
    waves: function () { noise(3.5, 500, 0.6, 0.18, 1.5); },
    radio: function () { noise(0.8, 2200, 3, 0.12, 0.05); },
    thud: function () { tone(90, 0.5, 0.5, 'sine', 0, 40); },
    storm: function () { noise(4, 300, 0.4, 0.25, 0.8); tone(55, 2.5, 0.15, 'sawtooth', 0.4, 40); },
    chime: function () { [880, 1320, 1760].forEach(function (f, i) { tone(f, 1.6, 0.12, 'sine', i * 0.18); }); },
    ask: function () { tone(660, 0.25, 0.15); tone(990, 0.35, 0.15, 'sine', 0.18); },
    mic: function () { tone(1200, 0.08, 0.1, 'square'); }
  };
  function sfx(name) { try { SFX[name] && SFX[name](); } catch (_) {} }
  function bgmStart() {
    var a = audio(); if (!a || bgmTimer) return; bgmGain = a.createGain(); bgmGain.gain.value = 0.045;
    var lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; bgmGain.connect(lp); lp.connect(a.destination);
    var chords = [[220, 261.6, 329.6], [196, 246.9, 293.7], [174.6, 220, 261.6], [196, 246.9, 329.6]], k = 0;
    function play() {
      var t = a.currentTime; chords[k++ % 4].forEach(function (f) {
        [0, 3].forEach(function (det) { var o = a.createOscillator(), g = a.createGain(); o.type = 'triangle'; o.frequency.value = f; o.detune.value = det;
          g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.5, t + 1.2); g.gain.linearRampToValueAtTime(0, t + 4.4); o.connect(g); g.connect(bgmGain); o.start(t); o.stop(t + 4.5); });
      });
    }
    play(); bgmTimer = setInterval(play, 4000);
  }
  function bgmStop() { clearInterval(bgmTimer); bgmTimer = null; if (bgmGain) { try { bgmGain.disconnect(); } catch (_) {} bgmGain = null; } }

  /* ---------- 語音 ---------- */
  var VP = { narrator: [1.0, 0.95], female: [1.15, 1.0], male: [0.75, 0.95], old: [0.55, 0.82], child: [1.7, 1.12], protagonist: [0.9, 1.05] };
  var GEMINI_VOICE = { narrator: 'Aoede', female: 'Kore', male: 'Puck', old: 'Charon', child: 'Leda', protagonist: 'Fenrir' };
  var voiceMap = {};
  function assignVoices() {
    var vs = (window.speechSynthesis && speechSynthesis.getVoices()) || [];
    var zh = vs.filter(function (v) { return /zh[-_]TW/i.test(v.lang); }).concat(vs.filter(function (v) { return /zh[-_](HK|CN)|^zh$/i.test(v.lang); }));
    var ids = book.characters.map(function (c) { return c.id; }).concat('__me');
    ids.forEach(function (id, i) { voiceMap[id] = zh.length ? zh[i % zh.length] : null; });
    var sel = $('narrVoice'); if (sel && zh.length && !sel.options.length) {
      zh.forEach(function (v, i) { var o = document.createElement('option'); o.value = i; o.textContent = v.name + ' (' + v.lang + ')'; sel.appendChild(o); });
      sel.onchange = function () { voiceMap.narrator = zh[+sel.value]; };
    }
  }
  if (window.speechSynthesis) { assignVoices(); speechSynthesis.onvoiceschanged = assignVoices; }
  function vtype(id) { var c = chars[id]; return id === 'narrator' ? 'narrator' : (c && c.voice_type) || 'female'; }
  function speakBrowser(text, id) {
    return new Promise(function (res) {
      if (!window.speechSynthesis || MOCK) { var t = setTimeout(function () { res('ok'); }, MOCK ? 150 : Math.min(6000, 200 + text.length * 120)); cancelCur = function () { clearTimeout(t); res('cancelled'); }; return; }
      var u = new SpeechSynthesisUtterance(text), p = VP[vtype(id)] || VP.female; u.lang = 'zh-TW'; if (voiceMap[id]) u.voice = voiceMap[id];
      u.pitch = p[0]; u.rate = p[1]; var done = false; function fin(r) { if (!done) { done = true; res(r); } }
      u.onend = function () { fin('ok'); }; u.onerror = function (e) { fin(e && (e.error === 'interrupted' || e.error === 'canceled') ? 'cancelled' : 'ok'); };
      cancelCur = function () { speechSynthesis.cancel(); fin('cancelled'); };
      speechSynthesis.cancel(); speechSynthesis.speak(u);
    });
  }
  async function speakGemini(text, id) {
    var r = await fetch(CFG.url + '/functions/v1/aivault-tts', { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: CFG.anon, Authorization: 'Bearer ' + CFG.anon },
      body: JSON.stringify({ action: 'tts', text: text, language: 'zh-TW', voice_id: GEMINI_VOICE[vtype(id)] }) });
    var j = await r.json(); var b64 = (j.result && j.result.audio_base64) || j.audio_base64; if (!b64) throw new Error('no audio');
    var a = new Audio('data:' + ((j.result && j.result.mime) || 'audio/mpeg') + ';base64,' + b64);
    return new Promise(function (res) { a.onended = function () { res('ok'); }; a.onerror = function () { res('ok'); }; cancelCur = function () { a.pause(); res('cancelled'); }; a.play().catch(function () { res('ok'); }); });
  }
  async function speakOnce(text, id) {
    if (ttsGemini && !geminiBroken && !MOCK) { try { return await speakGemini(text, id); } catch (e) { geminiBroken = true; status('Gemini 語音失敗，改用瀏覽器語音'); } }
    return speakBrowser(text, id);
  }
  function waitUnpaused() { return paused ? new Promise(function (r) { resumeWaiters.push(r); }) : Promise.resolve(); }
  async function say(text, id) { for (;;) { await waitUnpaused(); var r = await speakOnce(text, id); cancelCur = null; if (r !== 'cancelled' || !paused) return; } }

  /* ---------- 畫面 ---------- */
  function addLine(id, text, cls) {
    var c = chars[id] || {}; var d = document.createElement('div');
    d.className = 'line ' + (id === 'narrator' ? 'narrator ' : '') + (cls || '');
    d.innerHTML = '<span class="who">' + esc(id === 'narrator' ? '🎙 說書人' : id === '__me' ? '🧑 你（' + c.name + '）' : '🗣 ' + (c.name || id)) + '</span>' + esc(text);
    $('stage').appendChild(d); d.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }
  function status(t) { var s = $('micSt'); if (s) s.innerHTML = t; }
  function restoreTranscript() { st.transcript.forEach(function (l) { addLine(l.speaker, l.text, l.cls); }); }
  function record(speaker, text, cls, extra) { var l = { speaker: speaker, text: text, cls: cls || '' }; if (extra) for (var k in extra) l[k] = extra[k]; st.transcript.push(l); persist(); addLine(speaker, text, cls); }

  /* ---------- 麥克風 ---------- */
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  function listen(ms) {
    return new Promise(function (resolve) {
      var box = $('mic'), inp = $('typed'), tapBtn = $('tapMic'), finished = false, rec = null, timer = null, heard = '';
      box.classList.add('show'); inp.value = ''; tapBtn.style.display = 'none';
      function done(v) { if (finished) return; finished = true; clearTimeout(timer); try { rec && rec.abort(); } catch (_) {} box.classList.remove('show'); $('sendTyped').onclick = null; inp.oninput = null; inp.onkeydown = null; resolve((v || '').trim()); }
      function arm(t) { clearTimeout(timer); timer = setTimeout(function () { paused ? arm(t) : done(heard); }, t); }
      $('sendTyped').onclick = function () { done(inp.value); };
      inp.onkeydown = function (e) { if (e.key === 'Enter') done(inp.value); };
      inp.oninput = function () { arm(ms + 4000); };
      function startRec() {
        if (!SR || MOCK) { status('⌨️ 這個瀏覽器不支援語音辨識，請打字回答'); return; }
        try {
          rec = new SR(); rec.lang = 'zh-TW'; rec.interimResults = true; rec.continuous = false;
          rec.onresult = function (e) { var t = ''; for (var i = 0; i < e.results.length; i++) t += e.results[i][0].transcript; heard = t; inp.value = t; arm(2500);
            if (e.results[e.results.length - 1].isFinal) setTimeout(function () { done(heard); }, 600); };
          rec.onerror = function (e) { if (e.error === 'not-allowed' || e.error === 'service-not-allowed') { tapBtn.style.display = ''; status('🎤 請點「開麥」允許麥克風，或直接打字'); } };
          rec.onend = function () { if (!finished && heard) done(heard); };
          rec.start(); sfx('mic'); status('<span class="pulse"></span>請直接說出你的回答…');
        } catch (e) { tapBtn.style.display = ''; status('🎤 點「開麥」開始說話，或直接打字'); }
      }
      tapBtn.onclick = function () { tapBtn.style.display = 'none'; startRec(); arm(ms); };
      startRec(); arm(ms);
    });
  }

  /* ---------- AI（ai-gateway，少量呼叫） ---------- */
  var RULES = [
    '【角色 AI 硬約束】你知道原小說的最終結局是「' + book.original_ending + '」，但你絕對不可以因為知道這個結局而引導、暗示、或逼迫主角走回原時間線。你只根據當下角色性格與已發生的事件行動。',
    '【旁白 AI 硬約束】根據目前已確定的時間線敘事，不要預設未來會回到原結局。',
    '【時間線】已發生的決定不可撤銷，不能重來。',
    '【問主角】若要問主角，直接開放式提問，不要給選項、不要選擇題。'
  ].join('\n');
  async function gateway(system, user) {
    if (MOCK) return window.__yinxuMockGateway ? window.__yinxuMockGateway(system, user) : '';
    if (localStorage.getItem('yinxuAiOff') === '1') return '';
    var r = await fetch(CFG.url + '/functions/v1/ai-gateway', { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: CFG.anon, Authorization: 'Bearer ' + CFG.anon },
      body: JSON.stringify({ provider: 'groq', model: 'openai/gpt-oss-120b', messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }) });
    var d = await r.json(); return d.content || d.text || d.response || (d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content) || '';
  }
  function parseJSON(s) { try { var m = String(s).match(/\{[\s\S]*\}/); return m ? JSON.parse(m[0]) : null; } catch (_) { return null; } }
  function castText() { return book.characters.map(function (c) { return c.id + '=' + c.name + '（' + c.personality + '）'; }).join('；') + '；主角=' + chars.__me.name + '（由讀者扮演，不可替他說話）'; }
  function historyText() { return st.transcript.slice(-24).map(function (l) { return (l.speaker === 'narrator' ? '說書人' : (chars[l.speaker] || {}).name || l.speaker) + '：' + l.text; }).join('\n'); }
  async function adaptSegment(segment, nextPrompt, decision) {
    var sys = '你是因序小說的編導，統籌說書人與各角色 AI。繁體中文、口語、每句不超過 45 字。\n' + RULES +
      '\n角色：' + castText() + '\n只輸出 JSON：{"lines":[{"speaker":"角色id或narrator","text":"..."}],"ask":"下一個要問主角的話（若有）"}';
    var user = '已發生（不可改）：\n' + historyText() + '\n\n主角剛剛的回答：「' + decision.answer + '」' + (decision.by === 'auto' ? '（主角 AI 代答）' : '') +
      '\n\n原劇本接下來的段落（可改寫以符合主角的回答，保留場景氛圍，2–5 句，先讓角色對主角的回答做出真實反應）：\n' +
      segment.map(function (n) { return n.speaker + '：' + n.text; }).join('\n') +
      (nextPrompt ? '\n\n段落結束時要由 ' + nextPrompt.speaker + ' 問主角（原問句：「' + nextPrompt.text + '」）。若原問句已不合情境請改寫成開放式問句，放在 ask。' : '\n\n這是最後一段，請給出依目前時間線自然收束的結尾，不要回到原結局。');
    try { var j = parseJSON(await gateway(sys, user)); if (j && Array.isArray(j.lines) && j.lines.length) return { lines: j.lines.filter(function (l) { return l && l.text && (l.speaker === 'narrator' || chars[l.speaker]) && l.speaker !== '__me'; }).slice(0, 6), ask: j.ask }; } catch (e) { console.warn('adapt failed', e); }
    return null;
  }

  /* ---------- 時間線 ---------- */
  function segmentFrom(i) { var seg = []; while (i < book.nodes.length && book.nodes[i].type !== 'prompt') seg.push(book.nodes[i++]); return { seg: seg, next: i < book.nodes.length ? i : -1 }; }
  async function playPrompt(node, askText) {
    var q = askText || node.text; sfx('ask');
    record(node.speaker, q, 'ask'); await say(q, node.speaker);
    var ans = await listen(SILENCE);
    if (!ans) { status('沒聽到，再問一次…'); record(node.speaker, q, 'ask', { repeat: true }); await say(q, node.speaker); ans = await listen(SILENCE); }
    var by = 'reader';
    if (!ans) { by = 'auto'; ans = node.original_answer || '……我想想，先這樣吧。'; }
    record('__me', ans, 'me', { by: by }); if (by === 'auto') await say(ans, '__me');
    var d = { node: st.idx, question: q, answer: ans, by: by, at: new Date().toISOString() }; st.decisions.push(d); persist(); return d;
  }
  async function run() {
    while (st.idx < book.nodes.length) {
      await waitUnpaused();
      if (st.segment) { await playSegment(); continue; }
      var node = book.nodes[st.idx];
      if (node.type === 'prompt') {
        var d = await playPrompt(node, st.pendingAsk); st.pendingAsk = null;
        var s = segmentFrom(st.idx + 1); var nextPrompt = s.next >= 0 ? book.nodes[s.next] : null;
        status('…'); var ad = await adaptSegment(s.seg, nextPrompt, d);
        st.segment = ad ? ad.lines : s.seg.map(function (n) { return { speaker: n.speaker, text: n.text, sfx: n.sfx }; });
        if (ad && s.seg[0] && s.seg[0].sfx) st.segment[0].sfx = s.seg[0].sfx;
        st.pendingAsk = ad && ad.ask && nextPrompt ? ad.ask : null; st.idx = s.next >= 0 ? s.next : book.nodes.length; st.segPos = 0; persist();
        await playSegment();
      } else {
        var s0 = segmentFrom(st.idx); st.segment = s0.seg.map(function (n) { return { speaker: n.speaker, text: n.text, sfx: n.sfx }; });
        st.segPos = st.segPos || 0; st.idx = s0.next >= 0 ? s0.next : book.nodes.length; persist(); await playSegment();
      }
    }
    await finish();
  }
  async function playSegment() {
    while (st.segment && st.segPos < st.segment.length) {
      var l = st.segment[st.segPos]; if (l.sfx) sfx(l.sfx); record(l.speaker, l.text); st.segPos++; persist(); await say(l.text, l.speaker);
    }
    st.segment = null; st.segPos = 0; persist();
  }
  async function finish() {
    status('正在把這條時間線寫成新的一部…'); $('mic').classList.add('show'); $('typed').style.display = 'none'; $('sendTyped').style.display = 'none';
    var story = '', title = '';
    var j = parseJSON(await gateway('你是小說家。把互動紀錄整理成一篇完整的繁體中文短篇小說（400–700 字，第三人稱，主角叫' + chars.__me.name + '）。忠於紀錄中已發生的事，不要改回原結局。只輸出 JSON：{"title":"新標題（不含書名號）","story":"..."}', historyText()).catch(function () { return ''; }));
    if (j && j.story) { story = j.story; title = j.title || ''; }
    if (!story) story = st.transcript.map(function (l) { return l.speaker === 'narrator' ? l.text : ((chars[l.speaker] || {}).name || l.speaker) + '說：「' + l.text + '」'; }).join('\n');
    var parts = 1 + YinxuStore.children(book.book_id).length; var part = (book.part || 1) + 1;
    var nb = {
      book_id: book.book_id + '-t' + Date.now().toString(36), parent_id: book.book_id, part: part,
      title: book.title.replace(/｜.*$/, '') + '｜第' + part + '部' + (title ? '：' + title : '') + (parts > 1 ? '（時間線 ' + parts + '）' : ''),
      protagonist: book.protagonist, original_ending: (j && j.story ? story.slice(-160) : st.decisions.map(function (d) { return d.answer; }).join('；')),
      characters: book.characters, created_at: new Date().toISOString(), story_text: story,
      nodes: st.transcript.filter(function (l) { return !l.repeat; }).reduce(function (a, l, i, arr) {
        if (l.speaker === '__me') return a;
        var nx = arr[i + 1]; if (l.cls === 'ask' && nx && nx.speaker === '__me') a.push({ type: 'prompt', speaker: l.speaker, text: l.text, original_answer: nx.text });
        else a.push({ type: l.speaker === 'narrator' ? 'narrator' : 'character', speaker: l.speaker, text: l.text }); return a; }, []),
      timeline_state: { current_node: 0, decisions: st.decisions, irreversible: true }
    };
    YinxuStore.save(nb); st.ended = true; localStorage.removeItem(RUN_KEY); sfx('chime');
    $('end').style.display = 'flex'; $('endTitle').textContent = nb.title; $('endStory').textContent = story;
    status('');
  }

  /* ---------- 控制 ---------- */
  function setPaused(p) { paused = p; $('pauseBtn').textContent = p ? '▶ 繼續' : '⏸ 暫停'; if (p) { cancelCur && cancelCur(); if (ac) ac.suspend(); } else { if (ac) ac.resume(); var w = resumeWaiters; resumeWaiters = []; w.forEach(function (f) { f(); }); } }
  $('pauseBtn').onclick = function () { setPaused(!paused); };
  function syncBgm() { $('bgmBtn').classList.toggle('on', bgmOn); $('bgmBtn').textContent = bgmOn ? '🎵 音樂開' : '🔇 音樂關'; }
  $('bgmBtn').onclick = function () { bgmOn = !bgmOn; localStorage.setItem('yinxuBgmOff', bgmOn ? '0' : '1'); syncBgm(); bgmOn ? bgmStart() : bgmStop(); };
  $('ttsBtn').onclick = function () { ttsGemini = !ttsGemini; geminiBroken = false; localStorage.setItem('yinxuGeminiTts', ttsGemini ? '1' : '0'); $('ttsBtn').classList.toggle('on', ttsGemini); };
  $('ttsBtn').classList.toggle('on', ttsGemini); syncBgm();
  $('bookTitle').textContent = book.title;
  history.pushState(null, '', location.href); window.addEventListener('popstate', function () { if (!st.ended && confirm('時間線不可倒退。要離開並保留進度嗎？')) { location.href = 'yinxu-shelf.html'; } else history.pushState(null, '', location.href); });
  if (st.transcript.length) { restoreTranscript(); $('startBtn').textContent = '▶ 從中斷處繼續（不可重來）'; }
  $('startBtn').onclick = function () {
    $('intro').style.display = 'none'; audio(); if (bgmOn) bgmStart();
    if (window.speechSynthesis && !MOCK) { var u = new SpeechSynthesisUtterance(' '); u.volume = 0; speechSynthesis.speak(u); }
    run().catch(function (e) { status('發生錯誤：' + esc(e.message || e)); console.error(e); });
  };
  window.__yinxu = { state: function () { return st; }, book: book };
})();
