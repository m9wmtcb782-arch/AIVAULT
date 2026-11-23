/* AIVAULT 臺北衛星地圖 v1 — 近景 3D 圖層（ES module，縮放 ≥ 15 才載入）
 * 人物：Kenney「Mini Characters」骨架蒙皮 glTF（CC0），AnimationMixer 播放 walk 動畫；6 種外觀；學生加背包。
 * 車輛：Kenney「Car Kit」glTF（CC0），InstancedMesh；公車暫以 delivery 廂型車模型拉長＋路線色調代替。
 * 列車與飛機：程式建模的圓潤造型（非真實模型）。
 * 繪製方式：與底圖同步的螢幕座標正交相機（Google hybrid 為點陣圖、不支援 WebGLOverlayView，故採此法），
 *           每幀依經緯度→螢幕像素投影定位，任何縮放層級都對齊地面；DPR 正確、無模糊。全部為模擬，不追蹤任何真人。 */
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/+esm';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/GLTFLoader.js/+esm';
import { MeshoptDecoder } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/libs/meshopt_decoder.module.js/+esm';
import * as SkeletonUtils from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/utils/SkeletonUtils.js/+esm';
import { mergeGeometries } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/utils/BufferGeometryUtils.js/+esm';

const BASE = new URL('../assets/models/tpe-sat/', import.meta.url).href;
const PEOPLE = ['male-a', 'female-b', 'male-c', 'female-d', 'male-e', 'female-f'];
const CARS = ['sedan', 'taxi', 'suv', 'van', 'hatchback-sports', 'sedan'];
const TILT = 0.8; // 俯視角（rad）

