/**
 * ENGINE-12 Soft Tissue Simulator (DEV).
 * Collision + local deformation field + spring-damper recovery.
 * NOT whole-mesh scale. NOT a single fixed morph animation for all contacts.
 *
 * Shared Body Core soft-tissue layer — same state readable by virtual renderer
 * and (later) ENGINE-11 compositor.
 */
import { REGION_PARAMS, SOFT_TISSUE_PARAMS_VERSION, listRegions } from './region-params.js';

export const SOFT_TISSUE_SIM_VERSION = '0.1.0-dev';
export const SOFT_TISSUE_STATUS = '開發中';

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

function len3(v) {
  return Math.hypot(v.x, v.y, v.z);
}

function sub(a, b) {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function add(a, b) {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

function scale(a, s) {
  return { x: a.x * s, y: a.y * s, z: a.z * s };
}

function norm(a) {
  const L = len3(a) || 1e-9;
  return scale(a, 1 / L);
}

/**
 * Create one soft region with a coarse sample lattice (local deformation points).
 * Displacements are per-sample — never a uniform mesh.scale.
 */
function createRegionState(params, samplesPerAxis = 3) {
  const samples = [];
  const [hx, hy, hz] = params.halfExtents;
  const [cx, cy, cz] = params.restCenter;
  for (let ix = 0; ix < samplesPerAxis; ix++) {
    for (let iy = 0; iy < samplesPerAxis; iy++) {
      for (let iz = 0; iz < samplesPerAxis; iz++) {
        const u = samplesPerAxis === 1 ? 0 : ix / (samplesPerAxis - 1);
        const v = samplesPerAxis === 1 ? 0 : iy / (samplesPerAxis - 1);
        const w = samplesPerAxis === 1 ? 0 : iz / (samplesPerAxis - 1);
        const rest = {
          x: cx + (u - 0.5) * 2 * hx,
          y: cy + (v - 0.5) * 2 * hy,
          z: cz + (w - 0.5) * 2 * hz
        };
        samples.push({
          rest: { ...rest },
          pos: { ...rest },
          vel: { x: 0, y: 0, z: 0 },
          disp: { x: 0, y: 0, z: 0 }
        });
      }
    }
  }
  return {
    id: params.id,
    params,
    samples,
    lastContact: null,
    peakPenetration: 0,
    peakArea: 0,
    contactFrames: 0
  };
}

/**
 * Sphere collider vs region AABB + sample points.
 * Returns contact metrics: penetration, area estimate, normal, angle.
 */
function collideSphereWithRegion(collider, region) {
  const p = region.params;
  const [hx, hy, hz] = p.halfExtents;
  const [cx, cy, cz] = p.restCenter;
  // Closest point on AABB to sphere center
  const q = {
    x: clamp(collider.x, cx - hx, cx + hx),
    y: clamp(collider.y, cy - hy, cy + hy),
    z: clamp(collider.z, cz - hz, cz + hz)
  };
  const d = sub(collider, q);
  const dist = len3(d);
  const pen = collider.radius - dist;
  if (pen <= 0) return null;

  const n = dist > 1e-6 ? norm(d) : { x: 0, y: 0, z: 1 };
  // Angle: degrees from +Z (frontal) using contact normal
  const angleDeg = (Math.acos(clamp(n.z, -1, 1)) * 180) / Math.PI;
  // Effective contact area ~ pi * a^2 where a grows with penetration & radius
  const a = Math.sqrt(Math.max(0, 2 * collider.radius * pen - pen * pen));
  const area = Math.PI * a * a * p.contactAreaGain;

  return {
    penetration: Math.min(pen, p.maxPenetration),
    rawPenetration: pen,
    area,
    normal: n,
    angleDeg,
    point: q,
    durationHint: collider.durationMs || 0
  };
}

/**
 * @param {object} [opts]
 * @param {string[]} [opts.regions] subset of region ids
 * @param {number} [opts.samplesPerAxis]
 */
export function createSoftTissueSim(opts = {}) {
  const ids = opts.regions || Object.keys(REGION_PARAMS);
  const samplesPerAxis = opts.samplesPerAxis || 3;
  const regions = {};
  ids.forEach((id) => {
    const p = REGION_PARAMS[id];
    if (p) regions[id] = createRegionState(p, samplesPerAxis);
  });

  let frame = 0;
  let lastDt = 1 / 60;
  const history = [];

  /**
   * Step simulation.
   * @param {number} dtSeconds
   * @param {Array<{id?:string,x:number,y:number,z:number,radius:number,durationMs?:number}>} colliders
   */
  function step(dtSeconds, colliders = []) {
    const dt = clamp(dtSeconds || 1 / 60, 0.001, 0.05);
    lastDt = dt;
    frame += 1;
    const contacts = [];

    Object.values(regions).forEach((region) => {
      const p = region.params;
      let best = null;
      for (const c of colliders) {
        const hit = collideSphereWithRegion(c, region);
        if (hit && (!best || hit.penetration > best.penetration)) {
          best = { ...hit, colliderId: c.id || 'collider' };
        }
      }

      if (best) {
        region.lastContact = best;
        region.contactFrames += 1;
        region.peakPenetration = Math.max(region.peakPenetration, best.penetration);
        region.peakArea = Math.max(region.peakArea, best.area);
        contacts.push({ regionId: region.id, ...best });
      } else {
        region.lastContact = null;
      }

      // Integrate each sample independently (local field — not uniform scale)
      const mass = Math.max(0.05, p.volume);
      region.samples.forEach((s) => {
        // Spring to rest
        const toRest = sub(s.rest, s.pos);
        let fx = toRest.x * p.elasticity;
        let fy = toRest.y * p.elasticity - p.gravityBias * 9.81 * 0.02 * mass;
        let fz = toRest.z * p.elasticity;

        if (best) {
          // Push sample away from collider along contact normal, falloff by distance
          const toSample = sub(s.rest, best.point);
          const dist = len3(toSample);
          const influence = Math.exp(-dist * dist / (2 * (0.01 + best.area * 0.002)));
          // Penetration displacement — magnitude depends on pen, area, angle
          const angleFactor = 0.55 + 0.45 * Math.cos((best.angleDeg * Math.PI) / 180);
          const areaFactor = clamp(best.area / 0.01, 0.4, 2.5);
          const mag =
            best.penetration *
            influence *
            angleFactor *
            areaFactor *
            (0.7 + 0.3 / Math.sqrt(mass));
          // Squeeze: displace along -normal; lateral spread
          const push = scale(best.normal, -mag);
          const lateral = {
            x: toSample.x * p.lateralCoupling * mag * 0.5,
            y: toSample.y * p.lateralCoupling * mag * 0.15,
            z: toSample.z * p.lateralCoupling * mag * 0.5
          };
          fx += (push.x + lateral.x) * p.elasticity * 2.2;
          fy += (push.y + lateral.y) * p.elasticity * 2.2;
          fz += (push.z + lateral.z) * p.elasticity * 2.2;
        } else {
          // Recovery boost when free
          fx *= p.recoveryRate;
          fy *= p.recoveryRate;
          fz *= p.recoveryRate;
        }

        // Integrate
        s.vel.x = (s.vel.x + (fx / mass) * dt) * p.damping;
        s.vel.y = (s.vel.y + (fy / mass) * dt) * p.damping;
        s.vel.z = (s.vel.z + (fz / mass) * dt) * p.damping;
        s.pos.x += s.vel.x * dt;
        s.pos.y += s.vel.y * dt;
        s.pos.z += s.vel.z * dt;
        s.disp.x = s.pos.x - s.rest.x;
        s.disp.y = s.pos.y - s.rest.y;
        s.disp.z = s.pos.z - s.rest.z;
      });
    });

    const snapshot = {
      frame,
      dt,
      contacts,
      metrics: getMetrics()
    };
    history.push(snapshot);
    if (history.length > 600) history.shift();
    return snapshot;
  }

  function getMetrics() {
    const out = {};
    Object.values(regions).forEach((r) => {
      let maxDisp = 0;
      let sumDisp = 0;
      r.samples.forEach((s) => {
        const d = len3(s.disp);
        maxDisp = Math.max(maxDisp, d);
        sumDisp += d;
      });
      out[r.id] = {
        maxDisplacement: maxDisp,
        meanDisplacement: sumDisp / r.samples.length,
        peakPenetration: r.peakPenetration,
        peakArea: r.peakArea,
        contactFrames: r.contactFrames,
        inContact: !!r.lastContact,
        lastAngleDeg: r.lastContact ? r.lastContact.angleDeg : null,
        lastArea: r.lastContact ? r.lastContact.area : null,
        lastPenetration: r.lastContact ? r.lastContact.penetration : null
      };
    });
    return out;
  }

  /** Shared state export for renderers / ENGINE-11 */
  function getDeformationState() {
    const regionsOut = {};
    Object.values(regions).forEach((r) => {
      regionsOut[r.id] = {
        id: r.id,
        params: {
          volume: r.params.volume,
          elasticity: r.params.elasticity,
          damping: r.params.damping,
          gravityBias: r.params.gravityBias,
          maxPenetration: r.params.maxPenetration
        },
        samples: r.samples.map((s) => ({
          rest: { ...s.rest },
          pos: { ...s.pos },
          disp: { ...s.disp }
        })),
        // Explicitly not a uniform scale:
        uniformScale: null,
        deformationMode: 'local_sample_field'
      };
    });
    return {
      schema: 'aivault.darkstar.soft_tissue_state.v0.1',
      version: SOFT_TISSUE_SIM_VERSION,
      paramsVersion: SOFT_TISSUE_PARAMS_VERSION,
      status: SOFT_TISSUE_STATUS,
      frame,
      dt: lastDt,
      regions: regionsOut,
      metrics: getMetrics(),
      sharedBodyCoreLayer: 'soft-tissue',
      consumers: ['virtual-world-renderer', 'ENGINE-11-realworld-compositor']
    };
  }

  function resetPeaks() {
    Object.values(regions).forEach((r) => {
      r.peakPenetration = 0;
      r.peakArea = 0;
      r.contactFrames = 0;
    });
  }

  function resetAll() {
    Object.values(regions).forEach((r) => {
      r.samples.forEach((s) => {
        s.pos = { ...s.rest };
        s.vel = { x: 0, y: 0, z: 0 };
        s.disp = { x: 0, y: 0, z: 0 };
      });
      r.lastContact = null;
    });
    resetPeaks();
    frame = 0;
    history.length = 0;
  }

  return {
    version: SOFT_TISSUE_SIM_VERSION,
    status: SOFT_TISSUE_STATUS,
    step,
    getDeformationState,
    getMetrics,
    resetAll,
    resetPeaks,
    getHistory: () => history.slice(),
    listRegionIds: () => Object.keys(regions)
  };
}

export { listRegions, REGION_PARAMS };
