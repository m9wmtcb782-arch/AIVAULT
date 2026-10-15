/* 聊天視窗：AI 訊息旁的彩色 ✦ 方塊頭像與歡迎畫面 ✦ → 會動的暗星黑色小球；移除頁首左側彩色 ✦ 標誌（保留頁首黑球）。 */
(function (w, d) {
  "use strict";
  if (w.__dsChatOrbs) return; w.__dsChatOrbs = 1;
  var s = d.createElement("style");
  s.textContent = ".topbar .brand>.brand-mark{display:none!important}" +
    ".message:not(.user) .message-avatar.ds-orb-av{background:none!important;animation:none!important;box-shadow:none!important;border:0!important;overflow:visible;font-size:0!important;color:transparent!important}" +
    ".welcome-mark.ds-orb-av{background:none!important;animation:none!important;box-shadow:none!important;font-size:0!important}";
  d.head.appendChild(s);
  function orbify(av, size) {
    if (av.classList.contains("ds-orb-av") || !w.DarkStarOrb) return;
    av.classList.add("ds-orb-av"); av.textContent = "";
    var sp = d.createElement("span"); av.appendChild(sp); w.DarkStarOrb.mount(sp, { size: size });
  }
  function scan() {
    d.querySelectorAll(".message:not(.user) .message-avatar").forEach(function (av) {
      var t = (av.textContent || "").trim();
      if (t === "✦" || t === "" && !av.children.length) orbify(av, 34); // 其他功能自訂的頭像（📚📸🌑）保持不變
    });
    d.querySelectorAll(".welcome-mark").forEach(function (m) { orbify(m, 72); });
  }
  var q = 0; function later() { if (!q) q = requestAnimationFrame(function () { q = 0; scan(); }); }
  function init() { scan(); new MutationObserver(later).observe(d.body, { childList: true, subtree: true }); }
  if (d.readyState === "loading") d.addEventListener("DOMContentLoaded", init); else init();
})(window, document);

/* 輸入列按鈕：白色圓形「笑臉＋」→ 開啟機器人工作區；黑色圓形「鉛筆方塊」→ 既有的「＋ 新聊天」。
   使用者訊息下方的刪除 ×：預設隱藏，點一下自己的訊息才出現（功能不變）。
   AI 回覆依內容自動做表情（[表情:x] 標籤／表情符號／關鍵詞）；「曙光…表情」指令讓曙光做表情。 */
(function (w, d) {
  "use strict";
  if (w.__dsComposerBtns) return; w.__dsComposerBtns = 1;
  var st = d.createElement("style");
  st.textContent =
    ".ds-cbtn{flex:none;width:32px;height:32px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;padding:0;margin:0 2px;cursor:pointer;-webkit-tap-highlight-color:transparent}" +
    ".ds-cbtn svg{width:18px;height:18px}.ds-cbtn.white{background:#fff!important;color:#111!important;border:1px solid #d9d9de!important;box-shadow:0 1px 3px rgba(0,0,0,.1)}" +
    ".ds-cbtn.black{background:#111!important;color:#fff!important;border:1px solid #111!important}" +
    ".message.user .message-action.danger{display:none}.message.user.ds-showdel .message-action.danger{display:inline-flex}";
  d.head.appendChild(st);
  var FACE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="butt"><path d="M18.2 9.6A7.5 7.5 0 1 0 11 19.5"/><path d="M10 8.5v2.6M14 8.5v2.6"/><path d="M18 14v7M14.5 17.5h7"/></svg>';
  var PEN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6"/><path d="M17.5 3.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4z"/></svg>';
  function btn(cls, svg, label, fn) { var b = d.createElement("button"); b.type = "button"; b.className = "ds-cbtn " + cls; b.innerHTML = svg; b.setAttribute("aria-label", label); b.title = label; b.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); fn(); }); return b; }
  function addButtons() {
    var row = d.querySelector(".composer-row"), mic = d.getElementById("micButton");
    if (!row || d.getElementById("dsComposerBots")) return;
    var a = btn("white", FACE, "機器人工作區", function () { if (w.AIVAULTBots) w.AIVAULTBots.open(); }); a.id = "dsComposerBots";
    var b = btn("black", PEN, "新聊天", function () { var n = d.getElementById("newChatButton"); if (n) n.click(); }); b.id = "dsComposerNewChat";
    row.insertBefore(a, mic && mic.parentNode === row ? mic : null); row.insertBefore(b, mic && mic.parentNode === row ? mic : null);
  }
  // 點自己的訊息 → 顯示／隱藏刪除 ×
  d.addEventListener("click", function (e) {
    var m = e.target.closest && e.target.closest(".message.user"); if (!m || e.target.closest("button")) return;
    m.classList.toggle("ds-showdel");
  });
  // AI 回覆 → 表情；移除 [表情:x] 標籤
  var ready = false, seen = new WeakSet();
  function stripTag(node) { var O = w.DarkStarOrb; (function walk(n) { if (n.nodeType === 3) { if (/[\[【［]\s*(表情|expr)/i.test(n.nodeValue)) n.nodeValue = O.stripTags(n.nodeValue); } else n.childNodes.forEach(walk); })(node); }
  function onAi(row) {
    if (seen.has(row)) return; seen.add(row); if (!ready) return;
    var O = w.DarkStarOrb; if (!O || !O.moodOf) return;
    setTimeout(function () {
      var t = (row.querySelector(".message-text") || row).textContent || ""; if (!t.trim()) return;
      var mood = O.moodOf(t); stripTag(row);
      if (!mood) return;
      var dawn = /^\s*曙光[：:]/.test(t) || row.getAttribute("data-agent") === "dawn-light";
      var who = dawn && w.AIVAULTDawnAvatar ? w.AIVAULTDawnAvatar : w.AIVAULTDarkStarAvatar;
      if (who && who.expr) who.expr(mood, 4000);
    }, 400);
  }
  function scanAi() { d.querySelectorAll(".message:not(.user)").forEach(onAi); }
  // 「曙光做一個開心的表情」→ 本機讓曙光做表情（在曙光協作路由之前攔截，不呼叫 AI）
  function wrapSend() {
    if (typeof w.sendMessage !== "function" || w.sendMessage.__dsDawnExpr) return;
    var prev = w.sendMessage;
    var wrapped = function () {
      var input = d.getElementById("composerInput"), t = input ? input.value.trim() : "", O = w.DarkStarOrb;
      if (t && /曙光|dawn/i.test(t) && O && O.detectCommand && w.AIVAULTDawnAvatar) {
        var ex = O.detectCommand(t.replace(/曙光|dawn ?light|dawn/ig, ""));
        if (ex) {
          input.value = "";
          try { w.renderUserMessage(t, []); } catch (e) {}
          w.AIVAULTDawnAvatar.expr(ex, 5000); w.AIVAULTDawnAvatar.say((O.LABELS[ex] || "🙂").replace(/^(\S+) /, "$1 "), ex);
          try { w.renderAIMessage("曙光：" + (O.LABELS[ex] || "🙂")); } catch (e) {}
          return;
        }
      }
      return prev.apply(this, arguments);
    };
    wrapped.__dsDawnExpr = true; w.sendMessage = wrapped;
  }
  function init() {
    addButtons(); scanAi(); setTimeout(function () { ready = true; }, 2500);
    new MutationObserver(function () { addButtons(); scanAi(); }).observe(d.body, { childList: true, subtree: true });
    setTimeout(wrapSend, 1500); setTimeout(wrapSend, 4000);
  }
  if (d.readyState === "complete") init(); else w.addEventListener("load", init);
})(window, document);