export async function create(opt) {
  const W = () => innerWidth, H = () => innerHeight;
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(opt.dpr); renderer.setSize(W(), H()); renderer.outputColorSpace = THREE.SRGBColorSpace;
  const el = renderer.domElement; el.id = 'tpe-3d'; el.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:6';
  document.body.appendChild(el);
  const scene = new THREE.Scene();
  const cam = new THREE.OrthographicCamera(0, W(), 0, -H(), -20000, 20000); cam.position.set(0, 0, 5000);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x556070, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6); sun.position.set(-0.4, 0.8, 1); scene.add(sun);

  const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
  const load = (u) => new Promise((ok, no) => loader.load(u, ok, undefined, no));

  /* ---- 人物模板 ---- */
  const tpl = await Promise.all(PEOPLE.map((n) => load(BASE + 'people/' + n + '.glb')));
  const box = new THREE.Box3().setFromObject(tpl[0].scene); const H0 = (box.max.y - box.min.y) || 1;
  const bagMat = new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: .6 });
  const bagGeo = new THREE.CapsuleGeometry(H0 * .085, H0 * .12, 4, 10); // 圓潤背包配件
  const POOL = opt.mobile ? 28 : 72, pool = [];
  for (let i = 0; i < POOL; i++) {
    const v = i % tpl.length, root = SkeletonUtils.clone(tpl[v].scene), g = new THREE.Group(); g.add(root);
    root.traverse((o) => { if (o.isMesh) { o.frustumCulled = false; } });
    const mixer = new THREE.AnimationMixer(root), clips = tpl[v].animations;
    const walk = mixer.clipAction(THREE.AnimationClip.findByName(clips, 'walk') || clips[0]); walk.play(); walk.time = Math.random() * 2;
    const bag = new THREE.Mesh(bagGeo, bagMat); bag.position.set(0, H0 * .58, -H0 * .13); bag.visible = false; g.add(bag);
    g.visible = false; scene.add(g); pool.push({ g, mixer, bag, key: null, used: 0 });
  }

  /* ---- 車輛（InstancedMesh） ---- */
  // meshopt 量化/交錯屬性 → 一般 Float32 屬性，才能合併成單一 InstancedMesh
  function plain(src) {
    const g = new THREE.BufferGeometry();
    for (const k of ['position', 'normal', 'uv']) { const a = src.getAttribute(k); if (!a) continue;
      const n = a.itemSize, arr = new Float32Array(a.count * n), get = ['getX', 'getY', 'getZ', 'getW'];
      for (let i = 0; i < a.count; i++) for (let c = 0; c < n; c++) arr[i * n + c] = a[get[c]](i);
      g.setAttribute(k, new THREE.BufferAttribute(arr, n)); }
    if (src.index) g.setIndex(Array.from(src.index.array)); else g.setIndex([...Array(g.getAttribute('position').count).keys()]);
    if (!g.getAttribute('uv')) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.getAttribute('position').count * 2), 2));
    if (!g.getAttribute('normal')) g.computeVertexNormals();
    return g;
  }
  async function vehicleGeo(name) {
    const gl = await load(BASE + 'vehicles/' + name + '.glb'); gl.scene.updateMatrixWorld(true);
    const geos = []; let mat = null;
    gl.scene.traverse((o) => { if (o.isMesh) { const g = plain(o.geometry); g.applyMatrix4(o.matrixWorld); geos.push(g); mat = mat || o.material; } });
    const geo = mergeGeometries(geos, false); geo.computeBoundingBox(); const b = geo.boundingBox;
    const lenX = b.max.x - b.min.x, lenZ = b.max.z - b.min.z; // 車頭方向：取較長軸
    if (lenX > lenZ) geo.rotateY(Math.PI / 2); // 統一成沿 Z 軸
    geo.computeBoundingBox(); const bb = geo.boundingBox; geo.translate(-(bb.max.x + bb.min.x) / 2, -bb.min.y, -(bb.max.z + bb.min.z) / 2);
    geo.computeBoundingBox(); return { geo, mat, L: geo.boundingBox.max.z - geo.boundingBox.min.z };
  }
  const CAP_CAR = opt.mobile ? 90 : 240;
  const carV = await Promise.all([...new Set(CARS)].map(vehicleGeo));
  const carIM = carV.map((v) => { const m = new THREE.InstancedMesh(v.geo, v.mat, CAP_CAR); m.count = 0; m.frustumCulled = false; scene.add(m); return m; });
  const busV = await vehicleGeo('delivery');
  const busIM = new THREE.InstancedMesh(busV.geo, busV.mat.clone(), 60); busIM.count = 0; busIM.frustumCulled = false; scene.add(busIM);
  /* ---- 列車、飛機（程式建模圓潤造型） ---- */
  const trainGeo = new THREE.CapsuleGeometry(1, 6, 6, 14); trainGeo.rotateX(Math.PI / 2); trainGeo.translate(0, 1, 0);
  const trainIM = new THREE.InstancedMesh(trainGeo, new THREE.MeshStandardMaterial({ roughness: .35, metalness: .2 }), 160); trainIM.count = 0; trainIM.frustumCulled = false; scene.add(trainIM);
  const plane = new THREE.Group();
  { const wm = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: .35, metalness: .15 }), tm = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: .4 });
    const f = new THREE.Mesh(new THREE.CapsuleGeometry(.9, 8, 8, 16), wm); f.rotation.x = Math.PI / 2; plane.add(f);
    const wing = new THREE.Mesh(new THREE.BoxGeometry(11, .25, 2.2), wm); wing.position.set(0, -.2, .4); plane.add(wing);
    const ht = new THREE.Mesh(new THREE.BoxGeometry(4.2, .2, 1.1), wm); ht.position.set(0, .2, -4.3); plane.add(ht);
    const vt = new THREE.Mesh(new THREE.BoxGeometry(.25, 2.2, 1.6), tm); vt.position.set(0, 1.3, -4.3); plane.add(vt);
    plane.visible = false; scene.add(plane); }

  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), eul = new THREE.Euler(0, 0, 0, 'XYZ'), pos = new THREE.Vector3(), scl = new THREE.Vector3(), col = new THREE.Color();
  const CARC = [0xe5e7eb, 0xf59e0b, 0x334155, 0xef4444, 0x3b82f6, 0x9ca3af];
  let lastT = performance.now();
  function place(sx, sy, yaw, s, sy2) { pos.set(sx, -sy, sy * 0.5 + 100); eul.set(TILT, yaw, 0); q.setFromEuler(eul); scl.set(s, s, s * (sy2 || 1)); m4.compose(pos, q, scl); return m4; }

  function render(V, list, now) {
    const dt = Math.min(.1, (now - lastT) / 1000); lastT = now;
    let pi = 0; const used = new Set(); const humans = [], cars = [], buses = [], trains = [], planes = [];
    for (const e of list) (e.t === 'student' || e.t === 'people' ? humans : e.t === 'car' ? cars : e.t === 'bus' ? buses : e.t === 'train' ? trains : planes).push(e);
    // 人物：真實骨架動畫模型，數量上限 POOL（其餘維持 2D 點，由主程式處理不到的部分直接略過）
    const hpx = V.z >= 19 ? 46 : V.z >= 18 ? 34 : V.z >= 17 ? 24 : 16;
    for (const p of pool) p.g.visible = false;
    humans.slice(0, POOL).forEach((e, i) => {
      const p = pool[i], yaw = Math.atan2(e.dx, e.dy * 1); // 面向行進方向（螢幕向下＝朝鏡頭）
      p.g.position.set(e.sx, -e.sy, e.sy * 0.5 + 100); p.g.rotation.set(TILT, yaw, 0, 'XYZ'); const s = hpx / H0; p.g.scale.set(s, s, s);
      p.bag.visible = e.t === 'student'; p.g.visible = true; p.mixer.update(dt * (opt.reduced ? .3 : 1));
    });
    // 汽車
    const per = carIM.map(() => 0);
    for (const e of cars) { const k = e.v % carIM.length, m = carIM[k]; if (per[k] >= CAP_CAR) continue;
      const lenPx = Math.max(4.6 / e.m, 12), s = lenPx / carV[k].L; m.setMatrixAt(per[k], place(e.sx, e.sy, Math.atan2(e.dx, e.dy), s)); per[k]++; }
    carIM.forEach((m, k) => { m.count = per[k]; m.instanceMatrix.needsUpdate = true; });
    // 公車（拉長＋路線色）
    let nb = 0; for (const e of buses) { if (nb >= 60) break; const lenPx = Math.max(12 / e.m, 26), s = lenPx / (busV.L * 1.9); busIM.setMatrixAt(nb, place(e.sx, e.sy, Math.atan2(e.dx, e.dy), s, 1.9)); busIM.setColorAt(nb, col.set(e.c)); nb++; }
    busIM.count = nb; busIM.instanceMatrix.needsUpdate = true; if (busIM.instanceColor) busIM.instanceColor.needsUpdate = true;
    // 列車
    let nt = 0; for (const e of trains) { if (nt >= 160) break; const lenPx = Math.max(60 / e.m, 30), s = lenPx / 8; trainIM.setMatrixAt(nt, place(e.sx, e.sy, Math.atan2(e.dx, e.dy), s)); trainIM.setColorAt(nt, col.set(e.c)); nt++; }
    trainIM.count = nt; trainIM.instanceMatrix.needsUpdate = true; if (trainIM.instanceColor) trainIM.instanceColor.needsUpdate = true;
    // 飛機（高度：往畫面上方抬升＋放大）
    plane.visible = false;
    if (planes.length) { const e = planes[0], len = Math.max(37 / e.m, 40) * (1 + e.alt / 1500), s = len / 9.8, lift = e.alt / e.m * .35;
      plane.position.set(e.sx, -(e.sy - lift), e.sy * .5 + 400); plane.rotation.set(TILT, Math.atan2(e.dx, e.dy), 0, 'XYZ'); plane.scale.set(s, s, s); plane.visible = true; }
    renderer.render(scene, cam);
  }
  function resize() { renderer.setSize(W(), H()); cam.right = W(); cam.bottom = -H(); cam.updateProjectionMatrix(); }
  addEventListener('resize', resize);
  return { render, resize, info: () => ({ people: PEOPLE.length, pool: POOL, H0 }) };
}
