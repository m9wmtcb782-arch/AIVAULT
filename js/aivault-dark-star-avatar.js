/**
 * Dark Star digital-human body. Not an AI.
 * Mouth / expression driven by Technical Dark Star PCM + captions.
 */
(function (root) {
  "use strict";
  if (root.AIVAULTDarkStarAvatar) return;

  var EMOTIONS = {
    neutral: { label: "平靜", brow: 0, eye: 1, mouthCurve: 0.12 },
    thinking: { label: "思考", brow: -0.25, eye: 0.85, mouthCurve: 0 },
    happy: { label: "專注愉快", brow: 0.15, eye: 1.05, mouthCurve: 0.35 },
    surprised: { label: "驚訝", brow: 0.4, eye: 1.25, mouthCurve: 0.05 },
    intense: { label: "推理", brow: -0.35, eye: 1.1, mouthCurve: -0.05 },
    listening: { label: "聆聽", brow: 0.1, eye: 1.0, mouthCurve: 0.08 }
  };

  var KEYWORDS = [
    ["surprised", /竟然|沒想到|哇|原來|居然|what\?|wow/i],
    ["intense", /推理|結論|架構|系統|錯誤|修復|分析|therefore|because/i],
    ["happy", /完成|成功|可以|好的|了解|done|ready|ok/i],
    ["thinking", /思考|首先|其次|判斷|考慮|maybe|consider/i]
  ];

  function detectEmotion(text) {
    var s = String(text || "");
    for (var i = 0; i < KEYWORDS.length; i++) {
      if (KEYWORDS[i][1].test(s)) return KEYWORDS[i][0];
    }
    return "neutral";
  }

  function Avatar(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.energy = 0;
    this.targetEnergy = 0;
    this.speaking = false;
    this.emotion = "neutral";
    this.blink = 0;
    this.t = 0;
    this.running = false;
    this._raf = 0;
    var self = this;
    this._loop = function (ts) {
      self.t = ts / 1000;
      self._draw();
      if (self.running) self._raf = requestAnimationFrame(self._loop);
    };
  }

  Avatar.prototype.start = function () {
    if (this.running) return;
    this.running = true;
    this._raf = requestAnimationFrame(this._loop);
  };

  Avatar.prototype.stop = function () {
    this.running = false;
    if (this._raf) cancelAnimationFrame(this._raf);
    this.setSpeaking(false, 0);
    this._draw();
  };

  Avatar.prototype.setSpeaking = function (on, energy) {
    this.speaking = !!on;
    this.targetEnergy = on ? Math.max(0, Math.min(1, energy || 0.25)) : 0;
    if (!on) this.energy = this.energy * 0.3;
  };

  Avatar.prototype.setEmotion = function (name) {
    if (!EMOTIONS[name]) name = "neutral";
    this.emotion = name;
  };

  Avatar.prototype.setEmotionFromText = function (text) {
    this.setEmotion(detectEmotion(text));
    return this.emotion;
  };

  Avatar.prototype._draw = function () {
    var c = this.canvas;
    var g = this.ctx;
    var w = c.width;
    var h = c.height;
    this.energy += (this.targetEnergy - this.energy) * 0.28;
    if (Math.random() < 0.008) this.blink = 1;
    this.blink *= 0.78;

    g.clearRect(0, 0, w, h);
    var bg = g.createRadialGradient(w * 0.5, h * 0.35, 20, w * 0.5, h * 0.45, w * 0.7);
    bg.addColorStop(0, "#1b2438");
    bg.addColorStop(0.55, "#0b1020");
    bg.addColorStop(1, "#05060c");
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);

    g.fillStyle = "rgba(244,63,94,0.07)";
    g.beginPath();
    g.arc(w * 0.5, h * 0.42, 150 + Math.sin(this.t * 1.4) * 6, 0, Math.PI * 2);
    g.fill();

    var cx = w * 0.5;
    var cy = h * 0.40 + Math.sin(this.t * 1.6) * 3;
    var emo = EMOTIONS[this.emotion] || EMOTIONS.neutral;
    var mouthOpen = this.speaking ? 8 + this.energy * 28 : 3;

    g.fillStyle = "#141824";
    g.beginPath();
    g.moveTo(cx - 150, h);
    g.quadraticCurveTo(cx - 120, cy + 150, cx, cy + 118);
    g.quadraticCurveTo(cx + 120, cy + 150, cx + 150, h);
    g.fill();

    g.fillStyle = "#c9a07a";
    g.fillRect(cx - 18, cy + 70, 36, 42);

    g.fillStyle = "#e2b48a";
    g.beginPath();
    g.ellipse(cx, cy, 72, 86, 0, 0, Math.PI * 2);
    g.fill();

    g.fillStyle = "#0e1018";
    g.beginPath();
    g.ellipse(cx, cy - 38, 76, 48, 0, Math.PI, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.moveTo(cx - 74, cy - 20);
    g.quadraticCurveTo(cx - 90, cy + 30, cx - 58, cy + 58);
    g.lineTo(cx - 48, cy + 10);
    g.fill();

    g.strokeStyle = "#1a120e";
    g.lineWidth = 4;
    g.lineCap = "round";
    var browY = cy - 22 - emo.brow * 10;
    g.beginPath();
    g.moveTo(cx - 38, browY + emo.brow * 6);
    g.lineTo(cx - 12, browY - emo.brow * 4);
    g.stroke();
    g.beginPath();
    g.moveTo(cx + 38, browY + emo.brow * 6);
    g.lineTo(cx + 12, browY - emo.brow * 4);
    g.stroke();

    var eyeH = 11 * emo.eye * (1 - this.blink * 0.92);
    function eye(x) {
      g.fillStyle = "#fff";
      g.beginPath();
      g.ellipse(x, cy - 4, 13, Math.max(1.2, eyeH), 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#111827";
      g.beginPath();
      g.arc(x + Math.sin(this.t * 0.7) * 2, cy - 4, 5.2, 0, Math.PI * 2);
      g.fill();
    }
    eye.call(this, cx - 24);
    eye.call(this, cx + 24);

    g.fillStyle = "#7a2d3a";
    g.beginPath();
    g.ellipse(cx, cy + 38 + emo.mouthCurve * 4, 16 + this.energy * 8, mouthOpen * 0.55, 0, 0, Math.PI * 2);
    g.fill();
    if (this.speaking && this.energy > 0.08) {
      g.fillStyle = "#3b0d16";
      g.beginPath();
      g.ellipse(cx, cy + 40, 8 + this.energy * 5, mouthOpen * 0.28, 0, 0, Math.PI * 2);
      g.fill();
    }

    g.fillStyle = "#f43f5e";
    g.beginPath();
    g.arc(cx + 48, cy + 18, 4, 0, Math.PI * 2);
    g.fill();

    g.fillStyle = "rgba(226,232,240,0.72)";
    g.font = "12px ui-sans-serif, system-ui, sans-serif";
    g.textAlign = "center";
    g.fillText("TECHNICAL DARK STAR · BODY", cx, h - 18);
  };

  Avatar.detectEmotion = detectEmotion;
  Avatar.EMOTIONS = EMOTIONS;
  root.AIVAULTDarkStarAvatar = Avatar;
})(window);
