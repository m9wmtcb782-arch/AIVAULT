// 3D 沙盒：載入 AI 的 product.js，用 GLTFExporter 轉 GLB，再用 Khronos glTF-Validator 檢查；結果印成一行 JSON（GLB 用 base64）
import { createRequire } from "module"; const require = createRequire(process.cwd() + "/x.js");
import * as THREE from "three"; import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js"; import validator from "gltf-validator";
globalThis.FileReader = class { readAsArrayBuffer(b) { b.arrayBuffer().then((r) => { this.result = r; this.onloadend && this.onloadend(); this.onload && this.onload({ target: this }); }); } readAsDataURL(b) { b.arrayBuffer().then((r) => { this.result = "data:application/octet-stream;base64," + Buffer.from(r).toString("base64"); this.onloadend && this.onloadend(); }); } };
const P = require((process.env.W || "/w") + "/product.js"); const scene = P.build(require("three"));
const glb = await new GLTFExporter().parseAsync(scene, { binary: true });
const rep = await validator.validateBytes(new Uint8Array(glb));
let meshes = 0; scene.traverse((o) => { if (o.isMesh) meshes++; });
const ok = rep.issues.numErrors === 0 && meshes > 0;
console.log("GLBRESULT " + JSON.stringify({ ok, bytes: glb.byteLength, meshes, errors: rep.issues.numErrors, warnings: rep.issues.numWarnings, msgs: rep.issues.messages.slice(0, 8).map((m) => m.code + ":" + m.message), b64: ok ? Buffer.from(glb).toString("base64") : "" }));
