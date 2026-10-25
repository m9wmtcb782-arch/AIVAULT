/**
 * Conversation Target Tracking（對話對象追蹤）
 * Shared by ENGINE-15／16／08. 狀態：開發中。
 * 不得用固定循環動畫冒充自然交流。
 */

export const CONVERSATION_TRACKING_VERSION = '0.1.0-dev';

/** @typedef {'user'|'friend'|'darkstar'|null} PartyId */
/** @typedef {'user_eyes'|'friend_display'|'virtual_camera'|'away'|null} GazeTargetId */

/**
 * @param {object} [opts]
 */
export function createConversationTracker(opts = {}) {
  const state = {
    currentSpeaker: /** @type {PartyId} */ (null),
    listener: /** @type {PartyId} */ (null),
    answerTarget: /** @type {PartyId} */ (null),
    userEyePos: { x: 0.15, y: 1.55, z: 1.35 },
    friendDisplayPos: { x: -0.55, y: 1.45, z: 1.1 },
    virtualCameraGaze: { x: 0, y: 1.52, z: 2.4 },
    currentGazeTarget: /** @type {GazeTargetId} */ (null),
    lastGazeSwitchAt: 0,
    headPose: { yaw: 0, pitch: 0, roll: 0 },
    eyePose: { yaw: 0, pitch: 0, left: { yaw: 0, pitch: 0 }, right: { yaw: 0, pitch: 0 } },
    mode: 'idle', // idle | answering_user | answering_friend | listening_user | listening_friend | three_way
    note: 'DEV — WebRTC three-pane NOT complete'
  };

  function clonePos(p) {
    return { x: p.x, y: p.y, z: p.z };
  }

  function getState() {
    return {
      version: CONVERSATION_TRACKING_VERSION,
      currentSpeaker: state.currentSpeaker,
      listener: state.listener,
      answerTarget: state.answerTarget,
      userEyePos: clonePos(state.userEyePos),
      friendDisplayPos: clonePos(state.friendDisplayPos),
      virtualCameraGaze: clonePos(state.virtualCameraGaze),
      currentGazeTarget: state.currentGazeTarget,
      lastGazeSwitchAt: state.lastGazeSwitchAt,
      headPose: { ...state.headPose },
      eyePose: {
        yaw: state.eyePose.yaw,
        pitch: state.eyePose.pitch,
        left: { ...state.eyePose.left },
        right: { ...state.eyePose.right }
      },
      mode: state.mode,
      note: state.note
    };
  }

  /**
   * Resolve preferred gaze target from conversation roles.
   * Answering friend → virtual_camera (遠端眼神交流，非螢幕朋友影像).
   * Listening friend → friend_display allowed.
   * Answering user → user_eyes.
   */
  function resolveGazeTarget() {
    if (state.mode === 'answering_user' || state.answerTarget === 'user') {
      return 'user_eyes';
    }
    if (state.mode === 'answering_friend' || state.answerTarget === 'friend') {
      return 'virtual_camera';
    }
    if (state.mode === 'listening_friend' || (state.currentSpeaker === 'friend' && state.listener === 'darkstar')) {
      return 'friend_display';
    }
    if (state.mode === 'listening_user' || (state.currentSpeaker === 'user' && state.listener === 'darkstar')) {
      return 'user_eyes';
    }
    if (state.currentGazeTarget) return state.currentGazeTarget;
    return 'user_eyes';
  }

  function worldPosForTarget(id) {
    if (id === 'user_eyes') return clonePos(state.userEyePos);
    if (id === 'friend_display') return clonePos(state.friendDisplayPos);
    if (id === 'virtual_camera') return clonePos(state.virtualCameraGaze);
    if (id === 'away') {
      return {
        x: state.userEyePos.x + 0.35,
        y: state.userEyePos.y + 0.05,
        z: state.userEyePos.z
      };
    }
    return clonePos(state.virtualCameraGaze);
  }

  function setGazeTarget(id, ts = Date.now()) {
    if (id !== state.currentGazeTarget) {
      state.currentGazeTarget = id;
      state.lastGazeSwitchAt = ts;
    }
  }

  function setUserEyePos(p) {
    if (!p) return;
    state.userEyePos = { x: +p.x, y: +p.y, z: +p.z };
  }

  function setFriendDisplayPos(p) {
    if (!p) return;
    state.friendDisplayPos = { x: +p.x, y: +p.y, z: +p.z };
  }

  function setVirtualCameraGaze(p) {
    if (!p) return;
    state.virtualCameraGaze = { x: +p.x, y: +p.y, z: +p.z };
  }

  function setHeadPose(p) {
    state.headPose = { yaw: p.yaw || 0, pitch: p.pitch || 0, roll: p.roll || 0 };
  }

  function setEyePose(p) {
    state.eyePose = {
      yaw: p.yaw || 0,
      pitch: p.pitch || 0,
      left: { yaw: (p.left && p.left.yaw) || 0, pitch: (p.left && p.left.pitch) || 0 },
      right: { yaw: (p.right && p.right.yaw) || 0, pitch: (p.right && p.right.pitch) || 0 }
    };
  }

  /**
   * High-level conversation mode switch (UI / decision mock).
   * @param {'idle'|'answering_user'|'answering_friend'|'listening_user'|'listening_friend'|'three_way'} mode
   * @param {object} [extra]
   */
  function setMode(mode, extra = {}) {
    state.mode = mode;
    if (mode === 'answering_user') {
      state.answerTarget = 'user';
      state.currentSpeaker = 'darkstar';
      state.listener = 'user';
      setGazeTarget('user_eyes', extra.ts);
    } else if (mode === 'answering_friend') {
      state.answerTarget = 'friend';
      state.currentSpeaker = 'darkstar';
      state.listener = 'friend';
      setGazeTarget('virtual_camera', extra.ts);
    } else if (mode === 'listening_user') {
      state.answerTarget = null;
      state.currentSpeaker = 'user';
      state.listener = 'darkstar';
      setGazeTarget('user_eyes', extra.ts);
    } else if (mode === 'listening_friend') {
      state.answerTarget = null;
      state.currentSpeaker = 'friend';
      state.listener = 'darkstar';
      setGazeTarget('friend_display', extra.ts);
    } else if (mode === 'three_way') {
      // leave roles to rotateThreeWay
    } else {
      state.answerTarget = null;
      state.currentSpeaker = null;
      state.listener = null;
    }
    if (extra.userEyePos) setUserEyePos(extra.userEyePos);
    if (extra.virtualCameraGaze) setVirtualCameraGaze(extra.virtualCameraGaze);
  }

  /**
   * Three-person turn rotation (mock for Test C).
   * @param {'user'|'friend'|'darkstar_to_user'|'darkstar_to_friend'} turn
   */
  function rotateThreeWay(turn, ts = Date.now()) {
    state.mode = 'three_way';
    if (turn === 'user') {
      state.currentSpeaker = 'user';
      state.listener = 'darkstar';
      state.answerTarget = null;
      setGazeTarget('user_eyes', ts);
    } else if (turn === 'friend') {
      state.currentSpeaker = 'friend';
      state.listener = 'darkstar';
      state.answerTarget = null;
      setGazeTarget('friend_display', ts);
    } else if (turn === 'darkstar_to_user') {
      state.currentSpeaker = 'darkstar';
      state.listener = 'user';
      state.answerTarget = 'user';
      setGazeTarget('user_eyes', ts);
    } else if (turn === 'darkstar_to_friend') {
      state.currentSpeaker = 'darkstar';
      state.listener = 'friend';
      state.answerTarget = 'friend';
      setGazeTarget('virtual_camera', ts);
    }
  }

  return {
    version: CONVERSATION_TRACKING_VERSION,
    getState,
    resolveGazeTarget,
    worldPosForTarget,
    setGazeTarget,
    setUserEyePos,
    setFriendDisplayPos,
    setVirtualCameraGaze,
    setHeadPose,
    setEyePose,
    setMode,
    rotateThreeWay
  };
}
