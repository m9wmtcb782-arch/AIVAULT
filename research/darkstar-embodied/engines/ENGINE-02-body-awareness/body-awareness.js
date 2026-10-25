/**
 * ENGINE-02｜暗星身體自我認知（Body Self-Awareness）
 * 狀態：開發中。連接真實 Phase1 joint-controller／arm-ik／safety，非空設定表。
 * 不得宣稱已具備 ENGINE-09 自主運動學習。
 */
import {
  DarkStarBodySafety,
  JOINT_LIMITS,
  BODY_SAFETY_VERSION
} from '../../../../assets/dark-star/body-safety-layer.js';
import { SKILLS, listSkills, getSkill, SKILLS_REGISTRY_VERSION } from './skills-registry.js';

export const BODY_AWARENESS_VERSION = '0.1.0-dev';

const BODY_ASSET = Object.freeze({
  id: 'technical-dark-star-avatar',
  path: 'assets/dark-star/technical-dark-star-avatar.glb',
  format: 'glb',
  renderer: 'three.js',
  notes: 'Body Brain Lab seed; not VRM',
  hasPhysicalBody: false,
  canOperatePhysicalObjects: false,
  embodimentDomain: 'virtual'
});

/**
 * @param {object} opts
 * @param {object} [opts.controller] phase1 createJointController result
 * @param {object} [opts.avatar] THREE.Object3D
 * @param {Array} [opts.bones]
 * @param {object} [opts.bonesByHint]
 * @param {object} [opts.safety] defaults to DarkStarBodySafety
 * @param {object} [opts.scene] { objects: { chair?, blackboard?, eraser? }, id? }
 * @param {() => number|null} [opts.getFps]
 * @param {object} [opts.mockState] Node test override when no Three avatar
 */
