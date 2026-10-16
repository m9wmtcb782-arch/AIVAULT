/* 因序小說：情境環境音與配樂（WebAudio 合成；依場景情緒切換、淡入淡出）+ 音效。無外部檔案、無版權問題。 */
window.YinxuAudio = (function () {
  var ac = null, master = null, bed = null, musicOn = localStorage.getItem('yinxuBgmOff') !== '1', mood = null, timers = [];
  function ctx() { if (!ac) { var C = window.AudioContext || window.webkitAudioContext; if (!C) return null; ac = new C(); master = ac.createGain(); master.gain.value = 1; master.connect(ac.destination); } if (ac.state === 'suspended') ac.resume(); return ac; }
  function noiseBuf(kind) { var a = ctx(), n = a.sampleRate * 4, b = a.createBuffer(1, n, a.sampleRate), d = b.getChannelData(0), last = 0, b0 = 0, b1 = 0, b2 = 0;
    for (var i = 0; i < n; i++) { var w = Math.random() * 2 - 1;
      if (kind === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
      else if (kind === 'pink') { b0 = 0.997 * b0 + w * 0.029591; b1 = 0.985 * b1 + w * 0.032534; b2 = 0.95 * b2 + w * 0.048056; d[i] = (b0 + b1 + b2 + w * 0.05) * 1.6; }
      else d[i] = w; }
    return b; }
  function loopNoise(kind, filter, f, q, vol, dest) { var a = ctx(), s = a.createBufferSource(); s.buffer = noiseBuf(kind); s.loop = true; var fl = a.createBiquadFilter(); fl.type = filter; fl.frequency.value = f; fl.Q.value = q || 0.7; var g = a.createGain(); g.gain.value = vol; s.connect(fl); fl.connect(g); g.connect(dest); s.start(); return { src: s, filter: fl, gain: g }; }
  function lfo(param, rate, depth, base) { var a = ctx(), o = a.createOscillator(), g = a.createGain(); o.frequency.value = rate; g.gain.value = depth; o.connect(g); g.connect(param); param.value = base; o.start(); return o; }
  var CHORDS = { calm: [[57, 60, 64], [53, 57, 60], [55, 59, 62], [52, 55, 59]], warm: [[60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62]], sad: [[57, 60, 64], [53, 57, 60], [50, 53, 57], [52, 56, 59]], tense: [[52, 55, 58], [53, 56, 59], [52, 55, 58], [51, 54, 57]], mystery: [[50, 53, 57], [51, 55, 58], [50, 53, 56], [48, 51, 55]], night: [[55, 58, 62], [51, 55, 58], [53, 56, 60], [50, 53, 57]], storm: [[45, 48, 52], [46, 49, 53], [45, 48, 51], [43, 46, 50]], battle: [[45, 52, 57], [43, 50, 55], [41, 48, 53], [43, 50, 55]] };
  var AMB = { calm: 'waves', warm: 'birds', sad: 'rain', tense: 'wind', mystery: 'wind', night: 'night', storm: 'storm', battle: 'wind' };
  function hz(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  function stopBed(fade) { if (!bed) return; var b = bed; bed = null; timers.forEach(clearInterval); timers = []; var t = ac.currentTime; b.out.gain.cancelScheduledValues(t); b.out.gain.setValueAtTime(b.out.gain.value, t); b.out.gain.linearRampToValueAtTime(0, t + (fade || 2)); setTimeout(function () { b.nodes.forEach(function (n) { try { n.stop ? n.stop() : n.disconnect(); } catch (_) {} }); try { b.out.disconnect(); } catch (_) {} }, (fade || 2) * 1000 + 200); }
  function setMood(m) {
    m = CHORDS[m] ? m : 'calm'; if (!musicOn) { mood = m; return; } if (m === mood && bed) return; mood = m; var a = ctx(); if (!a) return; stopBed(2.5);
    var out = a.createGain(); out.gain.value = 0; out.connect(master); out.gain.linearRampToValueAtTime(1, a.currentTime + 3); var nodes = [];
    var amb = AMB[m];
    if (amb === 'waves' || amb === 'storm') { var w = loopNoise('brown', 'lowpass', 700, 0.5, 0.28, out); nodes.push(w.src, lfo(w.gain.gain, 0.09, 0.16, 0.2)); }
    if (amb === 'rain' || amb === 'storm') { var r = loopNoise('pink', 'highpass', 1200, 0.5, amb === 'storm' ? 0.16 : 0.08, out); nodes.push(r.src); }
    if (amb === 'wind' || amb === 'storm') { var wd = loopNoise('pink', 'bandpass', 500, 1.2, 0.12, out); nodes.push(wd.src, lfo(wd.filter.frequency, 0.07, 300, 600), lfo(wd.gain.gain, 0.05, 0.06, 0.1)); }
    if (amb === 'night') timers.push(setInterval(function () { if (Math.random() < 0.6) for (var i = 0; i < 3; i++) blip(4200 + Math.random() * 300, 0.03, 0.025, i * 0.07, out); }, 900));
    if (amb === 'birds') timers.push(setInterval(function () { if (Math.random() < 0.35) chirp(out); }, 1500));
    if (amb === 'storm') timers.push(setInterval(function () { if (Math.random() < 0.18) thunder(out, 0.5); }, 4000));
    var pad = a.createGain(); pad.gain.value = 0.05; var lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = m === 'battle' ? 1400 : 800; pad.connect(lp); lp.connect(out);
    var k = 0, seq = CHORDS[m], dur = m === 'tense' || m === 'battle' ? 3 : 6;
    function chord() { var t = a.currentTime; seq[k++ % seq.length].forEach(function (n, i) { [0, 7].forEach(function (det) { var o = a.createOscillator(), g = a.createGain(); o.type = i ? 'sine' : 'triangle'; o.frequency.value = hz(n); o.detune.value = det; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.5, t + dur * 0.35); g.gain.linearRampToValueAtTime(0, t + dur + 1.2); o.connect(g); g.connect(pad); o.start(t); o.stop(t + dur + 1.3); }); });
      if (m === 'calm' || m === 'warm' || m === 'night' || m === 'sad') { var nn = seq[(k - 1) % seq.length]; [0, 1, 2, 1].forEach(function (j, s) { blip(hz(nn[j] + 12), 1.2, 0.035, s * dur / 4, pad); }); }
      if (m === 'battle' || m === 'tense') for (var s = 0; s < dur * 2; s++) blip(hz(seq[(k - 1) % seq.length][0] - 12), 0.18, s % 2 ? 0.05 : 0.09, s * 0.5, pad, 'sine'); }
    chord(); timers.push(setInterval(chord, dur * 1000)); nodes.push(pad);
    bed = { out: out, nodes: nodes };
  }
  function blip(f, dur, vol, when, dest, type) { var a = ctx(); if (!a) return; var t = a.currentTime + (when || 0), o = a.createOscillator(), g = a.createGain(); o.type = type || 'sine'; o.frequency.value = f; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g); g.connect(dest || master); o.start(t); o.stop(t + dur + 0.05); }
  function chirp(dest) { var a = ctx(), t = a.currentTime; for (var i = 0; i < 3; i++) { var o = a.createOscillator(), g = a.createGain(), s = t + i * 0.12; o.frequency.setValueAtTime(2800, s); o.frequency.exponentialRampToValueAtTime(4200, s + 0.08); g.gain.setValueAtTime(0, s); g.gain.linearRampToValueAtTime(0.03, s + 0.02); g.gain.linearRampToValueAtTime(0, s + 0.1); o.connect(g); g.connect(dest); o.start(s); o.stop(s + 0.12); } }
  function burst(kind, filter, f, q, vol, dur, attack, dest) { var a = ctx(); if (!a) return; var s = a.createBufferSource(); s.buffer = noiseBuf(kind); var fl = a.createBiquadFilter(); fl.type = filter; fl.frequency.value = f; fl.Q.value = q; var g = a.createGain(), t = a.currentTime; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); s.connect(fl); fl.connect(g); g.connect(dest || master); s.start(t); s.stop(t + dur + 0.1); }
  function thunder(dest, v) { burst('brown', 'lowpass', 300, 0.5, v || 0.9, 3.5, 0.05, dest); setTimeout(function () { burst('brown', 'lowpass', 180, 0.5, (v || 0.9) * 0.7, 2.5, 0.2, dest); }, 400); }
  var SFX = {
    waves: function () { burst('brown', 'lowpass', 600, 0.5, 0.5, 3.5, 1.4); }, rain: function () { burst('pink', 'highpass', 1500, 0.5, 0.25, 4, 1); },
    wind: function () { burst('pink', 'bandpass', 700, 1.5, 0.3, 3, 1.2); }, thunder: function () { thunder(); }, storm: function () { thunder(); },
    fire: function () { for (var i = 0; i < 12; i++) setTimeout(function () { burst('white', 'highpass', 2500, 1, 0.12, 0.05, 0.002); }, Math.random() * 2000); },
    footsteps: function () { for (var i = 0; i < 4; i++) setTimeout(function () { burst('brown', 'lowpass', 400, 1, 0.6, 0.15, 0.005); }, i * 420); },
    door: function () { blip(120, 0.6, 0.3, 0, null, 'sawtooth'); burst('brown', 'lowpass', 250, 1, 0.8, 0.4, 0.005); },
    bell: function () { [523, 1046, 1568].forEach(function (f, i) { blip(f, 2.5, 0.1 / (i + 1)); }); }, chime: function () { [880, 1320, 1760].forEach(function (f, i) { blip(f, 1.8, 0.07, i * 0.15); }); },
    crowd: function () { burst('pink', 'bandpass', 900, 0.8, 0.25, 3, 0.8); }, birds: function () { chirp(master); setTimeout(function () { chirp(master); }, 700); },
    radio: function () { burst('white', 'bandpass', 2000, 3, 0.15, 0.8, 0.03); }, thud: function () { blip(80, 0.5, 0.5); burst('brown', 'lowpass', 200, 1, 0.6, 0.3, 0.005); },
    ask: function () { blip(660, 0.3, 0.08); blip(990, 0.45, 0.08, 0.16); }, mic: function () { blip(1200, 0.08, 0.05, 0, null, 'square'); }
  };
  function sfx(n) { try { if (n && SFX[n]) { ctx(); SFX[n](); } } catch (_) {} }
  function setMusic(on) { musicOn = on; localStorage.setItem('yinxuBgmOff', on ? '0' : '1'); if (on) { var m = mood; mood = null; setMood(m || 'calm'); } else stopBed(1); }
  function duck(on) { if (master && ac) master.gain.setTargetAtTime(on ? 0.45 : 1, ac.currentTime, 0.3); }
  return { ctx: ctx, setMood: setMood, sfx: sfx, setMusic: setMusic, musicOn: function () { return musicOn; }, duck: duck, suspend: function () { ac && ac.suspend(); }, resume: function () { ac && ac.resume(); } };
})();
