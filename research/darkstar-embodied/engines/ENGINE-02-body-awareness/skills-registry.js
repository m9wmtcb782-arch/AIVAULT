/**
 * Dark Star skill registry (DEV).
 * A written skill list is NOT "autonomous motor learning" (ENGINE-09).
 * Skills mark what the body controller can currently execute in the virtual domain.
 */
export const SKILLS_REGISTRY_VERSION = '0.1.0-dev';

/** @typedef {'learned'|'stub'|'unlearned'} SkillStatus */
/** @typedef {'virtual'|'physical'|'either'} SkillDomain */

/**
 * @type {Record<string, {
 *   id: string,
 *   status: SkillStatus,
 *   domain: SkillDomain,
 *   requires?: string[],
 *   description: string,
 *   executor?: string
 * }>}
 */
export const SKILLS = Object.freeze({
  wave: {
    id: 'wave',
    status: 'learned',
    domain: 'virtual',
    description: 'Raise arm and oscillate forearm (phase1 arm-ik)',
    executor: 'phase1/arm-ik.js'
  },
  smile: {
    id: 'smile',
    status: 'learned',
    domain: 'virtual',
    description: 'Morph smile open',
    executor: 'phase1/joint-controller.js'
  },
  blink: {
    id: 'blink',
    status: 'learned',
    domain: 'virtual',
    description: 'Morph eye close',
    executor: 'phase1/joint-controller.js'
  },
  turn_toward_target: {
    id: 'turn_toward_target',
    status: 'learned',
    domain: 'virtual',
    description: 'Neck yaw toward target (macro)',
    executor: 'phase1/joint-controller.js'
  },
  sit_on_virtual_chair: {
    id: 'sit_on_virtual_chair',
    status: 'stub',
    domain: 'virtual',
    requires: ['scene:chair'],
    description: 'Sit on a virtual chair object (simplified hip/root motion)',
    executor: 'phase1/virtual-classroom/sit-controller.js'
  },
  erase_virtual_blackboard: {
    id: 'erase_virtual_blackboard',
    status: 'stub',
    domain: 'virtual',
    requires: ['scene:blackboard', 'scene:eraser', 'skill:hold_virtual_eraser'],
    description: 'Clear virtual blackboard text state via eraser object',
    executor: 'phase1/virtual-classroom/blackboard-state.js'
  },
  hold_virtual_eraser: {
    id: 'hold_virtual_eraser',
    status: 'stub',
    domain: 'virtual',
    requires: ['scene:eraser'],
    description: 'Attach/use virtual eraser (state flag; no full finger IK yet)'
  },
  walk_to: {
    id: 'walk_to',
    status: 'unlearned',
    domain: 'virtual',
    description: 'Locomotion not implemented in Phase1'
  },
  erase_real_classroom_blackboard: {
    id: 'erase_real_classroom_blackboard',
    status: 'unlearned',
    domain: 'physical',
    description: 'Impossible: avatar has no physical body'
  }
});

export function listSkills(filter) {
  const all = Object.values(SKILLS);
  if (!filter) return all.slice();
  return all.filter((s) => {
    if (filter.status && s.status !== filter.status) return false;
    if (filter.domain && s.domain !== filter.domain) return false;
    return true;
  });
}

export function getSkill(id) {
  return SKILLS[id] || null;
}
