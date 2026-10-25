/**
 * ENGINE-01 Real-time Visual Perception (minimal).
 * Camera → MediaPipe Face + Hand → structured events on bus.
 * Never uploads frames. Never calls LLM / AI Gateway per frame.
 * Status: 開發中
 */
import { createEventBus } from './event-bus.js';
import {
  smileFromBlendshapes,
  headTurnFromMatrix,
  headTurnFromLandmarks,
  createWaveDetector,
  facePresent
} from './detectors.js';
import { startMockFeed } from './mock-feed.js';

const MP_VISION = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
const FACE_MODEL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
const HAND_MODEL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

export const ENGINE01_VERSION = '0.1.0-dev';

function uid(type) {
  return type + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
}

function wrap(partial) {
  return {
    schema: 'aivault.darkstar.visual_event.v0.1',
    id: uid(partial.type),
    ts: Date.now(),
    stream_ts: performance.now(),
    type: partial.type,
    confidence: partial.confidence,
    source: partial.source,
    payload: partial.payload || {},
    note: partial.note || undefined
  };
}

/**
 * Rising-edge + cooldown emitter so we don't spam every frame.
 */
function createEdgeEmitter(cooldownMs = 1200) {
  const last = new Map();
  return function maybeEmit(bus, partial) {
    if (!partial) return null;
    const t = performance.now();
    const prev = last.get(partial.type) || 0;
    if (t - prev < cooldownMs) return null;
    last.set(partial.type, t);
    const ev = wrap(partial);
    bus.emit(ev);
    return ev;
  };
}

export async function createVisualEngine(opts = {}) {
  const bus = opts.bus || createEventBus('engine-01-visual');
  const emitEdge = createEdgeEmitter(opts.cooldownMs || 1200);
  const waveDet = createWaveDetector(opts.wave || {});
  let faceLandmarker = null;
  let handLandmarker = null;
  let stream = null;
  let video = opts.video || null;
  let running = false;
  let raf = 0;
  let lastVideoTime = -1;
  let faceSeen = false;
  const stats = { frames: 0, events: 0, lastMs: 0 };

  async function loadModels() {
    const { FaceLandmarker, HandLandmarker, FilesetResolver } = await import(
      MP_VISION + '/vision_bundle.mjs'
    );
    const fileset = await FilesetResolver.forVisionTasks(MP_VISION + '/wasm');
    faceLandmarker = await FaceLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: FACE_MODEL, delegate: 'CPU' },
      runningMode: 'VIDEO',
      numFaces: 1,
      outputFaceBlendshapes: true,
      outputFacialTransformationMatrixes: true
    });
    handLandmarker = await HandLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: HAND_MODEL, delegate: 'CPU' },
      runningMode: 'VIDEO',
      numHands: 2
    });
  }

  async function startCamera(videoEl) {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('getUserMedia_unavailable');
    }
    video = videoEl || video;
    if (!video) throw new Error('video_element_required');
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      audio: false
    });
    video.srcObject = stream;
    video.playsInline = true;
    video.muted = true;
    await video.play();
    return stream;
  }

  function stopCamera() {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      stream = null;
    }
    if (video) video.srcObject = null;
  }

  function processFrame() {
    if (!running || !video || video.readyState < 2) {
      raf = requestAnimationFrame(processFrame);
      return;
    }
    if (video.currentTime === lastVideoTime) {
      raf = requestAnimationFrame(processFrame);
      return;
    }
    lastVideoTime = video.currentTime;
    const t0 = performance.now();
    stats.frames++;

    try {
      const face = faceLandmarker.detectForVideo(video, t0);
      const hands = handLandmarker.detectForVideo(video, t0);

      if (face?.faceLandmarks?.length) {
        if (!faceSeen) {
          faceSeen = true;
          emitEdge(bus, facePresent(face.faceLandmarks));
        }
        emitEdge(bus, smileFromBlendshapes(face.faceBlendshapes));
        let turn = null;
        if (face.facialTransformationMatrixes?.[0]?.data) {
          turn = headTurnFromMatrix(face.facialTransformationMatrixes[0].data);
        }
        if (!turn) turn = headTurnFromLandmarks(face.faceLandmarks);
        emitEdge(bus, turn);
      } else if (faceSeen) {
        faceSeen = false;
        emitEdge(bus, {
          type: 'lost_face',
          confidence: 0.8,
          source: 'mediapipe_face',
          payload: {}
        });
      }

      const handLms = hands?.landmarks || [];
      const wave = waveDet.push(handLms, t0);
      emitEdge(bus, wave);
    } catch (e) {
      console.warn('[ENGINE-01] frame', e);
    }

    stats.lastMs = performance.now() - t0;
    stats.events = bus.history().length;
    raf = requestAnimationFrame(processFrame);
  }

  async function start({ videoEl, mock = false } = {}) {
    if (mock) {
      const feed = startMockFeed({ bus });
      return { mode: 'mock', feed };
    }
    if (!faceLandmarker) await loadModels();
    await startCamera(videoEl);
    running = true;
    lastVideoTime = -1;
    waveDet.reset();
    faceSeen = false;
    raf = requestAnimationFrame(processFrame);
    return { mode: 'camera' };
  }

  function stop() {
    stopCamera();
  }

  return {
    version: ENGINE01_VERSION,
    bus,
    start,
    stop,
    getStats: () => ({ ...stats }),
    /** Test helper: inject a detector partial through edge emitter */
    _testEmit(partial) {
      return emitEdge(bus, partial);
    }
  };
}

export { createEventBus, startMockFeed };
