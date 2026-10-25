/**
 * DEMO mapping: visual_event → control_intent.
 * NOT ENGINE-04 autonomous decision. UI must label as 示範映射.
 */
export function visualEventToControlIntent(ev) {
  if (!ev || !ev.type) return null;
  const base = {
    agent: 'dark-star',
    schema: 'aivault.darkstar.control_intent.v0.1',
    id: 'demo-map-' + ev.id,
    ts: Date.now(),
    target: 'camera_user',
    confidence: ev.confidence,
    priority: 35,
    speech: { enabled: false },
    source: {
      decision: 'demo_visual_map',
      note: 'NOT autonomous — ENGINE-01 demo mapping only',
      visual_event_id: ev.id,
      visual_type: ev.type
    }
  };

  switch (ev.type) {
    case 'wave':
      return {
        ...base,
        intent: 'demo_wave_reply',
        motion: { right_arm: 'wave' }
      };
    case 'smile':
      return {
        ...base,
        intent: 'demo_smile_reply',
        motion: { expression: 'smile' }
      };
    case 'head_turn':
      return {
        ...base,
        intent: 'demo_look',
        motion: {
          head: 'turn_toward_target',
          gaze: 'target_face'
        }
      };
    default:
      return null;
  }
}
