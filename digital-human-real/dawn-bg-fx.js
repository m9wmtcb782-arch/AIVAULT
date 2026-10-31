/* 曙光背景動態層：全息藍色地球自轉、窗外太陽自轉＋烈焰日冕。
   純 canvas、無外部資源（貼圖取自 idle 海報本身），rAF ~30fps，頁面隱藏或非 idle/talk 片段時停。
   設定來自 avatars.json 的 bgFx（座標以 lite 影格 480x640 為準）；沒有 bgFx 的數字人（暗星）完全不啟用。 */
(function (root) {
  function makeSphere(img, W, H, b, opts) {
    const r = b.r, pad = Math.ceil(r * (opts.pad || 0)), S = Math.ceil(2 * r) + 2 * pad;
    const src = document.createElement('canvas'); src.width = W; src.height = H;
    const sx = src.getContext('2d'); sx.drawImage(img, 0, 0, W, H);
    const sd = sx.getImageData(0, 0, W, H).data;
    const cv = document.createElement('canvas'); cv.width = S; cv.height = S;
    const ctx = cv.getContext('2d'); const out = ctx.createImageData(S, S);
    const c0 = S / 2;   // 球心在 canvas 中央
    const px = [];      // 預先計算：每個球面像素的經度、緯度高度、遮罩
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const nx = (x + 0.5 - c0) / r, ny = (y + 0.5 - c0) / r, d2 = nx * nx + ny * ny;
      if (d2 >= 1) continue;
      const z = Math.sqrt(1 - d2), d = Math.sqrt(d2);
      const feather = Math.min(1, (1 - d) / (opts.feather || 0.12));
      px.push([(y * S + x) * 4, Math.atan2(nx, z), ny, Math.sqrt(1 - ny * ny), z, feather]);
    }
    function sample(fx, fy) {
      let X = Math.round(b.cx + fx), Y = Math.round(b.cy + fy);
      if (X < 0) X = -X; if (X >= W) X = 2 * W - X - 2; if (Y < 0) Y = -Y; if (Y >= H) Y = 2 * H - Y - 2;
      return (Y * W + X) * 4;
    }
    function draw(theta) {
      const o = out.data, PI = Math.PI;
      for (const [i, lon, ny, cl, z, f] of px) {
        let L = lon + theta; L = ((L + PI) % (2 * PI) + 2 * PI) % (2 * PI) - PI;
        if (L > PI / 2) L = PI - L; else if (L < -PI / 2) L = -PI - L;   // 背面＝正面鏡像，接縫連續
        const s = sample(Math.sin(L * (opts.squeeze || 0.62)) * cl * r, ny * r);   // 只取中央較不變形的區域當貼圖，避免邊緣拉絲
        const sh = (opts.shadeMin || 0.75) + (1 - (opts.shadeMin || 0.75)) * z;
        o[i] = sd[s] * sh; o[i + 1] = sd[s + 1] * sh; o[i + 2] = sd[s + 2] * sh; o[i + 3] = 255 * f;
      }
      ctx.clearRect(0, 0, S, S); ctx.putImageData(out, 0, 0);
    }
    return { cv, ctx, S, pad, draw };
  }
  function noise(a, t, k) {   // 便宜的平滑雜訊（多頻正弦）
    return 0.5 + 0.25 * Math.sin(a * 7 + t * 1.3 + k) + 0.15 * Math.sin(a * 13 - t * 2.1 + k * 2) + 0.1 * Math.sin(a * 29 + t * 3.7);
  }
  function flames(sp, r, t) {
    const ctx = sp.ctx, c = sp.S / 2;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(c, c, r * 0.9, c, c, r * 1.4);
    const pulse = 0.22 + 0.06 * Math.sin(t * 2.3);
    g.addColorStop(0, 'rgba(255,140,40,' + pulse + ')'); g.addColorStop(1, 'rgba(255,60,0,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(c, c, r * 1.4, 0, 6.283); ctx.fill();
    const N = 90;
    for (let k = 0; k < N; k++) {
      const a = k / N * 6.283 + t * 0.05;
      const len = r * (0.06 + 0.3 * Math.pow(noise(a, t, k * 0.37), 2.2));
      const r0 = r * 0.9, x0 = c + Math.cos(a) * r0, y0 = c + Math.sin(a) * r0;
      const bend = 0.18 * Math.sin(t * 1.7 + k);
      const x1 = c + Math.cos(a + bend * 0.15) * (r0 + len), y1 = c + Math.sin(a + bend * 0.15) * (r0 + len);
      const lg = ctx.createLinearGradient(x0, y0, x1, y1);
      lg.addColorStop(0, 'rgba(255,200,90,0)'); lg.addColorStop(0.25, 'rgba(255,190,80,0.45)'); lg.addColorStop(0.6, 'rgba(255,110,20,0.25)'); lg.addColorStop(1, 'rgba(255,40,0,0)');
      ctx.strokeStyle = lg; ctx.lineWidth = Math.max(1, r * 0.035); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(c + Math.cos(a + bend * 0.3) * (r0 + len * 0.5), c + Math.sin(a + bend * 0.3) * (r0 + len * 0.5), x1, y1); ctx.stroke();
    }
    ctx.restore();
  }
  function attach(host, cfg, opts) {
    if (!host || !cfg || !cfg.poster) return null;
    const W = cfg.frameW || 480, H = cfg.frameH || 640, clips = cfg.clips || ['idle', 'talk'];
    const layer = document.createElement('div'); layer.className = 'dh-bgfx';
    layer.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:1;overflow:hidden;transition:opacity .2s linear;opacity:0;';
    host.appendChild(layer);
    const img = new Image(); img.decoding = 'async'; img.src = cfg.poster;
    let earth = null, sun = null, raf = 0, last = 0, t0 = performance.now(), dead = false;
    function place(sp, b) {
      const s = sp.cv.style; s.position = 'absolute';
      s.left = ((b.cx - sp.S / 2) / W * 100) + '%'; s.top = ((b.cy - sp.S / 2) / H * 100) + '%';
      s.width = (sp.S / W * 100) + '%'; s.height = (sp.S / H * 100) + '%';
      layer.appendChild(sp.cv);
    }
    img.onload = () => {
      try {
        if (cfg.earth) { earth = makeSphere(img, W, H, cfg.earth, { feather: 0.14, shadeMin: 0.8 }); place(earth, cfg.earth); }
        if (cfg.sun) { sun = makeSphere(img, W, H, cfg.sun, { pad: 0.45, feather: 0.06, shadeMin: 0.85 }); place(sun, cfg.sun); }
        if (sun) { sun.cv.style.mixBlendMode = 'normal'; }
        loop(performance.now());
      } catch (e) { dead = true; layer.remove(); }   // 例如 file:// 跨來源污染：直接放棄，不影響數字人
    };
    function loop(now) {
      raf = requestAnimationFrame(loop);
      if (document.hidden) return;
      const vis = !(opts && opts.visible) || opts.visible(clips);
      layer.style.opacity = vis ? 1 : 0;
      if (!vis || now - last < 33) return; last = now;
      const t = (now - t0) / 1000;
      if (earth) earth.draw(t * 2 * Math.PI / (cfg.earth.period || 40));
      if (sun) { sun.draw(t * 2 * Math.PI / (cfg.sun.period || 60)); flames(sun, cfg.sun.r, t); }
    }
    document.addEventListener('visibilitychange', () => { if (!document.hidden && !dead) last = 0; });
    return { layer, renderAt(t) { if (earth) earth.draw(t * 2 * Math.PI / (cfg.earth.period || 40)); if (sun) { sun.draw(t * 2 * Math.PI / (cfg.sun.period || 60)); flames(sun, cfg.sun.r, t); } }, stop() { cancelAnimationFrame(raf); layer.remove(); } };
  }
  root.DHBgFx = { attach };
})(typeof window !== 'undefined' ? window : globalThis);
