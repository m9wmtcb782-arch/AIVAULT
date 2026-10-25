/**
 * ENGINE-17 皮膚感覺區域映射（虛擬模擬｜開發中）
 * 對齊 soft-tissue 區域概念；本層負責感覺神經輸入，非形變場。
 * 禁止宣稱真實主觀痛覺。
 */
export const SKIN_REGIONS_VERSION = '0.1.0-dev';

/** @typedef {{ id: string, label: string, limb: string, side?: 'L'|'R'|null, softTissueLink?: string }} SkinRegion */

/** @type {Record<string, SkinRegion>} */
export const SKIN_REGIONS = Object.freeze({
  hand_R: { id: 'hand_R', label: '右手', limb: 'arm', side: 'R', softTissueLink: null },
  hand_L: { id: 'hand_L', label: '左手', limb: 'arm', side: 'L', softTissueLink: null },
  forearm_R: { id: 'forearm_R', label: '右前臂', limb: 'arm', side: 'R' },
  forearm_L: { id: 'forearm_L', label: '左前臂', limb: 'arm', side: 'L' },
  upper_arm_R: { id: 'upper_arm_R', label: '右上臂', limb: 'arm', side: 'R' },
  upper_arm_L: { id: 'upper_arm_L', label: '左上臂', limb: 'arm', side: 'L' },
  cheek_L: { id: 'cheek_L', label: '左臉頰', limb: 'face', side: 'L', softTissueLink: 'cheek_L' },
  cheek_R: { id: 'cheek_R', label: '右臉頰', limb: 'face', side: 'R', softTissueLink: 'cheek_R' },
  chest_L: { id: 'chest_L', label: '左胸', limb: 'torso', side: 'L', softTissueLink: 'chest_L' },
  chest_R: { id: 'chest_R', label: '右胸', limb: 'torso', side: 'R', softTissueLink: 'chest_R' },
  abdomen: { id: 'abdomen', label: '腹部', limb: 'torso', side: null, softTissueLink: 'abdomen' },
  hip_L: { id: 'hip_L', label: '左臀', limb: 'hip', side: 'L', softTissueLink: 'hip_L' },
  hip_R: { id: 'hip_R', label: '右臀', limb: 'hip', side: 'R', softTissueLink: 'hip_R' },
  torso_front: { id: 'torso_front', label: '軀幹前側', limb: 'torso', side: null },
  shin_R: { id: 'shin_R', label: '右小腿', limb: 'leg', side: 'R' },
  shin_L: { id: 'shin_L', label: '左小腿', limb: 'leg', side: 'L' }
});

export function listSkinRegions() {
  return Object.values(SKIN_REGIONS);
}

export function getSkinRegion(id) {
  return SKIN_REGIONS[id] || null;
}