export function createBodyAwareness(opts = {}) {
  const safety = opts.safety || DarkStarBodySafety;
  const controller = opts.controller || null;
  let scene = opts.scene || { id: null, objects: {} };
  let mockState = opts.mockState || null;
  const learnedOverrides = new Set(); // skills marked available beyond registry stub→runtime

  function bindController(c) {
    opts.controller = c;
  }

  function setScene(next) {
    scene = next || { id: null, objects: {} };
  }

  function setMockState(s) {
    mockState = s;
  }

  function grantSkillRuntime(id) {
    learnedOverrides.add(id);
  }

  function sceneHas(key) {
    const objs = (scene && scene.objects) || {};
    if (key === 'chair') return !!(objs.chair || objs.virtual_chair);
    if (key === 'blackboard') return !!(objs.blackboard || objs.virtual_blackboard);
    if (key === 'eraser') return !!(objs.eraser || objs.virtual_eraser);
    return !!objs[key];
  }

  function skillEffectiveStatus(skill) {
    if (!skill) return 'unlearned';
    if (learnedOverrides.has(skill.id)) return 'learned';
    return skill.status;
  }

  function readPose() {
    if (mockState && mockState.pose) return { ...mockState.pose, source: 'mock' };
    const avatar = opts.avatar;
    const bonesByHint = opts.bonesByHint || {};
    const pose = {
      position: { x: 0, y: 0, z: 0 },
      quaternion: { x: 0, y: 0, z: 0, w: 1 },
      neck: null,
      standing: true,
      sitting: false,
      source: 'default'
    };
    if (avatar && avatar.position) {
      pose.position = {
        x: avatar.position.x,
        y: avatar.position.y,
        z: avatar.position.z
      };
      if (avatar.quaternion) {
        pose.quaternion = {
          x: avatar.quaternion.x,
          y: avatar.quaternion.y,
          z: avatar.quaternion.z,
          w: avatar.quaternion.w
        };
      }
      pose.source = 'avatar';
    }
    if (bonesByHint.neck) {
      const n = bonesByHint.neck;
      pose.neck = { x: n.rotation.x, y: n.rotation.y, z: n.rotation.z };
    }
    if (mockState && typeof mockState.sitting === 'boolean') {
      pose.sitting = mockState.sitting;
      pose.standing = !mockState.sitting;
    } else if (avatar && avatar.userData && avatar.userData.sitting) {
      pose.sitting = true;
      pose.standing = false;
    }
    return pose;
  }

  function skeletonSummary() {
    if (mockState && mockState.skeleton) return mockState.skeleton;
    const bones = opts.bones || [];
    const byHint = opts.bonesByHint || {};
    const arms = controller && controller.inspectArms ? controller.inspectArms() : null;
    return {
      boneCount: bones.length || (mockState && mockState.boneCount) || 0,
      hints: Object.keys(byHint),
      armChains: arms
        ? {
            R: !!(arms.R && arms.R.upper),
            L: !!(arms.L && arms.L.upper),
            version: arms.version || (controller && controller.armIkVersion)
          }
        : null,
      morphCapable: true,
      safetyVersion: safety.version || BODY_SAFETY_VERSION
    };
  }

  function jointRanges() {
    const out = {};
    Object.entries(JOINT_LIMITS).forEach(([k, v]) => {
      out[k] = { x: v.x, y: v.y, z: v.z, soft: v.soft, hard: v.hard, name: v.name };
    });
    return out;
  }

  /**
   * Full body state query — must reflect live controller/avatar when bound.
   */
  function getBodyState() {
    const pose = readPose();
    const macros = controller && controller.macros ? controller.macros.slice() : ['wave', 'smile', 'blink'];
    const feedback = controller && controller.getLastFeedback ? controller.getLastFeedback() : null;
    const skills = listSkills().map((s) => ({
      id: s.id,
      status: skillEffectiveStatus(s),
      domain: s.domain,
      description: s.description
    }));
    return {
      schema: 'aivault.darkstar.body_state.v0.1',
      ts: Date.now(),
      version: BODY_AWARENESS_VERSION,
      asset: { ...BODY_ASSET },
      embodiment: {
        hasPhysicalBody: false,
        canOperatePhysicalObjects: false,
        domain: 'virtual',
        reason: '數字人僅存在於虛擬渲染空間，無實體肢體，不能操作現實物品'
      },
      skeleton: skeletonSummary(),
      pose,
      jointRanges: jointRanges(),
      skills: {
        registryVersion: SKILLS_REGISTRY_VERSION,
        learned: skills.filter((s) => s.status === 'learned').map((s) => s.id),
        stub: skills.filter((s) => s.status === 'stub').map((s) => s.id),
        unlearned: skills.filter((s) => s.status === 'unlearned').map((s) => s.id),
        all: skills
      },
      controller: {
        bound: !!controller,
        version: controller && controller.version,
        macros,
        armIkVersion: controller && controller.armIkVersion,
        lastFeedbackStatus: feedback && feedback.status
      },
      scene: {
        id: scene.id || null,
        objects: Object.keys((scene && scene.objects) || {})
      },
      fps: opts.getFps ? opts.getFps() : null,
      status: '開發中'
    };
  }

  /**
   * Capability / affordance gate (also used by ENGINE-05).
   * @param {string} action skill id or verb
   * @param {object} [context]
   * @returns {{ can: boolean, reason: string, domain: 'virtual'|'physical', action: string, checks: object }}
   */
  function canPerform(action, context = {}) {
    const ctx = context || {};
    const domainHint = ctx.domain || null;
    const checks = {
      hasSkill: false,
      skillStatus: null,
      postureOk: true,
      inRange: true,
      targetDomain: null,
      hasPermission: true,
      canVerify: true,
      sceneOk: true
    };

    // Explicit physical erase / any physical-domain op
    const physicalActions = new Set([
      'erase_real_classroom_blackboard',
      'erase_real_blackboard',
      'operate_physical',
      'touch_real_object'
    ]);
    if (
      physicalActions.has(action) ||
      domainHint === 'physical' ||
      (ctx.target && ctx.target.domain === 'physical') ||
      ctx.physical === true
    ) {
      checks.targetDomain = 'physical';
      return {
        can: false,
        reason: '無實體身體／不能操作現實物品（hasPhysicalBody=false）',
        domain: 'physical',
        action,
        checks
      };
    }

    const skill = getSkill(action) || getSkill(aliasAction(action));
    const resolvedId = skill ? skill.id : action;

    if (skill && skill.domain === 'physical') {
      checks.targetDomain = 'physical';
      checks.hasSkill = false;
      return {
        can: false,
        reason: '無實體身體／不能操作現實物品（技能域為 physical）',
        domain: 'physical',
        action: resolvedId,
        checks
      };
    }

    checks.targetDomain = 'virtual';

    if (!skill) {
      return {
        can: false,
        reason: `未知動作或未註冊技能: ${action}`,
        domain: 'virtual',
        action,
        checks
      };
    }

    const status = skillEffectiveStatus(skill);
    checks.skillStatus = status;
    checks.hasSkill = status === 'learned' || status === 'stub';

    if (status === 'unlearned') {
      return {
        can: false,
        reason: `尚未學會技能: ${skill.id}`,
        domain: 'virtual',
        action: skill.id,
        checks
      };
    }

    // Requirement checks
    const reqs = skill.requires || [];
    for (const r of reqs) {
      if (r.startsWith('scene:')) {
        const key = r.slice(6);
        const ok = ctx.forceSceneHas && ctx.forceSceneHas[key] != null
          ? !!ctx.forceSceneHas[key]
          : sceneHas(key);
        if (!ok) {
          checks.sceneOk = false;
          return {
            can: false,
            reason: `場景缺少物件: ${key}`,
            domain: 'virtual',
            action: skill.id,
            checks
          };
        }
      }
      if (r.startsWith('skill:')) {
        const dep = r.slice(6);
        const depSkill = getSkill(dep);
        const depStatus = depSkill ? skillEffectiveStatus(depSkill) : 'unlearned';
        if (depStatus === 'unlearned') {
          checks.hasSkill = false;
          return {
            can: false,
            reason: `缺少依賴技能: ${dep}`,
            domain: 'virtual',
            action: skill.id,
            checks
          };
        }
      }
    }

    // Posture
    const pose = readPose();
    if (skill.id === 'sit_on_virtual_chair' && pose.sitting) {
      checks.postureOk = false;
      return {
        can: false,
        reason: '目前已是坐下姿態',
        domain: 'virtual',
        action: skill.id,
        checks
      };
    }

    // Range (optional context)
    if (ctx.target && typeof ctx.target.distance === 'number' && typeof ctx.reachLimit === 'number') {
      if (ctx.target.distance > ctx.reachLimit) {
        checks.inRange = false;
        return {
          can: false,
          reason: `目標超出可達範圍 distance=${ctx.target.distance} > ${ctx.reachLimit}`,
          domain: 'virtual',
          action: skill.id,
          checks
        };
      }
    }

    if (ctx.denyPermission) {
      checks.hasPermission = false;
      return {
        can: false,
        reason: '無操作權限',
        domain: 'virtual',
        action: skill.id,
        checks
      };
    }

    return {
      can: true,
      reason:
        status === 'stub'
          ? `可行（虛擬域，技能 ${skill.id} 為 stub／簡化執行）`
          : `可行（虛擬域，技能 ${skill.id}）`,
      domain: 'virtual',
      action: skill.id,
      checks,
      skillStatus: status
    };
  }

  return {
    version: BODY_AWARENESS_VERSION,
    asset: BODY_ASSET,
    getBodyState,
    canPerform,
    listSkills: (f) =>
      listSkills(f).map((s) => ({ ...s, status: skillEffectiveStatus(s) })),
    getSkill,
    setScene,
    setMockState,
    bindController,
    grantSkillRuntime,
    safetyVersion: safety.version || BODY_SAFETY_VERSION,
    skillsRegistryVersion: SKILLS_REGISTRY_VERSION
  };
}

function aliasAction(action) {
  const map = {
    sit: 'sit_on_virtual_chair',
    sit_chair: 'sit_on_virtual_chair',
    erase_virtual: 'erase_virtual_blackboard',
    erase_blackboard: 'erase_virtual_blackboard',
    erase_real: 'erase_real_classroom_blackboard',
    wave_hand: 'wave'
  };
  return map[action] || action;
}

export { BODY_ASSET, SKILLS, listSkills, getSkill };
