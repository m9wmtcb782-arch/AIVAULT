/* 曙光即時逐字稿合併（只改顯示）：dawn-light-live-voice.js 的 showDawnLine() 每個串流片段都新增一則訊息
   （「曙光：你」「曙光：好」…）。這裡把同一位說話者連續的片段合併成一則泡泡；換人說話或停頓超過 4 秒才開新泡泡。
   不碰曙光的音訊／socket。回滾：git revert 本檔 commit；停用：localStorage.dsDawnMergeOff = "1"。 */
(function (w, d) {
  "use strict";
  (function () { var st = d.createElement("style"); st.textContent = ".message-avatar.ds-dawn-av{background:none!important;animation:none!important;box-shadow:none!important;border:0!important;overflow:visible;font-size:0!important;flex:none}"; d.head.appendChild(st); })();
  if (w.__dsDawnMerge) return; w.__dsDawnMerge = 1;
  try { if (localStorage.getItem("dsDawnMergeOff") === "1") return; } catch (e) {}
  var RE = /^(曙光|你)：/;
  function info(row) {
    if (!row || row.nodeType !== 1 || !row.classList || !row.classList.contains("message")) return null;
    var b = null; for (var i = 0; i < row.children.length; i++) if (row.children[i].classList.contains("message-text")) { b = row.children[i]; break; }
    if (!b) return null; // 其他腳本可能另加頭像／按鈕，只看直接子層的 .message-text
    var m = RE.exec(b.textContent || ""); if (!m) return null;
    return { who: m[1], body: b };
  }
  function dawnOnly() {
    try { if (w.AIVAULTDarkStarLive && w.AIVAULTDarkStarLive.isConnected()) return false; } catch (e) {}
    try { return !!(w.DawnLightLiveVoice && w.DawnLightLiveVoice.isOpen()); } catch (e) { return false; }
  }
  function onAdd(row) {
    // live-voice-show 透過對話匯流排另外畫的同一段曙光／使用者文字（有頭像的那則）→ 隱藏，避免重複
    if (row && row.nodeType === 1 && row.dataset && (row.dataset.speaker === "dawn" || (row.dataset.speaker === "user" && dawnOnly()))) { row.style.display = "none"; row.setAttribute("data-ds-dup", "1"); return; }
    var me = info(row); if (!me) return;
    var now = Date.now(), prev = row.previousElementSibling;
    while (prev && prev.getAttribute && prev.getAttribute("data-ds-dup") === "1") prev = prev.previousElementSibling;
    var pi = info(prev);
    if (pi && pi.who === me.who && prev.__dsDawnT && now - prev.__dsDawnT < 4000) {
      pi.body.textContent += me.body.textContent.replace(RE, "");
      prev.__dsDawnT = now; row.remove();
      try { var O = w.DarkStarOrb, mx = prev.__dsDawnOrb && O && O.moodOf && O.moodOf(pi.body.textContent); if (mx) prev.__dsDawnOrb.setExpression(mx, 5000); } catch (e) {}
      var host = prev.parentNode; if (host) host.scrollTop = host.scrollHeight;
      var ms = d.getElementById("messages"); if (ms) ms.scrollTop = ms.scrollHeight;
      return;
    }
    row.__dsDawnT = now;
    if (me.who === "曙光" && !row.querySelector(".message-avatar")) { // 曙光即時的泡泡：動態曙光太陽頭像（不是黑球）
      try { var av = d.createElement("div"); av.className = "message-avatar ds-orb-av ds-dawn-av"; var sp = d.createElement("span"); av.appendChild(sp); row.insertBefore(av, row.firstChild);
        var ob = w.DarkStarOrb && w.DarkStarOrb.mount(sp, { size: 34, theme: "dawn" }); row.__dsDawnOrb = ob; } catch (e) {}
    }
  }
  function init() {
    var host = d.getElementById("messagesInner") || d.getElementById("messages"); if (!host) return;
    new MutationObserver(function (list) { list.forEach(function (m) { m.addedNodes.forEach(onAdd); }); }).observe(host, { childList: true });
  }
  if (d.readyState === "loading") d.addEventListener("DOMContentLoaded", init); else init();
})(window, document);
