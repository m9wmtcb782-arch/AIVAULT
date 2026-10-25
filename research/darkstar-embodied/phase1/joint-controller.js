/**
 * Dark Star Phase1 joint controller (DEV).
 * Applies control_intent.motion to a GLB avatar with Body Safety Layer + arm IK wave.
 * Not a full neural motor policy — do not claim autonomous learning / decision.
 */
import { DarkStarBodySafety } from '../../../assets/dark-star/body-safety-layer.js';
import { createArmIkController } from './arm-ik.js';

export const PHASE1_CONTROLLER_VERSION = '0.2.0-dev';

const MACROS = {
  idle_stand: {},
  turn_toward_target: { neck: { y: 0.35 } },
  smile: {
    morph: {
      'h_expressions.RsmileOpen_h': 0.7,
      'h_expressions.LsmileOpen_h': 0.7
    }
  },
  blink: {
    morph: {
      'h_expressions.LeyeClose_h': 1,
      'h_expressions.ReyeClose_h': 1
    }
  },
  mouth_open: { morph: { 'h_expressions.MouthOpen_h': 0.8 } }
};

function radToDeg(r) {
  return (r * 180) / Math.PI;
}

export function createJointController(ctx) {
  const safety = ctx.safety || DarkStarBodySafety;
  const bonesByHint = ctx.bonesByHint || {};
  const setMorph = ctx.setMorph || (() => {});
  const log = ctx.log || console.log;
  const avatar = ctx.avatar;
  const bones = ctx.bones || [];
  const onSafety = ctx.onSafety || (() => {});

  const armIk = avatar && bones.length
    ? createArmIkController(avatar, bones)
    : null;

  let lastFeedback = null;
  let waveBusy = false;

  function applyMacro(name, part) {
    const m = MACROS[name];
    if (!m) return { ok: false, reason: 'unknown_macro', name, part };
    if (m.morph) {
      Object.entries(m.morph).forEach(([k, v]) => setMorph(k, v));
    }
    if (m.neck && bonesByHint.neck) {
      const b = bonesByHint.neck;
      const next = {
        x: radToDeg(b.rotation.x + (m.neck.x || 0)),
        y: radToDeg(b.rotation.y + (m.neck.y || 0)),
        z: radToDeg(b.rotation.z + (m.neck.z || 0))
      };
      const gated = safety.safetyGate({
        jointName: b.name || 'neck',
        angles: next
      });
      const clamped = safety.clampAngles(b.name || 'neck', next);
      b.rotation.x = (clamped.x * Math.PI) / 180;
      b.rotation.y = (clamped.y * Math.PI) / 180;
      b.rotation.z = (clamped.z * Math.PI) / 180;
      if (!gated.allow) onSafety({ event: 'neck_gated', gated, clamped });
      return { ok: !!gated.allow, name, part, gated, clamped, stub: false };
    }
    return { ok: true, name, part, stub: false };
  }

  function validateIntent(intent) {
    if (!intent || intent.agent !== 'dark-star') {
      return { ok: false, status: 'blocked', reason: 'bad_agent' };
    }
    if (!intent.intent) return { ok: false, status: 'blocked', reason: 'missing_intent' };
    return { ok: true };
  }

  function jointsSnapshot() {
    const j = {};
    if (bonesByHint.neck) {
      j.neck = {
        x: bonesByHint.neck.rotation.x,
        y: bonesByHint.neck.rotation.y,
        z: bonesByHint.neck.rotation.z
      };
    }
    return j;
  }

  /**
   * @param {object} intent
   * @returns {Promise<object>} motion_feedback
   */
  async function execute(intent) {
    const v = validateIntent(intent);
    if (!v.ok) {
      lastFeedback = {
        agent: 'dark-star',
        schema: 'aivault.darkstar.motion_feedback.v0.1',
        intent_id: intent && intent.id,
        ts: Date.now(),
        status: 'blocked',
        safety: { pain: 0, blocked: [v.reason], warnings: [] },
        notes: v.reason
      };
      return lastFeedback;
    }

    const motion = intent.motion || {};
    const applied = [];
    const warnings = [];
    const blocked = [];

    if (motion.head) applied.push(applyMacro(motion.head, 'head'));
    if (motion.expression) applied.push(applyMacro(motion.expression, 'expression'));
    if (motion.gaze === 'target_face') {
      applied.push(applyMacro('turn_toward_target', 'gaze'));
    }

    async function runArm(macroName, side) {
      if (macroName !== 'wave') {
        return { ok: false, stub: true, name: macroName, reason: 'arm_macro_not_implemented' };
      }
      if (!armIk) {
        return { ok: false, stub: false, name: 'wave', reason: 'arm_ik_unavailable' };
      }
      if (waveBusy) {
        return { ok: false, stub: false, name: 'wave', reason: 'wave_busy', status: 'blocked' };
      }
      waveBusy = true;
      try {
        const result = await armIk.wave(side, {
          cycles: 3,
          durationMs: 1400,
          onSafety: (s) => {
            onSafety(s);
            if (s && s.blocked) blocked.push(...(s.blocked || []).slice(0, 4));
          }
        });
        return result;
      } finally {
        waveBusy = false;
      }
    }

    if (motion.right_arm) {
      const r = await runArm(motion.right_arm, 'R');
      applied.push(r);
    }
    if (motion.left_arm) {
      const r = await runArm(motion.left_arm, 'L');
      applied.push(r);
    }

    applied.forEach((a) => {
      if (!a) return;
      if (a.stub) warnings.push(a.reason || a.note || 'stub');
      if (a.status === 'partial') warnings.push(a.reason || 'partial');
      if (a.status === 'blocked' || a.ok === false) {
        if (a.reason) blocked.push(a.reason);
      }
      if (a.safety && a.safety.warnings) warnings.push(...a.safety.warnings);
    });

    const anyWave = applied.some((a) => a && a.name === 'wave');
    const waveFailed = applied.some((a) => a && a.name === 'wave' && a.ok === false);
    const wavePartial = applied.some((a) => a && a.name === 'wave' && a.status === 'partial');

    let status = 'completed';
    if (waveFailed && !applied.some((a) => a && a.name === 'wave' && a.ok)) status = 'blocked';
    else if (wavePartial || warnings.length) status = 'partial';
    if (!anyWave && blocked.length && applied.every((a) => a && a.ok === false)) status = 'blocked';

    lastFeedback = {
      agent: 'dark-star',
      schema: 'aivault.darkstar.motion_feedback.v0.1',
      intent_id: intent.id,
      ts: Date.now(),
      status,
      applied,
      safety: {
        pain: 0,
        blocked: blocked.slice(0, 12),
        warnings: warnings.slice(0, 12),
        layer: safety.version
      },
      joints: jointsSnapshot(),
      fps: ctx.getFps ? ctx.getFps() : null,
      notes: 'phase1-dev; NOT autonomous',
      armIk: armIk ? armIk.version : null
    };
    log('[phase1-controller]', lastFeedback);
    if (lastFeedback.safety.blocked.length || lastFeedback.safety.warnings.length) {
      onSafety({ event: 'execute_safety', safety: lastFeedback.safety });
    }
    return lastFeedback;
  }

  return {
    version: PHASE1_CONTROLLER_VERSION,
    execute,
    getLastFeedback: () => lastFeedback,
    inspectArms: () => (armIk ? armIk.inspect() : null),
    macros: Object.keys(MACROS).concat(['wave']),
    armIkVersion: armIk ? armIk.version : null
  };
}

/** Demo intent matching construction-order example (UI only — NOT autonomy). */
export function demoGreetIntent() {
  return {
    agent: 'dark-star',
    schema: 'aivault.darkstar.control_intent.v0.1',
    id: 'demo-greet-' + Date.now(),
    ts: Date.now(),
    intent: 'greet_person',
    target: 'camera_user',
    confidence: 1,
    priority: 50,
    motion: {
      gaze: 'target_face',
      head: 'turn_toward_target',
      right_arm: 'wave',
      expression: 'smile',
      blend_ms: 280
    },
    speech: {
      text: '你好，很高興見到你。',
      enabled: false
    },
    source: {
      decision: 'ui_demo',
      note: 'NOT autonomous — button demo only'
    }
  };
}
