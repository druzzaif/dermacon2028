import * as THREE2 from "three";
import { createKit } from "./kit.js";
import { buildSite } from "./site.js";
import { buildHalls } from "./halls.js";
import { createTraffic } from "./traffic.js";
import { createNav } from "./nav.js";
import { createUI } from "./ui.js";
import { SITE, GEO0, ROOMS, GATES, BUILDINGS, CARPETS, DOME, ADMIN, findRoom } from "./data.js";

var EYE = 1.65;
var lerpAngle = (a, b, t) => {
  let d = b - a;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return a + d * t;
};
var clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function createVenue(container, options = {}) {
  const opt = Object.assign({
    start: "gate-g9",
    destination: null,
    ui: true,
    quality: "auto",
    mode: "overview",
    font: '"Barlow", "Segoe UI", system-ui, sans-serif',
    title: ["DERMACON", "2027"],
    subtitle: "",
    onSelect: null,
    onArrive: null,
    onReady: null,
    onModeChange: null
  }, options);
  const coarse = typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;
  const low = opt.quality === "low" || opt.quality === "auto" && (coarse || Math.min(innerWidth, innerHeight) < 600);
  const root = document.createElement("div");
  root.className = "dv3";
  container.appendChild(root);
  const canvas = document.createElement("canvas");
  canvas.className = "dv3-gl";
  canvas.tabIndex = 0;
  canvas.setAttribute("aria-label", "3D map of the DERMACON 2027 venue");
  root.appendChild(canvas);
  let renderer;
  try {
    renderer = new THREE2.WebGLRenderer({ canvas, antialias: !low, powerPreference: "high-performance" });
  } catch (e) {
    root.innerHTML = '<div class="dv3-load" style="padding:24px;text-align:center">This device could not start 3D graphics (WebGL). Open the venue map in a current version of Chrome, Edge, Safari or Firefox.</div>';
    createUI(root, { rooms: [], starts: [], title: opt.title, subtitle: opt.subtitle, showPanel: false }, {});
    return { dispose() {
      root.remove();
    }, failed: true };
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, low ? 1.5 : 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE2.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.toneMapping = THREE2.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.92;
  const scene = new THREE2.Scene();
  scene.fog = new THREE2.Fog(14083826, 600, 3200);
  const camera = new THREE2.PerspectiveCamera(50, 1, 0.3, 7e3);
  camera.rotation.order = "YXZ";
  const sunDir = new THREE2.Vector3(-0.38, 0.8, 0.46).normalize();
  const skyMat = new THREE2.ShaderMaterial({
    side: THREE2.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: { top: { value: new THREE2.Color("#2f78d0") }, hor: { value: new THREE2.Color("#d9e9f5") }, sun: { value: sunDir } },
    vertexShader: "varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: "varying vec3 vP; uniform vec3 top; uniform vec3 hor; uniform vec3 sun; void main(){ vec3 d = normalize(vP); float h = clamp(d.y, 0.0, 1.0); vec3 c = mix(hor, top, pow(h, 0.5)); float s = max(dot(d, normalize(sun)), 0.0); c += vec3(1.0, 0.92, 0.75) * pow(s, 600.0) * 2.0 + vec3(1.0, 0.95, 0.85) * pow(s, 10.0) * 0.15; if (d.y < 0.0) c = mix(hor, vec3(0.55, 0.6, 0.55), clamp(-d.y * 5.0, 0.0, 1.0)); gl_FragColor = linearToOutputTexel(vec4(c, 1.0)); }"
  });
  const sky = new THREE2.Mesh(new THREE2.SphereGeometry(5e3, 32, 16), skyMat);
  scene.add(sky);
  const pmrem = new THREE2.PMREMGenerator(renderer);
  const envScene = new THREE2.Scene();
  envScene.add(new THREE2.Mesh(sky.geometry, skyMat));
  const envRT = pmrem.fromScene(envScene, 0.04);
  scene.environment = envRT.texture;
  pmrem.dispose();
  const hemi = new THREE2.HemisphereLight(14478335, 9406070, 1.15);
  scene.add(hemi);
  const sun = new THREE2.DirectionalLight(16773340, 2.9);
  sun.position.copy(sunDir).multiplyScalar(700);
  sun.target.position.set(0, 0, 0);
  scene.add(sun, sun.target);
  sun.castShadow = true;
  const sc = sun.shadow.camera;
  sc.left = -350;
  sc.right = 350;
  sc.top = 290;
  sc.bottom = -290;
  sc.near = 150;
  sc.far = 1400;
  sun.shadow.mapSize.set(low ? 2048 : 4096, low ? 2048 : 4096);
  sun.shadow.bias = -6e-4;
  sun.shadow.normalBias = 0.35;
  const kit = createKit({ font: opt.font, lowQuality: low, maxAniso: Math.min(8, renderer.capabilities.getMaxAnisotropy()) });
  const roofBatch = new kit.Batch();
  const roofGroup = new THREE2.Group();
  roofGroup.name = "roofs";
  buildSite(kit);
  buildHalls(kit, roofBatch);
  const world = new THREE2.Group();
  scene.add(world, roofGroup);
  kit.batch.build(world, { name: "static" });
  roofBatch.build(roofGroup, { cast: false, name: "roof" });
  kit.signs.forEach((s) => (s.userData.roofOnly ? roofGroup : world).add(s));
  const chairGeo = {};
  const m4 = new THREE2.Matrix4();
  let chairCount = 0;
  kit.chairs.forEach((c) => {
    const geo = chairGeo[c.color] || (chairGeo[c.color] = kit.chairGeometry(c.color)), n = c.list.length / 4, im = new THREE2.InstancedMesh(geo, kit.M.matte, n);
    for (let i = 0; i < n; i++) {
      m4.makeRotationY(c.list[i * 4 + 2]).setPosition(c.list[i * 4], c.list[i * 4 + 3], c.list[i * 4 + 1]);
      im.setMatrixAt(i, m4);
    }
    im.instanceMatrix.needsUpdate = true;
    im.computeBoundingSphere();
    im.receiveShadow = true;
    im.name = "chairs:" + c.name;
    world.add(im);
    chairCount += n;
  });
  const looks = [
    ["#2f5d8a", "#8d5524", "#1d1b1a"],
    ["#b5523b", "#c68a62", "#3b2a1e"],
    ["#3d6b4f", "#e0ac86", "#6b4f2a"],
    ["#7a4b8e", "#5c3b28", "#1d1b1a"],
    ["#d9a441", "#e0ac86", "#222"],
    ["#2b2f38", "#c68a62", "#3b2a1e"]
  ];
  const SILENT = /* @__PURE__ */ new Set(["h1", "h10", "h9", "h8"]);
  const PEOPLE_HP = looks.map(([shirt, skin, hair]) => kit.personGeometry(shirt, { skin, hair, headphones: true }));
  const PEOPLE_PLAIN = looks.map(([shirt, skin, hair]) => kit.personGeometry(shirt, { skin, hair, headphones: false }));
  const bHP = PEOPLE_HP.map(() => []), bPLAIN = PEOPLE_PLAIN.map(() => []);
  const plainRects = ["hall-a", "iadvl-hall"].map((id) => kit.rooms[id] && kit.rooms[id].rect).filter(Boolean);
  const inR = (r, x, z) => x >= r[0] && x <= r[2] && z >= r[1] && z <= r[3];
  kit.chairs.forEach((c, bi) => {
    const n = c.list.length / 4;
    for (let i = 0; i < n; i++) {
      const x = c.list[i * 4], z = c.list[i * 4 + 1];
      const silent = SILENT.has(c.name) && !plainRects.some((r) => inR(r, x, z));
      const pct = silent ? low ? 30 : 55 : low ? 15 : 35;
      const u = (Math.imul(i + 1, 2654435761) ^ Math.imul(bi + 7, 40503)) >>> 0;
      if (u % 100 >= pct) continue;
      const v = (u >>> 9) % looks.length, target = silent ? bHP[v] : bPLAIN[v];
      target.push(c.list[i * 4], c.list[i * 4 + 3], z, c.list[i * 4 + 2]);
    }
  });
  [[PEOPLE_HP, bHP, "hp"], [PEOPLE_PLAIN, bPLAIN, "plain"]].forEach(([geos, buckets, tag]) => geos.forEach((geo, k) => {
    const arr = buckets[k], cnt = arr.length / 4;
    if (!cnt) return;
    const im = new THREE2.InstancedMesh(geo, kit.M.matte, cnt);
    for (let i = 0; i < cnt; i++) {
      m4.makeRotationY(arr[i * 4 + 3]).setPosition(arr[i * 4], arr[i * 4 + 1], arr[i * 4 + 2]);
      im.setMatrixAt(i, m4);
    }
    im.instanceMatrix.needsUpdate = true;
    im.computeBoundingSphere();
    im.receiveShadow = true;
    im.castShadow = true;
    im.name = `people:${tag}:${k}`;
    world.add(im);
    chairCount += cnt;
  }));
  const traffic = createTraffic(kit, world, { low });
  const bById = Object.fromEntries(BUILDINGS.map((b) => [b.id, b]));
  const bName = (id) => id === "h3" ? "Dome" : id === "admin" ? "Office block near Gate G9" : bById[id] ? bById[id].title : "";
  const rooms = ROOMS.filter((r) => kit.rooms[r.id]).map((r) => Object.assign({}, r, kit.rooms[r.id]));
  const roomById = Object.fromEntries(rooms.map((r) => [r.id, r]));
  const inward = { S: [0, -5], N: [0, 5], E: [-5, 0], W: [5, 0] };
  const starts = [
    ...GATES.filter((g) => g.kind === "main").map((g) => ({ id: g.id, name: `${g.name} \xB7 Main entry`, at: [g.at[0] + inward[g.face][0], g.at[1] + inward[g.face][1]] })),
    { id: "registration", name: "Registration", at: roomById.registration.arrive },
    { id: "faculty-lounge", name: "Faculty Lounge", at: roomById["faculty-lounge"].arrive },
    { id: "dining", name: "Dining Area", at: roomById.dining.arrive },
    ...GATES.filter((g) => g.kind !== "main").map((g) => ({ id: g.id, name: g.name, at: [g.at[0] + inward[g.face][0], g.at[1] + inward[g.face][1]] })),
    { id: "here", name: "Where I am standing", at: null }
  ];
  const nav = createNav({ bounds: SITE, colliders: kit.colliders, navBlocks: kit.navBlocks, costRects: kit.costRects, zones: kit.zones });
  const describe = (zn) => {
    if (!zn) return { label: "the paved road", verb: "along" };
    if (zn.room) return { label: roomById[zn.room] ? roomById[zn.room].name : zn.room, verb: "into" };
    if (zn.carpet) return { label: "the red carpet", verb: "along" };
    if (zn.building) {
      const b = bById[zn.building];
      return { label: b ? b.main.length ? b.title : "an unused hall" : zn.name, verb: "inside" };
    }
    return { label: zn.name, verb: "across" };
  };
  const CH = 8, chash = /* @__PURE__ */ new Map();
  kit.colliders.forEach((r) => {
    for (let i = Math.floor(r[0] / CH); i <= Math.floor(r[2] / CH); i++) for (let j = Math.floor(r[1] / CH); j <= Math.floor(r[3] / CH); j++) {
      const k = i + "," + j;
      (chash.get(k) || chash.set(k, []).get(k)).push(r);
    }
  });
  function collide(p, rad = 0.38) {
    for (let it = 0; it < 3; it++) {
      const gi = Math.floor(p.x / CH), gj = Math.floor(p.z / CH);
      for (let i = gi - 1; i <= gi + 1; i++) for (let j = gj - 1; j <= gj + 1; j++) {
        const list = chash.get(i + "," + j);
        if (!list) continue;
        for (const r of list) {
          const cx = clamp(p.x, r[0], r[2]), cz = clamp(p.z, r[1], r[3]);
          let dx = p.x - cx, dz = p.z - cz;
          const d2 = dx * dx + dz * dz;
          if (d2 >= rad * rad) continue;
          if (d2 > 1e-8) {
            const d = Math.sqrt(d2);
            p.x = cx + dx / d * rad;
            p.z = cz + dz / d * rad;
          } else {
            const l = p.x - r[0], rr = r[2] - p.x, t = p.z - r[1], b = r[3] - p.z, m = Math.min(l, rr, t, b);
            if (m === l) p.x = r[0] - rad;
            else if (m === rr) p.x = r[2] + rad;
            else if (m === t) p.z = r[1] - rad;
            else p.z = r[3] + rad;
          }
        }
      }
    }
    p.x = clamp(p.x, SITE.minX - 40, SITE.maxX + 40);
    p.z = clamp(p.z, SITE.minZ - 40, SITE.maxZ + 40);
  }
  const S = { mode: "overview", reveal: false, sweep: null, roofs: "off", dest: null, startId: opt.start, route: null, steps: [], tour: null, fly: null, arrived: false, disposed: false };
  const orbit = { target: new THREE2.Vector3(10, 0, 5), dist: 560, az: -0.5, pol: 0.92 }, og = { target: orbit.target.clone(), dist: orbit.dist, az: orbit.az, pol: orbit.pol };
  const walk = { pos: new THREE2.Vector3(146.8, EYE, 148), yaw: 0, pitch: -0.04 };
  const keys = /* @__PURE__ */ new Set();
  const chev = (() => {
    const c = document.createElement("canvas");
    c.width = 128;
    c.height = 64;
    const g = c.getContext("2d");
    g.fillStyle = "#19b5ff";
    g.fillRect(0, 0, 128, 64);
    g.strokeStyle = "#fff";
    g.lineWidth = 9;
    g.lineJoin = "miter";
    [18, 82].forEach((x) => {
      g.beginPath();
      g.moveTo(x, 12);
      g.lineTo(x + 26, 32);
      g.lineTo(x, 52);
      g.stroke();
    });
    const t = new THREE2.CanvasTexture(c);
    t.wrapS = THREE2.RepeatWrapping;
    t.colorSpace = THREE2.SRGBColorSpace;
    return t;
  })();
  const routeMat = new THREE2.MeshBasicMaterial({ map: chev, transparent: true, opacity: 0.95, depthTest: false, depthWrite: false, toneMapped: false, side: THREE2.DoubleSide });
  const routeMesh = new THREE2.Mesh(new THREE2.BufferGeometry(), routeMat);
  routeMesh.renderOrder = 20;
  routeMesh.frustumCulled = false;
  routeMesh.visible = false;
  scene.add(routeMesh);
  function setRibbon(rt) {
    if (!rt) {
      routeMesh.visible = false;
      return;
    }
    const P2 = rt.points, pos = [], uv = [], w = S.mode === "walk" ? 0.55 : 1.1, y = 0.16;
    for (let i = 1; i < P2.length; i++) {
      const a = P2[i - 1], b = P2[i], dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1, nx = -dz / l * w, nz = dx / l * w, u0 = rt.cum[i - 1] / 3, u1 = rt.cum[i] / 3;
      pos.push(a[0] + nx, y, a[1] + nz, a[0] - nx, y, a[1] - nz, b[0] + nx, y, b[1] + nz, a[0] - nx, y, a[1] - nz, b[0] - nx, y, b[1] - nz, b[0] + nx, y, b[1] + nz);
      uv.push(u0, 1, u0, 0, u1, 1, u0, 0, u1, 0, u1, 1);
      for (let k = 0; k < 10; k++) {
        const t0 = k / 10 * Math.PI * 2, t1 = (k + 1) / 10 * Math.PI * 2;
        pos.push(b[0], y, b[1], b[0] + Math.cos(t0) * w, y, b[1] + Math.sin(t0) * w, b[0] + Math.cos(t1) * w, y, b[1] + Math.sin(t1) * w);
        uv.push(0.5, 0.02, 0.5, 0.02, 0.5, 0.02);
      }
    }
    routeMesh.geometry.dispose();
    const g = new THREE2.BufferGeometry();
    g.setAttribute("position", new THREE2.Float32BufferAttribute(pos, 3));
    g.setAttribute("uv", new THREE2.Float32BufferAttribute(uv, 2));
    routeMesh.geometry = g;
    routeMesh.visible = true;
  }
  const marker = new THREE2.Group();
  marker.visible = false;
  scene.add(marker);
  const mk = (geo, color, op) => {
    const m = new THREE2.Mesh(geo, new THREE2.MeshBasicMaterial({ color, transparent: true, opacity: op, depthTest: false, depthWrite: false, toneMapped: false, side: THREE2.DoubleSide }));
    m.renderOrder = 21;
    marker.add(m);
    return m;
  };
  const ring = mk(new THREE2.RingGeometry(1.5, 2.1, 40), 16727444, 0.95);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.2;
  const beam = mk(new THREE2.CylinderGeometry(0.35, 0.35, 60, 16, 1, true), 16727444, 0.28);
  beam.position.y = 30;
  const pin = mk(new THREE2.ConeGeometry(1.5, 3.4, 20), 16727444, 1);
  pin.rotation.x = Math.PI;
  const pinTop = mk(new THREE2.SphereGeometry(1.5, 20, 12), 16727444, 1);
  const startMk = new THREE2.Mesh(new THREE2.RingGeometry(1, 1.6, 32), new THREE2.MeshBasicMaterial({ color: 16777215, transparent: true, opacity: 0.95, depthTest: false, toneMapped: false, side: THREE2.DoubleSide }));
  startMk.rotation.x = -Math.PI / 2;
  startMk.position.y = 0.22;
  startMk.renderOrder = 21;
  startMk.visible = false;
  scene.add(startMk);
  const meMk = new THREE2.Group();
  [[6, 4358644, 0.28], [2.4, 16777215, 1], [1.7, 4358644, 1]].forEach(([r, c, o], i) => {
    const m = new THREE2.Mesh(new THREE2.CircleGeometry(r, 32), new THREE2.MeshBasicMaterial({ color: c, transparent: true, opacity: o, depthTest: false, toneMapped: false }));
    m.rotation.x = -Math.PI / 2;
    m.position.y = 0.3 + i * 0.01;
    m.renderOrder = 22 + i;
    meMk.add(m);
  });
  meMk.visible = false;
  scene.add(meMk);
  const ui = createUI(root, { rooms, starts, title: opt.title, subtitle: opt.subtitle, showPanel: opt.ui }, {
    select: (id) => api.goTo(id),
    start: (id) => api.setStart(id),
    mode: (m) => api.setMode(m),
    roofs: (r) => api.setRoofs(r),
    locate: () => api.locate(),
    action: (a) => {
      if (a === "tour") S.tour ? stopTour() : api.walkRoute();
      else if (a === "inside") api.stepInside();
      else if (a === "top") api.viewFromAbove();
    }
  });
  const labels = [];
  const addLabel = (o) => {
    const e = document.createElement("button");
    e.type = "button";
    e.className = "dv3-lab " + (o.kind === "building" ? "b" : o.kind);
    e.innerHTML = o.text.replace(/&/g, "&amp;") + (o.sub ? `<small>${o.sub}</small>` : "");
    e.style.display = "none";
    ui.labels.appendChild(e);
    const L = Object.assign({ el: e, shown: false }, o);
    labels.push(L);
    e.addEventListener("click", () => {
      if (L.kind === "room") api.goTo(L.id);
      else if (L.kind === "gate" || L.kind === "main") api.setStart(L.id);
      else if (L.kind === "building") {
        const r = rooms.find((q) => q.building === L.id);
        if (r) flyOrbit({ target: new THREE2.Vector3(L.x, 0, L.z), dist: 170, pol: 0.7 });
      }
    });
    return L;
  };
  const wholeHall = /* @__PURE__ */ new Set(["hall-a", "expo-1", "dining", "entertainment", "registration", "food-court", "organizing-office"]);
  kit.labels.forEach(addLabel);
  rooms.forEach((r) => addLabel({ kind: "room", text: r.name, sub: "", x: r.center[0], z: r.center[1], y: wholeHall.has(r.id) ? 9 : 5.2, id: r.id, whole: wholeHall.has(r.id) }));
  const v3 = new THREE2.Vector3();
  let W = 1, H = 1;
  function updateLabels() {
    if (meMk.visible) meMk.scale.setScalar(S.mode === "walk" ? 0.7 : Math.max(0.8, Math.min(8, orbit.dist / 200)));
    const near = S.mode === "walk" ? false : orbit.dist < 260;
    for (const L of labels) {
      let show;
      if (S.mode === "walk" || S.fly) {
        const d = Math.hypot(L.x - camera.position.x, L.z - camera.position.z);
        show = !S.fly && (L.kind === "main" ? d < 300 : L.kind === "park" ? d < 260 : L.kind === "poi" ? d < 200 : L.kind === "room" ? d < 55 && d > 6 && !L.whole : L.kind === "gate" ? d < 120 : L.kind === "building" ? d < 260 && d > 50 : false);
      } else show = L.kind === "main" || L.kind === "park" ? true : L.kind === "poi" ? orbit.dist < 420 : L.kind === "room" ? near : L.kind === "gate" ? orbit.dist < 800 : !near;
      if (S.dest && L.kind === "room" && L.id === S.dest.id && !S.fly) show = true;
      if (show) {
        v3.set(L.x, L.y, L.z).project(camera);
        if (v3.z > 1 || v3.z < -1 || Math.abs(v3.x) > 1.05 || Math.abs(v3.y) > 1.05) show = false;
        else L.el.style.transform = `translate(${((v3.x + 1) / 2 * W).toFixed(1)}px,${((1 - v3.y) / 2 * H).toFixed(1)}px) translate(-50%,-100%)`;
      }
      if (show !== L.shown) {
        L.el.style.display = show ? "" : "none";
        L.shown = show;
      }
    }
  }
  const tmpCam = new THREE2.PerspectiveCamera();
  tmpCam.rotation.order = "YXZ";
  function orbitPose(o, out) {
    const sp = Math.sin(o.pol);
    out.position.set(o.target.x + o.dist * sp * Math.sin(o.az), o.dist * Math.cos(o.pol), o.target.z + o.dist * sp * Math.cos(o.az));
    out.lookAt(o.target.x, 0, o.target.z);
  }
  function walkPose(w, out) {
    out.position.copy(w.pos);
    out.rotation.set(w.pitch, w.yaw, 0, "YXZ");
  }
  function startFly(dur, then) {
    S.fly = { t: 0, dur, p0: camera.position.clone(), q0: camera.quaternion.clone(), then };
  }
  function flyOrbit(g) {
    if (S.mode !== "overview") return api.setMode("overview", g);
    if (g.target) og.target.copy(g.target);
    if (g.dist) og.dist = g.dist;
    if (g.pol) og.pol = g.pol;
    if (g.az !== void 0) og.az = g.az;
  }
  const yawTo = (from, to) => Math.atan2(-(to[0] - from.x), -(to[1] - from.z));
  function applyRoofs() {
    const vis = !S.reveal && S.roofs === "on";
    if (roofGroup.visible !== vis) {
      roofGroup.visible = vis;
    }
    renderer.shadowMap.needsUpdate = true;
    ui.setRoofs(S.roofs);
  }
  function startPoint() {
    const s = starts.find((q) => q.id === S.startId) || starts[0];
    if (s.id === "here") return S.mode === "walk" ? [walk.pos.x, walk.pos.z] : nav.nearest(orbit.target.x, orbit.target.z);
    return s.at;
  }
  function refreshRoute() {
    const from = startPoint();
    startMk.position.set(from[0], 0.22, from[1]);
    startMk.visible = S.mode !== "walk";
    if (!S.dest) {
      S.route = null;
      S.steps = [];
      setRibbon(null);
      marker.visible = false;
      ui.setDestination(null);
      return;
    }
    S.route = nav.route(from, S.dest.arrive);
    S.steps = S.route ? nav.directions(S.route, describe, S.dest.name) : [];
    setRibbon(S.route);
    marker.visible = true;
    marker.position.set(S.dest.arrive[0], 0, S.dest.arrive[1]);
    S.arrived = false;
    const bn = bName(S.dest.building);
    ui.setDestination(S.dest, bn && bn !== S.dest.name ? bn : "", S.route, S.steps);
    labels.forEach((L) => L.el.classList.toggle("sel", L.kind === "room" && L.id === S.dest.id));
  }
  function frameRoute() {
    if (S.mode !== "overview" || !S.dest) return;
    const P2 = S.route ? S.route.points : [S.dest.arrive];
    let a = Infinity, b = -Infinity, c = Infinity, d = -Infinity;
    P2.forEach((p) => {
      a = Math.min(a, p[0]);
      b = Math.max(b, p[0]);
      c = Math.min(c, p[1]);
      d = Math.max(d, p[1]);
    });
    const span = Math.max(b - a, (d - c) * 1.3, 60);
    og.target.set((a + b) / 2, 0, (c + d) / 2);
    og.dist = clamp(span * 1.25, 110, 760);
    og.pol = Math.min(og.pol, 0.85);
  }
  function revealRoom(r, pol = 0.42, fill = 0.6) {
    const [x0, z0, x1, z1] = r.rect, w = x1 - x0, d = z1 - z0, asp = (W || 1) / (H || 1);
    const half = Math.max(d * fill, w * fill / asp);
    const dist = clamp(half / Math.tan(25 * Math.PI / 180) * 1.2, 60, 700);
    S.reveal = true;
    applyRoofs();
    const g = { target: new THREE2.Vector3(r.center[0], 0, r.center[1]), dist, pol };
    if (S.mode === "overview") {
      og.target.copy(g.target);
      og.dist = g.dist;
      og.pol = g.pol;
      og.az = og.az;
    } else api.setMode("overview", g);
  }
  function stopTour(silent) {
    if (!S.tour) return;
    S.tour = null;
    ui.setTouring(false);
  }
  function arrive() {
    if (S.arrived || !S.dest) return;
    S.arrived = true;
    ui.say(`You have arrived \xB7 ${S.dest.name}`, 3600);
    if (opt.onArrive) opt.onArrive(S.dest);
  }
  const api = {
    rooms,
    starts,
    scene,
    camera,
    renderer,
    get destination() {
      return S.dest;
    },
    get mode() {
      return S.mode;
    },
    get route() {
      return S.route;
    },
    get steps() {
      return S.steps;
    },
    stats: { chairs: chairCount, rooms: rooms.length, signs: kit.signs.length, vehicles: traffic.count },
    goTo(idOrName, o = {}) {
      const r = idOrName ? roomById[idOrName] || roomById[(findRoom(idOrName) || {}).id] : null;
      stopTour();
      S.dest = r || null;
      if (o.from) S.startId = o.from, ui.setStart(S.startId);
      refreshRoute();
      if (r && !o.keepView) {
        revealRoom(r);
        setTimeout(() => {
          if (S.dest === r && S.mode === "overview") {
            S.reveal = false;
            applyRoofs();
            frameRoute();
          }
        }, 3600);
      }
      if (opt.onSelect && !o.silent) opt.onSelect(r);
      return r;
    },
    setStart(id) {
      if (!starts.some((s) => s.id === id)) return;
      stopTour();
      S.startId = id;
      ui.setStart(id);
      refreshRoute();
      if (S.mode === "overview") frameRoute();
      if (S.mode === "walk" && id !== "here") {
        const p = startPoint();
        walk.pos.set(p[0], EYE, p[1]);
        if (S.route && S.route.points[1]) walk.yaw = yawTo(walk.pos, S.route.points[1]);
      }
    },
    locate() {
      if (S.geoId != null) {
        navigator.geolocation.clearWatch(S.geoId);
        S.geoId = null;
        S.me = null;
        meMk.visible = false;
        ui.setLoc(false);
        return;
      }
      if (!navigator.geolocation) return ui.say("Location is not available on this device", 3200);
      ui.say("Finding your location\u2026", 2200);
      S.geoId = navigator.geolocation.watchPosition((pos) => {
        const dN = (pos.coords.latitude - GEO0[0]) * 111320, dE = (pos.coords.longitude - GEO0[1]) * 111320 * Math.cos(GEO0[0] * Math.PI / 180);
        const km = Math.hypot(dE, dN) / 1e3;
        if (km > 3) {
          navigator.geolocation.clearWatch(S.geoId);
          S.geoId = null;
          ui.setLoc(false);
          return ui.say(`You are about ${km.toFixed(km < 10 ? 1 : 0)} km from the venue \u2014 use "To Main Gate G9" for directions`, 4200);
        }
        const g9 = GATES[0].at;
        S.me = [g9[0] + dE * 0.809 - dN * 0.588, g9[1] - dE * 0.588 - dN * 0.809];
        meMk.position.set(S.me[0], 0, S.me[1]);
        meMk.visible = true;
        ui.setLoc(true);
        if (!S.meShown) {
          S.meShown = true;
          ui.say("Blue dot = your approximate location", 3000);
        }
      }, () => {
        S.geoId = null;
        ui.setLoc(false);
        ui.say("Could not get your location \u2014 please allow location access", 3600);
      }, { enableHighAccuracy: true, maximumAge: 5e3, timeout: 2e4 });
    },
    setRoofs(r) {
      S.roofs = r;
      applyRoofs();
    },
    setMode(mode, g) {
      if (mode === S.mode && !g) return;
      stopTour();
      if (camera.fov !== 50) {
        camera.fov = 50;
        camera.updateProjectionMatrix();
      }
      if (mode === "walk") {
        if (!g) {
          const p = S.dest && S.route ? S.route.points[0] : nav.nearest(orbit.target.x, orbit.target.z);
          walk.pos.set(p[0], EYE, p[1]);
          walk.yaw = S.route && S.route.points[1] ? yawTo(walk.pos, S.route.points[1]) : orbit.az;
          walk.pitch = -0.03;
        } else {
          walk.pos.set(g.at[0], EYE, g.at[1]);
          walk.yaw = g.look ? yawTo(walk.pos, g.look) : g.yaw || 0;
          walk.pitch = -0.03;
        }
        S.mode = "walk";
        applyRoofs();
        startFly(1.5, g && g.then);
      } else {
        if (S.mode === "walk") {
          orbit.target.set(walk.pos.x, 0, walk.pos.z);
          orbit.az = walk.yaw;
          orbit.dist = 8;
          orbit.pol = 1.3;
          og.target.copy(orbit.target);
          og.az = orbit.az;
          og.dist = 190;
          og.pol = 0.8;
        }
        if (g) {
          if (g.target) og.target.copy(g.target);
          if (g.dist) og.dist = g.dist;
          if (g.pol) og.pol = g.pol;
        }
        orbit.target.copy(og.target);
        orbit.dist = og.dist;
        orbit.pol = og.pol;
        orbit.az = og.az;
        S.mode = "overview";
        applyRoofs();
        startFly(1.3);
      }
      ui.setMode(S.mode);
      setRibbon(S.route);
      startMk.visible = S.mode !== "walk";
      if (opt.onModeChange) opt.onModeChange(S.mode);
    },
    walkRoute() {
      if (!S.dest || !S.route) return;
      const rt = S.route, p = rt.points[0];
      const begin = () => {
        S.tour = { rt, s: 0, look: S.dest.look, v: 0 };
        ui.setTouring(true);
      };
      api.setMode("walk", { at: p, look: rt.points[1] || S.dest.look, then: begin });
    },
    stepInside(id) {
      const r = id ? roomById[id] : S.dest;
      if (!r) return;
      clearTimeout(S.insideT);
      clearTimeout(S.insideT2);
      S.sweep = null;
      const bld = bById[r.building];
      let y = EYE;
      if (bld && bld.main && bld.main.length) {
        const zl = Math.abs(r.arrive[1] - bld.cz);
        const roofY = bld.eave + (bld.ridge - bld.eave) * (1 - zl / (bld.D / 2 + 0.6));
        y = bld.eave <= 8 ? clamp(bld.eave - 0.9, 3, 5.2) : clamp(bld.eave - 3, 3, 14);
      }
      api.setMode("walk", { at: r.arrive, look: r.look });
      walk.pos.set(r.center[0], y, r.center[1]);
      walk.pitch = -0.3;
      camera.fov = 82;
      camera.updateProjectionMatrix();
      const yaw0 = walk.yaw;
      S.insideT = setTimeout(() => {
        S.sweep = { t0: clock, dur: 9, a: yaw0, b: yaw0 + Math.PI * 2 };
      }, 1900);
      S.insideT2 = setTimeout(() => {
        S.sweep = null;
        walk.yaw = yaw0;
        walk.pos.set(r.arrive[0], EYE, r.arrive[1]);
        walk.pitch = -0.03;
        camera.fov = 50;
        camera.updateProjectionMatrix();
        startFly(1.6);
      }, 11300);
    },
    viewFromAbove(id) {
      const r = id ? roomById[id] : S.dest;
      if (!r) return;
      const w = r.rect[2] - r.rect[0], d = r.rect[3] - r.rect[1];
      const g = { target: new THREE2.Vector3(r.center[0], 0, r.center[1]), dist: clamp(Math.max(w, d * 1.4) * 1.15, 42, 240), pol: 0.55 };
      if (S.mode === "overview") {
        og.target.copy(g.target);
        og.dist = g.dist;
        og.pol = g.pol;
      } else api.setMode("overview", g);
    },
    resize() {
      const r = root.getBoundingClientRect();
      W = Math.max(1, r.width);
      H = Math.max(1, r.height);
      renderer.setSize(W, H, false);
      camera.aspect = W / H;
      camera.updateProjectionMatrix();
    },
    dispose() {
      S.disposed = true;
      if (S.geoId != null) navigator.geolocation.clearWatch(S.geoId);
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      scene.traverse((o) => {
        if (o.isInstancedMesh) o.dispose();
      });
      kit.dispose();
      [routeMesh, ring, beam, pin, pinTop, startMk, sky].forEach((m) => {
        m.geometry.dispose();
        m.material.dispose();
      });
      chev.dispose();
      envRT.dispose();
      ui.dispose();
      renderer.dispose();
      root.remove();
    }
  };
  const ptr = /* @__PURE__ */ new Map();
  let downAt = null, moved = false, lastPinch = 0, lastMid = null, hover = false;
  const ray = new THREE2.Raycaster(), ndc = new THREE2.Vector2(), ground = new THREE2.Plane(new THREE2.Vector3(0, 1, 0), 0), hit = new THREE2.Vector3();
  function groundAt(ev) {
    const r = canvas.getBoundingClientRect();
    ndc.set((ev.clientX - r.left) / r.width * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    return ray.ray.intersectPlane(ground, hit) ? [hit.x, hit.z] : null;
  }
  canvas.addEventListener("pointerdown", (e) => {
    S.sweep = null;
    canvas.focus({ preventScroll: true });
    canvas.setPointerCapture(e.pointerId);
    ptr.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptr.size === 1) {
      downAt = { x: e.clientX, y: e.clientY, b: e.button, t: performance.now() };
      moved = false;
    }
    lastPinch = 0;
    lastMid = null;
  });
  canvas.addEventListener("pointermove", (e) => {
    const p = ptr.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX;
    p.y = e.clientY;
    if (downAt && Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 5) moved = true;
    if (S.fly) return;
    if (ptr.size === 1) {
      if (S.mode === "overview") {
        if (downAt && (downAt.b === 2 || e.ctrlKey || e.shiftKey || e.metaKey)) pan(dx, dy);
        else {
          og.az -= dx * 5e-3;
          og.pol = clamp(og.pol - dy * 5e-3, 0.08, 1.45);
        }
      } else {
        walk.yaw += dx * 42e-4;
        walk.pitch = clamp(walk.pitch + dy * 42e-4, -1.15, 1.15);
      }
    } else if (ptr.size === 2) {
      const [a, b] = [...ptr.values()], d = Math.hypot(a.x - b.x, a.y - b.y), mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      moved = true;
      if (S.mode === "overview") {
        if (lastPinch) og.dist = clamp(og.dist * lastPinch / d, 14, 1200);
        if (lastMid) pan(mid.x - lastMid.x, mid.y - lastMid.y);
      } else if (lastPinch) {
        const f = (d - lastPinch) * 0.06;
        walk.pos.x += -Math.sin(walk.yaw) * f;
        walk.pos.z += -Math.cos(walk.yaw) * f;
        collide(walk.pos);
      }
      lastPinch = d;
      lastMid = mid;
    }
  });
  const up = (e) => {
    if (!ptr.has(e.pointerId)) return;
    ptr.delete(e.pointerId);
    lastPinch = 0;
    lastMid = null;
    if (ptr.size === 0 && downAt && !moved && downAt.b === 0 && !S.fly && S.mode === "walk" && performance.now() - downAt.t < 600) {
      const g = groundAt(e);
      if (g && Math.hypot(g[0] - walk.pos.x, g[1] - walk.pos.z) < 500) {
        const rt = nav.route([walk.pos.x, walk.pos.z], nav.nearest(g[0], g[1]));
        if (rt && rt.length > 0.8) {
          S.tour = { rt, s: 0, look: null, v: 0, free: true };
        }
      }
    }
    if (ptr.size === 0) downAt = null;
  };
  canvas.addEventListener("pointerup", up);
  canvas.addEventListener("pointercancel", up);
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  canvas.addEventListener("dblclick", (e) => {
    if (S.mode !== "overview" || S.fly) return;
    const g = groundAt(e);
    if (!g) return;
    const p = nav.nearest(g[0], g[1]);
    api.setMode("walk", { at: p, yaw: og.az });
  });
  canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    if (S.fly) return;
    const dy = e.deltaMode === 1 ? e.deltaY * 30 : e.deltaY;
    if (S.mode === "overview") og.dist = clamp(og.dist * Math.exp(dy * 11e-4), 14, 1200);
    else {
      stopTour();
      const f = -dy * 0.012;
      walk.pos.x += -Math.sin(walk.yaw) * f;
      walk.pos.z += -Math.cos(walk.yaw) * f;
      collide(walk.pos);
    }
  }, { passive: false });
  root.addEventListener("pointerenter", () => hover = true);
  root.addEventListener("pointerleave", () => hover = false);
  function pan(dx, dy) {
    const k = og.dist * 16e-4, ca = Math.cos(og.az), sa = Math.sin(og.az);
    og.target.x += -ca * dx * k - sa * dy * k;
    og.target.z += sa * dx * k - ca * dy * k;
    og.target.x = clamp(og.target.x, SITE.minX - 80, SITE.maxX + 80);
    og.target.z = clamp(og.target.z, SITE.minZ - 70, SITE.maxZ + 150);
  }
  const MOVE = /* @__PURE__ */ new Set(["w", "a", "s", "d", "q", "e", "arrowup", "arrowdown", "arrowleft", "arrowright", "shift"]);
  function onKey(e) {
    const t = e.target;
    if (t && (t.tagName === "SELECT" || t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
    if (!hover && document.activeElement !== canvas) return;
    const k = e.key.toLowerCase();
    if (!MOVE.has(k)) return;
    keys.add(k);
    if (k !== "shift") {
      e.preventDefault();
      if (S.tour && S.mode === "walk") stopTour();
    }
  }
  function onKeyUp(e) {
    keys.delete(e.key.toLowerCase());
  }
  function onBlur() {
    keys.clear();
  }
  window.addEventListener("keydown", onKey);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", onBlur);
  const mctx = ui.map.getContext("2d");
  function drawMap() {
    const g = mctx, cw = ui.map.width, ch = ui.map.height, pad = 10, sc2 = Math.min((cw - pad * 2) / (SITE.maxX - SITE.minX), (ch - pad * 2) / (SITE.maxZ - SITE.minZ));
    const X = (x) => pad + (x - SITE.minX) * sc2, Z = (z) => pad + (z - SITE.minZ) * sc2;
    g.clearRect(0, 0, cw, ch);
    g.fillStyle = "rgba(194,42,52,.9)";
    CARPETS.forEach((r) => g.fillRect(X(r[0]), Z(r[1]), (r[2] - r[0]) * sc2, (r[3] - r[1]) * sc2));
    BUILDINGS.forEach((b) => {
      const w = b.rot ? b.D : b.W, d = b.rot ? b.W : b.D;
      g.fillStyle = b.main.length ? S.dest && S.dest.building === b.id ? "#d63d86" : "#7d6aa8" : "#5a5d68";
      g.fillRect(X(b.cx - w / 2), Z(b.cz - d / 2), w * sc2, d * sc2);
    });
    g.fillStyle = S.dest && S.dest.building === "h3" ? "#d63d86" : "#7d6aa8";
    g.beginPath();
    g.arc(X(DOME.cx), Z(DOME.cz), DOME.r * sc2, 0, 7);
    g.fill();
    g.fillStyle = S.dest && S.dest.building === "admin" ? "#d63d86" : "#7d6aa8";
    g.fillRect(X(ADMIN.rect[0]), Z(ADMIN.rect[1]), (ADMIN.rect[2] - ADMIN.rect[0]) * sc2, (ADMIN.rect[3] - ADMIN.rect[1]) * sc2);
    {
      const G = GATES[0], gx = X(G.at[0]), gz = Z(G.at[1]), pu = 1 + 0.25 * Math.sin(clock * 4);
      g.fillStyle = "rgba(255,61,148,.35)";
      g.beginPath();
      g.arc(gx, gz, 12 * pu, 0, 7);
      g.fill();
      g.fillStyle = "#ff3d94";
      g.beginPath();
      g.arc(gx, gz, 6, 0, 7);
      g.fill();
      g.strokeStyle = "#fff";
      g.lineWidth = 2;
      g.stroke();
      g.font = "800 15px sans-serif";
      g.textAlign = "right";
      g.textBaseline = "middle";
      g.lineWidth = 4;
      g.strokeStyle = "#16132a";
      g.strokeText("MAIN ENTRY", gx - 12, gz);
      g.fillStyle = "#fff";
      g.fillText("MAIN ENTRY", gx - 12, gz);
    }
    if (S.me) {
      const mx = Math.max(8, Math.min(cw - 8, X(S.me[0]))), mz = Math.max(8, Math.min(ch - 14, Z(S.me[1])));
      g.fillStyle = "rgba(66,133,244,.3)";
      g.beginPath();
      g.arc(mx, mz, 11, 0, 7);
      g.fill();
      g.fillStyle = "#4285f4";
      g.beginPath();
      g.arc(mx, mz, 5, 0, 7);
      g.fill();
      g.strokeStyle = "#fff";
      g.lineWidth = 2;
      g.stroke();
    }
    g.font = "700 11px sans-serif";
    g.textAlign = "center";
    g.textBaseline = "bottom";
    g.fillStyle = "#6fb0ff";
    g.fillText("\u25BC P  Parking (south of Gate G9)", cw / 2, ch - 1);
    if (S.route) {
      g.strokeStyle = "#19b5ff";
      g.lineWidth = 4;
      g.lineJoin = "round";
      g.beginPath();
      S.route.points.forEach((p, i) => i ? g.lineTo(X(p[0]), Z(p[1])) : g.moveTo(X(p[0]), Z(p[1])));
      g.stroke();
    }
    if (S.dest) {
      g.fillStyle = "#ff3d94";
      g.beginPath();
      g.arc(X(S.dest.arrive[0]), Z(S.dest.arrive[1]), 7, 0, 7);
      g.fill();
      g.strokeStyle = "#fff";
      g.lineWidth = 2;
      g.stroke();
    }
    if (S.mode === "walk") {
      g.save();
      g.translate(X(walk.pos.x), Z(walk.pos.z));
      g.rotate(-walk.yaw);
      g.fillStyle = "#fff";
      g.beginPath();
      g.moveTo(0, -12);
      g.lineTo(8, 9);
      g.lineTo(0, 4);
      g.lineTo(-8, 9);
      g.closePath();
      g.fill();
      g.strokeStyle = "#16132a";
      g.lineWidth = 2;
      g.stroke();
      g.restore();
    }
    g.font = "700 24px sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    HALL_KEYS.forEach((h) => {
      const px = X(h.x), pz = Z(h.z), on = S.dest && S.dest.building === h.b;
      g.beginPath();
      g.arc(px, pz, 15, 0, 7);
      g.fillStyle = on ? "#d63d86" : "rgba(22,19,42,.9)";
      g.fill();
      g.strokeStyle = "#fff";
      g.lineWidth = 2;
      g.stroke();
      g.fillStyle = "#fff";
      g.fillText(h.key, px, pz + 1);
    });
    g.textAlign = "start";
    g.textBaseline = "alphabetic";
    g.fillStyle = "rgba(255,255,255,.75)";
    g.font = "600 20px sans-serif";
    g.fillText("N", cw - 26, 26);
    g.fillRect(cw - 20, 30, 2, 12);
  }
  const HALL_KEYS = [
    { key: "A", b: "h1", room: "hall-a", x: 83.2, z: 82.3 },
    { key: "B", b: "h10", room: "hall-b", x: 83.2, z: 0.05 },
    { key: "C", b: "h9", room: "hall-c", x: 83.2, z: -82.4 },
    { key: "D", b: "h2", room: "expo-1", x: -57.3, z: 82.3 },
    { key: "E", b: "h8", room: "workshop-1", x: -57.3, z: 0.1 },
    { key: "F", b: "h7", room: "dining", x: -57.3, z: -82.15 }
  ];
  ui.map.style.cursor = "pointer";
  ui.map.addEventListener("click", (e) => {
    const r = ui.map.getBoundingClientRect(), cw = ui.map.width, ch = ui.map.height;
    const px = (e.clientX - r.left) / r.width * cw, py = (e.clientY - r.top) / r.height * ch;
    const pad = 10, sc2 = Math.min((cw - pad * 2) / (SITE.maxX - SITE.minX), (ch - pad * 2) / (SITE.maxZ - SITE.minZ));
    let best = null, bd = Infinity;
    HALL_KEYS.forEach((h) => {
      const d = Math.hypot(px - (pad + (h.x - SITE.minX) * sc2), py - (pad + (h.z - SITE.minZ) * sc2));
      if (d < bd) {
        bd = d;
        best = h;
      }
    });
    if (best && bd < 24) api.goTo(best.room);
  });
  const routePoint = (rt, s, out) => {
    const P2 = rt.points, C = rt.cum;
    s = clamp(s, 0, rt.length);
    let i = 1;
    while (i < C.length - 1 && C[i] < s) i++;
    const l = C[i] - C[i - 1] || 1, t = (s - C[i - 1]) / l;
    out[0] = P2[i - 1][0] + (P2[i][0] - P2[i - 1][0]) * t;
    out[1] = P2[i - 1][1] + (P2[i][1] - P2[i - 1][1]) * t;
    return out;
  };
  const pa = [0, 0], pb = [0, 0];
  let last = performance.now(), raf = 0, frame = 0, clock = 0;
  const reduce = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  function tick(now) {
    if (S.disposed) return;
    raf = requestAnimationFrame(tick);
    const dt = Math.min(0.05, (now - last) / 1e3);
    last = now;
    clock += dt;
    frame++;
    if (document.hidden) return;
    if (!reduce) traffic.update(dt);
    if (S.fly) {
      const f = S.fly;
      f.t += dt / (reduce ? 0.01 : f.dur);
      const k = f.t >= 1 ? 1 : f.t * f.t * (3 - 2 * f.t);
      if (S.mode === "walk") walkPose(walk, tmpCam);
      else orbitPose(orbit, tmpCam);
      camera.position.lerpVectors(f.p0, tmpCam.position, k);
      camera.quaternion.slerpQuaternions(f.q0, tmpCam.quaternion, k);
      if (f.t >= 1) {
        S.fly = null;
        if (f.then) f.then();
      }
    } else if (S.mode === "overview") {
      const a = 1 - Math.exp(-dt * 9);
      orbit.target.lerp(og.target, a);
      orbit.dist += (og.dist - orbit.dist) * a;
      orbit.az += (og.az - orbit.az) * a;
      orbit.pol += (og.pol - orbit.pol) * a;
      if (keys.size) {
        const sp = orbit.dist * 0.9 * dt;
        if (keys.has("w") || keys.has("arrowup")) pan(0, sp / (og.dist * 16e-4));
        if (keys.has("s") || keys.has("arrowdown")) pan(0, -sp / (og.dist * 16e-4));
        if (keys.has("a") || keys.has("arrowleft")) pan(sp / (og.dist * 16e-4), 0);
        if (keys.has("d") || keys.has("arrowright")) pan(-sp / (og.dist * 16e-4), 0);
      }
      orbitPose(orbit, camera);
    } else {
      if (S.tour) {
        const T = S.tour, rt = T.rt, indoor = nav.cost[Math.floor(walk.pos.z - nav.minZ) * nav.nx + Math.floor(walk.pos.x - nav.minX)] > 1.05 && nav.cost[Math.floor(walk.pos.z - nav.minZ) * nav.nx + Math.floor(walk.pos.x - nav.minX)] < 1.5;
        const remain = rt.length - T.s, vmax = T.free ? 6 : indoor ? 5 : 12, target = Math.min(vmax, 1.2 + remain * 1.2);
        T.v += (target - T.v) * (1 - Math.exp(-dt * 2.5));
        T.s += T.v * dt;
        routePoint(rt, T.s, pa);
        routePoint(rt, T.s + 3.5, pb);
        walk.pos.set(pa[0], EYE, pa[1]);
        if (Math.hypot(pb[0] - pa[0], pb[1] - pa[1]) > 0.3) walk.yaw = lerpAngle(walk.yaw, Math.atan2(-(pb[0] - pa[0]), -(pb[1] - pa[1])), 1 - Math.exp(-dt * 4.5));
        if (!T.free) walk.pitch += (-0.04 - walk.pitch) * (1 - Math.exp(-dt * 3));
        if (T.s >= rt.length) {
          if (T.look) {
            T.turn = (T.turn || 0) + dt;
            walk.yaw = lerpAngle(walk.yaw, yawTo(walk.pos, T.look), 1 - Math.exp(-dt * 5));
            if (T.turn > 1.1) {
              stopTour();
              arrive();
            }
          } else stopTour();
        }
      } else if (keys.size) {
        const run = keys.has("shift") ? 13 : 5.2, f = (keys.has("w") || keys.has("arrowup") ? 1 : 0) - (keys.has("s") || keys.has("arrowdown") ? 1 : 0), st = (keys.has("d") ? 1 : 0) - (keys.has("a") ? 1 : 0), tr = (keys.has("arrowleft") || keys.has("q") ? 1 : 0) - (keys.has("arrowright") || keys.has("e") ? 1 : 0);
        walk.yaw += tr * 1.9 * dt;
        const sy = Math.sin(walk.yaw), cy = Math.cos(walk.yaw), n = Math.hypot(f, st) || 1;
        walk.pos.x += (-sy * f + cy * st) / n * run * dt;
        walk.pos.z += (-cy * f - sy * st) / n * run * dt;
        collide(walk.pos);
      }
      if (S.sweep) {
        const sw = S.sweep, k = Math.min(1, (clock - sw.t0) / sw.dur), e = k * k * (3 - 2 * k);
        walk.yaw = sw.a + (sw.b - sw.a) * e;
        if (k >= 1) S.sweep = null;
      }
      if (S.dest && !S.arrived && !S.tour && Math.hypot(walk.pos.x - S.dest.arrive[0], walk.pos.z - S.dest.arrive[1]) < 3) arrive();
      walkPose(walk, camera);
      if (frame % 6 === 0) {
        ui.setHere(describe(nav.zoneAt(walk.pos.x, walk.pos.z)).label.replace(/^the /, "").replace(/^./, (c) => c.toUpperCase()));
        drawMap();
      }
    }
    if (S.mode !== "walk" && frame % 6 === 0) drawMap();
    if (routeMesh.visible) chev.offset.x = -(clock * (S.mode === "walk" ? 0.9 : 1.6)) % 1;
    if (marker.visible) {
      const s = 1 + 0.22 * Math.sin(clock * 3.2), far = S.mode === "walk" ? 0.55 : clamp(orbit.dist / 170, 0.8, 3.4);
      ring.scale.setScalar(s * far);
      pin.position.y = (6.5 + Math.sin(clock * 2.4) * 0.7) * far * 0.8;
      pin.scale.setScalar(far * 0.8);
      pinTop.position.y = pin.position.y + 2.4 * far * 0.8;
      pinTop.scale.setScalar(far * 0.8);
      beam.visible = S.mode !== "walk" || Math.hypot(walk.pos.x - marker.position.x, walk.pos.z - marker.position.z) > 25;
    }
    sky.position.set(camera.position.x, 0, camera.position.z);
    const nearWant = S.mode === "overview" && !S.fly ? clamp(orbit.dist * 0.03, 0.3, 30) : 0.25;
    if (Math.abs(camera.near - nearWant) > nearWant * 0.2) {
      camera.near = nearWant;
      camera.updateProjectionMatrix();
    }
    renderer.render(scene, camera);
    updateLabels();
  }
  const ro = new ResizeObserver(() => api.resize());
  ro.observe(root);
  api.resize();
  ui.setMode("overview");
  ui.setStart(S.startId);
  applyRoofs();
  orbitPose(orbit, camera);
  refreshRoute();
  if (opt.destination) api.goTo(opt.destination, { silent: true });
  if (opt.mode === "walk") api.setMode("walk");
  raf = requestAnimationFrame(tick);
  if (opt.onReady) setTimeout(() => opt.onReady(api), 0);
  return api;
}

export { ROOMS, GATES, BUILDINGS, findRoom, createVenue };
