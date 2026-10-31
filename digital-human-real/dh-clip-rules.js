/* 數字人片段規則（純函式，可在 node 測試）。
   - 動作／儀式片段播放中：說話不可中斷、不可暫停，播完才回 idle（＋整頭嘴型）。
   - 整頭嘴型只能畫在「目前真正看得到的 idle」上。 */
(function (root) {
  const BASE = { idle: 1, talk: 1, happy: 1 };
  function isAction(n) { return !!n && !BASE[n]; }
  // 目前片段是否仍需鎖住（不被說話／新回覆打斷）
  function holdAction(s) { return isAction(s.clip) && s.clip !== 'transition' && !s.ended && s.now < s.lockUntil; }
  // 鎖定時間上限：片段長度＋1 秒（iOS 解碼卡住也不會永遠停住）
  function lockUntil(now, duration) { return now + ((isFinite(duration) && duration > 0 ? duration : 8) + 1) * 1000; }
  function lipAllowed(s) { return s.clip === 'idle' && !!s.idleOn && !s.idlePaused && s.idleReady >= 2 && !s.otherOn; }
  const api = { isAction, holdAction, lockUntil, lipAllowed };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.DHClipRules = api;
})(typeof window !== 'undefined' ? window : globalThis);
