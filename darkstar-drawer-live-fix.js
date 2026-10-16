/* 抽屜「暗星即時」修正：原本的頁內 REALTIME_VOICE_V1 腳本有語法錯誤（整段不執行），
   aivault-dual-agent-live 找不到 __AIVAULT_DARK_STAR_START__／TOGGLE → 沒有真的建立暗星語音連線（沒有聲音）。
   這裡把 START／STOP 接到已驗證可出聲的頁內引擎 AIVAULTDarkStarLive（iOS 手勢內 primeAudio）。
   只影響抽屜「暗星即時」；即時視訊、曙光即時不經過這裡。回滾：git revert 本檔的 commit。 */
(function (w) {
  "use strict";
  if (w.__AIVAULT_DARK_STAR_START__ || w.__dsDrawerLiveFix) return; w.__dsDrawerLiveFix = 1;
  function L() { return w.AIVAULTDarkStarLive; }
  w.__AIVAULT_DARK_STAR_START__ = function () { var l = L(); if (l && !l.isConnected()) return l.connect(); }; // 同步呼叫，仍在點擊手勢內
  w.__AIVAULT_DARK_STAR_STOP__ = function () { var l = L(); if (l && l.isConnected()) return l.disconnect(); };
})(window);
