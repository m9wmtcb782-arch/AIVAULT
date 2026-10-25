/**
 * ENGINE-18 傷害規則：僅由虛擬物理參數決定，禁止依對話內容隨意生傷。
 * 虛擬模擬｜非真實醫學診斷。
 */
export const INJURY_RULES_VERSION = '0.1.0-dev';

/**
 * @param {object} params
 * @param {object} params.sensation ENGINE-17 sensation
 * @param {object} [params.collision] { impactForce, penetration }
 * @returns {null|{ kind: string, severity: number, region: string, mobilityImpact: object, visual: object, rule: string }}
 */
export function evaluateInjuryFromPhysics(params) {
  const s = params.sensation || {};
  const region = s.region;
  const temp = s.temperatureC;
  const force = (params.collision && params.collision.impactForce) != null
    ? params.collision.impactForce
    : (s.meta && s.meta.impactForce) != null
      ? s.meta.impactForce
      : s.type === 'collision'
        ? (s.intensity || 0) * 80
        : 0;

  // Burns from temperature
  if (typeof temp === 'number' && temp >= 70) {
    const severity = Math.min(1, (temp - 60) / 50);
    return {
      kind: 'burn',
      severity,
      region,
      mobilityImpact: {
        limb: s.limb,
        side: s.side,
        restrictActions: severity >= 0.55 ? ['lift_heavy', 'wave', 'hold_virtual_eraser'] : ['lift_heavy'],
        postureBias: severity >= 0.7 ? 'guard_arm' : null
      },
      visual: {
        erythema: Math.min(1, severity + 0.2),
        blisterHint: severity >= 0.6,
        bleeding: false,
        bruise: 0
      },
      rule: `temp>=70 → burn severity=(temp-60)/50`,
      fromPhysics: true
    };
  }
  if (typeof temp === 'number' && temp >= 55 && temp < 70) {
    const severity = Math.min(0.45, (temp - 50) / 40);
    return {
      kind: 'erythema',
      severity,
      region,
      mobilityImpact: {
        limb: s.limb,
        side: s.side,
        restrictActions: [],
        postureBias: null
      },
      visual: { erythema: severity + 0.3, blisterHint: false, bleeding: false, bruise: 0 },
      rule: `55<=temp<70 → erythema`,
      fromPhysics: true
    };
  }

  // Collision ladder
  if (force >= 90) {
    return {
      kind: 'fracture',
      severity: Math.min(1, force / 120),
      region: mapForceRegion(region, s),
      mobilityImpact: {
        limb: s.limb || 'arm',
        side: s.side || 'R',
        restrictActions: ['lift_heavy', 'wave', 'hold_virtual_eraser', 'erase_virtual_blackboard'],
        postureBias: 'immobilize_arm',
        cannotLift: true
      },
      visual: {
        erythema: 0.4,
        bruise: 0.85,
        bleeding: force >= 110,
        abrasion: 0.3,
        jointInjury: true
      },
      rule: `impactForce>=90 → fracture`,
      fromPhysics: true
    };
  }
  if (force >= 55) {
    return {
      kind: 'joint_injury',
      severity: Math.min(0.85, force / 100),
      region: mapForceRegion(region, s),
      mobilityImpact: {
        limb: s.limb || 'arm',
        side: s.side || 'R',
        restrictActions: ['lift_heavy', 'wave'],
        postureBias: 'guard_arm',
        cannotLift: true
      },
      visual: { erythema: 0.35, bruise: 0.55, bleeding: false, abrasion: 0.15, jointInjury: true },
      rule: `impactForce>=55 → joint_injury`,
      fromPhysics: true
    };
  }
  if (force >= 30) {
    return {
      kind: 'bruise',
      severity: Math.min(0.6, force / 80),
      region,
      mobilityImpact: {
        limb: s.limb,
        side: s.side,
        restrictActions: force >= 45 ? ['lift_heavy'] : [],
        postureBias: null
      },
      visual: { erythema: 0.25, bruise: force / 80, bleeding: false, abrasion: force >= 40 ? 0.2 : 0 },
      rule: `impactForce>=30 → bruise`,
      fromPhysics: true
    };
  }
  if (force >= 15) {
    return {
      kind: 'abrasion',
      severity: Math.min(0.35, force / 50),
      region,
      mobilityImpact: { limb: s.limb, side: s.side, restrictActions: [], postureBias: null },
      visual: { erythema: 0.2, bruise: 0.1, bleeding: false, abrasion: force / 40 },
      rule: `impactForce>=15 → abrasion`,
      fromPhysics: true
    };
  }

  // High virtual pain without force/temp → erythema only if pressure pain
  if ((s.virtualPain || 0) >= 0.8 && (s.pressure || 0) >= 0.75) {
    return {
      kind: 'erythema',
      severity: 0.25,
      region,
      mobilityImpact: { limb: s.limb, side: s.side, restrictActions: [], postureBias: null },
      visual: { erythema: 0.4, bruise: 0, bleeding: false, abrasion: 0 },
      rule: `virtualPain>=0.8 & pressure>=0.75 → erythema`,
      fromPhysics: true
    };
  }

  return null;
}

function mapForceRegion(region, s) {
  if (region && region.startsWith('hand')) return region.replace('hand', 'forearm');
  return region || (s.side === 'L' ? 'upper_arm_L' : 'upper_arm_R');
}

/** Dialogue-only injury requests MUST be rejected */
export function rejectDialogueOnlyInjury(reason) {
  return {
    ok: false,
    rejected: true,
    reason: reason || '禁止僅依對話內容產生傷害；須有虛擬物理參數',
    fromPhysics: false
  };
}
