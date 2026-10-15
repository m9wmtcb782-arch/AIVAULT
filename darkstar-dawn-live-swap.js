/* 曙光即時：面板主角交換（曙光大、暗星小）＋ 曙光 📷 相機（約每秒 1 張 JPEG，{type:'video'}）。
   獨立模組：整檔 git revert 即可回滾。關閉開關：localStorage.dsDawnSwapOff = "1"。 */
(function (w, d) {
  "use strict";
  if (w.__DS_DAWN_SWAP__) return; w.__DS_DAWN_SWAP__ = true;
  try { if (localStorage.getItem("dsDawnSwapOff") === "1") return; } catch (e) {}
  var html = d.documentElement, front = false, cam = null, camOn = false, camTimer = 0, camStream = null, patched = false;
  function css() {
    var s = d.createElement("style");
    s.textContent =
      "#aivault-darkstar-avatar .dsfacebox #dsorb,#aivault-darkstar-avatar .dsfacebox #dsDawn{transition:all .35s ease}" +
      "html.ds-dawn-front #aivault-darkstar-avatar .dsfacebox #dsDawn.ds-orb{position:absolute!important;left:50%!important;top:50%!important;width:100px!important;height:100px!important;transform:translate(-50%,-56%);z-index:3}" +
      "html.ds-dawn-front #aivault-darkstar-avatar .dsfacebox #dsorb.ds-orb{position:absolute!important;left:4px!important;top:4px!important;width:46px!important;height:46px!important;z-index:2;opacity:.9}" +
      "@media(min-width:701px){html.ds-dawn-front #aivault-darkstar-avatar .dsfacebox #dsDawn.ds-orb{width:120px!important;height:120px!important}html.ds-dawn-front #aivault-darkstar-avatar .dsfacebox #dsorb.ds-orb{width:58px!important;height:58px!important;left:8px!important;top:8px!important}}" +
      "#dsDawnCam{position:fixed;right:9px;top:64px;width:112px;height:150px;z-index:82;border-radius:14px;overflow:hidden;background:#222;box-shadow:0 10px 28px rgba(0,0,0,.25)}" +
      "#dsDawnCam[hidden]{display:none}#dsDawnCam video{width:100%;height:100%;object-fit:cover;display:block;transform:scaleX(-1)}" +
      "#dsDawnCam.camoff{height:42px;width:42px}#dsDawnCam.camoff video{display:none}" +
      "#dsDawnCamBtn{position:absolute;left:6px;bottom:6px;width:30px;height:30px;border-radius:50%;border:0;background:rgba(0,0,0,.55);color:#fff;font-size:15px;line-height:30px;padding:0}" +
      "#dsDawnCam.camoff #dsDawnCamBtn{background:#f5b301}" +
      "@media(min-width:701px){#dsDawnCam{right:214px;top:72px;width:160px;height:120px}}";
    d.head.appendChild(s);
  }
  function api() { return w.DawnLightLiveVoice; }
  function dawnLive() {
    var A = api(); if (!A || !A.isOpen || !A.isOpen()) return false;
    try { var D = w.AivaultDualAgentLive; if (D && D.armed && !D.armed().dawn) return false; } catch (e) {}
    return true;
  }
  function darkLive() { try { var L = w.AIVAULTDarkStarLive; return !!(L && L.isConnected && L.isConnected()); } catch (e) { return false; } }
  // 曙光連線帶 video=1（與暗星相同 relay，暗星視訊即走這條）；僅在相機開著時才真的送畫面
  function patchUrl() {
    var A = api(); if (patched || !A || !A.session || !A.session.url) return;
    var orig = A.session.url.bind(A.session); patched = true;
    A.session.url = function () { return orig().replace("video=0", "video=1"); };
  }
  function ensureCam() {
    if (cam) return cam;
    cam = d.createElement("div"); cam.id = "dsDawnCam"; cam.className = "camoff"; cam.hidden = true;
    cam.innerHTML = '<video autoplay playsinline muted></video><button id="dsDawnCamBtn" type="button" aria-label="曙光相機">📷</button>';
    d.body.appendChild(cam);
    cam.querySelector("#dsDawnCamBtn").addEventListener("click", function (e) { e.stopPropagation(); camOn ? stopCam() : startCam(); });
    return cam;
  }
  function startCam() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;
    navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } }, audio: false }).then(function (s) {
      camStream = s; camOn = true; var v = cam.querySelector("video"); v.srcObject = s; v.play().catch(function () {});
      cam.classList.remove("camoff");
      var cv = d.createElement("canvas"), cx = cv.getContext("2d");
      clearInterval(camTimer);
      camTimer = setInterval(function () {
        var A = api(); if (!dawnLive() || !v.videoWidth) return;
        var W = 480, H = Math.round(W * v.videoHeight / v.videoWidth); cv.width = W; cv.height = H;
        try { cx.drawImage(v, 0, 0, W, H); } catch (e) { return; }
        var url = cv.toDataURL("image/jpeg", 0.7), i = url.indexOf(",");
        if (i > 0) A.sendRaw(JSON.stringify({ type: "video", data: url.slice(i + 1), mimeType: "image/jpeg" }));
      }, 1000);
    }).catch(function () { camOn = false; });
  }
  function stopCam() {
    camOn = false; clearInterval(camTimer); camTimer = 0;
    if (camStream) { camStream.getTracks().forEach(function (t) { t.stop(); }); camStream = null; }
    if (cam) { cam.querySelector("video").srcObject = null; cam.classList.add("camoff"); }
  }
  function setFront(on) {
    if (on === front) return; front = on; html.classList.toggle("ds-dawn-front", on);
    ensureCam().hidden = !on;
    if (!on) { stopCam(); var o = dawnOrb(); if (o) o.setTalking(0); }
  }
  function dawnOrb() { var D = w.AIVAULTDawnAvatar; return D && D.orb && D.orb(); }
  function tick() {
    patchUrl();
    var on = dawnLive() && !darkLive();
    setFront(on);
    if (on) {
      var A = api(), s = A && A.session, playing = !!(s && s.sources && s.sources.length), o = dawnOrb();
      if (o) o.setTalking(playing ? 0.3 + 0.5 * Math.abs(Math.sin(Date.now() / 90)) : 0);
    }
  }
  function init() { css(); setInterval(tick, 120); }
  if (d.readyState === "loading") d.addEventListener("DOMContentLoaded", init); else init();
  w.AIVAULTDawnLiveSwap = { state: function () { return { front: front, camOn: camOn, patched: patched }; } };
})(window, document);
