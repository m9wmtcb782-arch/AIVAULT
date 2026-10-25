/**
 * Dark Star Phase1 joint controller (DEV).
 * Applies control_intent.motion to a GLB avatar with Body Safety Layer hooks.
 * Not a full neural motor policy — do not claim autonomous learning.
 */
import { DarkStarBodySafety } from '../../../assets/dark-star/body-safety-layer.js';

export const PHASE1_CONTROLLER_VERSION = '0.1.0-dev';

/** Named motion macros → bone Euler / morph. */
const MACROS = {
  idle_stand: {},
  turn_toward_target: { neck: { y: 0.35 } },
  wave: { note: 'wave_macro_stub_phase1' },
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

  let lastFeedback = null;

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
      const angleCheck = safety.evaluateAngles(b.name || 'neck', next);
      const gated = safety.safetyGate({
        jointName: b.name || 'neck',
        angles: next
      });
      const clamped = safety.clampAngles(b.name || 'neck', next);
      b.rotation.x = (clamped.x * Math.PI) / 180;
      b.rotation.y = (clamped.y * Math.PI) / 180;
      b.rotation.z = (clamped.z * Math.PI) / 180;
      return { ok: !!gated.allow, name, part, gated, clamped };
    }
    return { ok: true, name, part, stub: !!m.note, note: m.note };
  }

  function validateIntent(intent) {
    if (!intent || intent.agent !== 'dark-star') {
      return { ok: false, status: 'blocked', reason: 'bad_agent' };
    }
    if (!intent.intent) return { ok: false, status: 'blocked', reason: 'missing_intent' };
    return { ok: true };
  }

  function execute(intent) {
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
    if (motion.head) applied.push(applyMacro(motion.head, 'head'));
    if (motion.right_arm) applied.push(applyMacro(motion.right_arm, 'right_arm'));
    if (motion.left_arm) applied.push(applyMacro(motion.left_arm, 'left_arm'));
    if (motion.expression) applied.push(applyMacro(motion.expression, 'expression'));
    if (motion.gaze === 'target_face') {
      applied.push(applyMacro('turn_toward_target', 'gaze'));
    }
    applied.forEach((a) => {
      if (a && a.stub) warnings.push(a.note || 'stub_macro');
    });

    lastFeedback = {
      agent: 'dark-star',
      schema: 'aivault.darkstar.motion_feedback.v0.1',
      intent_id: intent.id,
      ts: Date.now(),
      status: warnings.length ? 'partial' : 'completed',
      applied,
      safety: {
        pain: 0,
        blocked: [],
        warnings,
        layer: safety.version
      },
      joints: bonesByHint.neck
        ? {
            neck: {
              x: bonesByHint.neck.rotation.x,
              y: bonesByHint.neck.rotation.y,
              z: bonesByHint.neck.rotation.z
            }
          }
        : {},
      fps: ctx.getFps ? ctx.getFps() : null,
      notes: 'phase1-dev'
    };
    log('[phase1-controller]', lastFeedback);
    return lastFeedback;
  }

  return {
    version: PHASE1_CONTROLLER_VERSION,
    execute,
    getLastFeedback: () => lastFeedback,
    macros: Object.keys(MACROS)
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
