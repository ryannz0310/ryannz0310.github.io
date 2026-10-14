/* Take the shot, in 3D: a night stadium, a cloth net, a diving keeper and a camera that chases the ball.
   World units are metres. The camera looks down -z; the goal line sits at z = GZ. */
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

export function startShoot3D(box) {
  const canvas = box.querySelector("canvas"), call = document.getElementById("pitchCall");
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const small = Math.min(innerWidth, innerHeight) < 700;

  const GW = 5, GH = 2.2, GZ = -8, ND = 1.4, BR = .17, KZ = GZ + .45;
  const TYPES = {
    finesse: { T: .95, curve: .95, arc: .5, spin: [6, 22, 0] },
    power:   { T: .44, curve: 0, arc: .1, spin: [-34, 0, 0] },
    chip:    { T: 1.35, curve: 0, arc: 2.2, spin: [9, 0, 0] },
    trivela: { T: .85, curve: -1.05, arc: .35, spin: [4, -24, 0] }
  };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ease = t => 1 - Math.pow(1 - t, 3);
  const PURPLE = 0x7c3aed, HI = 0xb47cff, ICE = 0xeadcff;

  /* ---------- renderer, scene, camera ---------- */
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, small ? 1.5 : 1.75));
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x06030c);
  scene.fog = new THREE.Fog(0x06030c, 24, 75);
  const camera = new THREE.PerspectiveCamera(42, 1, .05, 220);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), .6, .5, .86);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  /* ---------- lights ---------- */
  scene.add(new THREE.HemisphereLight(0x9f88e6, 0x0b2214, .32));
  const key = new THREE.DirectionalLight(0xfff6ee, 3.1);
  key.position.set(-7, 14, 7); key.target.position.set(0, 0, GZ / 2);
  key.castShadow = true; key.shadow.mapSize.set(small ? 1024 : 2048, small ? 1024 : 2048);
  Object.assign(key.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 40 });
  key.shadow.bias = -.0005; key.shadow.normalBias = .02;
  scene.add(key, key.target);
  const rimL = new THREE.PointLight(0x9b5cff, 10, 14, 1.8), rimR = rimL.clone();
  rimL.position.set(-5, 4, GZ - 2); rimR.position.set(5, 4, GZ - 2); scene.add(rimL, rimR);
  const fill = new THREE.PointLight(0xffffff, 6, 12, 1.8); fill.position.set(0, 3, 2); scene.add(fill);

  /* ---------- turf and lines ---------- */
  const turfTex = (() => {
    const c = document.createElement("canvas"); c.width = 64; c.height = 512; const g = c.getContext("2d");
    g.fillStyle = "#2b6e3f"; g.fillRect(0, 0, 64, 256); g.fillStyle = "#235c34"; g.fillRect(0, 256, 64, 256);
    for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(${Math.random() < .5 ? "255,255,255" : "0,0,0"},${Math.random() * .07})`; g.fillRect(Math.random() * 64, Math.random() * 512, 1, 2 + Math.random() * 3); }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(30, 80 / 4.4);
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = renderer.capabilities.getMaxAnisotropy(); return t;
  })();
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), new THREE.MeshStandardMaterial({ map: turfTex, roughness: .95, metalness: 0 }));
  ground.rotation.x = -Math.PI / 2; ground.position.z = -10; ground.receiveShadow = true; scene.add(ground);
  const lineMat = new THREE.MeshStandardMaterial({ color: 0xf2ecff, roughness: .8, emissive: 0x6e5a99, emissiveIntensity: .25 });
  const strip = (x1, z1, x2, z2, w = .08) => {
    const len = Math.hypot(x2 - x1, z2 - z1), m = new THREE.Mesh(new THREE.PlaneGeometry(len, w), lineMat);
    m.rotation.x = -Math.PI / 2; m.rotation.z = -Math.atan2(z2 - z1, x2 - x1); m.position.set((x1 + x2) / 2, .006, (z1 + z2) / 2); m.receiveShadow = true; scene.add(m);
  };
  strip(-22, GZ, 22, GZ); strip(-4.6, GZ, -4.6, GZ + 4.4); strip(4.6, GZ, 4.6, GZ + 4.4); strip(-4.6, GZ + 4.4, 4.6, GZ + 4.4);
  strip(-1.6, GZ, -1.6, GZ + 1.4); strip(1.6, GZ, 1.6, GZ + 1.4); strip(-1.6, GZ + 1.4, 1.6, GZ + 1.4);
  const spot = new THREE.Mesh(new THREE.CircleGeometry(.12, 24), lineMat); spot.rotation.x = -Math.PI / 2; spot.position.y = .007; scene.add(spot);

  /* ---------- goal frame ---------- */
  const postMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .25, metalness: .3, emissive: 0x7a4bd6, emissiveIntensity: .35 });
  const backMat = new THREE.MeshStandardMaterial({ color: 0x8b84a0, roughness: .5, metalness: .6 });
  const tube = (a, b, r, mat) => {
    const d = new THREE.Vector3().subVectors(b, a), m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, d.length(), 20), mat);
    m.position.copy(a).addScaledVector(d, .5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    m.castShadow = true; scene.add(m); return m;
  };
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const topBack = GH * .9;
  tube(V(-GW / 2, 0, GZ), V(-GW / 2, GH, GZ), .065, postMat); tube(V(GW / 2, 0, GZ), V(GW / 2, GH, GZ), .065, postMat);
  tube(V(-GW / 2 - .065, GH, GZ), V(GW / 2 + .065, GH, GZ), .065, postMat);
  [-1, 1].forEach(s => {
    tube(V(s * GW / 2, 0, GZ), V(s * GW / 2, 0, GZ - ND), .025, backMat);
    tube(V(s * GW / 2, 0, GZ - ND), V(s * GW / 2, topBack, GZ - ND), .03, backMat);
    tube(V(s * GW / 2, GH, GZ), V(s * GW / 2, topBack, GZ - ND), .025, backMat);
  });
  tube(V(-GW / 2, 0, GZ - ND), V(GW / 2, 0, GZ - ND), .025, backMat);
  tube(V(-GW / 2, topBack, GZ - ND), V(GW / 2, topBack, GZ - ND), .03, backMat);

  /* ---------- the net: a verlet cloth for roof + back, static mesh for the sides ---------- */
  const NU = 27, NV = 19, L1 = Math.hypot(GH - topBack, ND), L2 = topBack;
  const N = NU * NV, pos = new Float32Array(N * 3), prev = new Float32Array(N * 3), pin = new Uint8Array(N);
  let vb = 0, bestGap = 9;
  for (let v = 0; v < NV; v++) {
    const s = v / (NV - 1) * (L1 + L2); let y, z;
    if (s <= L1) { const f = s / L1; y = GH + (topBack - GH) * f; z = GZ - ND * f; } else { const f = (s - L1) / L2; y = topBack * (1 - f); z = GZ - ND; }
    if (Math.abs(s - L1) < bestGap) { bestGap = Math.abs(s - L1); vb = v; }
    for (let u = 0; u < NU; u++) { const i = v * NU + u; pos[i * 3] = -GW / 2 + GW * u / (NU - 1); pos[i * 3 + 1] = y; pos[i * 3 + 2] = z; }
  }
  prev.set(pos);
  const rest = pos.slice();
  for (let v = 0; v < NV; v++) for (let u = 0; u < NU; u++) pin[v * NU + u] = (v === 0 || v === NV - 1 || v === vb || u === 0 || u === NU - 1) ? 1 : 0;
  const cons = [], idx = [];
  const link = (a, b) => { cons.push(a, b, Math.hypot(pos[a * 3] - pos[b * 3], pos[a * 3 + 1] - pos[b * 3 + 1], pos[a * 3 + 2] - pos[b * 3 + 2])); idx.push(a, b); };
  for (let v = 0; v < NV; v++) for (let u = 0; u < NU; u++) { const i = v * NU + u; if (u < NU - 1) link(i, i + 1); if (v < NV - 1) link(i, i + NU); }
  const netGeo = new THREE.BufferGeometry(); netGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3)); netGeo.setIndex(idx);
  const netMat = new THREE.LineBasicMaterial({ color: 0xe9ddff, transparent: true, opacity: .55, fog: true });
  scene.add(new THREE.LineSegments(netGeo, netMat));
  // side nets
  const sideV = [];
  [-1, 1].forEach(s => {
    const x = s * GW / 2;
    for (let k = 1; k < 7; k++) { const z = GZ - ND * k / 7, yTop = GH + (topBack - GH) * k / 7; sideV.push(x, 0, z, x, yTop, z); }
    for (let y = .22; y < GH; y += .22) { const zEnd = y <= topBack ? GZ - ND : GZ - ND * (GH - y) / (GH - topBack); sideV.push(x, y, GZ, x, y, zEnd); }
  });
  const sideGeo = new THREE.BufferGeometry(); sideGeo.setAttribute("position", new THREE.Float32BufferAttribute(sideV, 3));
  scene.add(new THREE.LineSegments(sideGeo, new THREE.LineBasicMaterial({ color: 0xe9ddff, transparent: true, opacity: .35 })));

  /* ---------- the ball: physical material with a football pattern computed per pixel ---------- */
  const centers = (() => {
    const t = (1 + Math.sqrt(5)) / 2, out = [];
    [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]].forEach(p => out.push(new THREE.Vector3(...p).normalize()));
    const ico = new THREE.IcosahedronGeometry(1, 0), p = ico.attributes.position;
    for (let i = 0; i < p.count; i += 3) out.push(new THREE.Vector3().fromBufferAttribute(p, i).add(new THREE.Vector3().fromBufferAttribute(p, i + 1)).add(new THREE.Vector3().fromBufferAttribute(p, i + 2)).normalize());
    return out;
  })();
  const ballMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: .32, clearcoat: .7, clearcoatRoughness: .2 });
  ballMat.onBeforeCompile = sh => {
    sh.uniforms.uC = { value: centers };
    sh.vertexShader = "varying vec3 vObj;\n" + sh.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\nvObj = position;");
    sh.fragmentShader = "uniform vec3 uC[32];\nvarying vec3 vObj;\n" + sh.fragmentShader.replace("#include <color_fragment>", `#include <color_fragment>
      vec3 nn = normalize(vObj); float b1 = -2.0, b2 = -2.0; int bi = 0;
      for (int i = 0; i < 32; i++) { float d = dot(nn, uC[i]); if (d > b1) { b2 = b1; b1 = d; bi = i; } else if (d > b2) { b2 = d; } }
      float w = fwidth(b1 - b2) * 1.5 + 0.004;
      float seam = smoothstep(0.004, 0.004 + w, b1 - b2);
      vec3 pat = bi < 12 ? vec3(0.09, 0.04, 0.17) : vec3(0.97, 0.96, 1.0);
      diffuseColor.rgb *= mix(vec3(0.22, 0.18, 0.28), pat, seam);`);
  };
  const ball = new THREE.Mesh(new THREE.SphereGeometry(BR, 64, 48), ballMat);
  ball.castShadow = true; scene.add(ball);
  const ballVel = new THREE.Vector3(), spin = new THREE.Vector3();

  /* ---------- keeper, built from capsules ---------- */
  const keeper = new THREE.Group(), kBody = new THREE.Group(); keeper.add(kBody); scene.add(keeper);
  const mJersey = new THREE.MeshStandardMaterial({ color: ICE, roughness: .65 }), mDark = new THREE.MeshStandardMaterial({ color: 0x150c24, roughness: .7 });
  const mSkin = new THREE.MeshStandardMaterial({ color: 0xd8ab86, roughness: .6 }), mGlove = new THREE.MeshStandardMaterial({ color: HI, emissive: PURPLE, emissiveIntensity: 1.2, roughness: .4 });
  const part = (geo, mat, x, y, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; kBody.add(m); return m; };
  part(new THREE.CapsuleGeometry(.085, .62, 6, 12), mDark, -.13, .42); part(new THREE.CapsuleGeometry(.085, .62, 6, 12), mDark, .13, .42);
  part(new THREE.CylinderGeometry(.21, .23, .3, 16), mDark, 0, .9);
  const torso = part(new THREE.CapsuleGeometry(.2, .42, 8, 16), mJersey, 0, 1.3); torso.scale.z = .72;
  const crest = (() => { const c = document.createElement("canvas"); c.width = c.height = 128; const g = c.getContext("2d"); g.fillStyle = "#7c3aed"; g.font = "italic 900 96px Montserrat, Arial"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("1", 64, 70); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  part(new THREE.PlaneGeometry(.26, .26), new THREE.MeshStandardMaterial({ map: crest, transparent: true, roughness: .7 }), 0, 1.33, .148);
  part(new THREE.SphereGeometry(.125, 20, 16), mSkin, 0, 1.73);
  const hair = part(new THREE.SphereGeometry(.13, 20, 12, 0, Math.PI * 2, 0, Math.PI * .55), mDark, 0, 1.75); hair.rotation.x = -.25;
  const arm = sx => {
    const piv = new THREE.Group(); piv.position.set(sx * .25, 1.55, 0); kBody.add(piv);
    const a = new THREE.Mesh(new THREE.CapsuleGeometry(.06, .46, 6, 10), mJersey); a.position.y = -.3; a.castShadow = true; piv.add(a);
    const gl = new THREE.Mesh(new THREE.SphereGeometry(.085, 16, 12), mGlove); gl.position.y = -.62; gl.castShadow = true; piv.add(gl);
    return piv;
  };
  const armL = arm(-1), armR = arm(1);
  keeper.position.set(0, 0, KZ);
  const kState = { fx: 0, h: 0, th: 0, side: 1, d: 0, t0: 0, from: null, to: null };
  const reachPose = (tx, ty) => {
    const L = 2.1, side = tx >= 0 ? 1 : -1, th = clamp(Math.acos(clamp((ty - .1) / L, -1, 1)), .35, 1.42);
    return { fx: clamp(tx - side * L * Math.sin(th), -1.6, 1.6), h: Math.max(0, ty - L * Math.cos(th)) * .8, th, side };
  };

  /* ---------- stadium: stands, crowd, LED board, floodlights ---------- */
  const standMat = new THREE.MeshStandardMaterial({ color: 0x120a20, roughness: .9 });
  for (let r = 0; r < 10; r++) { const m = new THREE.Mesh(new THREE.BoxGeometry(70, .5, 1.1), standMat); m.position.set(0, .25 + r * .55, GZ - 8 - r * 1.1); scene.add(m); }
  const CROWD = small ? 900 : 1700, crowd = new THREE.InstancedMesh(new THREE.CapsuleGeometry(.14, .26, 2, 6), new THREE.MeshStandardMaterial({ roughness: .8 }), CROWD);
  const seats = [], tmp = new THREE.Object3D(), col = new THREE.Color();
  const palette = [0x2a1a4a, 0x3b2370, 0x7c3aed, 0xeadcff, 0x18101f, 0xb47cff, 0x5b3a9e, 0xffffff];
  for (let i = 0; i < CROWD; i++) {
    const r = i % 10, x = -30 + Math.random() * 60, s = { x, y: .78 + r * .55, z: GZ - 8 - r * 1.1 + (Math.random() - .5) * .3, ph: Math.random() * 6.28, amp: .6 + Math.random() * .6 };
    seats.push(s); tmp.position.set(s.x, s.y, s.z); tmp.updateMatrix(); crowd.setMatrixAt(i, tmp.matrix);
    crowd.setColorAt(i, col.setHex(palette[(Math.random() * palette.length) | 0]).multiplyScalar(.3 + Math.random() * .4));
  }
  scene.add(crowd);
  const flashGeo = new THREE.BufferGeometry(), FL = 60, flashPos = new Float32Array(FL * 3), flashCol = new Float32Array(FL * 3), flashLife = new Float32Array(FL);
  flashGeo.setAttribute("position", new THREE.BufferAttribute(flashPos, 3)); flashGeo.setAttribute("color", new THREE.BufferAttribute(flashCol, 3));
  scene.add(new THREE.Points(flashGeo, new THREE.PointsMaterial({ size: .35, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })));
  const flash = () => { for (let i = 0; i < FL; i++) if (flashLife[i] <= 0) { const s = seats[(Math.random() * CROWD) | 0]; flashPos.set([s.x, s.y + .35, s.z + .15], i * 3); flashLife[i] = .18; return; } };

  const ledC = document.createElement("canvas"); ledC.width = 2048; ledC.height = 64; const led = ledC.getContext("2d");
  const ledTex = new THREE.CanvasTexture(ledC); ledTex.colorSpace = THREE.SRGBColorSpace;
  const ledMat = new THREE.MeshBasicMaterial({ map: ledTex, toneMapped: false }); ledMat.color.setScalar(1.6);
  const board = new THREE.Mesh(new THREE.PlaneGeometry(30, .94), ledMat); board.position.set(0, .47, GZ - 3.4); scene.add(board);
  const boardBack = new THREE.Mesh(new THREE.BoxGeometry(30.2, 1, .2), standMat); boardBack.position.set(0, .5, GZ - 3.52); scene.add(boardBack);
  let goalFlashT = -9;
  const drawLED = t => {
    const lit = t - goalFlashT < 2.6;
    led.fillStyle = "#07030d"; led.fillRect(0, 0, 2048, 64);
    led.font = "italic 900 44px Montserrat, Arial"; led.textBaseline = "middle";
    const msg = lit ? "GOAL!     GOAL!     GOAL!     " : "RYAN #7   ·   VINSCHOOL CENTRAL PARK   ·   LEFT WINGER   ·   ", w = led.measureText(msg).width;
    led.fillStyle = lit ? ((t * 8 | 0) % 2 ? "#ffffff" : "#b47cff") : "#a26bff";
    const off = (t * (lit ? 520 : 120)) % w;
    for (let x = -off; x < 2048; x += w) led.fillText(msg, x, 34);
    led.fillStyle = "rgba(0,0,0,.35)"; for (let x = 0; x < 2048; x += 4) led.fillRect(x, 0, 1, 64);
    ledTex.needsUpdate = true;
  };

  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }); lampMat.color.setScalar(6);
  const beamMat = new THREE.MeshBasicMaterial({ color: 0xb69cff, transparent: true, opacity: .022, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
  [[-17, GZ - 12], [17, GZ - 12], [-19, 8], [19, 8]].forEach(([x, z]) => {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(.18, .25, 18, 8), standMat); pole.position.set(x, 9, z); scene.add(pole);
    const head = new THREE.Group(); head.position.set(x, 18.4, z); head.lookAt(0, 0, GZ / 2); scene.add(head);
    for (let i = 0; i < 6; i++) { const l = new THREE.Mesh(new THREE.CircleGeometry(.32, 16), lampMat); l.position.set((i % 3 - 1) * .8, (i < 3 ? .45 : -.45), .1); head.add(l); }
    const len = Math.hypot(x, 18.4, z - GZ / 2), cone = new THREE.Mesh(new THREE.ConeGeometry(4.2, len, 24, 1, true), beamMat);
    cone.position.set(0, 0, len / 2); cone.rotation.x = -Math.PI / 2; head.add(cone);
  });
  const haze = new THREE.Mesh(new THREE.PlaneGeometry(120, 40), new THREE.MeshBasicMaterial({ map: (() => { const c = document.createElement("canvas"); c.width = c.height = 256; const g = c.getContext("2d"), gr = g.createRadialGradient(128, 200, 10, 128, 200, 200); gr.addColorStop(0, "rgba(124,58,237,.3)"); gr.addColorStop(1, "rgba(8,4,16,0)"); g.fillStyle = gr; g.fillRect(0, 0, 256, 256); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })(), transparent: true, depthWrite: false, fog: false }));
  haze.position.set(0, 10, GZ - 26); scene.add(haze);

  /* ---------- effects: aim reticle, trajectory preview, trail, confetti, turf spray ---------- */
  const glow = c => { const m = new THREE.MeshBasicMaterial({ color: c, transparent: true, toneMapped: false, depthWrite: false }); m.color.multiplyScalar(2.2); return m; };
  const ret = new THREE.Group(); ret.add(new THREE.Mesh(new THREE.RingGeometry(.2, .25, 48), glow(HI)));
  [[.42, 0], [-.42, 0], [0, .42], [0, -.42]].forEach(([x, y]) => { const b = new THREE.Mesh(new THREE.PlaneGeometry(x ? .22 : .035, y ? .22 : .035), glow(HI)); b.position.set(x, y, 0); ret.add(b); });
  ret.visible = false; scene.add(ret);
  const DOTS = 26, dotPos = new Float32Array(DOTS * 3), dotGeo = new THREE.BufferGeometry(); dotGeo.setAttribute("position", new THREE.BufferAttribute(dotPos, 3));
  const dotMat = new THREE.PointsMaterial({ color: HI, size: .07, transparent: true, opacity: .85, toneMapped: false, depthWrite: false }); dotMat.color.multiplyScalar(1.6);
  const dots = new THREE.Points(dotGeo, dotMat); dots.visible = false; scene.add(dots);
  const TR = 30, trPos = new Float32Array(TR * 3), trCol = new Float32Array(TR * 3), trGeo = new THREE.BufferGeometry();
  trGeo.setAttribute("position", new THREE.BufferAttribute(trPos, 3)); trGeo.setAttribute("color", new THREE.BufferAttribute(trCol, 3));
  const trail = new THREE.Points(trGeo, new THREE.PointsMaterial({ size: .3, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })); scene.add(trail);
  const trailHist = [];
  const CF = 420, conf = new THREE.InstancedMesh(new THREE.PlaneGeometry(.07, .035), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, toneMapped: false }), CF);
  const cf = []; const cfCols = [0x7c3aed, 0xb47cff, 0xffffff, 0xeadcff, 0x9b5cff];
  for (let i = 0; i < CF; i++) { cf.push({ p: new THREE.Vector3(0, -9, 0), v: new THREE.Vector3(), r: new THREE.Euler(), w: new THREE.Vector3(), life: 0 }); conf.setColorAt(i, col.setHex(cfCols[i % 5]).multiplyScalar(1.4)); }
  conf.frustumCulled = false; conf.userData.dirty = true; scene.add(conf);
  const SP = 80, spPos = new Float32Array(SP * 3), spVel = new Float32Array(SP * 3), spGeo = new THREE.BufferGeometry(); let spLife = 0;
  spGeo.setAttribute("position", new THREE.BufferAttribute(spPos, 3));
  const spray = new THREE.Points(spGeo, new THREE.PointsMaterial({ color: 0x7fd49a, size: .05, transparent: true, opacity: .9 })); spray.visible = false; scene.add(spray);

  /* ---------- game state ---------- */
  let type = "finesse", shot = null, goals = 0, shots = 0, timeScale = 1, aim = null, demoDone = false, visible = false, running = false;
  let simT = 0, realT = 0, shake = 0, camMode = "home", camT = 0, impact = new THREE.Vector3(0, 1, GZ - ND), replaySide = 1, crowdJump = -9;
  const camPos = new THREE.Vector3(), camLook = new THREE.Vector3(), wantPos = new THREE.Vector3(), wantLook = new THREE.Vector3();
  let homePos = new THREE.Vector3(0, 1.3, 4.4), homeLook = new THREE.Vector3(0, .95, GZ), baseFov = 42;
  const mouse = { x: 0, y: 0 };

  const path = (tp, tx, ty, t, out = new THREE.Vector3()) => {
    const k = TYPES[tp], side = Math.abs(tx) < .15 ? 1 : Math.sign(tx);
    return out.set(tx * t + k.curve * side * Math.sin(Math.PI * t) * (1 - .3 * t), BR + (ty - BR) * t + k.arc * Math.sin(Math.PI * t), GZ * (t * (1.12 - .12 * t)));
  };
  const setCall = (text, miss) => { call.textContent = text; call.className = "pitch-call"; void call.offsetWidth; call.className = "pitch-call show" + (miss ? " miss" : ""); };
  const count = () => { document.getElementById("goalCount").textContent = goals; document.getElementById("shotCount").textContent = shots; };

  const shoot = (tx, ty, demo) => {
    if (shot) return;
    if (!demo) { shots++; box.classList.add("played"); }
    const inGoal = Math.abs(tx) < GW / 2 - BR * .6 && ty < GH - BR * .6;
    const post = !inGoal && ((Math.abs(Math.abs(tx) - GW / 2) < .22 && ty < GH + .15) || (Math.abs(ty - GH) < .22 && Math.abs(tx) < GW / 2 + .15));
    const corner = Math.abs(tx) > 1.65 && ty > 1.4;
    const readIt = Math.random() < (type === "power" ? .2 : type === "chip" ? .12 : .28);
    const save = !demo && inGoal && readIt && !corner && !(type === "chip" && Math.abs(tx) < 1.1);
    const outcome = save ? "save" : inGoal ? "goal" : post ? "post" : "miss";
    const wrong = Math.abs(tx) > .35 ? -Math.sign(tx) : (Math.random() < .5 ? -1 : 1);
    const dive = save ? reachPose(tx, ty) : reachPose(wrong * (1.5 + Math.random() * .6), .7 + Math.random() * .7);
    Object.assign(kState, { from: { fx: kState.fx }, to: dive, side: dive.side, t0: simT + (type === "power" ? .08 : .17), d: 0 });
    shot = { type, tx, ty, outcome, demo, t0: simT, T: TYPES[type].T, phase: "fly", end: 0, slow: false };
    spin.set(...TYPES[type].spin); if (type !== "power" && type !== "chip") spin.y *= Math.sign(tx || 1);
    trailHist.length = 0; ret.visible = dots.visible = false; camMode = "follow";
    // turf spray from the strike
    spLife = .9; spray.visible = true;
    for (let i = 0; i < SP; i++) { spPos.set([(Math.random() - .5) * .2, .02, .1 + Math.random() * .1], i * 3); spVel.set([(Math.random() - .5) * 2.4, 1 + Math.random() * 2.6, Math.random() * 1.6 - .4], i * 3); }
    if (type === "power" && !still) shake = .06;
    loop();
  };

  const celebrate = s => {
    if (s.outcome === "goal") {
      if (!s.demo) goals++;
      setCall("Goal!"); goalFlashT = realT; crowdJump = realT;
      impact.copy(ball.position); replaySide = ball.position.x > 0 ? -1 : 1;
      if (!still) { shake = .12; camMode = "replay"; camT = realT; }
      for (let i = 0; i < CF; i++) { const c = cf[i]; c.p.set((Math.random() - .5) * 9, 3.5 + Math.random() * 3, GZ + (Math.random() - .3) * 6); c.v.set((Math.random() - .5) * 3, Math.random() * 2, (Math.random() - .5) * 3); c.w.set(Math.random() * 12, Math.random() * 12, Math.random() * 12); c.life = still ? 0 : 4 + Math.random() * 2; }
      for (let i = 0; i < 30; i++) setTimeout(flash, Math.random() * 1500);
    } else if (s.outcome === "save") { setCall("Saved!", true); shake = still ? 0 : .04; }
    else if (s.outcome === "post") { setCall("Off the post!", true); shake = still ? 0 : .07; postMat.emissiveIntensity = 3; }
    else setCall(s.ty > GH ? "Over the bar!" : "Wide!", true);
    count();
  };

  /* ---------- simulation ---------- */
  const tv = new THREE.Vector3(), tv2 = new THREE.Vector3();
  const clothStep = dt => {
    const g = -2.2 * dt * dt, bx = ball.position.x, by = ball.position.y, bz = ball.position.z, rr = BR + .04;
    let hits = 0;
    for (let i = 0; i < N; i++) {
      if (pin[i]) continue;
      const k = i * 3;
      for (let a = 0; a < 3; a++) { const p = pos[k + a], vel = (p - prev[k + a]) * .965; prev[k + a] = p; pos[k + a] = p + vel + (a === 1 ? g : 0); }
      // gentle pull back to the rest shape keeps the net from drifting
      for (let a = 0; a < 3; a++) pos[k + a] += (rest[k + a] - pos[k + a]) * .012;
      const dx = pos[k] - bx, dy = pos[k + 1] - by, dz = pos[k + 2] - bz, d = Math.hypot(dx, dy, dz);
      if (d < rr && d > 1e-5) { const f = rr / d; pos[k] = bx + dx * f; pos[k + 1] = by + dy * f; pos[k + 2] = bz + dz * f; hits++; }
    }
    for (let it = 0; it < 4; it++) for (let c = 0; c < cons.length; c += 3) {
      const a = cons[c] * 3, b = cons[c + 1] * 3, L = cons[c + 2];
      const dx = pos[b] - pos[a], dy = pos[b + 1] - pos[a + 1], dz = pos[b + 2] - pos[a + 2], d = Math.hypot(dx, dy, dz) || 1e-6;
      if (d <= L) continue; // a net only resists stretching
      const diff = (d - L) / d * .5, pa = pin[cons[c]], pb = pin[cons[c + 1]];
      const wa = pa ? 0 : (pb ? 1 : .5), wb = pb ? 0 : (pa ? 1 : .5);
      pos[a] += dx * diff * 2 * wa; pos[a + 1] += dy * diff * 2 * wa; pos[a + 2] += dz * diff * 2 * wa;
      pos[b] -= dx * diff * 2 * wb; pos[b + 1] -= dy * diff * 2 * wb; pos[b + 2] -= dz * diff * 2 * wb;
    }
    return hits;
  };

  const step = dt => {
    simT += dt;
    // keeper
    if (shot && kState.to) {
      if (simT > kState.t0) kState.d = Math.min(1, (simT - kState.t0) / .42);
      const e = ease(kState.d), t = kState.to, el = simT - shot.t0;
      kState.fx = kState.from.fx + (t.fx - kState.from.fx) * e; kState.th = t.th * e; kState.side = t.side;
      kState.h = t.h * Math.sin(kState.d * Math.PI * .5) * (el > shot.T + .35 ? Math.max(0, 1 - (el - shot.T - .35) * 3) : 1);
    } else {
      kState.fx += (Math.sin(simT * 1.7) * .3 - kState.fx) * Math.min(1, dt * 3);
      kState.th += -kState.th * Math.min(1, dt * 6); kState.h += -kState.h * Math.min(1, dt * 6);
    }
    keeper.position.set(kState.fx, kState.h, KZ); keeper.rotation.z = -kState.side * kState.th;
    const up = clamp(kState.th / .5, 0, 1), bob = shot ? 0 : Math.sin(simT * 6) * .02;
    kBody.position.y = bob - (shot ? 0 : .04);
    armR.rotation.z = .85 + (Math.PI - .2 - .85) * up; armL.rotation.z = -(.85 + (Math.PI - .2 - .85) * up);

    // ball
    ball.rotation.x += spin.x * dt; ball.rotation.y += spin.y * dt; ball.rotation.z += spin.z * dt;
    const s = shot;
    if (s) {
      const el = simT - s.t0, t = el / s.T;
      if (s.phase === "fly") {
        if (s.outcome !== "miss" && t > .74 && !s.slow && !still) { s.slow = true; timeScale = .26; }
        if (s.outcome === "save" && t >= .95) {
          path(s.type, s.tx, s.ty, .95, ball.position);
          ballVel.set(Math.sign(s.tx || 1) * (2.5 + Math.random() * 2), 3.5, 3.2); spin.multiplyScalar(-.5); s.phase = "loose"; celebrate(s);
        } else if (t >= 1) {
          path(s.type, s.tx, s.ty, 1, ball.position); path(s.type, s.tx, s.ty, .97, tv);
          ballVel.subVectors(ball.position, tv).divideScalar(s.T * .03);
          if (s.outcome === "goal") s.phase = "net";
          else if (s.outcome === "post") { ballVel.set(-Math.sign(s.tx || 1) * 2 + ballVel.x * .2, Math.abs(ballVel.y) * .3 + 1.5, Math.abs(ballVel.z) * .42); s.phase = "loose"; celebrate(s); }
          else { s.phase = "away"; celebrate(s); }
        } else path(s.type, s.tx, s.ty, t, ball.position);
      } else {
        ballVel.y -= 9.8 * dt; ball.position.addScaledVector(ballVel, dt);
        if (s.phase === "net") {
          if (!s.hitNet && ball.position.z < GZ - .25) { s.hitNet = true; celebrate(s); }
          ball.position.x = clamp(ball.position.x, -GW / 2 + BR, GW / 2 - BR);
          if (ball.position.z < GZ - ND - .75) { ball.position.z = GZ - ND - .75; ballVel.z = Math.max(0, ballVel.z); }
        }
        if (ball.position.y < BR) { ball.position.y = BR; ballVel.y = Math.abs(ballVel.y) > .6 ? -ballVel.y * .45 : 0; ballVel.x *= .86; ballVel.z *= .86; spin.multiplyScalar(.9); }
      }
      if (!s.end && s.phase !== "fly" && (s.phase !== "net" || s.hitNet)) s.end = simT;
      if (s.end && simT - s.end > .5 && timeScale < 1) timeScale = Math.min(1, timeScale + dt * 4);
      if (s.end && simT - s.end > (s.outcome === "goal" ? 2.6 : 1.5)) {
        shot = null; timeScale = 1; kState.to = null; camMode = "home"; spin.set(0, 0, 0);
        ball.position.set(0, 1.4, 0); ballVel.set(0, 0, 0); s.reset = true; dropping = true;
      }
    } else if (dropping) {
      ballVel.y -= 9.8 * dt; ball.position.y += ballVel.y * dt;
      if (ball.position.y < BR) { ball.position.y = BR; ballVel.y = Math.abs(ballVel.y) > .8 ? -ballVel.y * .4 : 0; if (!ballVel.y) dropping = false; }
    }
    // net
    const sub = Math.max(1, Math.ceil(dt / (1 / 120))), h = dt / sub;
    for (let i = 0; i < sub; i++) {
      const hits = clothStep(h);
      if (hits && s && s.phase === "net") { const k = Math.exp(-Math.min(11, 2.2 * hits) * h); ballVel.x *= k; ballVel.z *= k; if (ballVel.y > 0) ballVel.y *= k; }
    }
    netGeo.attributes.position.needsUpdate = true;
  };
  let dropping = false;

  /* ---------- camera ---------- */
  const fitHome = () => {
    const a = camera.aspect;
    baseFov = a < .9 ? 47 : a < 1.3 ? 46 : 42;
    homePos.set(0, a < .9 ? 1.2 : 1.3, a < .9 ? 4.6 : 4.4); homeLook.set(0, a < .9 ? 1.15 : .95, GZ);
  };
  const updateCamera = rdt => {
    const s = shot;
    if (camMode === "follow" && s) {
      const p = ball.position, z = Math.max(p.z + 2.6, GZ + 3.2);
      wantPos.set(p.x * .55, Math.max(1.05, p.y * .6 + .85), z); wantLook.set(p.x * .8, Math.max(.6, p.y * .9), Math.min(p.z - 2, GZ));
    } else if (camMode === "replay") {
      const a = (realT - camT) * .35, r = 3.6;
      wantPos.set(impact.x + replaySide * r * Math.cos(.9 - a * .5), 1.25 + a * .15, GZ + 1.3 + r * Math.sin(.9 - a * .5) * .55); wantLook.copy(impact).setY(Math.max(.5, impact.y * .8)).setZ(GZ - ND * .5);
    } else {
      wantPos.copy(homePos).add(tv2.set(mouse.x * .35, mouse.y * .15, 0)); wantLook.copy(homeLook);
    }
    const k = 1 - Math.exp(-rdt * (camMode === "follow" ? 5 : camMode === "replay" ? 2.6 : 3));
    camPos.lerp(wantPos, k); camLook.lerp(wantLook, k);
    camera.position.copy(camPos);
    if (shake > .002) { camera.position.x += (Math.random() - .5) * shake; camera.position.y += (Math.random() - .5) * shake; shake *= Math.exp(-rdt * 6); }
    camera.lookAt(camLook);
    const wantFov = baseFov - (s && s.type === "power" && s.phase === "fly" ? 6 : 0) - (timeScale < .5 ? 5 : 0);
    if (Math.abs(camera.fov - wantFov) > .01) { camera.fov += (wantFov - camera.fov) * Math.min(1, rdt * 5); camera.updateProjectionMatrix(); }
  };

  /* ---------- effects update ---------- */
  const updateFx = (dt, rdt) => {
    // trail
    if (shot && (shot.phase === "fly" || shot.phase === "net")) { trailHist.unshift(ball.position.clone()); if (trailHist.length > TR) trailHist.pop(); } else if (trailHist.length) trailHist.pop();
    const hot = shot && shot.type === "power";
    for (let i = 0; i < TR; i++) {
      const p = trailHist[i]; if (!p) { trPos.set([0, -50, 0], i * 3); continue; }
      trPos.set([p.x, p.y, p.z], i * 3); const f = (1 - i / TR) * (hot ? 1.1 : .7);
      trCol.set(hot ? [f, f * .75, f * 1.3] : [f * .7, f * .45, f * 1.2], i * 3);
    }
    trGeo.attributes.position.needsUpdate = trGeo.attributes.color.needsUpdate = true;
    // turf spray
    if (spLife > 0) {
      spLife -= dt; for (let i = 0; i < SP; i++) { spVel[i * 3 + 1] -= 9.8 * dt; for (let a = 0; a < 3; a++) spPos[i * 3 + a] += spVel[i * 3 + a] * dt; if (spPos[i * 3 + 1] < 0) spPos[i * 3 + 1] = 0; }
      spGeo.attributes.position.needsUpdate = true; spray.material.opacity = Math.max(0, spLife); if (spLife <= 0) spray.visible = false;
    }
    // confetti
    let any = false;
    for (let i = 0; i < CF; i++) {
      const c = cf[i];
      if (c.life > 0) { any = true; c.life -= rdt; c.v.y -= 2.2 * rdt; c.v.multiplyScalar(1 - .9 * rdt); c.v.x += Math.sin(realT * 3 + i) * .6 * rdt; c.p.addScaledVector(c.v, rdt); c.r.x += c.w.x * rdt; c.r.y += c.w.y * rdt; c.r.z += c.w.z * rdt; }
      else c.p.y = -20;
      tmp.position.copy(c.p); tmp.rotation.copy(c.r); tmp.scale.setScalar(1); tmp.updateMatrix(); conf.setMatrixAt(i, tmp.matrix);
    }
    if (any || conf.userData.dirty) { conf.instanceMatrix.needsUpdate = true; conf.userData.dirty = any; }
    // crowd bounce after a goal
    const cj = realT - crowdJump;
    if (cj < 3.2) {
      const fade = 1 - cj / 3.2;
      for (let i = 0; i < CROWD; i++) { const s = seats[i]; tmp.position.set(s.x, s.y + Math.max(0, Math.sin(realT * 11 + s.ph)) * .28 * s.amp * fade, s.z); tmp.rotation.set(0, 0, 0); tmp.updateMatrix(); crowd.setMatrixAt(i, tmp.matrix); }
      crowd.instanceMatrix.needsUpdate = true;
    }
    // camera flashes
    if (Math.random() < .06) flash();
    for (let i = 0; i < FL; i++) { if (flashLife[i] > 0) flashLife[i] -= rdt; const v = Math.max(0, flashLife[i] / .18) * 3; flashCol.set([v, v, v], i * 3); }
    flashGeo.attributes.position.needsUpdate = flashGeo.attributes.color.needsUpdate = true;
    // lights pulse
    const pulse = Math.max(0, 1 - (realT - goalFlashT) / 2.5);
    rimL.intensity = rimR.intensity = 10 + pulse * 40 * (.6 + .4 * Math.sin(realT * 20));
    bloom.strength = .6 + pulse * .5;
    postMat.emissiveIntensity += (.35 - postMat.emissiveIntensity) * Math.min(1, rdt * 3);
    drawLED(realT);
    // aim helpers
    const showAim = aim && !shot && camMode === "home";
    ret.visible = dots.visible = !!showAim;
    if (showAim) {
      ret.position.set(aim.x, aim.y, GZ + .02); ret.lookAt(camera.position); ret.scale.setScalar(1 + Math.sin(realT * 6) * .05);
      for (let i = 0; i < DOTS; i++) { path(type, aim.x, aim.y, (i + 1) / DOTS, tv); dotPos.set([tv.x, tv.y, tv.z], i * 3); }
      dotGeo.attributes.position.needsUpdate = true;
    }
  };

  /* ---------- loop ---------- */
  let last = 0;
  const frame = t => {
    const rdt = Math.min(.05, (t - (last || t)) / 1000); last = t; realT = t / 1000;
    step(rdt * timeScale); updateCamera(rdt); updateFx(rdt * timeScale, rdt);
    composer.render();
  };
  function loop() {
    if (running) return; running = true;
    const tick = t => { frame(t); if (visible || shot || dropping) requestAnimationFrame(tick); else { running = false; last = 0; } };
    requestAnimationFrame(tick);
  }

  const resize = () => {
    const r = box.getBoundingClientRect(); if (!r.width || !r.height) return;
    renderer.setSize(r.width, r.height, false); composer.setSize(r.width, r.height);
    bloom.resolution.set(r.width / 2, r.height / 2);
    camera.aspect = r.width / r.height; fitHome(); camera.fov = baseFov; camera.updateProjectionMatrix();
    if (!shot) { camPos.copy(homePos); camLook.copy(homeLook); }
    if (!running) frame(performance.now());
  };

  /* ---------- input ---------- */
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -GZ), hit = new THREE.Vector3();
  const toAim = e => {
    const r = box.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    camera.position.copy(camPos); camera.lookAt(camLook); camera.updateMatrixWorld();
    ray.setFromCamera(ndc, camera);
    if (!ray.ray.intersectPlane(plane, hit)) return null;
    return { x: clamp(hit.x, -6.5, 6.5), y: clamp(hit.y, .12, 4.2) };
  };
  box.addEventListener("pointermove", e => {
    const r = box.getBoundingClientRect(); mouse.x = ((e.clientX - r.left) / r.width - .5) * 2; mouse.y = -((e.clientY - r.top) / r.height - .5) * 2;
    if (e.pointerType === "mouse") { aim = toAim(e); if (!running) loop(); }
  });
  box.addEventListener("pointerleave", () => { aim = null; mouse.x = mouse.y = 0; });
  box.addEventListener("pointerdown", e => { if (shot || dropping) return; const a = toAim(e); if (!a) return; if (e.pointerType !== "mouse") aim = null; demoDone = true; shoot(a.x, a.y); });
  box.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); demoDone = true; shoot((Math.random() - .5) * 4.4, .3 + Math.random() * 1.7); } });
  document.querySelectorAll(".shot-type").forEach(b => b.addEventListener("click", () => {
    type = b.dataset.type; document.querySelectorAll(".shot-type").forEach(o => o.setAttribute("aria-pressed", o === b));
  }));
  new ResizeObserver(resize).observe(box);
  new IntersectionObserver(([en]) => {
    visible = en.isIntersecting; if (visible) loop();
    if (visible && !demoDone) { demoDone = true; setTimeout(() => { if (!shot && !shots) shoot(1.85, 1.65, true); }, 1100); }
  }, { threshold: .35 }).observe(box);

  resize();
  box.classList.add("is-3d");
  return true;
}
