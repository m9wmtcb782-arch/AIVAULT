/* 因序小說 v2 播放引擎
   - 開場：預編譯節點（到第一個提問為止），之後由後端「執行期導演」依讀者回答自由生成（不回原著）
   - 聽不懂 → 由提問角色追問一次；真正沉默兩次 → 主角 AI 代答
   - 語音：Gemini 角色聲線（後端快取），額度不足時標示「備援語音」改用瀏覽器語音
   - 時間線不可逆（進度存 localStorage，不能倒退） */
(function () {
  var Q = new URLSearchParams(location.search), MOCK = Q.get('mock') === '1', SILENCE = +Q.get('silence') || 8000, MAX_TURNS = 12;
  var $ = function (id) { return document.getElementById(id); }, A = window.YinxuAudio, API = window.YinxuAPI;
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  var book = null, chars = {}, st = null, RUN_KEY = '', paused = false, waiters = [], offline = false;
  var audioEl = new Audio(); audioEl.preload = 'auto'; audioEl.setAttribute('playsinline', '');
  var ttsCache = {}, ttsCooldown = 0;

  /* ---------- 載入 ---------- */
  async function loadBook() {
    var id = Q.get('book') || 'lighthouse-night', b = YinxuStore.get(id);
    if (!b && /^yx-/.test(id)) { var d = await API.call('get', { book_id: id }); b = d.book; }
    return b;
  }
  function persist() { localStorage.setItem(RUN_KEY, JSON.stringify(st)); }
  function freshState() { return { idx: 0, phase: 'script', queue: [], prompt: null, decisions: [], transcript: [], facts: [], causes: [], act: 1, turn: 0, ending: false, mood: 'calm', started_at: new Date().toISOString() }; }

  /* ---------- 畫面 ---------- */
  function nameOf(id) { return id === 'narrator' ? '說書人' : id === '__me' ? '你（' + chars.__me.name + '）' : (chars[id] || {}).name || id; }
  function addLine(l) {
    var d = document.createElement('div'); d.className = 'line ' + (l.speaker === 'narrator' ? 'narrator ' : '') + (l.cls || '');
    d.innerHTML = '<span class="who">' + esc((l.speaker === 'narrator' ? '🎙 ' : l.speaker === '__me' ? '🧑 ' : '🗣 ') + nameOf(l.speaker)) + (l.fallback ? ' <em class="fb">🔈 備援語音</em>' : '') + (l.by === 'auto' ? ' <em class="fb">主角 AI 代答</em>' : '') + '</span>' + esc(l.text);
    $('stage').appendChild(d); d.scrollIntoView({ behavior: 'smooth', block: 'end' }); return d;
  }
  function record(l) { st.transcript.push(l); persist(); return addLine(l); }
  function status(t) { $('micSt').innerHTML = t || ''; $('mic').classList.toggle('show', !!t || $('mic').dataset.listening === '1'); }

  /* ---------- 語音 ---------- */
  function voiceOf(id) { var c = id === '__me' ? book.protagonist || {} : chars[id] || chars.narrator || {}; return { voice: c.tts_voice || (id === '__me' ? 'Puck' : 'Sulafat'), style: c.tts_style || '', type: id === 'narrator' ? 'narrator' : c.voice_type || 'male' }; }
  function ttsKey(text, id) { var v = voiceOf(id); return v.voice + '|' + text; }
  function fetchTTS(text, id, preUrl) {
    var k = ttsKey(text, id); if (preUrl) ttsCache[k] = Promise.resolve(preUrl);
    if (ttsCache[k]) return ttsCache[k];
    if (offline || Date.now() < ttsCooldown) return Promise.resolve(null);
    var v = voiceOf(id);
    ttsCache[k] = API.call('tts', { text: text, voice: v.voice, style: v.style }).then(function (d) { return d.url || null; }).catch(function (e) {
      if (e.status === 429) ttsCooldown = Date.now() + ((e.data && e.data.retry_after) || 60) * 1000; delete ttsCache[k]; return null; });
    return ttsCache[k];
  }
  var VP = { narrator: [1.0, 0.95], female: [1.15, 1.0], male: [0.8, 0.95], old: [0.6, 0.82], child: [1.6, 1.1] };
  function speakBrowser(text, id) {
    return new Promise(function (res) {
      if (!window.speechSynthesis || MOCK) return setTimeout(res, MOCK ? 120 : 1500);
      var u = new SpeechSynthesisUtterance(text), p = VP[voiceOf(id).type] || VP.male; u.lang = 'zh-TW'; u.pitch = p[0]; u.rate = p[1];
      var zh = speechSynthesis.getVoices().filter(function (v) { return /zh[-_]TW/i.test(v.lang); }); if (zh.length) u.voice = zh[(Object.keys(chars).indexOf(id) + 1) % zh.length];
      var done = false; function fin() { if (!done) { done = true; res(); } } u.onend = fin; u.onerror = fin; cur = { cancel: function () { speechSynthesis.cancel(); }, replay: true };
      speechSynthesis.cancel(); speechSynthesis.speak(u);
    });
  }
  var cur = null;
  function playUrl(url) {
    return new Promise(function (res) { var done = false; function fin() { if (!done) { done = true; res(true); } }
      audioEl.onended = fin; audioEl.onerror = function () { if (!done) { done = true; res(false); } }; audioEl.src = url;
      cur = { pause: function () { audioEl.pause(); }, resume: function () { audioEl.play().catch(fin); } };
      audioEl.play().catch(function () { if (!done) { done = true; res(false); } }); });
  }
  function waitUnpaused() { return paused ? new Promise(function (r) { waiters.push(r); }) : Promise.resolve(); }
  async function speak(line, el, preUrl) {
    await waitUnpaused(); A.duck(true);
    var url = MOCK ? null : await fetchTTS(line.text, line.speaker, preUrl);
    var ok = false;
    if (url) ok = await playUrl(url);
    if (!ok) { if (el && !line.fallback) { line.fallback = true; persist(); var w = el.querySelector('.who'); if (w) w.insertAdjacentHTML('beforeend', ' <em class="fb">🔈 備援語音</em>'); }
      for (;;) { await speakBrowser(line.text, line.speaker); if (!paused) break; await waitUnpaused(); } }
    cur = null; A.duck(false); await waitUnpaused();
  }

  /* ---------- 麥克風 ---------- */
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  function listen(ms) {
    return new Promise(function (resolve) {
      var box = $('mic'), inp = $('typed'), tap = $('tapMic'), finished = false, rec = null, timer = null, heard = '';
      box.dataset.listening = '1'; box.classList.add('show'); inp.value = ''; tap.style.display = 'none';
      function done(v) { if (finished) return; finished = true; clearTimeout(timer); try { rec && rec.abort(); } catch (_) {} box.dataset.listening = '0'; status(''); resolve((v || '').trim()); }
      function arm(t) { clearTimeout(timer); timer = setTimeout(function () { paused ? arm(t) : done(heard); }, t); }
      $('sendTyped').onclick = function () { done(inp.value); }; inp.onkeydown = function (e) { if (e.key === 'Enter' && !e.isComposing) done(inp.value); };
      inp.oninput = function () { arm(ms + 6000); };
      function start() {
        if (!SR || MOCK) { status('⌨️ 這個瀏覽器不支援語音辨識，請打字回答'); return; }
        try { rec = new SR(); rec.lang = 'zh-TW'; rec.interimResults = true; rec.continuous = false;
          rec.onresult = function (e) { var t = ''; for (var i = 0; i < e.results.length; i++) t += e.results[i][0].transcript; heard = t; inp.value = t; arm(3000); if (e.results[e.results.length - 1].isFinal) setTimeout(function () { done(heard); }, 700); };
          rec.onerror = function (e) { if (/not-allowed|service-not-allowed/.test(e.error)) { tap.style.display = ''; status('🎤 點「開麥」允許麥克風，或直接打字'); } };
          rec.onend = function () { if (!finished && heard) done(heard); };
          rec.start(); A.sfx('mic'); status('<span class="pulse"></span>請直接說出你的回答…（也可以打字）');
        } catch (e) { tap.style.display = ''; status('🎤 點「開麥」開始說話，或直接打字'); } }
      tap.onclick = function () { tap.style.display = 'none'; start(); arm(ms); };
      start(); arm(ms);
    });
  }

  /* ---------- 導演 ---------- */
  function slimBook() { return { title: book.title, protagonist: book.protagonist, original_ending: book.original_ending, characters: book.characters.map(function (c) { return { id: c.id, name: c.name, personality: c.personality, speech_style: c.speech_style, voice_type: c.voice_type, agent: c.agent ? { id: c.agent.id, name: c.agent.name, trait: c.agent.trait } : undefined }; }), outline: book.outline && book.outline.length ? book.outline : book.nodes.map(function (n) { return n.speaker + '：' + n.text; }).join('\n').slice(0, 6000) }; }
  function recent() { return st.transcript.slice(-30).map(function (l) { return nameOf(l.speaker) + '：' + l.text; }).join('\n'); }
  async function direct(q, ans, by, clarified) {
    for (var tries = 0; ; tries++) {
      try {
        status('🌟 暗星導演正在理解你的回答…');
        var r = await API.call('direct', { book: slimBook(), state: { causes: st.causes || [], facts: st.facts, act: st.act, turn: st.turn, decisions: st.decisions, recent: recent() }, asker: q.speaker, question: q.text, answer: ans, by: by, clarified: clarified });
        status(''); return r;
      } catch (e) {
        if (e.status === 401) { status('需要登入才能使用 AI 導演。<a href="' + API.loginUrl() + '">登入</a>'); await new Promise(function () {}); }
        if (tries < 1) continue;
        await new Promise(function (res) { status('AI 導演暫時連不上（' + esc(e.message) + '）。故事會停在這裡等你，不會回到原劇情。 <button class="btn" id="retryDirect">重試</button>'); $('retryDirect').onclick = res; });
      }
    }
  }
  function cleanLines(lines) { return (lines || []).filter(function (l) { return l && l.text && l.speaker !== '__me' && (l.speaker === 'narrator' || chars[l.speaker]); }).slice(0, 10).map(function (l) { return { speaker: l.speaker, text: String(l.text).slice(0, 200), sfx: l.sfx || '' }; }); }
  async function askOnce(q, repeat) { A.sfx('ask'); var el = record({ speaker: q.speaker, text: q.text, cls: 'ask', repeat: !!repeat }); await speak({ speaker: q.speaker, text: q.text }, el, q.audio_url); return listen(SILENCE); }
  async function handlePrompt() {
    var q = st.prompt, ans = await askOnce(q), by = 'reader';
    if (!ans) { status('沒有聽到回答，再問一次…'); ans = await askOnce(q, true); }
    if (!ans) { by = 'auto'; ans = q.original_answer || ''; }
    if (ans) { var el = record({ speaker: '__me', text: ans, cls: 'me', by: by }); if (by === 'auto') await speak({ speaker: '__me', text: ans }, el); }
    var r = await direct(q, ans, by, false);
    if (by === 'auto' && !ans) { ans = String(r.auto_answer || '……').slice(0, 200); var e2 = record({ speaker: '__me', text: ans, cls: 'me', by: 'auto' }); await speak({ speaker: '__me', text: ans }, e2); }
    if (r.understood === false && by === 'reader' && r.clarify) {
      var cq = { speaker: q.speaker, text: String(r.clarify).slice(0, 200) }, a2 = await askOnce(cq);
      if (!a2) a2 = await askOnce(cq, true);
      if (a2) { record({ speaker: '__me', text: a2, cls: 'me', by: 'reader' }); ans = ans + ' → ' + a2; }
      q = cq; r = await direct(cq, a2 || ans, a2 ? 'reader' : 'auto', true);
    }
    st.decisions.push({ question: q.text, answer: ans, by: by, interpretation: r.interpretation || '', at: new Date().toISOString() });
    (r.world && r.world.facts || []).forEach(function (f) { if (f && st.facts.indexOf(f) < 0) st.facts.push(String(f).slice(0, 120)); });
    applyCauses(r);
    if (r.world && r.world.act) st.act = r.world.act; st.turn++; if (r.mood) st.mood = r.mood;
    st.queue = cleanLines(r.lines); st.prompt = !r.ending && st.turn < MAX_TURNS && r.prompt && r.prompt.text && chars[r.prompt.speaker] ? { speaker: r.prompt.speaker, text: String(r.prompt.text).slice(0, 200) } : null;
    st.ending = !st.prompt; persist();
  }
  /* ---------- 因果 ---------- */
  function applyCauses(r) {
    st.causes = st.causes || []; var fresh = 0;
    (r.paid_off || []).forEach(function (id) { st.causes.forEach(function (c) { if (c.id === id) c.paid = true; }); });
    (r.new_causes || []).slice(0, 2).forEach(function (c) { var t = String((c && c.text) || c || '').slice(0, 60); if (!t) return;
      st.causes.push({ id: 'c' + (st.causes.length + 1), text: t, weight: Math.min(3, Math.max(1, +(c && c.weight) || 1)), turn: st.turn + 1, paid: false }); fresh++; });
    if (r.ending && r.recap) st.recap = (r.recap || []).slice(0, 8);
    renderCause(fresh);
  }
  function renderCause(fresh) {
    var b = $('causeBtn'); if (!b) return; var n = (st.causes || []).length; b.style.display = n ? '' : 'none'; b.textContent = '因 ' + n;
    if (fresh) { b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); }
  }
  function causeList() { return (st.causes || []).map(function (c) { return '<li>' + (c.paid ? '✅' : '🌱') + ' ' + esc(c.text) + ' <small>（第' + c.turn + '回）</small></li>'; }).join('') || '<li>還沒有種下任何因</li>'; }
  async function playQueue() {
    while (st.queue.length) {
      var l = st.queue[0]; if (l.mood) st.mood = l.mood; A.setMood(st.mood); if (l.sfx) A.sfx(l.sfx);
      var el = record({ speaker: l.speaker, text: l.text, fallback: false });
      if (st.queue[1]) fetchTTS(st.queue[1].text, st.queue[1].speaker, st.queue[1].audio_url);
      await speak({ speaker: l.speaker, text: l.text }, el, l.audio_url); st.queue.shift(); persist();
    }
  }
  function loadScript() {
    var urls = book.audio_urls || {};
    while (st.idx < book.nodes.length) {
      var n = book.nodes[st.idx], u = urls[st.idx]; st.idx++;
      if (n.type === 'prompt') { st.prompt = { speaker: n.speaker, text: n.text, original_answer: n.original_answer, audio_url: u }; break; }
      st.queue.push({ speaker: n.speaker, text: n.text, sfx: n.sfx, mood: n.mood, audio_url: u });
    }
    st.phase = 'live'; persist();
  }
  async function run() {
    A.setMood(st.mood);
    for (;;) {
      await waitUnpaused();
      if (st.queue.length) { await playQueue(); continue; }
      if (st.phase === 'script') { loadScript(); continue; }
      if (st.prompt) { await handlePrompt(); continue; }
      break;
    }
    await finish();
  }

  /* ---------- 結束：新時間線 ---------- */
  async function finish() {
    status('📝 正在把這條時間線寫成新的一部…');
    var tx = st.transcript.filter(function (l) { return !l.repeat; }).map(function (l) { return nameOf(l.speaker) + '：' + l.text; }).join('\n'), story = '', title = '', newEnd = '';
    try { var j = await API.call('novelize', { transcript: '書名：' + book.title + '\n主角：' + chars.__me.name + '\n' + tx }); story = j.story || ''; title = j.title || ''; newEnd = j.new_ending || ''; } catch (_) {}
    if (!story) story = tx;
    var part = (book.part || 1) + 1, siblings = YinxuStore.children(book.book_id).length;
    var nb = { book_id: book.book_id + '-t' + Date.now().toString(36), parent_id: book.book_id, part: part,
      title: book.title.replace(/｜.*$/, '') + '｜第' + part + '部' + (title ? '：' + title.replace(/[《》]/g, '') : '') + (siblings ? '（時間線 ' + (siblings + 1) + '）' : ''),
      opening: newEnd || story.slice(0, 80), protagonist: book.protagonist, original_ending: newEnd || story.slice(-120), characters: book.characters, outline: book.outline, cover: book.cover,
      created_at: new Date().toISOString(), story_text: story,
      nodes: st.transcript.filter(function (l) { return !l.repeat; }).reduce(function (a, l, i, arr) { if (l.speaker === '__me') return a; var nx = arr[i + 1];
        a.push(l.cls === 'ask' && nx && nx.speaker === '__me' ? { type: 'prompt', speaker: l.speaker, text: l.text, original_answer: nx.text } : { type: l.speaker === 'narrator' ? 'narrator' : 'character', speaker: l.speaker, text: l.text }); return a; }, []),
      crew: book.crew, timeline_state: { current_node: 0, decisions: st.decisions, facts: st.facts, causes: st.causes, recap: st.recap, irreversible: true } };
    YinxuStore.save(nb);
    if (API.loggedIn() && !MOCK) API.call('save_timeline', { book: nb }).catch(function () {});
    localStorage.removeItem(RUN_KEY); A.sfx('bell'); status('');
    $('end').style.display = 'flex'; $('endTitle').textContent = nb.title; $('endStory').textContent = story;
    var rc = st.recap || [], cmap = {}; (st.causes || []).forEach(function (c) { cmap[c.id] = c.text; });
    $('endRecap').innerHTML = (st.causes || []).length ? '<b>因 → 果</b><ul>' + (rc.length ? rc.map(function (x) { return '<li>🌱 ' + esc(cmap[x.cause] || x.cause) + '<br>→ ' + esc(x.effect || '') + '</li>'; }).join('') : causeList()) + '</ul>' : '';
    var ag = book.characters.map(function (c) { return c.agent && c.agent.id; }).filter(Boolean);
    if (ag.length && API.loggedIn() && !MOCK) API.call('remember_play', { title: book.title, agent_ids: ag, summary: newEnd || story.slice(0, 200) }).catch(function () {});
  }

  /* ---------- 控制 ---------- */
  function setPaused(p) { paused = p; $('pauseBtn').textContent = p ? '▶ 繼續' : '⏸ 暫停';
    if (p) { if (cur && cur.pause) cur.pause(); else if (cur && cur.cancel) cur.cancel(); A.suspend(); }
    else { A.resume(); if (cur && cur.resume) cur.resume(); var w = waiters; waiters = []; w.forEach(function (f) { f(); }); } }
  function syncBgm() { $('bgmBtn').textContent = A.musicOn() ? '🎵' : '🔇'; $('bgmBtn').classList.toggle('on', A.musicOn()); }
  async function init() {
    try { book = await loadBook(); } catch (e) { if (e.status === 401) { location.replace(API.loginUrl()); return; } }
    if (!book) { document.body.innerHTML = '<p style="padding:24px;color:#ccc">找不到這本書。<a href="yinxu-shelf.html">回書架</a></p>'; return; }
    book.characters.forEach(function (c) { chars[c.id] = c; }); chars.narrator = chars.narrator || { id: 'narrator', name: '說書人', voice_type: 'narrator' };
    chars.__me = { id: '__me', name: (book.protagonist && book.protagonist.name) || '主角' };
    RUN_KEY = 'yinxu.run2.' + book.book_id;
    try { st = JSON.parse(localStorage.getItem(RUN_KEY) || 'null'); } catch (_) {} if (!st || st.ending && !st.queue.length) st = freshState();
    $('bookTitle').textContent = book.title; $('introTitle').textContent = book.title; $('introText').textContent = book.opening || '';
    var cv = book.cover || {}; $('introCover').style.background = 'linear-gradient(160deg,' + (cv.from || '#312e81') + ',' + (cv.to || '#0f172a') + ')'; $('introCover').textContent = cv.emoji || '📖';
    if (!API.loggedIn()) { $('loginHint').style.display = ''; $('loginHint').querySelector('a').href = API.loginUrl(); }
    if (book.crew && book.crew.length) $('introCrew').innerHTML = '<b>🌟 暗星指派的 AI 團隊</b><br>' + book.crew.map(function (x) { return esc((x.agent.avatar || '') + ' ' + x.agent.name + '｜' + x.role + (x.character ? '・' + x.character : '')); }).join('<br>');
    $('causeBtn').onclick = function () { var o = $('causes'); o.querySelector('ul').innerHTML = causeList(); o.style.display = 'flex'; }; renderCause(0);
    if (st.transcript.length) { st.transcript.forEach(addLine); $('startBtn').textContent = '▶ 從中斷處繼續（時間線不可重來）'; }
    $('pauseBtn').onclick = function () { setPaused(!paused); };
    $('bgmBtn').onclick = function () { A.setMusic(!A.musicOn()); syncBgm(); }; syncBgm();
    history.pushState(null, '', location.href); window.addEventListener('popstate', function () { if (confirm('時間線不可倒退。要離開並保留進度嗎？')) location.href = 'yinxu-shelf.html'; else history.pushState(null, '', location.href); });
    $('startBtn').onclick = function () {
      offline = !API.loggedIn(); $('intro').style.display = 'none'; A.ctx();
      audioEl.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA='; audioEl.play().catch(function () {});
      if (window.speechSynthesis && !MOCK) { var u = new SpeechSynthesisUtterance(' '); u.volume = 0; speechSynthesis.speak(u); }
      run().catch(function (e) { status('發生錯誤：' + esc(e.message || e)); console.error(e); });
    };
  }
  window.__yinxu = { state: function () { return st; }, applyCauses: function (r) { applyCauses(r); } };
  init();
})();
