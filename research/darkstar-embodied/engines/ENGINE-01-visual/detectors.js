/**
 * Rule-based detectors on MediaPipe Face / Hand landmarks.
 * Not trained models — confidence is heuristic. DEV / research only.
 */

/** MediaPipe face blendshape name → smile. */
export function smileFromBlendshapes(blendshapes, threshold = 0.45) {
  if (!blendshapes || !blendshapes.length) return null;
  const cats = blendshapes[0].categories || blendshapes[0];
  const get = (name) => {
    const c = Array.isArray(cats)
      ? cats.find((x) => x.categoryName === name || x.name === name)
      : null;
    return c ? Number(c.score || 0) : 0;
  };
  const L = get('mouthSmileLeft');
  const R = get('mouthSmileRight');
  const score = (L + R) / 2;
  if (score < threshold) return null;
  return {
    type: 'smile',
    confidence: Math.min(1, score),
    source: 'mediapipe_face',
    payload: { mouthSmileLeft: L, mouthSmileRight: R, threshold }
  };
}

/**
 * Head yaw from facial transformation matrix (column-major 4x4) or nose vs cheeks.
 * Positive yaw = turn toward viewer's left (subject's right) roughly.
 */
export function headTurnFromMatrix(matrixData, thresholdDeg = 18) {
  if (!matrixData || matrixData.length < 16) return null;
  // MediaPipe facialTransformationMatrixes: Float32Array 16, column-major.
  const r00 = matrixData[0];
  const r20 = matrixData[8];
  const yaw = Math.atan2(-r20, r00) * (180 / Math.PI);
  if (Math.abs(yaw) < thresholdDeg) return null;
  return {
    type: 'head_turn',
    confidence: Math.min(1, Math.abs(yaw) / 45),
    source: 'mediapipe_face',
    payload: {
      yaw_deg: yaw,
      direction: yaw > 0 ? 'left' : 'right',
      threshold_deg: thresholdDeg
    }
  };
}

/** Fallback head turn from face landmarks (nose tip 1 vs cheeks 234/454). */
export function headTurnFromLandmarks(landmarks, threshold = 0.08) {
  if (!landmarks || !landmarks[0] || landmarks[0].length < 455) return null;
  const lm = landmarks[0];
  const nose = lm[1];
  const left = lm[234];
  const right = lm[454];
  const midX = (left.x + right.x) / 2;
  const offset = nose.x - midX;
  if (Math.abs(offset) < threshold) return null;
  return {
    type: 'head_turn',
    confidence: Math.min(1, Math.abs(offset) / 0.2),
    source: 'mediapipe_face',
    payload: {
      nose_offset: offset,
      direction: offset > 0 ? 'right' : 'left',
      threshold
    }
  };
}

/**
 * Wave detector: track wrist Y/X oscillation while hand raised.
 * handLandmarks: array of hands, each 21 points (MediaPipe Hands).
 */
export function createWaveDetector(opts = {}) {
  const windowMs = opts.windowMs || 900;
  const minPeaks = opts.minPeaks || 3;
  const raiseY = opts.raiseY || 0.55; // normalized image y (top=0): wrist above this? MP y grows downward — raised = smaller y
  const history = [];

  return {
    reset() { history.length = 0; },
    push(hands, now = performance.now()) {
      if (!hands || !hands.length) return null;
      // Prefer hand with higher wrist (smaller y = higher in frame)
      let best = null;
      for (const hand of hands) {
        const wrist = hand[0];
        if (!wrist) continue;
        if (!best || wrist.y < best.wrist.y) best = { wrist, hand };
      }
      if (!best) return null;
      const raised = best.wrist.y < raiseY;
      history.push({ t: now, x: best.wrist.x, y: best.wrist.y, raised });
      while (history.length && now - history[0].t > windowMs) history.shift();
      if (!raised || history.length < 8) return null;

      // Count direction changes in x (wave sideways)
      let peaks = 0;
      for (let i = 2; i < history.length; i++) {
        const a = history[i - 2].x;
        const b = history[i - 1].x;
        const c = history[i].x;
        if ((b - a) * (c - b) < 0 && Math.abs(b - a) > 0.015) peaks++;
      }
      if (peaks < minPeaks) return null;

      const conf = Math.min(1, 0.45 + peaks * 0.12);
      return {
        type: 'wave',
        confidence: conf,
        source: 'mediapipe_hand',
        payload: {
          peaks,
          window_ms: windowMs,
          wrist_y: best.wrist.y,
          raised: true
        }
      };
    }
  };
}

export function facePresent(landmarks) {
  if (!landmarks || !landmarks.length || !landmarks[0]?.length) return null;
  return {
    type: 'face_present',
    confidence: 0.9,
    source: 'mediapipe_face',
    payload: { landmark_count: landmarks[0].length }
  };
}
