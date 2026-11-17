import * as THREE2 from "three";

// src/kit.js
import * as THREE from "three";
var DIR = { E: 0, N: Math.PI / 2, W: Math.PI, S: -Math.PI / 2 };
function unitArrays(geom) {
  const g = geom.index ? geom.toNonIndexed() : geom;
  return { p: g.attributes.position.array, n: g.attributes.normal.array };
}
function createKit({ font = "Arial, sans-serif", lowQuality = false, maxAniso = 8 } = {}) {
  const kit = { colliders: [], navBlocks: [], rooms: {}, zones: [], signs: [], chairs: [], costRects: [], labels: [] };
  const disposables = [];
  function tex(w, h, draw, tile = 1, srgb = true) {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    draw(c.getContext("2d"), w, h);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(1 / tile, 1 / tile);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = maxAniso;
    disposables.push(t);
    return t;
  }
  let seed = 7;
  const rnd = () => (seed = seed * 16807 % 2147483647) / 2147483647;
  function speckle(g, w, h, base, amp, n) {
    g.fillStyle = base;
    g.fillRect(0, 0, w, h);
    const id = g.getImageData(0, 0, w, h), d = id.data;
    for (let i = 0; i < d.length; i += 4) {
      const k = (rnd() - 0.5) * amp;
      d[i] += k;
      d[i + 1] += k;
      d[i + 2] += k;
    }
    g.putImageData(id, 0, 0);
    for (let i = 0; i < (n || 0); i++) {
      g.fillStyle = `rgba(${rnd() < 0.5 ? 0 : 255},${rnd() < 0.5 ? 0 : 255},${rnd() < 0.5 ? 0 : 255},${0.03 + rnd() * 0.04})`;
      g.beginPath();
      g.arc(rnd() * w, rnd() * h, 1 + rnd() * 5, 0, 7);
      g.fill();
    }
  }
  const T = {};
  T.asphalt = tex(256, 256, (g, w, h) => speckle(g, w, h, "#5b5d61", 34, 500), 6);
  T.concrete = tex(256, 256, (g, w, h) => {
    speckle(g, w, h, "#b9b7b1", 12, 260);
    g.strokeStyle = "rgba(70,70,70,.35)";
    g.lineWidth = 2;
    g.strokeRect(0, 0, w, h);
  }, 6);
  T.paver = tex(256, 256, (g, w, h) => {
    speckle(g, w, h, "#a9a49b", 16, 100);
    g.strokeStyle = "rgba(60,55,50,.45)";
    g.lineWidth = 2;
    for (let y = 0; y < 4; y++) for (let x = -1; x < 4; x++) g.strokeRect(x * 64 + y % 2 * 32, y * 64, 64, 64);
  }, 3);
  T.grass = tex(256, 256, (g, w, h) => {
    speckle(g, w, h, "#58803f", 30, 0);
    for (let i = 0; i < 2600; i++) {
      g.strokeStyle = `rgba(${40 + rnd() * 60},${100 + rnd() * 70},${30 + rnd() * 40},.5)`;
      g.beginPath();
      const x = rnd() * w, y = rnd() * h;
      g.moveTo(x, y);
      g.lineTo(x + rnd() * 4 - 2, y - 3 - rnd() * 4);
      g.stroke();
    }
  }, 5);
  const carpet = (base, a, b) => tex(256, 256, (g, w, h) => {
    speckle(g, w, h, base, 20, 0);
    g.globalAlpha = 0.35;
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      g.fillStyle = (x + y) % 2 ? a : b;
      g.beginPath();
      g.moveTo(x * 64 + 32, y * 64 + 6);
      g.lineTo(x * 64 + 58, y * 64 + 32);
      g.lineTo(x * 64 + 32, y * 64 + 58);
      g.lineTo(x * 64 + 6, y * 64 + 32);
      g.fill();
    }
    g.globalAlpha = 1;
  }, 2.4);
  T.carpetBlue = carpet("#2d3a66", "#36457a", "#27325a");
  T.carpetGrey = carpet("#70727c", "#7b7d88", "#666872");
  T.carpetPlum = carpet("#5a2f55", "#693a63", "#4d2749");
  T.carpetTeal = carpet("#2f5d63", "#376b72", "#285157");
  T.carpetRed = tex(128, 128, (g, w, h) => speckle(g, w, h, "#c22a34", 22, 0), 1.5);
  T.clad = tex(256, 256, (g, w, h) => {
    speckle(g, w, h, "#e9e9e4", 8, 0);
    for (let x = 0; x < w; x += 32) {
      g.fillStyle = "rgba(0,0,0,.10)";
      g.fillRect(x, 0, 3, h);
      g.fillStyle = "rgba(255,255,255,.5)";
      g.fillRect(x + 3, 0, 2, h);
    }
  }, 4);
  T.roof = tex(256, 256, (g, w, h) => {
    speckle(g, w, h, "#f7f8f9", 6, 0);
    for (let x = 0; x < w; x += 32) {
      g.fillStyle = "rgba(90,100,110,.14)";
      g.fillRect(x, 0, 4, h);
      g.fillStyle = "rgba(255,255,255,.6)";
      g.fillRect(x + 4, 0, 3, h);
    }
  }, 5);
  T.panel = tex(256, 256, (g, w, h) => {
    speckle(g, w, h, "#f1f0ec", 6, 0);
    g.strokeStyle = "rgba(120,120,125,.55)";
    g.lineWidth = 3;
    g.strokeRect(0, 0, w, h);
  }, 1);
  T.acoustic = tex(256, 256, (g, w, h) => {
    speckle(g, w, h, "#8a86a8", 16, 0);
    g.strokeStyle = "rgba(40,36,70,.5)";
    g.lineWidth = 3;
    g.strokeRect(0, 0, w, h);
    g.strokeRect(0, 0, w / 2, h);
  }, 2.4);
  T.wood = tex(256, 256, (g, w, h) => {
    speckle(g, w, h, "#8a5a34", 14, 0);
    for (let i = 0; i < 60; i++) {
      g.strokeStyle = `rgba(50,25,8,${0.08 + rnd() * 0.15})`;
      g.beginPath();
      const y = rnd() * h;
      g.moveTo(0, y);
      g.bezierCurveTo(w / 3, y + rnd() * 8 - 4, w * 2 / 3, y + rnd() * 8 - 4, w, y);
      g.stroke();
    }
  }, 2);
  T.brand = tex(512, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, 0);
    gr.addColorStop(0, "#5b1f6e");
    gr.addColorStop(0.55, "#a3195b");
    gr.addColorStop(1, "#1f7fa6");
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
    g.fillStyle = "rgba(255,255,255,.10)";
    for (let i = -4; i < 12; i++) {
      g.beginPath();
      g.moveTo(i * 60, h);
      g.lineTo(i * 60 + 130, 0);
      g.lineTo(i * 60 + 150, 0);
      g.lineTo(i * 60 + 20, h);
      g.fill();
    }
    g.fillStyle = "#fff";
    g.font = `800 62px ${font}`;
    g.textBaseline = "middle";
    g.fillText("DERMACON", 26, 100);
    g.font = `600 36px ${font}`;
    g.fillText("2027 \xB7 Gandhinagar", 28, 160);
  }, 1);
  T.brand.repeat.set(1 / 14, 1 / 7);
  const std = (o) => {
    const m = new THREE.MeshStandardMaterial(Object.assign({ vertexColors: true, roughness: 0.85, metalness: 0 }, o));
    disposables.push(m);
    return m;
  };
  const M = kit.M = {
    asphalt: std({ map: T.asphalt, roughness: 0.95 }),
    concrete: std({ map: T.concrete, roughness: 0.55, envMapIntensity: 0.5 }),
    paver: std({ map: T.paver, roughness: 0.9 }),
    grass: std({ map: T.grass, roughness: 1 }),
    carpetBlue: std({ map: T.carpetBlue, roughness: 1 }),
    carpetGrey: std({ map: T.carpetGrey, roughness: 1 }),
    carpetPlum: std({ map: T.carpetPlum, roughness: 1 }),
    carpetTeal: std({ map: T.carpetTeal, roughness: 1 }),
    carpetRed: std({ map: T.carpetRed, roughness: 1 }),
    clad: std({ map: T.clad, roughness: 0.6, metalness: 0.15 }),
    roof: std({ map: T.roof, roughness: 0.6, metalness: 0.05, side: THREE.DoubleSide }),
    panel: std({ map: T.panel, roughness: 0.8 }),
    acoustic: std({ map: T.acoustic, roughness: 0.95 }),
    wood: std({ map: T.wood, roughness: 0.55 }),
    brand: std({ map: T.brand, roughness: 0.7 }),
    matte: std({ roughness: 0.9 }),
    // vertex-coloured generic
    satin: std({ roughness: 0.45, envMapIntensity: 0.8 }),
    metal: std({ roughness: 0.3, metalness: 0.9 }),
    glass: std({ roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.35, color: 10474470, vertexColors: false }),
    glow: new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }),
    foliage: std({ roughness: 1, flatShading: true })
  };
  disposables.push(M.glow);
  const UNIT = {
    box: unitArrays(new THREE.BoxGeometry(1, 1, 1)),
    cyl: {},
    sphere: unitArrays(new THREE.IcosahedronGeometry(1, 1)),
    dome: unitArrays(new THREE.SphereGeometry(1, 40, 12, 0, Math.PI * 2, 0, Math.PI / 2)),
    prism: (() => {
      const g = new THREE.BufferGeometry();
      const A = [-0.5, 0, -0.5], B = [-0.5, 0, 0.5], C = [-0.5, 1, 0], D = [0.5, 0, -0.5], E = [0.5, 0, 0.5], F = [0.5, 1, 0];
      const tris = [A, B, C, D, F, E, A, C, F, A, F, D, B, E, F, B, F, C, A, D, E, A, E, B];
      g.setAttribute("position", new THREE.Float32BufferAttribute(tris.flat(), 3));
      g.computeVertexNormals();
      return unitArrays(g);
    })()
  };
  const cylUnit = (seg, rTop = 1) => {
    const k = seg + "_" + rTop;
    return UNIT.cyl[k] || (UNIT.cyl[k] = unitArrays(new THREE.CylinderGeometry(rTop, 1, 1, seg)));
  };
  const WHITE = [1, 1, 1];
  const colCache = {};
  const col = (c) => {
    if (!c) return WHITE;
    if (Array.isArray(c)) return c;
    return colCache[c] || (colCache[c] = (() => {
      const k = new THREE.Color(c);
      return [k.r, k.g, k.b];
    })());
  };
  kit.col = col;
  class Batch {
    constructor() {
      this.map = /* @__PURE__ */ new Map();
    }
    add(key, unit, m, color) {
      let b = this.map.get(key);
      if (!b) {
        b = { p: [], n: [], u: [], c: [] };
        this.map.set(key, b);
      }
      const e = m.elements, P2 = unit.p, N = unit.n, c = col(color);
      nm.getNormalMatrix(m);
      const ne = nm.elements;
      for (let i = 0; i < P2.length; i += 3) {
        const x = P2[i], y = P2[i + 1], z = P2[i + 2];
        const wx = e[0] * x + e[4] * y + e[8] * z + e[12], wy = e[1] * x + e[5] * y + e[9] * z + e[13], wz = e[2] * x + e[6] * y + e[10] * z + e[14];
        let nx = N[i], ny = N[i + 1], nz = N[i + 2];
        let ax = ne[0] * nx + ne[3] * ny + ne[6] * nz, ay = ne[1] * nx + ne[4] * ny + ne[7] * nz, az = ne[2] * nx + ne[5] * ny + ne[8] * nz;
        const l = Math.hypot(ax, ay, az) || 1;
        ax /= l;
        ay /= l;
        az /= l;
        b.p.push(wx, wy, wz);
        b.n.push(ax, ay, az);
        b.c.push(c[0], c[1], c[2]);
        const X = Math.abs(ax), Y = Math.abs(ay), Z = Math.abs(az);
        if (Y >= X && Y >= Z) b.u.push(wx, wz);
        else if (X > Z) b.u.push(wz, wy);
        else b.u.push(wx, wy);
      }
    }
    build(parent, { cast = true, receive = true, name = "" } = {}) {
      const out = [];
      for (const [key, b] of this.map) {
        const g = new THREE.BufferGeometry();
        g.setAttribute("position", new THREE.Float32BufferAttribute(b.p, 3));
        g.setAttribute("normal", new THREE.Float32BufferAttribute(b.n, 3));
        g.setAttribute("uv", new THREE.Float32BufferAttribute(b.u, 2));
        g.setAttribute("color", new THREE.Float32BufferAttribute(b.c, 3));
        g.computeBoundingSphere();
        disposables.push(g);
        const mesh = new THREE.Mesh(g, M[key]);
        mesh.name = name + ":" + key;
        const noShadow = key === "glass" || key === "glow";
        mesh.castShadow = cast && !noShadow && key !== "grass" && key !== "asphalt" && !key.startsWith("carpet");
        mesh.receiveShadow = receive && key !== "glow";
        if (key === "glass") mesh.renderOrder = 5;
        parent.add(mesh);
        out.push(mesh);
      }
      this.map.clear();
      return out;
    }
  }
  const nm = new THREE.Matrix3();
  kit.Batch = Batch;
  kit.batch = new Batch();
  kit.setBatch = (b) => {
    const old = kit.batch;
    kit.batch = b;
    return old;
  };
  let CUR = new THREE.Matrix4();
  const stack = [];
  const tmp = new THREE.Matrix4(), tmp2 = new THREE.Matrix4(), q = new THREE.Quaternion(), v3 = new THREE.Vector3(), s3 = new THREE.Vector3(), YAX = new THREE.Vector3(0, 1, 0);
  kit.push = (x, z, rot = 0, y = 0) => {
    stack.push(CUR.clone());
    tmp.makeRotationY(rot).setPosition(x, y, z);
    CUR = CUR.clone().multiply(tmp);
  };
  kit.pop = () => {
    CUR = stack.pop();
  };
  kit.world = (x, z, y = 0) => {
    v3.set(x, y, z).applyMatrix4(CUR);
    return [v3.x, v3.z, v3.y];
  };
  kit.worldRot = () => {
    const e = CUR.elements;
    return Math.atan2(e[8], e[0]);
  };
  const worldRect = (x0, z0, x1, z1) => {
    const a = kit.world(x0, z0), b = kit.world(x1, z1);
    return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])];
  };
  kit.worldRect = worldRect;
  const box = kit.box = (mat, x0, y0, z0, x1, y1, z1, color) => {
    tmp.makeScale(Math.abs(x1 - x0) || 1e-3, Math.abs(y1 - y0) || 1e-3, Math.abs(z1 - z0) || 1e-3).setPosition((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    kit.batch.add(mat, UNIT.box, tmp2.multiplyMatrices(CUR, tmp), color);
  };
  kit.boxc = (mat, cx, cy, cz, w, h, d, rot = 0, color, tiltX = 0, tiltZ = 0) => {
    q.setFromEuler(new THREE.Euler(tiltX, rot, tiltZ, "YXZ"));
    tmp.compose(v3.set(cx, cy, cz), q, s3.set(w, h, d));
    kit.batch.add(mat, UNIT.box, tmp2.multiplyMatrices(CUR, tmp), color);
  };
  kit.cyl = (mat, cx, y0, cz, r, h, color, seg = 16, rTop = 1) => {
    tmp.makeScale(r, h, r).setPosition(cx, y0 + h / 2, cz);
    kit.batch.add(mat, cylUnit(seg, rTop), tmp2.multiplyMatrices(CUR, tmp), color);
  };
  kit.sphere = (mat, cx, cy, cz, rx, ry, rz, color) => {
    tmp.makeScale(rx, ry, rz).setPosition(cx, cy, cz);
    kit.batch.add(mat, UNIT.sphere, tmp2.multiplyMatrices(CUR, tmp), color);
  };
  kit.dome = (mat, cx, y0, cz, r, h, color) => {
    tmp.makeScale(r, h, r).setPosition(cx, y0, cz);
    kit.batch.add(mat, UNIT.dome, tmp2.multiplyMatrices(CUR, tmp), color);
  };
  kit.prism = (mat, cx, y0, cz, len, h, span, rot = 0, color) => {
    q.setFromAxisAngle(YAX, rot);
    tmp.compose(v3.set(cx, y0, cz), q, s3.set(len, h, span));
    kit.batch.add(mat, UNIT.prism, tmp2.multiplyMatrices(CUR, tmp), color);
  };
  kit.solid = (x0, z0, x1, z1) => kit.colliders.push(worldRect(x0, z0, x1, z1));
  kit.navBlock = (x0, z0, x1, z1) => kit.navBlocks.push(worldRect(x0, z0, x1, z1));
  kit.cost = (x0, z0, x1, z1, c) => kit.costRects.push([...worldRect(x0, z0, x1, z1), c]);
  kit.zone = (name, x0, z0, x1, z1, extra) => kit.zones.push(Object.assign({ name, r: worldRect(x0, z0, x1, z1) }, extra));
  kit.room = (id, x0, z0, x1, z1, ax, az, lx, lz) => {
    const r = worldRect(x0, z0, x1, z1), a = kit.world(ax, az), l = kit.world(lx === void 0 ? (x0 + x1) / 2 : lx, lz === void 0 ? (z0 + z1) / 2 : lz);
    kit.rooms[id] = { rect: r, arrive: [a[0], a[1]], look: [l[0], l[1]], center: [(r[0] + r[2]) / 2, (r[1] + r[3]) / 2] };
    kit.zones.push({ name: id, r, room: id });
  };
  kit.wall = (mat, ax, az, bx, bz, h, t = 0.2, openings = [], color, y0 = 0) => {
    const alongX = Math.abs(bx - ax) >= Math.abs(bz - az);
    let a = alongX ? Math.min(ax, bx) : Math.min(az, bz), b = alongX ? Math.max(ax, bx) : Math.max(az, bz);
    const fixed = alongX ? az : ax;
    const ops = openings.slice().sort((p, r) => p.c - r.c);
    const seg = (s, e, yA, yB, solid) => {
      if (e - s < 0.01) return;
      if (alongX) {
        box(mat, s, yA, fixed - t / 2, e, yB, fixed + t / 2, color);
        if (solid) kit.solid(s, fixed - t / 2, e, fixed + t / 2);
      } else {
        box(mat, fixed - t / 2, yA, s, fixed + t / 2, yB, e, color);
        if (solid) kit.solid(fixed - t / 2, s, fixed + t / 2, e);
      }
    };
    let cur = a;
    for (const o of ops) {
      const s = o.c - o.w / 2, e = o.c + o.w / 2;
      seg(cur, s, y0, h, true);
      const dh = o.h || 2.5;
      if (dh < h) seg(s, e, dh, h, false);
      cur = e;
    }
    seg(cur, b, y0, h, true);
  };
  function fitText(g, text, maxW, size, weight) {
    let s = size;
    do {
      g.font = `${weight} ${s}px ${font}`;
      if (g.measureText(text).width <= maxW) break;
      s -= 2;
    } while (s > 10);
    return s;
  }
  kit.sign = (text, x, y, z, face, w, h, o = {}) => {
    const px = Math.min(1024, Math.max(128, Math.round(w * (o.ppm || 90)))), py = Math.max(48, Math.round(px * h / w));
    const c = document.createElement("canvas");
    c.width = px;
    c.height = py;
    const g = c.getContext("2d");
    if (o.gradient) {
      const gr = g.createLinearGradient(0, 0, px, py);
      o.gradient.forEach((cc, i) => gr.addColorStop(i / (o.gradient.length - 1), cc));
      g.fillStyle = gr;
    } else g.fillStyle = o.bg || "#1b1730";
    g.fillRect(0, 0, px, py);
    if (o.border) {
      g.strokeStyle = o.border;
      g.lineWidth = Math.max(3, py * 0.05);
      g.strokeRect(g.lineWidth / 2, g.lineWidth / 2, px - g.lineWidth, py - g.lineWidth);
    }
    g.fillStyle = o.fg || "#fff";
    g.textAlign = "center";
    g.textBaseline = "middle";
    const pad = px * 0.06;
    if (o.top) {
      fitText(g, o.top, px - pad * 2, py * 0.16, 600);
      g.globalAlpha = 0.85;
      g.fillText(o.top, px / 2, py * 0.16);
      g.globalAlpha = 1;
    }
    if (o.sub) {
      fitText(g, text, px - pad * 2, py * (o.top ? 0.4 : 0.46), 800);
      g.fillText(text, px / 2, py * (o.top ? 0.47 : 0.38));
      g.fillStyle = o.subFg || o.fg || "#fff";
      fitText(g, o.sub, px - pad * 2, py * 0.2, 500);
      g.globalAlpha = 0.9;
      g.fillText(o.sub, px / 2, py * (o.top ? 0.8 : 0.76));
      g.globalAlpha = 1;
    } else {
      fitText(g, text, px - pad * 2, py * (o.top ? 0.5 : 0.62), 800);
      g.fillText(text, px / 2, py * (o.top ? 0.6 : 0.53));
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = maxAniso;
    disposables.push(t);
    const mat = o.glow ? new THREE.MeshBasicMaterial({ map: t, toneMapped: false }) : new THREE.MeshStandardMaterial({ map: t, roughness: 0.6, emissive: 16777215, emissiveMap: t, emissiveIntensity: o.emissive === void 0 ? 0.25 : o.emissive });
    if (o.double) mat.side = THREE.DoubleSide;
    const geo = new THREE.PlaneGeometry(w, h);
    disposables.push(mat, geo);
    const mesh = new THREE.Mesh(geo, mat);
    const wp = kit.world(x, z, y);
    mesh.position.set(wp[0], wp[2], wp[1]);
    const ang = typeof face === "number" ? face : DIR[face];
    mesh.rotation.y = ang + kit.worldRot() + Math.PI / 2;
    mesh.userData.roofOnly = !!o.roofOnly;
    kit.signs.push(mesh);
    if (o.both) {
      const m2 = new THREE.Mesh(geo, mat);
      m2.position.copy(mesh.position);
      m2.rotation.y = mesh.rotation.y + Math.PI;
      kit.signs.push(m2);
    }
    return mesh;
  };
  let chairList = null;
  kit.beginChairs = () => {
    chairList = [];
  };
  kit.chair = (x, z, rot = 0, y = 0) => {
    const w = kit.world(x, z, y);
    chairList.push(w[0], w[1], rot + kit.worldRot(), w[2]);
  };
  kit.endChairs = (name, color = "#8c2332") => {
    if (chairList && chairList.length) kit.chairs.push({ name, list: chairList, color });
    chairList = null;
  };
  kit.chairGeometry = (cushion = "#8c2332") => {
    const b = new Batch(), old = kit.setBatch(b), saved = CUR;
    CUR = new THREE.Matrix4();
    const frame = "#2b2d33";
    box("matte", -0.22, 0.4, -0.23, 0.22, 0.47, 0.23, cushion);
    box("matte", -0.25, 0.47, -0.23, -0.19, 0.92, 0.23, cushion);
    if (!lowQuality) {
      box("matte", -0.23, 0, -0.22, -0.19, 0.4, -0.18, frame);
      box("matte", -0.23, 0, 0.18, -0.19, 0.4, 0.22, frame);
      box("matte", 0.18, 0, -0.22, 0.22, 0.4, -0.18, frame);
      box("matte", 0.18, 0, 0.18, 0.22, 0.4, 0.22, frame);
    } else box("matte", -0.2, 0, -0.2, 0.2, 0.4, 0.2, frame);
    const d = b.map.get("matte");
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(d.p, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(d.n, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(d.c, 3));
    kit.setBatch(old);
    CUR = saved;
    disposables.push(g);
    return g;
  };
  kit.personGeometry = (shirt, { skin = "#c68a62", hair = "#1d1b1a", pants = "#2d3142", headphones = false } = {}) => {
    const b = new Batch(), old = kit.setBatch(b), saved = CUR;
    CUR = new THREE.Matrix4();
    const HP = "#ffffff", HPD = "#e6e6ea";
    box("matte", -0.2, 0.47, -0.17, 0.07, 0.9, 0.17, shirt);
    box("matte", -0.15, 0.84, -0.2, 0.03, 0.97, 0.2, shirt);
    box("matte", -0.06, 0.47, -0.16, 0.42, 0.57, 0.16, pants);
    box("matte", 0.36, 0.05, -0.15, 0.45, 0.57, 0.15, pants);
    box("matte", 0.34, 0, -0.16, 0.5, 0.05, 0.16, "#1d1d22");
    box("matte", -0.04, 0.7, -0.25, 0.04, 0.93, -0.19, shirt);
    box("matte", -0.04, 0.7, 0.19, 0.04, 0.93, 0.25, shirt);
    box("matte", 0, 0.6, -0.22, 0.3, 0.66, -0.15, shirt);
    box("matte", 0, 0.6, 0.15, 0.3, 0.66, 0.22, shirt);
    box("matte", 0.26, 0.6, -0.2, 0.32, 0.65, -0.14, skin);
    box("matte", 0.26, 0.6, 0.14, 0.32, 0.65, 0.2, skin);
    kit.cyl("matte", -0.03, 0.95, 0, 0.05, 0.12, skin, 10);
    kit.sphere("matte", -0.02, 1.12, 0, 0.1, 0.12, 0.1, skin);
    kit.sphere("matte", -0.035, 1.18, 0, 0.105, 0.075, 0.115, hair);
    kit.sphere("matte", -0.09, 1.1, 0, 0.05, 0.09, 0.09, hair);
    if (headphones) {
      box("matte", -0.03, 1.265, -0.12, 0.03, 1.285, 0.12, HP);
      box("matte", -0.02, 1.14, -0.125, 0.02, 1.27, -0.115, HP);
      box("matte", -0.02, 1.14, 0.115, 0.02, 1.27, 0.125, HP);
      box("matte", -0.075, 1.11, -0.155, -0.01, 1.19, -0.115, HP);
      box("matte", -0.075, 1.11, 0.115, -0.01, 1.19, 0.155, HP);
    }
    const d = b.map.get("matte");
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(d.p, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(d.n, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(d.c, 3));
    kit.setBatch(old);
    CUR = saved;
    disposables.push(g);
    return g;
  };
  // Road vehicles, built along +x (front at +x), wheels resting on y = 0.
  kit.vehicleGeometry = (kind, color) => {
    const b = new Batch(), old = kit.setBatch(b), saved = CUR;
    CUR = new THREE.Matrix4();
    const tyre = "#151518", glass = "#26313e", lamp = "#fff1c2", tail = "#c0262e";
    const wheels = (xs, hw, r, w) => xs.forEach((x) => [-1, 1].forEach((s) => box("matte", x - r, 0, s * hw - w / 2, x + r, r * 2, s * hw + w / 2, tyre)));
    if (kind === "bus") {
      box("matte", -5.6, 0.45, -1.25, 5.6, 3.1, 1.25, color);
      box("matte", -5.62, 0.45, -1.27, 5.62, 0.8, 1.27, "#f2f2f2");
      box("matte", -5.3, 1.7, -1.27, 5.2, 2.6, 1.27, glass);
      box("matte", 5.45, 1.25, -1.1, 5.63, 2.75, 1.1, glass);
      box("matte", -5.6, 3.1, -1.15, 5.6, 3.25, 1.15, "#e8e8e8");
      [-1, 1].forEach((s) => {
        box("matte", 5.6, 0.85, s * 0.95 - 0.18, 5.66, 1.1, s * 0.95 + 0.18, lamp);
        box("matte", -5.66, 0.85, s * 0.95 - 0.18, -5.6, 1.1, s * 0.95 + 0.18, tail);
      });
      wheels([-3.7, 3.5], 1.1, 0.5, 0.32);
    } else if (kind === "auto") {
      box("matte", -1.25, 0.28, -0.66, 1.15, 0.95, 0.66, color);
      box("matte", 0.9, 0.95, -0.6, 1.05, 1.6, 0.6, glass);
      box("matte", -1.25, 0.95, -0.66, -1.1, 1.65, 0.66, color);
      box("matte", -1.3, 1.62, -0.72, 1.1, 1.82, 0.72, "#f2c230");
      [-1, 1].forEach((s) => box("matte", 0.85, 0.95, s * 0.6 - 0.04, 0.93, 1.62, s * 0.6 + 0.04, "#222"));
      box("matte", 1.15, 0.6, -0.12, 1.2, 0.8, 0.12, lamp);
      box("matte", 0.75, 0, -0.08, 1.2, 0.5, 0.08, tyre);
      box("matte", -1.05, 0, -0.68, -0.55, 0.5, -0.5, tyre);
      box("matte", -1.05, 0, 0.5, -0.55, 0.5, 0.68, tyre);
    } else {
      box("matte", -2.1, 0.3, -0.86, 2.1, 0.95, 0.86, color);
      box("matte", -1.25, 0.95, -0.76, 0.75, 1.42, 0.76, glass);
      box("matte", -1.15, 1.42, -0.72, 0.62, 1.5, 0.72, color);
      [-1, 1].forEach((s) => {
        box("matte", 2.1, 0.62, s * 0.62 - 0.15, 2.14, 0.8, s * 0.62 + 0.15, lamp);
        box("matte", -2.14, 0.62, s * 0.62 - 0.15, -2.1, 0.8, s * 0.62 + 0.15, tail);
      });
      wheels([-1.35, 1.35], 0.78, 0.33, 0.24);
    }
    const d = b.map.get("matte");
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(d.p, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(d.n, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(d.c, 3));
    kit.setBatch(old);
    CUR = saved;
    disposables.push(g);
    return g;
  };
  kit.seats = ({ x0, z0, x1, z1, face, rowGroups, seatGroups, aisle = 1.6, target, pitch = 1, sw = 0.56 }) => {
    const rows = rowGroups.reduce((a, b) => a + b, 0), per = seatGroups.reduce((a, b) => a + b, 0);
    const ew = face === "E" || face === "W";
    const depth = ew ? x1 - x0 : z1 - z0, lat = ew ? z1 - z0 : x1 - x0;
    const rp = Math.min(pitch, (depth - (rowGroups.length - 1) * aisle) / rows), sp = Math.min(sw, (lat - (seatGroups.length - 1) * aisle) / per);
    const usedD = rows * rp + (rowGroups.length - 1) * aisle, usedL = per * sp + (seatGroups.length - 1) * aisle;
    const dPos = [], lPos = [];
    let p = (depth - usedD) / 2 + rp / 2;
    rowGroups.forEach((n) => {
      for (let i = 0; i < n; i++) {
        dPos.push(p);
        p += rp;
      }
      p += aisle;
    });
    p = (lat - usedL) / 2 + sp / 2;
    seatGroups.forEach((n) => {
      for (let i = 0; i < n; i++) {
        lPos.push(p);
        p += sp;
      }
      p += aisle;
    });
    let drop = target ? rows * per - target : 0;
    if (drop < 0) {
      console.warn("seat block short of target by", -drop);
      drop = 0;
    }
    const rot = DIR[face];
    for (let r = 0; r < rows; r++) {
      const d = dPos[r];
      let from = 0, to = per;
      if (r === rows - 1 && drop > 0) {
        from = Math.floor(drop / 2);
        to = per - Math.ceil(drop / 2);
      }
      for (let s = from; s < to; s++) {
        const l = lPos[s];
        let x, z;
        if (face === "E") {
          x = x1 - d;
          z = z0 + l;
        } else if (face === "W") {
          x = x0 + d;
          z = z0 + l;
        } else if (face === "S") {
          z = z1 - d;
          x = x0 + l;
        } else {
          z = z0 + d;
          x = x0 + l;
        }
        kit.chair(x, z, rot);
      }
    }
    kit.navBlock(x0, z0, x1, z1);
    return rows * per - drop;
  };
  kit.stage = (x, z, audience, { w, d, h, ledW, ledH, title, sub, panel = 8, backH = 4.2, wing = 1.2 }) => {
    kit.push(x, z, DIR[audience]);
    box("matte", 0, 0, -w / 2, d, h - 0.06, w / 2, "#17171c");
    box("wood", 0, h - 0.06, -w / 2, d, h, w / 2);
    box("matte", -0.25, 0, -w / 2 - wing, 0, backH, w / 2 + wing, "#221d3a");
    box("matte", -0.02, h + 0.5, -ledW / 2 - 0.12, 0.04, h + 0.5 + ledH + 0.24, ledW / 2 + 0.12, "#0b0b0e");
    kit.sign(title, 0.08, h + 0.62 + ledH / 2, 0, "E", ledW, ledH, { glow: true, gradient: ["#3a1456", "#a3195b", "#1f7fa6"], top: "DERMACON 2027 \xB7 55th National Conference of IADVL", sub, ppm: 110 });
    [-1, 1].forEach((s) => {
      box("matte", 0.3, h, s * (w / 2 - 0.9) - 0.3, 0.9, h + 1.15, s * (w / 2 - 0.9) + 0.3, "#3d2230");
      box("wood", 0.25, h + 1.15, s * (w / 2 - 0.9) - 0.35, 0.95, h + 1.2, s * (w / 2 - 0.9) + 0.35);
    });
    const tl = Math.min(w - 4.5, panel * 0.75);
    if (panel) box("matte", d * 0.42, h, -tl / 2, d * 0.42 + 0.7, h + 0.74, tl / 2, "#f4f1ea");
    for (let i = 0; i < panel; i++) kit.chair(d * 0.42 - 0.45, -tl / 2 + (i + 0.5) * tl / panel, 0, h);
    [-1, 1].forEach((s) => {
      for (let k = 0; k < 3; k++) box("matte", d - 1.4, 0, s * (w / 2 + 0.01 + k * 0.3), d - 0.2, h * (3 - k) / 4, s * (w / 2 + 0.31 + k * 0.3), "#2a2a31");
    });
    [-1, 1].forEach((s) => {
      box("matte", d - 0.5, h, s * (w / 2 - 0.4) - 0.25, d - 0.1, h + 1.1, s * (w / 2 - 0.4) + 0.25, "#111114");
    });
    kit.solid(-0.25, -w / 2 - 0.3, d, w / 2 + 0.3);
    kit.navBlock(-0.3, -w / 2 - 1.5, d + 0.3, w / 2 + 1.5);
    kit.pop();
  };
  kit.roundTable = (x, z, r = 0.9, n = 6, cloth = "#f6f3ee") => {
    kit.cyl("matte", x, 0, z, r * 0.98, 0.72, cloth, 20, 1);
    kit.cyl("matte", x, 0.72, z, r, 0.03, cloth, 20);
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2 + 0.3;
      kit.chair(x + Math.cos(a) * (r + 0.42), z + Math.sin(a) * (r + 0.42), Math.PI - a + Math.PI * 2);
    }
    kit.navBlock(x - r - 0.8, z - r - 0.8, x + r + 0.8, z + r + 0.8);
  };
  kit.teaLounge = (x, z, r = 2.2) => {
    kit.cyl("wood", x, 0, z, r, 1.05, "#fff", 28);
    kit.cyl("matte", x, 1.05, z, r + 0.08, 0.06, "#3b2415", 28);
    kit.cyl("matte", x, 1.11, z, r - 0.7, 0.5, "#5a3418", 24);
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * Math.PI * 2;
      kit.cyl("metal", x + Math.cos(a) * (r - 0.45), 1.11, z + Math.sin(a) * (r - 0.45), 0.17, 0.5, "#d8d8dc", 12);
      kit.cyl("matte", x + Math.cos(a + 0.35) * (r - 0.35), 1.11, z + Math.sin(a + 0.35) * (r - 0.35), 0.22, 0.12, "#ffffff", 10);
    }
    kit.cyl("metal", x, 1.6, z, 0.08, 1.5, "#888", 8);
    kit.cyl("matte", x, 3, z, r * 0.78, 0.7, "#5a3418", 28);
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2;
      kit.sign("TEA \xB7 COFFEE", x + Math.cos(a) * (r * 0.78 + 0.02), 3.35, z - Math.sin(a) * (r * 0.78 + 0.02), a, r * 1.05, 0.5, { bg: "#5a3418", fg: "#ffe9c9", emissive: 0.5 });
    }
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2 + 0.78, d = r + 2.1;
      kit.cyl("metal", x + Math.cos(a) * d, 0, z + Math.sin(a) * d, 0.04, 1.05, "#aaa", 8);
      kit.cyl("matte", x + Math.cos(a) * d, 1.05, z + Math.sin(a) * d, 0.38, 0.04, "#f4f1ea", 16);
      kit.cyl("metal", x + Math.cos(a) * d, 0, z + Math.sin(a) * d, 0.25, 0.03, "#999", 12);
    }
    kit.solid(x - r * 0.8, z - r * 0.8, x + r * 0.8, z + r * 0.8);
    kit.navBlock(x - r - 0.4, z - r - 0.4, x + r + 0.4, z + r + 0.4);
  };
  kit.sofa = (x, z, rot, len = 1.9, color = "#3f5f7a") => {
    kit.push(x, z, rot);
    box("matte", -0.42, 0.12, -len / 2, 0.42, 0.42, len / 2, color);
    box("matte", -0.5, 0.12, -len / 2, -0.3, 0.82, len / 2, color);
    box("matte", -0.5, 0.12, -len / 2 - 0.16, 0.42, 0.6, -len / 2, color);
    box("matte", -0.5, 0.12, len / 2, 0.42, 0.6, len / 2 + 0.16, color);
    box("matte", -0.42, 0, -len / 2, 0.42, 0.12, len / 2, "#1d1d22");
    kit.navBlock(-0.6, -len / 2 - 0.2, 0.5, len / 2 + 0.2);
    kit.pop();
  };
  kit.plant = (x, z, s = 1) => {
    kit.cyl("matte", x, 0, z, 0.28 * s, 0.5 * s, "#e8e4dc", 12, 0.8);
    kit.sphere("foliage", x, 1.15 * s, z, 0.55 * s, 0.8 * s, 0.55 * s, "#3f7d3a");
    kit.sphere("foliage", x + 0.15, 1.6 * s, z - 0.1, 0.35 * s, 0.5 * s, 0.35 * s, "#4f9447");
  };
  kit.dispose = () => {
    disposables.forEach((d) => d.dispose && d.dispose());
    kit.signs.forEach((s) => {
      s.material.map && s.material.map.dispose();
      s.material.dispose();
      s.geometry.dispose();
    });
  };
  return kit;
}

// src/data.js
var P = (px, py) => [(px * 5 - 4500) / 11.75, (py * 5 - 4200) / 11.75];
var R = (x0, y0, x1, y1) => {
  const a = P(x0, y0), b = P(x1, y1);
  return [a[0], a[1], b[0], b[1]];
};
var PARKING = [[-102, 278, 19, 332], [56, 210, 176, 240], [60, 252, 185, 312]];
var PARK_WALK = [[158, 204], [148, 162]];
var GEO0 = [23.224313, 72.651995];
var SITE = { minX: -300, maxX: 292, minZ: -212, maxZ: 205 };
// Public roads around the venue, matched to Google Maps (Sector 17, Gandhinagar).
// The model is drawn square to the hall grid, so these sit about 25 degrees off true north:
// Exhibition Centre Road runs along the north side, Mahatma Gandhi Path along the south (parking side),
// Gh Road on the west (Town Hall side) and Ch Road on the east (Jilla Panchayat side).
// axis: direction the road runs; c: centre line; from/to: extent; lanes per direction; median width (m). Traffic keeps left.
var LANE = 3.5;
var FOOT = 4;
var OUTER_ROADS = [
  { id: "mg", name: "Mahatma Gandhi Path", axis: "x", c: 346, from: -430, to: 450, lanes: 2, median: 3, gaps: [-110, 38, 200], label: 60 },
  { id: "ec", name: "Exhibition Centre Road", axis: "x", c: -262, from: -430, to: 450, lanes: 2, median: 2, gaps: [], label: 0 },
  { id: "gh", name: "Gh Road", axis: "z", c: -364, from: -340, to: 440, lanes: 2, median: 3, gaps: [], label: 40 },
  { id: "ch", name: "Ch Road", axis: "z", c: 352, from: -340, to: 440, lanes: 2, median: 3, gaps: [], label: 40 }
];
OUTER_ROADS.forEach((r) => r.hw = r.median / 2 + r.lanes * LANE);
var BUILDINGS = [
  {
    id: "h1",
    hec: "Hall 1",
    title: "A",
    cx: 83.2,
    cz: 82.3,
    W: 88,
    D: 58,
    eave: 6,
    ridge: 9,
    main: ["W"],
    interior: "hallA",
    fascia: ["A", "Silent hall"]
  },
  {
    id: "h10",
    hec: "Hall 10",
    title: "B",
    cx: 83.2,
    cz: 0.05,
    W: 88,
    D: 58,
    eave: 6,
    ridge: 9,
    main: ["W"],
    interior: "hallB",
    fascia: ["B", "Silent halls \xB7 EC & IADVL"]
  },
  {
    id: "h9",
    hec: "Hall 9",
    title: "C",
    cx: 83.2,
    cz: -82.4,
    W: 88,
    D: 58,
    eave: 6,
    ridge: 9,
    main: ["W"],
    interior: "hallC",
    fascia: ["C", "Silent halls \xB7 SIG / Sister 1–3"]
  },
  {
    id: "h7",
    hec: "Hall 7",
    title: "F \xB7 DINING",
    cx: -57.3,
    cz: -82.15,
    W: 114,
    D: 58,
    eave: 6,
    ridge: 9,
    main: ["E", "W"],
    interior: "dining",
    fascia: ["F \xB7 DINING", "Lunch \xB7 Tea \xB7 Dinner"]
  },
  {
    id: "h8",
    hec: "Hall 8",
    title: "E \xB7 EXHIBITION 2",
    cx: -57.3,
    cz: 0.1,
    W: 114,
    D: 58,
    eave: 6,
    ridge: 9,
    main: ["E"],
    interior: "hallE",
    fascia: ["E", "E1 to E6 \xB7 Exhibition 2"]
  },
  {
    id: "h2",
    hec: "Hall 2",
    title: "D \xB7 EXHIBITION 1",
    cx: -57.3,
    cz: 82.3,
    W: 114,
    D: 58,
    eave: 6,
    ridge: 9,
    main: ["E"],
    interior: "expo1",
    fascia: ["D", "Exhibition 1"]
  },
  {
    id: "h5",
    hec: "Hall 5",
    title: "ENTERTAINMENT",
    cx: -202.2,
    cz: 46.65,
    W: 114,
    D: 70,
    eave: 18,
    ridge: 24,
    main: ["E"],
    interior: "entertainment",
    fascia: ["ENTERTAINMENT", "Gala evening"]
  },
  { id: "h6", hec: "Hall 6", title: "Hall 6", cx: -202.3, cz: -41.4, W: 114, D: 58, eave: 6, ridge: 9, main: [], interior: "empty" },
  { id: "h11", hec: "Hall 11", title: "Hall 11", cx: 192.7, cz: -105.9, W: 114, D: 58, eave: 6, ridge: 9, main: [], interior: "empty", rot: true },
  { id: "h12", hec: "Hall 12", title: "Hall 12", cx: 192.7, cz: 25.25, W: 88, D: 58, eave: 6, ridge: 9, main: [], interior: "empty", rot: true },
  {
    id: "h12a",
    hec: "Hall 12-A",
    title: "REGISTRATION",
    cx: 225.1,
    cz: 123.8,
    W: 74,
    D: 28,
    eave: 7.2,
    ridge: 9,
    main: ["W"],
    interior: "registration",
    fascia: ["REGISTRATION", "Badges \xB7 Kits \xB7 Help desk"]
  },
  { id: "h4", hec: "Hall 4", title: "Hall 4", cx: -231.9, cz: 137, W: 68, D: 31, eave: 6, ridge: 8, main: [], interior: "empty", rot: true }
];
var DOME = { id: "h3", hec: "Hall 3", title: "FOOD COURT \xB7 SPOUSE AREA", cx: -163, cz: 131.9, r: 27, h: 18 };
var ADMIN = { id: "admin", title: "ADMIN", rect: R(1125, 1157, 1195, 1203) };
var TUNNELS = [
  { x: -85.4, z0: 29.1, z1: 53.3 },
  { x: 86.8, z0: -53.4, z1: -29 },
  { x: 86.8, z0: 29, z1: 53.4 }
];
var ROOMS = [
  { id: "hall-a", name: "A", group: "Conference halls", building: "h1", seats: 2448, size: "63 \xD7 58 m", note: "Silent hall", aliases: ["hall a", "a", "plenary"] },
  { id: "hall-b", name: "B-1", group: "Conference halls", building: "h10", seats: 756, size: "45 \xD7 25 m", note: "Silent hall", aliases: ["hall b", "b", "hall b-1", "b-1", "b1"] },
  { id: "hall-b-2", name: "B-2", group: "Conference halls", building: "h10", seats: 260, size: "45 \xD7 16 m", note: "Silent hall", aliases: ["hall b-2", "b-2", "b2"] },
  { id: "hall-b-3", name: "B-3", group: "Conference halls", building: "h10", seats: 260, size: "45 \xD7 16 m", note: "Silent hall", aliases: ["hall b-3", "b-3", "b3"] },
  { id: "hall-c", name: "C-1", group: "Conference halls", building: "h9", seats: 756, size: "45 \xD7 25 m", note: "Silent hall", aliases: ["hall c", "c", "hall c-1", "c-1", "c1"] },
  { id: "hall-c-2", name: "C-2", group: "Conference halls", building: "h9", seats: 260, size: "45 \xD7 16 m", note: "Silent hall", aliases: ["hall c-2", "c-2", "c2"] },
  { id: "hall-c-3", name: "C-3", group: "Conference halls", building: "h9", seats: 260, size: "45 \xD7 16 m", note: "Silent hall", aliases: ["hall c-3", "c-3", "c3"] },
  { id: "e-poster", name: "E-POSTER", group: "Conference halls", building: "h9", size: "27 \xD7 16 m", note: "50 poster boards", aliases: ["e-poster", "poster area", "posters"] },
  { id: "international-hall", name: "INTERNATIONAL", group: "Silent halls", building: "h9", seats: 100, size: "16 \xD7 16 m", note: "Silent hall \xB7 Hall C-7", aliases: ["international hall", "c-7", "c7"] },
  { id: "sig-1", name: "SIG / SISTER 1", group: "Silent halls", building: "h9", seats: 103, size: "14 \xD7 21 m", note: "Silent hall \xB7 Hall C-6", aliases: ["sig hall 1", "sister hall 1", "sig/sister hall-1", "sig 1", "c-6", "c6"] },
  { id: "sig-2", name: "SIG / SISTER 2", group: "Silent halls", building: "h9", seats: 98, size: "15 \xD7 21 m", note: "Silent hall \xB7 Hall C-5", aliases: ["sig hall 2", "sister hall 2", "sig/sister hall-2", "sig 2", "c-5", "c5"] },
  { id: "sig-3", name: "SIG / SISTER 3", group: "Silent halls", building: "h9", seats: 101, size: "14 \xD7 21 m", note: "Silent hall \xB7 Hall C-4", aliases: ["sig hall 3", "sister hall 3", "sig/sister hall-3", "sig 3", "c-4", "c4"] },
  { id: "industries-1", name: "INDUSTRIES MEETING 1", group: "Silent halls", building: "h10", seats: 80, size: "14 \xD7 18 m", note: "Silent hall \xB7 Hall B-6", aliases: ["industries 1", "industries meeting hall 1", "b-6", "b6"] },
  { id: "industries-2", name: "INDUSTRIES MEETING 2", group: "Silent halls", building: "h10", seats: 80, size: "14 \xD7 18 m", note: "Silent hall \xB7 Hall B-5", aliases: ["industries 2", "industries meeting hall 2", "b-5", "b5"] },
  { id: "industries-3", name: "INDUSTRIES MEETING 3", group: "Silent halls", building: "h10", seats: 80, size: "14 \xD7 18 m", note: "Silent hall \xB7 Hall B-4", aliases: ["industries 3", "industries meeting hall 3", "b-4", "b4"] },
  { id: "ec-hall", name: "EC", group: "Silent halls", building: "h10", seats: 70, size: "9 \xD7 18 m", note: "Long round table \xB7 Hall B-8", aliases: ["ec hall", "eci", "eci hall", "b-8", "b8"] },
  { id: "iadvl-hall", name: "IADVL", group: "Silent halls", building: "h10", seats: 270, size: "34 \xD7 18 m", note: "Silent hall \xB7 14 round tables \xB7 Hall B-7", aliases: ["iadvl hall", "iadvl", "b-7", "b7"] },
  { id: "workshop-1", name: "E1", group: "Workshop halls", building: "h8", seats: 112, size: "17 \xD7 20 m", note: "Silent hall", aliases: ["workshop hall 1", "workshop 1", "ws 1", "e-1", "e1"] },
  { id: "workshop-2", name: "E2", group: "Workshop halls", building: "h8", seats: 112, size: "17 \xD7 20 m", note: "Silent hall", aliases: ["workshop hall 2", "workshop 2", "ws 2", "e-2", "e2"] },
  { id: "workshop-3", name: "E3", group: "Workshop halls", building: "h8", seats: 112, size: "17 \xD7 20 m", note: "Silent hall", aliases: ["workshop hall 3", "workshop 3", "ws 3", "e-3", "e3"] },
  { id: "workshop-4", name: "E4", group: "Workshop halls", building: "h8", seats: 112, size: "17 \xD7 20 m", note: "Silent hall", aliases: ["workshop hall 4", "workshop 4", "ws 4", "e-4", "e4"] },
  { id: "workshop-5", name: "E5", group: "Workshop halls", building: "h8", seats: 112, size: "17 \xD7 20 m", note: "Silent hall", aliases: ["workshop hall 5", "workshop 5", "ws 5", "e-5", "e5"] },
  { id: "workshop-6", name: "E6", group: "Workshop halls", building: "h8", seats: 112, size: "17 \xD7 20 m", note: "Silent hall", aliases: ["workshop hall 6", "workshop 6", "ws 6", "e-6", "e6"] },
  { id: "faculty-lounge", name: "FACULTY LOUNGE", group: "Faculty", building: "h1", size: "18 \xD7 18 m", note: "Tea & coffee \xB7 sofas", aliases: ["faculty lounge", "lounge"] },
  { id: "preview-room", name: "PREVIEW ROOM", group: "Faculty", building: "h1", size: "18 \xD7 18 m", note: "Slide check & upload", aliases: ["preview room", "speaker preview", "slide preview"] },
  { id: "registration", name: "REGISTRATION", group: "Services", building: "h12a", size: "37 \xD7 28 m (west half)", note: "Badges \xB7 help desk", aliases: ["registration", "registration hall", "hall 12a", "hall 12-a"] },
  { id: "kit-distribution", name: "KIT AREA", group: "Services", building: "h12a", size: "37 \xD7 28 m (east half)", note: "Conference kit \xB7 trolley bags", aliases: ["kit", "kit area", "kit distribution", "kit collection", "trolley", "trolley bag"] },
  { id: "organizing-office", name: "ADMIN", group: "Services", building: "admin", aliases: ["admin", "organizing committee office", "secretariat", "meeting room"] },
  { id: "dining", name: "DINING AREA", group: "Food", building: "h7", size: "114 \xD7 58 m", note: "46 round tables \xB7 5 buffet lines", aliases: ["dining area", "lunch", "dining"] },
  { id: "faculty-dining", name: "FACULTY DINING AREA", group: "Food", building: "h7", size: "65 \xD7 20 m", note: "Faculty dining", aliases: ["faculty dining", "faculty dining area"] },
  { id: "food-court", name: "FOOD COURT \xB7 SPOUSE AREA", group: "Food", building: "h3", size: "54 m dome", aliases: ["food court", "spouse area"] },
  { id: "expo-1", name: "EXHIBITION 1", group: "Exhibition", building: "h2", size: "114 \xD7 58 m", note: "D stalls", aliases: ["exhibition hall 1", "exhibition 1"] },
  { id: "expo-2", name: "EXHIBITION 2", group: "Exhibition", building: "h8", size: "114 \xD7 58 m", note: "E stalls", aliases: ["exhibition hall 2", "exhibition 2"] },
  { id: "entertainment", name: "ENTERTAINMENT", group: "Events", building: "h5", seats: 4368, size: "114 \xD7 70 m \xB7 18 m high", aliases: ["entertainment hall", "gala", "banquet"] }
];
var GATES = [
  { id: "gate-g9", name: "Gate G9", label: "G9", kind: "main", at: P(1245, 1203), face: "S" },
  { id: "gate-g8", name: "Gate G8", label: "G8", kind: "visitor", at: P(946, 1278), face: "S" },
  { id: "gate-g7", name: "Gate G7", label: "G7", kind: "visitor", at: P(599, 1278), face: "S" },
  { id: "gate-g6", name: "Gate G6", label: "G6", kind: "service", at: P(421, 1278), face: "S" },
  { id: "gate-g5", name: "Gate G5", label: "G5", kind: "service", at: P(298, 1278), face: "S" },
  { id: "gate-g4", name: "Gate G4", label: "G4", kind: "service", at: P(265, 550), face: "N" },
  { id: "gate-g3", name: "Gate G3", label: "G3", kind: "service", at: P(597, 512), face: "N" },
  { id: "gate-g2", name: "Gate G2", label: "G2", kind: "service", at: P(948, 470), face: "N" },
  { id: "gate-g1", name: "Gate G1", label: "G1", kind: "service", at: P(1245, 390), face: "N" },
  { id: "gate-g14", name: "Gate G14", label: "G14", kind: "service", at: P(1545, 416), face: "E" }
];
var CARPETS = [
  [6.5, -112, 21, 123],
  // spine between Halls 7/8/2 and 9/10/1
  [21, 117.5, 152, 123],
  // south run towards registration
  [146, 121.5, 183, 127],
  [180.5, 108, 187.5, 139.5],
  // apron in front of Hall 12-A
  [2, -88, 6.5, -76.3],
  [21, -88, 39, -76.8],
  // Hall 7 / Hall 9 entries
  [2, -5.6, 6.5, 5.8],
  [21, -5.6, 39, 5.7],
  // Hall 8 / Hall 10 entries
  [2, 76.6, 6.5, 88],
  [21, 76.6, 39, 88],
  // Hall 2 / Hall 1 entries
  [-128.5, -45, -123, 86],
  // west carpet (Entertainment Hall side)
  [-123, -5.6, -116, 5.8],
  [-123, 76.6, -116, 88],
  [-143, 40.5, -128.5, 52.8]
];
var LAWNS = [
  R(617, 502, 928, 538),
  R(968, 442, 1228, 538),
  R(277, 548, 578, 636),
  R(45, 552, 252, 1045),
  R(1462, 432, 1583, 778),
  R(1462, 795, 1583, 905),
  R(622, 1150, 928, 1280),
  R(968, 1150, 1052, 1288),
  R(266, 1078, 298, 1284)
];
var WASHROOMS = [[818, 520], [1160, 520], [497, 612], [232, 655], [232, 762], [232, 868], [1483, 548], [1483, 705], [1540, 1023], [1560, 1085], [283, 1095], [735, 1157], [1090, 1153]].map((p) => P(p[0], p[1]));
var FOOD_COURTS = [[500, 573], [1130, 478], [1490, 845], [548, 1258]].map((p) => P(p[0], p[1]));
var REG_COUNTERS = [[552, 525], [908, 483], [1195, 410], [458, 1265], [858, 1265], [1290, 1195]].map((p) => P(p[0], p[1]));
var FIRST_AID = [[232, 572], [1294, 1168]].map((p) => P(p[0], p[1]));
var FIRE_STATION = P(1492, 455);
var SCULPTURES = [[600, 742], [945, 742], [1245, 742], [600, 933], [945, 933], [1245, 933], [945, 1137], [1245, 1137]].map((p) => P(p[0], p[1]));
var EX1 = { g: "#8fe08a", p: "#f6c8cb", b: "#cfe6f8", l: "#cfcfe8", y: "#fff48f", o: "#f9cf96", k: "#f7d9ea", s: "#dde8ee", c: "#fdebd0", m: "#dbe8cc" };
var EXPO1_STALLS = [
  ["103", 8.3, 1, 16.2, 5.9, EX1.s],
  ["102", 16.2, 1, 25.1, 5.9, EX1.c],
  ["101", 29.1, 1, 43, 5.9, EX1.m],
  ["B1", 43, 1, 60.8, 5.9, EX1.l],
  ["104", 3.3, 9.9, 9.3, 17.9, EX1.b],
  ["105", 3.3, 17.9, 9.3, 26.8, EX1.p],
  ["106", 3.3, 30.7, 9.3, 39.6, EX1.p],
  ["107", 3.3, 39.6, 9.3, 47.5, EX1.b],
  ["115", 13.2, 9.9, 19.2, 17.9, EX1.b],
  ["114", 19.2, 9.9, 25.1, 17.9, EX1.b],
  ["116", 13.2, 17.9, 19.2, 26.8, EX1.p],
  ["113", 19.2, 17.9, 25.1, 26.8, EX1.p],
  ["117", 13.2, 30.7, 19.2, 39.6, EX1.p],
  ["112", 19.2, 30.7, 25.1, 39.6, EX1.p],
  ["118", 13.2, 39.6, 19.2, 47.5, EX1.b],
  ["111", 19.2, 39.6, 25.1, 47.5, EX1.b],
  ["B3", 29.1, 9.9, 41, 17.9, EX1.l],
  ["S1", 29.1, 17.9, 41, 26.8, EX1.k],
  ["S2", 29.1, 30.7, 41, 39.6, EX1.k],
  ["B4", 29.1, 39.6, 41, 47.5, EX1.l],
  ["T1", 44.9, 9.9, 60.8, 17.9, EX1.y],
  ["G1", 44.9, 17.9, 60.8, 26.8, EX1.o],
  ["G2", 44.9, 30.7, 60.8, 39.6, EX1.o],
  ["T2", 44.9, 39.6, 60.8, 47.5, EX1.y],
  ["108", 8.3, 51.5, 16.2, 56.5, EX1.s],
  ["109", 16.2, 51.5, 25.1, 56.5, EX1.c],
  ["110", 29.1, 51.5, 43, 56.5, EX1.m],
  ["B2", 43, 51.5, 60.8, 56.5, EX1.l],
  ["P1", 64.7, 4, 84.6, 12.9, EX1.g],
  ["D1", 88.5, 4, 108.4, 12.9, EX1.g],
  ["P2", 64.7, 17.9, 84.6, 26.8, EX1.g],
  ["D2", 88.5, 17.9, 108.4, 26.8, EX1.g],
  ["P3", 64.7, 30.7, 84.6, 39.6, EX1.g],
  ["D3", 88.5, 30.7, 108.4, 39.6, EX1.g],
  ["P4", 64.7, 44.6, 84.6, 53.5, EX1.g],
  ["D4", 88.5, 44.6, 108.4, 53.5, EX1.g]
];
var EXPO2_STALLS = (() => {
  const S = [], G = "#8fe08a", O = "#f9cf96", Y = "#fff48f", B = "#cfe6f8", L = "#cfcfe8", K = "#f7d9ea";
  const cu = [[103.2, 109.2], [94.3, 100.3], [85.4, 91.3]], rv = [[5.8, 11.7], [14.7, 20.6], [23.6, 29.5], [33.5, 39.5], [42.5, 48.4], [51.4, 57.2]];
  const nums = [[202, 203, 204, 205, 206, 207], [213, 212, 211, 210, 209, 208], [215, 216, 217, 218, 219, 220]];
  cu.forEach((c, ci) => rv.forEach((r, ri) => S.push([String(nums[ci][ri]), c[0], r[0], c[1], r[1], ri === 1 ? O : G])));
  S.push(["201", 97.3, 0.2, 109.2, 3, G], ["214", 87.4, 0.2, 97.3, 3, Y]);
  S.push(["224", 79.6, 0.8, 82.6, 10.4, Y], ["223", 79.6, 10.4, 82.6, 20.4, Y], ["222", 79.6, 37.5, 82.6, 47.3, Y], ["221", 79.6, 47.3, 82.6, 57.1, Y]);
  [286, 285, 284, 283, 282, 281, 280].forEach((n, i) => S.push([String(n), 2.1, 5.8 + i * 2.97, 5.1, 5.8 + (i + 1) * 2.97, B]));
  [279, 278, 277, 276, 275, 274].forEach((n, i) => S.push([String(n), 2.1, 32.6 + i * 2.97, 5.1, 32.6 + (i + 1) * 2.97, B]));
  [229, 228, 227, 226].forEach((n, i) => S.push([String(n), 8 + i * 3, 0.2, 11 + i * 3, 3, B]));
  S.push(["225", 20, 0.2, 24, 3, L]);
  [273, 272, 271, 270].forEach((n, i) => S.push([String(n), 8 + i * 3, 53.3, 11 + i * 3, 56.2, B]));
  S.push(["269", 20, 53.3, 24, 56.2, L]);
  const row = (v, a, b, c, d) => {
    if (a) S.push([String(a), 8, v, 12, v + 2.95, L]);
    if (b) S.push([String(b), 12, v, 15, v + 2.95, B]);
    if (c) S.push([String(c), 15, v, 18, v + 2.95, B]);
    if (d) S.push([String(d), 18, v, 24, v + 2.95, K]);
  };
  row(5.8, 230, 231, 232, 233);
  row(8.75, 237, 236, 235, 234);
  row(14.7, 238, 239, 0, 240);
  row(17.65, 244, 243, 242, 241);
  row(23.6, 245, 246, 247, 248);
  row(26.55, 252, 251, 250, 249);
  row(32.6, 253, 254, 255, 256);
  row(35.55, 260, 259, 258, 257);
  S.push(
    ["261", 8, 41.5, 14, 44.45, K],
    ["265", 18, 41.5, 24, 44.45, K],
    ["262", 8, 44.45, 11, 47.4, B],
    ["263", 8, 47.4, 11, 50.3, B],
    ["264", 11, 44.45, 14, 50.3, K],
    ["266", 18, 44.45, 21, 47.4, B],
    ["267", 18, 47.4, 21, 50.3, B],
    ["268", 21, 44.45, 24, 50.3, K]
  );
  return S;
})();
function findRoom(query) {
  if (!query) return null;
  const q = String(query).trim().toLowerCase().replace(/[\s_]+/g, " ");
  return ROOMS.find((r) => r.id === q.replace(/ /g, "-")) || ROOMS.find((r) => r.name.toLowerCase() === q) || ROOMS.find((r) => (r.aliases || []).includes(q)) || null;
}

// src/roads.js
// Divided city roads around the venue: asphalt, raised planted median with flowering shrubs, twin-arm street
// lights, lane and edge markings, kerbs, paver footpaths, verge trees, zebra crossings, signals and green road signs.
function buildOuterRoads(kit) {
  const { box, cyl, sign } = kit;
  let seed = 23;
  const rnd = () => (seed = seed * 16807 % 2147483647) / 2147483647;
  const ASPH = "#4e5056", WHITE = "#ecebe6", YELLOW = "#e6b92e", KERB = "#d7d2c6";
  const rb = (R2, mat, a0, a1, u0, u1, y0, y1, color) => R2.axis === "x" ? box(mat, a0, y0, u0, a1, y1, u1, color) : box(mat, u0, y0, a0, u1, y1, a1, color);
  const xz = (R2, a, u) => R2.axis === "x" ? [a, u] : [u, a];
  const subtract = (from, to, holes) => {
    const out = [];
    let cur = from;
    holes.slice().sort((p, q2) => p[0] - q2[0]).forEach(([h0, h1]) => {
      if (h1 <= cur || h0 >= to) return;
      if (h0 > cur) out.push([cur, h0]);
      cur = Math.max(cur, h1);
    });
    if (cur < to) out.push([cur, to]);
    return out;
  };
  const crossing = (R2) => OUTER_ROADS.filter((O) => O.axis !== R2.axis && O.c > R2.from && O.c < R2.to && R2.c > O.from && R2.c < O.to);
  const vtree = (x, z, s) => {
    cyl("matte", x, 0, z, 0.24 * s, 2.8 * s, "#6b4a32", 7, 0.7);
    kit.sphere("foliage", x, 4.4 * s, z, 2.4 * s, 2.3 * s, 2.4 * s, ["#3f7d3a", "#4a8a3f", "#356b33", "#58944a"][Math.floor(rnd() * 4)]);
    kit.sphere("foliage", x - 0.8 * s, 5.4 * s, z + 0.5 * s, 1.5 * s, 1.5 * s, 1.5 * s, "#5a9c4c");
  };
  const signal = (x, z) => {
    cyl("metal", x, 0, z, 0.11, 5.3, "#2b2d33", 8);
    box("matte", x - 0.26, 3.7, z - 0.26, x + 0.26, 5.1, z + 0.26, "#141417");
    [[4.82, "#ff3b30"], [4.4, "#5a4510"], [3.98, "#163d22"]].forEach(([y, c]) => kit.sphere("glow", x, y, z, 0.2, 0.17, 0.2, c));
    box("matte", x - 0.3, 0, z - 0.3, x + 0.3, 0.25, z + 0.3, "#d8d2c4");
  };
  const roadSign = (R2, a, u, text) => {
    const [x, z] = xz(R2, a, u);
    const off = R2.axis === "x" ? [1.6, 0] : [0, 1.6];
    [-1, 1].forEach((k) => cyl("metal", x + off[0] * k, 0, z + off[1] * k, 0.06, 3.3, "#9aa0a6", 8));
    sign(text, x, 2.85, z, R2.axis === "x" ? "S" : "E", 3.8, 0.95, { bg: "#0b6b3a", border: "#ffffff", sub: "Sector 17 \xB7 Gandhinagar", emissive: 0.35, ppm: 80, both: true });
  };
  const gantry = (R2, a, side, face, title, sub) => {
    const m = R2.median / 2, u0 = R2.c + side * (m + 0.4), u1 = R2.c + side * (R2.hw + 0.9), um = (u0 + u1) / 2;
    [u0, u1].forEach((u) => {
      const [x, z] = xz(R2, a, u);
      cyl("metal", x, 0, z, 0.22, 7.6, "#8b9097", 10);
    });
    rb(R2, "metal", a - 0.2, a + 0.2, Math.min(u0, u1) - 0.3, Math.max(u0, u1) + 0.3, 7.1, 7.45, "#8b9097");
    rb(R2, "metal", a - 0.2, a + 0.2, Math.min(u0, u1) - 0.3, Math.max(u0, u1) + 0.3, 5.0, 5.25, "#8b9097");
    const fa = face === "E" || face === "S" ? 0.3 : -0.3;
    const [x, z] = xz(R2, a + fa, um);
    sign(title, x, 6.2, z, face, R2.lanes * LANE + 1.2, 2.3, { bg: "#0b6b3a", border: "#ffffff", top: "DERMACON 2027", sub, emissive: 0.45, ppm: 70 });
  };
  OUTER_ROADS.forEach((R2) => {
    const { c, hw, from, to } = R2, m = R2.median / 2;
    const others = crossing(R2);
    const zones = others.map((O) => [O.c - O.hw - FOOT, O.c + O.hw + FOOT]);
    const carriage = others.map((O) => [O.c - O.hw, O.c + O.hw]);
    const gapHoles = (R2.gaps || []).map((g) => [g - 8, g + 8]);
    rb(R2, "asphalt", from, to, c - hw, c + hw, -0.06, 0.035, ASPH);
    rb(R2, "grass", from, to, c - hw - FOOT - 9, c + hw + FOOT + 9, -0.4, -0.05);
    const segs = subtract(from, to, zones);
    segs.forEach(([s0, s1]) => {
      const medSegs = subtract(s0, s1, gapHoles);
      medSegs.forEach(([a0, a1]) => {
        if (a1 - a0 < 2) return;
        rb(R2, "concrete", a0, a1, c - m, c + m, 0, 0.24, KERB);
        rb(R2, "grass", a0 + 0.3, a1 - 0.3, c - m + 0.18, c + m - 0.18, 0.24, 0.3);
        for (let a = a0 + 2.5; a < a1 - 2; a += 5.5) {
          const [x, z] = xz(R2, a, c);
          const pink = rnd() < 0.4;
          kit.sphere("foliage", x, 0.62, z, 0.75, 0.5, Math.min(0.75, m - 0.2), pink ? "#d0418f" : rnd() < 0.5 ? "#4a8a3f" : "#3f7d3a");
        }
        for (let a = a0 + 12; a < a1 - 6; a += 32) {
          const [x, z] = xz(R2, a, c);
          cyl("metal", x, 0.3, z, 0.13, 9.7, "#7d848c", 8);
          rb(R2, "metal", a - 0.08, a + 0.08, c - 2.4, c + 2.4, 9.8, 9.95, "#7d848c");
          rb(R2, "glow", a - 0.28, a + 0.28, c - 2.4, c - 1.5, 9.68, 9.8, "#fff3d0");
          rb(R2, "glow", a - 0.28, a + 0.28, c + 1.5, c + 2.4, 9.68, 9.8, "#fff3d0");
        }
      });
      [-1, 1].forEach((sd) => {
        const yu = c + sd * (m + 0.3);
        rb(R2, "matte", s0, s1, yu - 0.07, yu + 0.07, 0.035, 0.05, YELLOW);
        const eu = c + sd * (hw - 0.35);
        rb(R2, "matte", s0, s1, eu - 0.08, eu + 0.08, 0.035, 0.05, WHITE);
        for (let l = 1; l < R2.lanes; l++) {
          const du = c + sd * (m + LANE * l);
          for (let a = s0 + 3; a < s1 - 4; a += 9) rb(R2, "matte", a, a + 3.5, du - 0.07, du + 0.07, 0.035, 0.05, WHITE);
        }
      });
    });
    [-1, 1].forEach((sd) => {
      const holes = sd < 0 ? carriage.concat(gapHoles) : carriage;
      const ku0 = sd > 0 ? c + hw : c - hw - 0.3, ku1 = ku0 + 0.3;
      const fu0 = sd > 0 ? c + hw + 0.3 : c - hw - FOOT, fu1 = sd > 0 ? c + hw + FOOT : c - hw - 0.3;
      subtract(from, to, holes).forEach(([a0, a1]) => rb(R2, "paver", a0, a1, fu0, fu1, 0, 0.15));
      subtract(from, to, sd < 0 ? zones.concat(gapHoles) : zones).forEach(([a0, a1]) => {
        rb(R2, "concrete", a0, a1, ku0, ku1, 0, 0.22, KERB);
        if (R2.id === "mg" && sd < 0) return;
        for (let a = a0 + 6; a < a1 - 4; a += 15) {
          const [x, z] = xz(R2, a + rnd() * 3, c + sd * (hw + FOOT + 2.6));
          vtree(x, z, 0.85 + rnd() * 0.4);
        }
      });
    });
    others.forEach((O) => {
      [-1, 1].forEach((s) => {
        const z0 = O.c + s * (O.hw + 0.6), z1 = O.c + s * (O.hw + 3.6), za = Math.min(z0, z1), zb = Math.max(z0, z1);
        for (let u = c - hw + 0.6; u < c + hw - 0.4; u += 1.05) {
          if (Math.abs(u + 0.28 - c) < m + 0.25) continue;
          rb(R2, "matte", za, zb, u, u + 0.55, 0.036, 0.052, WHITE);
        }
        const sl = O.c + s * (O.hw + 4.4);
        rb(R2, "matte", sl - 0.2, sl + 0.2, c - hw + 0.3, c - m - 0.3, 0.036, 0.052, WHITE);
        rb(R2, "matte", sl - 0.2, sl + 0.2, c + m + 0.3, c + hw - 0.3, 0.036, 0.052, WHITE);
      });
      if (R2.axis === "x") [-1, 1].forEach((sx) => [-1, 1].forEach((sz) => signal(O.c + sx * (O.hw + 1.6), c + sz * (hw + 1.6))));
    });
    segs.forEach(([s0, s1]) => {
      if (s1 - s0 < 60) return;
      roadSign(R2, s0 + 14, c + hw + FOOT - 0.7, R2.name);
      roadSign(R2, s1 - 14, c - hw - FOOT + 0.7, R2.name);
    });
    const [lx, lz] = xz(R2, R2.label, c);
    kit.labels.push({ kind: "poi", text: R2.name, sub: "", x: lx, z: lz, y: 4, id: "road-" + R2.id });
  });
  const mg = OUTER_ROADS.find((r) => r.id === "mg");
  gantry(mg, 268, 1, "E", "HELIPAD EXHIBITION CENTRE", "Parking \xB7 Main Gate G9 ahead");
  gantry(mg, -70, -1, "W", "HELIPAD EXHIBITION CENTRE", "Parking \xB7 Main Gate G9 ahead");
}

// src/site.js
function buildSite(kit) {
  const { box, cyl, sign } = kit;
  let seed = 11;
  const rnd = () => (seed = seed * 16807 % 2147483647) / 2147483647;
  box("asphalt", SITE.minX - 22, -1.5, SITE.minZ - 22, SITE.maxX + 22, 0, SITE.maxZ + 22);
  box("grass", SITE.minX - 1500, -2, SITE.minZ - 1500, SITE.maxX + 1500, -0.6, SITE.maxZ + 1500);
  box("paver", -124, -0.2, -118, 134, 0.03, 124);
  const road = (x0, z0, x1, z1) => {
    box("asphalt", x0, -0.05, z0, x1, 0.03, z1, "#6a6c72");
    const ax = x1 - x0 > z1 - z0;
    for (let t = (ax ? x0 : z0) + 4; t < (ax ? x1 : z1) - 4; t += 8) {
      if (ax) box("matte", t, 0.03, (z0 + z1) / 2 - 0.12, t + 3, 0.05, (z0 + z1) / 2 + 0.12, "#d9d9d9");
      else box("matte", (x0 + x1) / 2 - 0.12, 0.03, t, (x0 + x1) / 2 + 0.12, 0.05, t + 3, "#d9d9d9");
    }
  };
  buildOuterRoads(kit);
  road(194, 160, 206, 338);
  road(138, 158, 194, 170);
  road(32, 200, 44, 338);
  road(-116, 226, -104, 338);
  road(56, 240, 185, 252);
  for (let i = 0; i < 24; i++) {
    const t = i / 24, x = -125 + 270 * t, z = 232 - 72 * t;
    kit.boxc("asphalt", x + 5.6, 0.0, z - 1.4, 12, 0.07, 9, 0.263, "#6a6c72");
  }
  box("matte", -72, 0, 226, -31, 8, 248, "#e6e1d4");
  box("matte", -73, 8, 225, -30, 8.7, 249, "#8d8f96");
  box("matte", -72, 2.4, 247.9, -31, 5.6, 248.1, "#2b3d52");
  box("matte", -54, 0, 247.8, -49, 3.4, 248.2, "#2b3d52");
  kit.labels.push({ kind: "poi", text: "State Central Library", sub: "", x: -51, z: 237, y: 12, id: "library" });
  PARKING.forEach(([x0, z0, x1, z1]) => {
    box("matte", x0, -0.1, z0, x1, 0.04, z1, "#f4f4f2");
    for (let x = x0 + 6; x < x1 - 3; x += 6) box("matte", x, 0.04, z0 + 2, x + 0.25, 0.07, z0 + 11, "#9aa0a8");
    for (let x = x0 + 6; x < x1 - 3; x += 6) box("matte", x, 0.04, z1 - 11, x + 0.25, 0.07, z1 - 2, "#9aa0a8");
    cyl("matte", x0 + 1.5, 0, z0 + 1.5, 0.12, 4.2, "#1a73e8", 8);
    const carCols = ["#f2f2f2", "#c9ccd1", "#1b1b1f", "#b3262e", "#2a5db0", "#8a8f98", "#e8e2d0", "#2f7d4f"];
    [z0 + 6.5, z1 - 6.5].forEach((zc) => {
      for (let x = x0 + 9; x < x1 - 3; x += 6) {
        if (rnd() < 0.3) continue;
        const col = carCols[Math.floor(rnd() * carCols.length)], l = 2.1 + rnd() * 0.25;
        box("matte", x - 0.9, 0.22, zc - l, x + 0.9, 0.9, zc + l, col);
        box("matte", x - 0.78, 0.9, zc - l * 0.55, x + 0.78, 1.5, zc + l * 0.45, "#2b3340");
      }
    });
  });
  for (let t = 0; t < 1; t += 0.07) {
    const x = PARK_WALK[0][0] + (PARK_WALK[1][0] - PARK_WALK[0][0]) * t, z = PARK_WALK[0][1] + (PARK_WALK[1][1] - PARK_WALK[0][1]) * t;
    box("glow", x - 0.5, 0.05, z - 0.5, x + 0.5, 0.12, z + 1.2, "#ff3d94");
  }
  kit.labels.push({ kind: "park", text: "P  PARKING", sub: "", x: 118, z: 276, y: 14, id: "parking" });
  kit.labels.push({ kind: "park", text: "Walk to Gate G9", sub: "", x: (PARK_WALK[0][0] + PARK_WALK[1][0]) / 2 + 6, z: (PARK_WALK[0][1] + PARK_WALK[1][1]) / 2, y: 4, id: "parkwalk" });
  LAWNS.forEach(([x0, z0, x1, z1]) => {
    box("grass", x0, 0, z0, x1, 0.16, z1);
    box("concrete", x0 - 0.25, 0, z0 - 0.25, x1 + 0.25, 0.12, z1 + 0.25);
    kit.cost(x0, z0, x1, z1, 7);
  });
  CARPETS.forEach(([x0, z0, x1, z1]) => {
    box("carpetRed", x0, 0, z0, x1, 0.065, z1);
    kit.cost(x0, z0, x1, z1, 1);
    kit.zone("the red carpet", x0, z0, x1, z1, { carpet: true });
  });
  const dash = (x0, z0, x1, z1) => {
    const n = Math.floor(Math.hypot(x1 - x0, z1 - z0) / 6);
    for (let i = 0; i < n; i++) {
      const t = (i + 0.25) / n, t2 = (i + 0.75) / n;
      box("matte", x0 + (x1 - x0) * t - 0.08, 0, z0 + (z1 - z0) * t - 0.08, x0 + (x1 - x0) * t2 + 0.08, 0.045, z0 + (z1 - z0) * t2 + 0.08, "#e8e4d2");
    }
  };
  dash(-285, -125, 140, -125);
  dash(-134, -120, -134, 95);
  dash(150, -120, 150, 100);
  dash(-270, -120, -270, 160);
  dash(240, -180, 240, 100);
  const inBuilding = (x, z, m = 3) => BUILDINGS.some((b) => {
    const hw = (b.rot ? b.D : b.W) / 2 + m, hd = (b.rot ? b.W : b.D) / 2 + m;
    return Math.abs(x - b.cx) < hw && Math.abs(z - b.cz) < hd;
  }) || Math.hypot(x - DOME.cx, z - DOME.cz) < DOME.r + m;
  const gcol = { main: "#d8362c", visitor: "#a3195b", service: "#a05a44" };
  GATES.forEach((g) => {
    const [x, z] = g.at;
    kit.push(x, z, DIR[g.face]);
    const big = g.kind === "main", w = big ? 9 : 6.5, h = big ? 7.5 : 6;
    [-1, 1].forEach((k) => {
      box("matte", -0.7, 0, k * w - 0.7, 0.7, h, k * w + 0.7, gcol[g.kind]);
      kit.solid(-0.7, k * w - 0.7, 0.7, k * w + 0.7);
    });
    box("matte", -0.6, h - 1.9, -w - 0.7, 0.6, h, w + 0.7, "#1b1730");
    [-1, 1].forEach((k) => {
      box("matte", -0.18, 0, k * (w + 0.7), 0.18, 2.3, k * (w + 24), "#d8d2c4");
      kit.solid(-0.18, Math.min(k * (w + 0.7), k * (w + 24)), 0.18, Math.max(k * (w + 0.7), k * (w + 24)));
    });
    sign(big ? "MAIN ENTRY FROM ROAD" : `GATE ${g.label}`, 0.62, h - 0.95, 0, "E", w * 2, 1.6, { bg: gcol[g.kind], sub: big ? "GATE G9 \xB7 DERMACON 2027 \xB7 Welcome" : "DERMACON 2027", glow: true, ppm: 60 });
    sign(big ? "THANK YOU \xB7 VISIT AGAIN" : `GATE ${g.label} \xB7 EXIT`, -0.62, h - 0.95, 0, "W", w * 2, 1.6, { bg: "#1b1730", emissive: 0.5, ppm: 50 });
    if (big) {
      [-1, 1].forEach((k) => cyl("glow", 0, h, k * w, 0.2, 5, "#ff3d94", 10));
      box("glow", -0.2, h + 5, -w - 0.2, 0.2, h + 5.4, w + 0.2, "#ff3d94");
      sign("MAIN ENTRY", 0, h + 1.5, 0, "E", w * 1.2, 1.5, { bg: "#d63d86", sub: "FROM ROAD \xB7 GATE G9", glow: true, ppm: 60, both: true });
      box("carpetRed", -20, 0, -4, 6, 0.065, 4);
      kit.cost(-20, -4, 6, 4, 1);
      [-1, 1].forEach((k) => {
        for (let i = 0; i < 5; i++) {
          cyl("metal", -3 - i * 3.5, 0, k * 4.6, 0.06, 6, "#d8d8dc", 8);
          box("matte", -3 - i * 3.5 - 0.02, 3.4, k * 4.6, -3 - i * 3.5 + 0.02, 5.8, k * 4.6 + k * 1.1, ["#a3195b", "#1f7fa6", "#5b1f6e"][i % 3]);
        }
      });
    }
    kit.pop();
    kit.labels.push(big ? { kind: "main", text: "MAIN ENTRY", sub: "Gate G9 \xB7 from road", x, z, y: h + 9, id: g.id } : { kind: "gate", text: g.label, x, z, y: h + 1.5, id: g.id });
  });
  BUILDINGS.filter((b) => b.main.length && b.id !== "h12a").forEach((b) => b.main.forEach((s) => {
    const x = b.cx + (s === "W" ? -1 : 1) * (b.W / 2 + 2.6);
    [[-b.D / 2 + 13, -9.5], [9.5, b.D / 2 - 13]].forEach(([a, c]) => {
      box("brand", x - 0.15, 0.4, b.cz + a, x + 0.15, 5.6, b.cz + c);
      kit.solid(x - 0.15, b.cz + a, x + 0.15, b.cz + c);
      [a, c].forEach((z) => box("metal", x - 0.2, 0, b.cz + z - 0.2, x + 0.2, 5.9, b.cz + z + 0.2, "#6b6f76"));
    });
  }));
  const tree = (x, z, s) => {
    if (inBuilding(x, z, 4)) return;
    cyl("matte", x, 0, z, 0.22 * s, 2.6 * s, "#6b4a32", 7, 0.7);
    kit.sphere("foliage", x, 4.2 * s, z, 2.3 * s, 2.5 * s, 2.3 * s, ["#3f7d3a", "#4a8a3f", "#356b33", "#58944a"][Math.floor(rnd() * 4)]);
    kit.sphere("foliage", x + 0.9 * s, 5.3 * s, z - 0.5 * s, 1.5 * s, 1.6 * s, 1.5 * s, "#5a9c4c");
    kit.solid(x - 0.3, z - 0.3, x + 0.3, z + 0.3);
  };
  LAWNS.forEach(([x0, z0, x1, z1]) => {
    const n = Math.max(2, Math.round((x1 - x0) * (z1 - z0) / 320));
    for (let i = 0; i < n; i++) tree(x0 + 2 + rnd() * (x1 - x0 - 4), z0 + 2 + rnd() * (z1 - z0 - 4), 0.8 + rnd() * 0.7);
  });
  for (let x = SITE.minX + 8; x < SITE.maxX; x += 16) {
    tree(x, SITE.minZ + 5, 1.1);
    tree(x + 6, SITE.maxZ - 5, 1.1);
  }
  for (let z = SITE.minZ + 14; z < SITE.maxZ; z += 16) {
    tree(SITE.minX + 5, z, 1.1);
    tree(SITE.maxX - 5, z + 5, 1.1);
  }
  for (let z = -104; z <= 112; z += 12) {
    if (Math.abs(z - -82.4) < 8 || Math.abs(z) < 8 || Math.abs(z - 82.3) < 8) continue;
    [4.2, 23.4].forEach((x) => {
      box("matte", x - 0.7, 0, z - 0.7, x + 0.7, 0.6, z + 0.7, "#e3ddd2");
      kit.sphere("foliage", x, 1.1, z, 0.8, 0.7, 0.8, "#4a8a3f");
      kit.solid(x - 0.7, z - 0.7, x + 0.7, z + 0.7);
    });
  }
  const pole = (x, z) => {
    if (inBuilding(x, z)) return;
    cyl("metal", x, 0, z, 0.1, 9, "#7d848c", 8);
    box("metal", x - 1.2, 8.9, z - 0.08, x + 1.2, 9, z + 0.08, "#7d848c");
    box("glow", x - 1.2, 8.82, z - 0.16, x - 0.6, 8.9, z + 0.16, "#fff3d0");
    box("glow", x + 0.6, 8.82, z - 0.16, x + 1.2, 8.9, z + 0.16, "#fff3d0");
  };
  for (let z = -110; z <= 115; z += 37.5) {
    pole(28, z + 20);
    pole(-130.5, z + 20);
    pole(140, z + 20);
  }
  for (let x = -250; x <= 250; x += 50) {
    pole(x, -128);
    pole(x, 168);
  }
  SCULPTURES.forEach(([x, z]) => {
    cyl("concrete", x, 0, z, 3.4, 0.45, "#fff", 6);
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * Math.PI * 2;
      kit.boxc("metal", x + Math.cos(a) * 1.1, 2.4, z + Math.sin(a) * 1.1, 0.12, 4.4, 0.9, -a + 0.5, "#c7a25a", 0, 0.25);
    }
    kit.sphere("metal", x, 4.9, z, 0.7, 0.7, 0.7, "#d9b56a");
    kit.solid(x - 3, z - 3, x + 3, z + 3);
  });
  const cabin = (x, z, w, d, h, color, title, sub, face = "S", bg = "#c2185b") => {
    kit.push(x, z);
    box("concrete", -w / 2 - 0.3, 0, -d / 2 - 0.3, w / 2 + 0.3, 0.12, d / 2 + 0.3);
    box("satin", -w / 2, 0.12, -d / 2, w / 2, h, d / 2, color);
    box("matte", -w / 2 - 0.4, h, -d / 2 - 0.4, w / 2 + 0.4, h + 0.25, d / 2 + 0.4, "#55585e");
    kit.solid(-w / 2, -d / 2, w / 2, d / 2);
    const off = face === "S" ? [0, d / 2 + 0.03] : face === "N" ? [0, -d / 2 - 0.03] : face === "E" ? [w / 2 + 0.03, 0] : [-w / 2 - 0.03, 0];
    sign(title, off[0], h - 0.9, off[1], face, Math.min(face === "S" || face === "N" ? w : d, 6) * 0.9, 1.1, { bg, sub, emissive: 0.5, ppm: 70 });
    kit.pop();
  };
  WASHROOMS.forEach(([x, z]) => cabin(x, z, 9, 5, 3.4, "#f1e9ee", "WASHROOMS", "Men \xB7 Women"));
  [[-108, -41], [-8, -41], [-108, 41.5], [-8, 41.5], [47, -41], [121, -41], [47, 41.5], [121, 41.5]].forEach(([x, z]) => cabin(x, z, 6, 3.4, 2.9, "#f6eef2", "WASHROOM", void 0, z < 0 ? "S" : "N"));
  FOOD_COURTS.forEach(([x, z], i) => {
    cabin(x, z, 12, 7, 3.6, "#f3efe2", "FOOD COURT", `Kiosk ${i + 1}`, "S", "#6c9a1f");
    for (let k = 0; k < 4; k++) {
      cyl("metal", x - 5 + k * 3.3, 0, z + 7.5, 0.04, 2.3, "#999", 6);
      kit.cyl("matte", x - 5 + k * 3.3, 2.1, z + 7.5, 1.5, 0.5, ["#c9367c", "#1f7fa6", "#e0a526", "#6c9a1f"][k], 10, 0.05);
      cyl("matte", x - 5 + k * 3.3, 0.7, z + 7.5, 0.5, 0.04, "#ffffff", 12);
    }
  });
  REG_COUNTERS.forEach(([x, z]) => cabin(x, z, 7, 3.5, 3.1, "#e6f1fa", "REGISTRATION COUNTER", "Gate desk", "S", "#1f7fa6"));
  FIRST_AID.forEach(([x, z]) => cabin(x, z, 7, 5, 3.2, "#ffffff", "FIRST AID", "Medical centre", "S", "#d8362c"));
  cabin(FIRE_STATION[0], FIRE_STATION[1], 14, 9, 5, "#f4e3df", "FIRE CONTROL ROOM", void 0, "S", "#d8362c");
  TUNNELS.forEach(({ x, z0, z1 }) => {
    [[z0, "N"], [z1, "S"]].forEach(([z, face]) => {
      box("matte", x - 3.6, 0, z - 0.5, x - 3, 4.2, z + 0.5, "#f2c230");
      box("matte", x + 3, 0, z - 0.5, x + 3.6, 4.2, z + 0.5, "#f2c230");
      box("matte", x - 3.6, 4.2, z - 0.5, x + 3.6, 4.8, z + 0.5, "#f2c230");
      sign("TUNNEL", x, 3.3, z + (face === "N" ? -0.55 : 0.55), face, 5, 0.9, { bg: "#f2c230", fg: "#16132a", emissive: 0.6, ppm: 60 });
    });
  });
  BUILDINGS.forEach((b) => kit.labels.push({ kind: b.main.length ? "building" : "idle", text: b.main.length ? b.title : "Not in use", sub: "", x: b.cx, z: b.cz, y: b.ridge + 4, id: b.id }));
  kit.labels.push({ kind: "building", text: "FOOD COURT \xB7 SPOUSE AREA", sub: "", x: DOME.cx, z: DOME.cz, y: 22, id: "h3" });
  kit.labels.push({ kind: "building", text: "ADMIN", sub: "", x: (ADMIN.rect[0] + ADMIN.rect[2]) / 2, z: (ADMIN.rect[1] + ADMIN.rect[3]) / 2, y: 11, id: "admin" });
}

// src/halls.js
var FT = 0.3048;
function buildHalls(kit, roofBatch) {
  const { box, cyl, wall, sign, seats, stage } = kit;
  const roof = (fn) => {
    const old = kit.setBatch(roofBatch);
    fn();
    kit.setBatch(old);
  };
  const floor = (mat, u0, v0, u1, v1, color) => box(mat, u0, 0.05, v0, u1, 0.11, v1, color);
  const doorSign = (text, u, v, face, w = 4.2, o = {}) => sign(text, u, 3.25, v, face, w, 0.95, Object.assign({ bg: "#1b1730", fg: "#fff", border: "#c9367c", emissive: 0.55 }, o));
  const rug = (mat, u0, v0, u1, v1, color) => box(mat, u0, 0.115, v0, u1, 0.125, v1, color);
  const counter = (u0, v0, u1, v1, text) => {
    box("wood", u0, 0, v0, u1, 1.05, v1, "#5a3418");
    box("matte", u0 - 0.05, 1.05, v0 - 0.05, u1 + 0.05, 1.1, v1 + 0.05, "#3b2415");
    kit.solid(u0, v0, u1, v1);
    cyl("metal", u0 + 0.8, 1.1, v0 + 0.7, 0.22, 0.45, "#c9c9cf", 12);
    cyl("metal", u1 - 0.8, 1.1, v0 + 0.7, 0.22, 0.45, "#c9c9cf", 12);
    sign(text, (u0 + u1) / 2, 2.1, v0 - 0.02, "N", Math.min(u1 - u0, 6), 0.55, { bg: "#5a3418", fg: "#ffe9c9", emissive: 0.5 });
  };
  function shell(b) {
    const { W, D, eave, ridge } = b, hw = W / 2, hd = D / 2, T = 0.6, rise = ridge - eave;
    kit.push(b.cx, b.cz, b.rot ? Math.PI / 2 : 0);
    box("concrete", -hw - T, -0.4, -hd - T, hw + T, 0.08, hd + T);
    kit.zone(`${b.hec}`, -hw, -hd, hw, hd, { building: b.id });
    kit.cost(-hw, -hd, hw, hd, 1.3);
    const mainW = b.id === "h12a" ? 7 : 10, mainH = Math.min(4.6, eave - 1.2);
    const sides = { N: [], S: [], E: [], W: [] };
    const cornerOpen = b.interior === "expo1" || b.interior === "hallE";
    for (const s of b.main) {
      sides[s].push({ c: 0, w: mainW, h: mainH });
      if (b.id === "h5") [-32, -15, 15, 32].forEach((c) => sides[s].push({ c, w: 2.6, h: 2.7 }));
      if (cornerOpen) [-(hd - 4), -(hd - 9.5), hd - 9.5, hd - 4].forEach((c) => sides[s].push({ c, w: 2.4, h: 2.7 }));
    }
    wall("clad", -hw - T / 2, -hd - T, -hw - T / 2, hd + T, eave, T, sides.W);
    wall("clad", hw + T / 2, -hd - T, hw + T / 2, hd + T, eave, T, sides.E);
    wall("clad", -hw, -hd - T / 2, hw, -hd - T / 2, eave, T, sides.N);
    wall("clad", -hw, hd + T / 2, hw, hd + T / 2, eave, T, sides.S);
    const dc = "#8f2f2a", fr = "#d9d9d6";
    const leaf = (x, z, alongX, w) => {
      if (alongX) {
        box("matte", x - w / 2 - 0.12, 0, z - T / 2 - 0.04, x + w / 2 + 0.12, 2.75, z + T / 2 + 0.04, fr);
        box("satin", x - w / 2, 0, z - T / 2 - 0.07, x + w / 2, 2.6, z + T / 2 + 0.07, dc);
      } else {
        box("matte", x - T / 2 - 0.04, 0, z - w / 2 - 0.12, x + T / 2 + 0.04, 2.75, z + w / 2 + 0.12, fr);
        box("satin", x - T / 2 - 0.07, 0, z - w / 2, x + T / 2 + 0.07, 2.6, z + w / 2, dc);
      }
    };
    const fx = W > 100 ? [-0.23, 0.02, 0.23] : [-0.19, 0.04, 0.18];
    fx.forEach((f, i) => {
      leaf(f * W, -hd - T / 2, true, i === 1 ? 3.6 : 2.2);
      leaf(f * W, hd + T / 2, true, i === 1 ? 3.6 : 2.2);
    });
    ["W", "E"].forEach((s) => {
      const x = s === "W" ? -hw - T / 2 : hw + T / 2;
      const open = b.main.includes(s);
      if (!(open && (cornerOpen || b.id === "h5"))) [-(hd - 4), -(hd - 9.5), hd - 9.5, hd - 4].forEach((z) => {
        if (hd > 20) leaf(x, z, false, 2.2);
      });
      if (!open && hd > 20) leaf(x, 0, false, 6);
    });
    const step = W > 100 ? 8.93 : 9.04, first = -hw + (W > 100 ? 7.6 : 8.1);
    for (let x = -hw + 0.3; x <= hw; x += (W - 0.6) / Math.round(W / 9)) {
      box("satin", x - 0.2, 0, -hd, x + 0.2, eave, -hd + 0.35, "#c9ced2");
      box("satin", x - 0.2, 0, hd - 0.35, x + 0.2, eave, hd, "#c9ced2");
    }
    const pz = D > 60 ? [-12.25, 11.5] : [-11.9, 12.2];
    const roofY = (z) => eave + rise * (1 - Math.abs(z) / (hd + T));
    if (b.interior !== "empty" || true) for (let x = first; x < hw - 2; x += step) pz.forEach((z) => {
      box("satin", x - 0.16, 0, z - 0.16, x + 0.16, roofY(z), z + 0.16, "#d43a33");
    });
    roof(() => {
      const span = hd + T + 0.8, L = Math.hypot(span, rise), a = Math.atan2(rise, span);
      kit.boxc("roof", 0, eave + rise / 2 + 0.12, -span / 2, W + 2 * T + 1.6, 0.12, L, 0, null, -a);
      kit.boxc("roof", 0, eave + rise / 2 + 0.12, span / 2, W + 2 * T + 1.6, 0.12, L, 0, null, a);
      box("satin", -hw - T - 0.8, ridge + 0.1, -0.5, hw + T + 0.8, ridge + 0.32, 0.5, "#f4f5f6");
      kit.prism("clad", -hw - T / 2, eave, 0, T, rise, D + 2 * T);
      kit.prism("clad", hw + T / 2, eave, 0, T, rise, D + 2 * T);
      for (let x = first; x < hw - 2; x += step) {
        kit.boxc("satin", x, eave + rise / 2 - 0.25, -span / 2, 0.25, 0.5, L, 0, "#f4f5f6", -a);
        kit.boxc("satin", x, eave + rise / 2 - 0.25, span / 2, 0.25, 0.5, L, 0, "#f4f5f6", a);
        box("satin", x - 0.1, eave - 0.15, -hd, x + 0.1, eave + 0.1, hd, "#f4f5f6");
      }
      const rows = D > 60 ? [-26, -13, 0, 13, 26] : [-21, -7, 7, 21];
      rows.forEach((z) => {
        for (let x = -hw + 6; x < hw - 4; x += 9) {
          box("glow", x - 2.2, roofY(z) - 0.75, z - 0.22, x + 2.2, roofY(z) - 0.68, z + 0.22, "#fff6dc");
          box("matte", x - 2.25, roofY(z) - 0.68, z - 0.26, x + 2.25, roofY(z) - 0.6, z + 0.26, "#f4f4f2");
        }
      });
    });
    for (const s of b.main) {
      const ex = s === "W" ? -hw - T : s === "E" ? hw + T : 0, ez = s === "N" ? -hd - T : s === "S" ? hd + T : 0;
      kit.push(ex, ez, DIR[s]);
      const pw = mainW / 2 + 2.2, top = Math.min(eave + 2.4, 8.6);
      [-1, 1].forEach((k) => {
        box("brand", 3.2, 0, k * pw - 0.7, 4.6, top, k * pw + 0.7);
        kit.solid(3.2, k * pw - 0.7, 4.6, k * pw + 0.7);
      });
      box("matte", 3.3, mainH + 0.5, -pw - 0.7, 4.5, top, pw + 0.7, "#1b1730");
      box("satin", 0, top, -pw - 1.2, 5.2, top + 0.25, pw + 1.2, "#ffffff");
      sign(b.fascia[0], 4.53, (mainH + 0.5 + top) / 2, 0, "E", pw * 2 + 1, top - mainH - 0.9, { gradient: ["#4a1766", "#a3195b", "#1f7fa6"], sub: b.fascia[1], top: "ENTRY", glow: true, ppm: 70 });
      sign(b.fascia[0], 3.27, (mainH + 0.5 + top) / 2, 0, "W", pw * 2 + 1, top - mainH - 0.9, { bg: "#1b1730", sub: "Red carpet \xB7 Exit", emissive: 0.5, ppm: 50 });
      box("carpetRed", -0.7, 0.05, -mainW / 2, 6, 0.1, mainW / 2);
      kit.pop();
    }
    if (!b.main.length) {
      sign("NOT IN USE", -hw - T - 0.03, 3.4, 0, "W", 9, 2.2, { bg: "#3a3d44", sub: "DERMACON 2027", emissive: 0.2 });
      sign("NOT IN USE", hw + T + 0.03, 3.4, 0, "E", 9, 2.2, { bg: "#3a3d44", sub: "DERMACON 2027", emissive: 0.2 });
    }
    kit.push(-hw, -hd);
    kit.beginChairs();
    INTERIORS[b.interior](b);
    kit.endChairs(b.id);
    kit.pop();
    kit.pop();
  }
  const confStage = (u, v, aud, title, o = {}) => stage(u, v, aud, Object.assign({ w: 40 * FT, d: 16 * FT, h: 3 * FT, ledW: 30 * FT, ledH: 8 * FT, title }, o));
  const bigStage = (u, v, aud, title, o = {}) => stage(u, v, aud, Object.assign({ w: 60 * FT, d: 20 * FT, h: 4 * FT, ledW: 30 * FT, ledH: 8 * FT, title, panel: 10, backH: 5 }, o));
  function tripleHalls(ids, names, doorsV) {
    const x0 = 43.2, defs = [[0, 16.5, "small"], [16.5, 41.5, "big"], [41.5, 58, "small"]];
    floor("carpetBlue", x0, 0, 88, 58);
    wall("acoustic", x0, 0, x0, 58, 4.2, 0.25, doorsV.map((c) => ({ c, w: 2.6 })));
    defs.forEach(([v0, v1, kind], i) => {
      const vc = (v0 + v1) / 2, name = names[i];
      if (kind === "big") {
        bigStage(87.5, vc, "W", name, { sub: "Silent hall" });
        seats({ x0: 50.4, z0: v0 + 1, x1: 73.6, z1: v1 - 1, face: "E", rowGroups: [9, 9], seatGroups: [21, 21], target: 756 });
      } else {
        confStage(87.5, vc, "W", name, { sub: "Silent hall" });
        seats({ x0: 57, z0: v0 + 0.8, x1: 74.2, z1: v1 - 0.8, face: "E", rowGroups: [13], seatGroups: [10, 10], target: 260 });
      }
      doorSign(name, x0 - 0.15, vc, "W", 4.4, { sub: "Silent hall" });
      kit.room(ids[i], x0, v0, 88, v1, 45.4, i === 0 ? v1 - 3.2 : i === 2 ? v0 + 3.2 : vc, 84, vc);
    });
  }
  function expoStalls(list, W, D) {
    const eps = 0.25, near = (a, b) => Math.abs(a - b) < eps;
    list.forEach(([no, u0, v0, u1, v1, color], idx) => {
      const w = u1 - u0, d = v1 - v0, area = w * d;
      box("matte", u0 + 0.04, 0.05, v0 + 0.04, u1 - 0.04, 0.15, v1 - 0.04, color);
      kit.navBlock(u0 + 0.2, v0 + 0.2, u1 - 0.2, v1 - 0.2);
      const closed = { N: v0 < 0.9, S: v1 > D - 0.9, W: u0 < 0.9, E: u1 > W - 0.9 };
      list.forEach((o, j) => {
        if (j === idx) return;
        const ov = Math.min(u1, o[3]) - Math.max(u0, o[1]) > 0.5, oh = Math.min(v1, o[4]) - Math.max(v0, o[2]) > 0.5;
        if (ov && near(v0, o[4])) closed.N = true;
        if (ov && near(v1, o[2])) closed.S = true;
        if (oh && near(u0, o[3])) closed.W = true;
        if (oh && near(u1, o[1])) closed.E = true;
      });
      const H = area >= 30 ? 3.6 : 2.5, P2 = "#f4f4f1";
      if (closed.N) box("panel", u0, 0.12, v0, u1, H, v0 + 0.06);
      if (closed.S) box("panel", u0, 0.12, v1 - 0.06, u1, H, v1);
      if (closed.W) box("panel", u0, 0.12, v0, u0 + 0.06, H, v1);
      if (closed.E) box("panel", u1 - 0.06, 0.12, v0, u1, H, v1);
      [[u0, v0], [u1, v0], [u0, v1], [u1, v1]].forEach(([x, z]) => box("metal", x - 0.05, 0.12, z - 0.05, x + 0.05, H, z + 0.05, "#d0d3d6"));
      const open = ["S", "N", "E", "W"].filter((s) => !closed[s]);
      const fas = (s) => {
        const y = H - 0.28;
        if (s === "N") {
          box("matte", u0, y - 0.22, v0, u1, y + 0.22, v0 + 0.05, color);
          sign(no, (u0 + u1) / 2, y, v0 - 0.02, "N", Math.min(w, 2.4), 0.42, { bg: "#ffffff", fg: "#1b1730", emissive: 0.3, ppm: 60 });
        }
        if (s === "S") {
          box("matte", u0, y - 0.22, v1 - 0.05, u1, y + 0.22, v1, color);
          sign(no, (u0 + u1) / 2, y, v1 + 0.02, "S", Math.min(w, 2.4), 0.42, { bg: "#ffffff", fg: "#1b1730", emissive: 0.3, ppm: 60 });
        }
        if (s === "W") {
          box("matte", u0, y - 0.22, v0, u0 + 0.05, y + 0.22, v1, color);
          sign(no, u0 - 0.02, y, (v0 + v1) / 2, "W", Math.min(d, 2.4), 0.42, { bg: "#ffffff", fg: "#1b1730", emissive: 0.3, ppm: 60 });
        }
        if (s === "E") {
          box("matte", u1 - 0.05, y - 0.22, v0, u1, y + 0.22, v1, color);
          sign(no, u1 + 0.02, y, (v0 + v1) / 2, "E", Math.min(d, 2.4), 0.42, { bg: "#ffffff", fg: "#1b1730", emissive: 0.3, ppm: 60 });
        }
      };
      open.slice(0, 2).forEach(fas);
      const cx = (u0 + u1) / 2, cz = (v0 + v1) / 2;
      if (area >= 30) {
        const tw = Math.min(w * 0.28, 3.2), td = Math.min(d * 0.28, 3.2);
        box("satin", cx - tw / 2, 0.12, cz - td / 2, cx + tw / 2, 4.3, cz + td / 2, P2);
        box("matte", cx - tw / 2 - 0.05, 3.5, cz - td / 2 - 0.05, cx + tw / 2 + 0.05, 4.3, cz + td / 2 + 0.05, color);
        kit.solid(cx - tw / 2, cz - td / 2, cx + tw / 2, cz + td / 2);
        [[-1, -1], [1, 1], [-1, 1], [1, -1]].forEach(([a, c], k) => {
          if (k < (area > 100 ? 4 : 2)) {
            const x = cx + a * w * 0.32, z = cz + c * d * 0.3;
            box("satin", x - 0.6, 0.12, z - 0.3, x + 0.6, 1.1, z + 0.3, "#ffffff");
            box("matte", x - 0.62, 1.1, z - 0.32, x + 0.62, 1.14, z + 0.32, color);
          }
        });
        if (area > 100) {
          box("satin", u0 + 1, 0.12, cz - 0.08, u0 + w * 0.22, 2.6, cz + 0.08, P2);
          box("satin", u1 - w * 0.22, 0.12, cz - 0.08, u1 - 1, 2.6, cz + 0.08, P2);
        }
      } else {
        const s = open[0] || "S";
        const off = s === "S" ? [0, d * 0.28] : s === "N" ? [0, -d * 0.28] : s === "E" ? [w * 0.28, 0] : [-w * 0.28, 0];
        const lx = s === "S" || s === "N" ? 0.6 : 0.25, lz = s === "S" || s === "N" ? 0.25 : 0.6;
        box("satin", cx + off[0] - lx, 0.12, cz + off[1] - lz, cx + off[0] + lx, 1.05, cz + off[1] + lz, "#ffffff");
      }
    });
  }
  const INTERIORS = {
    empty(b) {
    },
    // ----- Hall 1 : A (normal acoustic plenary hall, 2,448 seats) with Preview Room, Faculty Lounge and tea lounges -----
    hallA() {
      floor("carpetPlum", 25, 0, 88, 58);
      floor("carpetGrey", 0, 0, 25, 58);
      rug("carpetBlue", 7, 0, 25, 18);
      rug("wood", 7, 40, 25, 58);
      wall("acoustic", 25, 0, 25, 58, 4.2, 0.25, [{ c: 29, w: 6 }]);
      wall("acoustic", 7, 0, 7, 18, 4.2, 0.25);
      wall("acoustic", 7, 18, 25, 18, 4.2, 0.25, [{ c: 16, w: 2.4 }]);
      wall("acoustic", 7, 40, 25, 40, 4.2, 0.25, [{ c: 16, w: 2.4 }]);
      wall("acoustic", 7, 40, 7, 58, 4.2, 0.25);
      bigStage(87.4, 29, "W", "A", { sub: "Silent hall" });
      seats({ x0: 28, z0: 2.5, x1: 80, z1: 55.5, face: "E", rowGroups: [7, 7, 7, 7], seatGroups: [15, 15, 15, 15, 15, 15], aisle: 1.6, pitch: 1, target: 2448 });
      doorSign("A \xB7 MAIN", 24.8, 29, "W", 6, { sub: "Enter here" });
      kit.room("hall-a", 25, 0, 88, 58, 26.5, 29, 80, 29);
      doorSign("PREVIEW ROOM", 16, 18.2, "S", 5, { sub: "Slide check & upload" });
      [10, 14.5, 19, 23.5].forEach((u) => {
        box("wood", u - 1.1, 0.7, 1.2, u + 1.1, 0.76, 2);
        box("matte", u - 1.05, 0, 1.25, u + 1.05, 0.7, 1.45, "#2a2a30");
        box("matte", u - 0.45, 0.76, 1.45, u + 0.45, 1.3, 1.5, "#0c0c10");
        box("glow", u - 0.42, 0.8, 1.5, u + 0.42, 1.27, 1.505, "#bfe3ff");
        kit.chair(u, 2.8, DIR.N);
      });
      [[11, 6.5], [20, 6.5], [11, 12.5], [20, 12.5]].forEach(([u, v]) => kit.roundTable(u, v, 0.8, 6, "#efe9e2"));
      kit.plant(8, 16.6, 1.2);
      kit.plant(24.2, 16.6, 1.2);
      kit.room("preview-room", 7, 0, 25, 18, 16, 16.4, 16, 9);
      doorSign("FACULTY LOUNGE", 16, 39.8, "N", 5, { gradient: ["#4a1766", "#a3195b"], sub: "Tea \xB7 coffee \xB7 snacks" });
      counter(8, 41.5, 14, 44, "TEA \xB7 COFFEE \xB7 SNACKS");
      [[13, 49], [19, 49], [13, 55], [19, 55]].forEach(([u, v]) => kit.roundTable(u, v, 0.8, 6, "#efe9e2"));
      kit.sofa(23.6, 46, DIR.W, 2.2, "#3f5f7a");
      kit.sofa(9.2, 53, DIR.E, 2.2, "#3f5f7a");
      kit.plant(8, 57, 1.2);
      kit.plant(24.2, 57, 1.2);
      kit.plant(24.2, 41.5, 1.1);
      kit.room("faculty-lounge", 7, 40, 25, 58, 16, 41.8, 16, 49);
      kit.teaLounge(3.5, 11.5, 1.3);
      kit.teaLounge(3.5, 46.5, 1.3);
      counter(0.8, 0.8, 6.2, 4.2, "TEA \xB7 COFFEE");
      counter(0.8, 53.5, 6.2, 57, "PANTRY");
    },
    // ----- Hall 10 : B (three silent halls, open passage, EC Hall, IADVL Hall, silent halls B-1 to B-3) -----
    hallB() {
      floor("carpetPlum", 0, 0, 14, 18);
      floor("carpetPlum", 14, 0, 28, 18);
      floor("carpetPlum", 28, 0, 42, 18);
      floor("carpetGrey", 0, 18, 43.2, 40);
      floor("carpetPlum", 0, 40, 9, 58);
      floor("carpetPlum", 9, 40, 43.2, 58);
      wall("acoustic", 14, 0, 14, 18, 4.2, 0.25);
      wall("acoustic", 28, 0, 28, 18, 4.2, 0.25);
      wall("acoustic", 0, 18, 43.2, 18, 4.2, 0.25, [{ c: 7, w: 2.4 }, { c: 21, w: 2.4 }, { c: 35, w: 2.4 }]);
      wall("acoustic", 0, 40, 43.2, 40, 4.2, 0.25, [{ c: 4.5, w: 2.4 }, { c: 26, w: 2.4 }]);
      wall("acoustic", 9, 40, 9, 58, 4.2, 0.25, [{ c: 49, w: 2.4 }]);
      const silent = (id, u0, u1, name, sub, n) => {
        const m = (u0 + u1) / 2;
        confStage(m, 1, "S", name, { sub: "Silent hall" });
        seats({ x0: u0 + 1.2, z0: 6.8, x1: u1 - 1.2, z1: 17, face: "N", rowGroups: [5], seatGroups: [8, 8], aisle: 1.2, target: n });
        doorSign(name, m, 18.2, "S", 4.6, { sub });
        kit.room(id, u0, 0, u1, 18, m, 16.4, m, 8);
      };
      silent("industries-1", 0, 14, "INDUSTRIES MEETING 1", "Hall B-6 \xB7 silent", 80);
      silent("industries-2", 14, 28, "INDUSTRIES MEETING 2", "Hall B-5 \xB7 silent", 80);
      silent("industries-3", 28, 42, "INDUSTRIES MEETING 3", "Hall B-4 \xB7 silent", 80);
      counter(19, 27, 25, 30, "TEE \xB7 COFFEE LOUNGE");
      doorSign("EC", 4.5, 39.8, "N", 3.2, { sub: "Hall B-8" });
      kit.cyl("wood", 4.5, 0, 43.5, 1, 0.74, "#fff", 16);
      kit.cyl("wood", 4.5, 0, 51.5, 1, 0.74, "#fff", 16);
      box("wood", 3.5, 0, 43.5, 5.5, 0.74, 51.5);
      for (let k = 0; k < 35; k++) {
        const v = 42.6 + k * 0.25;
        kit.chair(2.8, v, DIR.E);
        kit.chair(6.2, v, DIR.W);
      }
      kit.solid(3.5, 43.5, 5.5, 51.5);
      kit.room("ec-hall", 0, 40, 9, 58, 4.5, 41.5, 4.5, 49);
      stage(26, 57.7, "N", { w: 20 * FT, d: 12 * FT, h: 2 * FT, ledW: 10 * FT, ledH: 8 * FT, title: "IADVL", sub: "Silent hall", panel: 6, wing: 0.8, backH: 4 });
      seats({ x0: 10.5, z0: 40.5, x1: 26.5, z1: 52.5, face: "S", rowGroups: [9], seatGroups: [15, 15], aisle: 1.2, target: 270 });
      [42, 45, 48, 51].forEach((v) => [29, 32.5, 36, 39.5].forEach((u) => {
        if (!(v === 51 && u >= 36)) kit.roundTable(u, v, 0.75, 6, "#efe9e2");
      }));
      doorSign("IADVL", 26, 39.8, "N", 5, { sub: "Hall B-7 \xB7 14 round tables" });
      kit.room("iadvl-hall", 9, 40, 43.2, 58, 26, 41.8, 26, 48);
      tripleHalls(["hall-b-2", "hall-b", "hall-b-3"], ["B-2", "B-1", "B-3"], [19.3, 24.2, 29.1, 34, 39]);
    },
    // ----- Hall 9 : C (International Hall, E-Poster area, SIG/Sister Halls 1-3, silent halls C-1 to C-3) -----
    hallC() {
      floor("carpetPlum", 0, 0, 16, 16);
      floor("carpetGrey", 16, 0, 43.2, 16);
      floor("carpetTeal", 0, 16, 43.2, 37);
      floor("carpetPlum", 0, 37, 14, 58);
      floor("carpetPlum", 14, 37, 29, 58);
      floor("carpetPlum", 29, 37, 43.2, 58);
      wall("acoustic", 16, 0, 16, 16, 4.2, 0.25, [{ c: 8, w: 2.4 }]);
      wall("acoustic", 0, 16, 16, 16, 4.2, 0.25, [{ c: 8, w: 2.4 }]);
      wall("acoustic", 0, 37, 43.2, 37, 4.2, 0.25, [{ c: 7, w: 2.4 }, { c: 21.5, w: 2.4 }, { c: 36, w: 2.4 }]);
      wall("acoustic", 14, 37, 14, 58, 4.2, 0.25);
      wall("acoustic", 29, 37, 29, 58, 4.2, 0.25);
      confStage(8, 1, "S", "INTERNATIONAL", { sub: "Silent hall" });
      seats({ x0: 1.5, z0: 6.8, x1: 14.5, z1: 15, face: "N", rowGroups: [5], seatGroups: [10, 10], aisle: 1, target: 100 });
      doorSign("INTERNATIONAL", 8, 16.2, "S", 5, { sub: "Hall C-7 \xB7 silent" });
      kit.room("international-hall", 0, 0, 16, 16, 8, 14.6, 8, 8);
      sign("E-POSTER", 29.5, 2.4, 15.6, "S", 9, 1.2, { gradient: ["#4a1766", "#a3195b", "#1f7fa6"], sub: "50 poster boards \xB7 27 \xD7 16 m", glow: true });
      for (let r = 0; r < 5; r++) for (let c = 0; c < 10; c++) {
        const u = 19 + c * 2.4, v = 2.5 + r * 2.6;
        box("panel", u - 0.6, 0, v - 0.05, u + 0.6, 1.8, v + 0.05, "#ffffff");
      }
      kit.room("e-poster", 16, 0, 43.2, 16, 30, 15, 30, 8);
      counter(19.5, 24, 25.5, 27, "TEE \xB7 COFFEE LOUNGE");
      const sig = (id, u0, u1, name, n, groups, cnum) => {
        const m = (u0 + u1) / 2;
        stage(m, 57.7, "N", { w: 40 * FT, d: 16 * FT, h: 3 * FT, ledW: 30 * FT, ledH: 8 * FT, title: name, sub: "Silent hall", panel: 7, wing: 0.6 });
        seats({ x0: u0 + 1, z0: 40.5, x1: u1 - 1, z1: 51.5, face: "S", rowGroups: [7], seatGroups: groups, aisle: 1.2, target: n });
        doorSign(name, m, 37.2, "N", 5, { sub: `Silent hall \xB7 Hall ${cnum}` });
        kit.room(id, u0, 37, u1, 58, m, 39.5, m, 48);
      };
      sig("sig-1", 0, 14, "SIG / SISTER 1", 103, [8, 7], "C-6");
      sig("sig-2", 14, 29, "SIG / SISTER 2", 98, [7, 7], "C-5");
      sig("sig-3", 29, 43.2, "SIG / SISTER 3", 101, [8, 7], "C-4");
      tripleHalls(["hall-c-2", "hall-c", "hall-c-3"], ["C-2", "C-1", "C-3"], [19.3, 24.2, 29.1, 34, 39]);
    },
    // ----- Hall 7 : Workshop Halls 1-6 + Exhibition Hall 2 -----
    hallE() {
      const x0 = 28.9, x1 = 78.5, cuts = [28.9, 45.4, 61.9, 78.5], doors = [37.1, 53.6, 70.1];
      floor("carpetBlue", x0, 0.7, x1, 20.5);
      floor("carpetBlue", x0, 37.2, x1, 57.3);
      floor("carpetGrey", x0, 20.5, x1, 37.2);
      kit.zone("the workshop corridor", x0, 20.5, x1, 37.2);
      [[0.7, 20.5, [3, 2, 1], "S"], [37.2, 57.3, [6, 5, 4], "N"]].forEach(([v0, v1, nums, aud]) => {
        const north = aud === "S", dv = north ? v1 : v0, bv = north ? v0 : v1;
        wall("acoustic", x0, dv, x1, dv, 4.2, 0.25, doors.map((c) => ({ c, w: 2.4 })));
        wall("acoustic", x0, bv, x1, bv, 4.2, 0.2);
        wall("acoustic", x0, v0, x0, v1, 4.2, 0.25);
        wall("acoustic", x1, v0, x1, v1, 4.2, 0.25);
        [cuts[1], cuts[2]].forEach((u) => wall("panel", u, v0, u, v1, 6 * FT, 0.12));
        nums.forEach((n, i) => {
          const a = cuts[i], c = cuts[i + 1], m = (a + c) / 2, name = `E${n}`;
          stage(m, north ? v0 + 0.5 : v1 - 0.5, aud, { w: 30 * FT, d: 10 * FT, h: 2 * FT, ledW: 20 * FT, ledH: 8 * FT, title: name, sub: "Silent hall", panel: 6, wing: 0.8 });
          seats({ x0: a + 1.2, z0: north ? v0 + 7.6 : v0 + 4.5, x1: c - 1.2, z1: north ? v1 - 3.6 : v1 - 7.6, face: north ? "N" : "S", rowGroups: [7], seatGroups: [8, 8], aisle: 1.5, target: 112 });
          doorSign(name, doors[i], dv + (north ? 0.16 : -0.16), north ? "S" : "N", 5);
          kit.room(`workshop-${n}`, a, v0, c, v1, doors[i], north ? v1 - 1.7 : v0 + 1.7, m, north ? v0 + 2 : v1 - 2);
        });
      });
      [35.6, 52.8, 71.3].forEach((u) => kit.teaLounge(u, 28.9, 2));
      expoStalls(EXPO2_STALLS, 114, 58);
      sign("EXHIBITION 2", 108, 5.2, 29, "E", 9, 1.6, { gradient: ["#1f7fa6", "#4a1766"], sub: "Stalls 201 – 286", glow: true });
      sign("E1 – E6", 83.62, 4.6, 29, "E", 9, 1.5, { gradient: ["#4a1766", "#a3195b"], sub: "Straight ahead", glow: true });
      box("matte", 83.4, 3.8, 24.4, 83.6, 5.4, 33.6, "#1b1730");
      [24.5, 33.5].forEach((v) => {
        box("metal", 83.35, 0, v - 0.15, 83.65, 3.8, v + 0.15, "#8a8f96");
        kit.solid(83.2, v - 0.3, 83.8, v + 0.3);
      });
      [25, 33].forEach((v) => cyl("metal", 108, 6, v, 0.03, 3, "#888", 6));
      kit.room("expo-2", 0, 0, 114, 58, 110.5, 29, 96, 29);
    },
    // ----- Hall 2 : Exhibition Hall 1 -----
    expo1() {
      expoStalls(EXPO1_STALLS, 114, 58);
      sign("EXHIBITION 1", 110.6, 5.2, 29, "E", 9, 1.6, { gradient: ["#1f7fa6", "#4a1766"], sub: "Stalls 101 – 118 \xB7 B \xB7 S \xB7 T \xB7 G \xB7 P \xB7 D", glow: true });
      [25, 33].forEach((v) => cyl("metal", 110.6, 6, v, 0.03, 3, "#888", 6));
      kit.room("expo-1", 0, 0, 114, 58, 110.5, 29, 96, 29);
    },
    // ----- Hall 7 : DINING AREA (46 round tables, 5 buffet lines) and Faculty Dining Area 65 x 20 m -----
    dining() {
      floor("carpetGrey", 0, 0, 114, 58);
      rug("carpetTeal", 48.5, 38, 114, 58);
      wall("acoustic", 48.5, 38, 114, 38, 4.2, 0.25, [{ c: 60, w: 2.4 }, { c: 95, w: 2.4 }]);
      wall("acoustic", 48.5, 38, 48.5, 58, 4.2, 0.25, [{ c: 47, w: 2.4 }]);
      doorSign("FACULTY DINING AREA", 66, 37.8, "N", 7, { sub: "Hall size 65 \xD7 20 m" });
      [
        [10, [13, 21.9, 30.8, 39.7, 48.7, 57.6, 66.5, 75.3, 84.2, 93.1]],
        [14.6, [9.6, 17.5, 26.4, 35.4, 44.3, 53.1, 62.1, 71, 79.9, 88.4, 96.9]],
        [20.4, [13, 21.9, 30.8, 39.7, 48.7, 57.6, 66.5, 75.3, 84.2, 93.1]],
        [37.6, [11.2, 20.1, 29, 38, 45.2]],
        [43.5, [6.8, 15.5, 24.5, 33.4, 40.6]],
        [49.1, [11.2, 20.1, 29, 38, 45.2]]
      ].forEach(([v, us]) => us.forEach((u) => kit.roundTable(u, v, 0.9, 8, "#f6f3ee")));
      [30.6, 43.5, 56.3, 69, 81.7].forEach((u, i) => {
        [27.6, 30.8].forEach((v) => {
          box("matte", u - 2, 0, v - 0.5, u + 2, 0.88, v + 0.5, "#f4f1ea");
          box("matte", u - 2.05, 0.88, v - 0.55, u + 2.05, 0.91, v + 0.55, "#7a2030");
          kit.solid(u - 2, v - 0.5, u + 2, v + 0.5);
          kit.navBlock(u - 2.6, v - 1.2, u + 2.6, v + 1.2);
          for (let c = 0; c < 4; c++) {
            const x = u - 1.4 + c * 0.93;
            box("metal", x - 0.32, 0.91, v - 0.24, x + 0.32, 1.05, v + 0.24, "#d5d5da");
            kit.sphere("metal", x, 1.05, v, 0.3, 0.16, 0.22, "#e3e3e8");
          }
        });
        sign(`BUFFET ${i + 1}`, u, 2.4, 27.1, "N", 2.6, 0.7, { bg: "#7a2030", emissive: 0.5 });
      });
      sign("DINING AREA", 57, 4.2, 0.42, "S", 14, 2, { gradient: ["#4a1766", "#a3195b", "#1f7fa6"], sub: "46 round tables \xB7 5 buffet lines", glow: true });
      sign("DINING ENTRY", 113.9, 5.3, 29, "W", 8, 1.2, { bg: "#1b1730", emissive: 0.5 });
      sign("DINING ENTRY", 0.1, 5.3, 29, "E", 8, 1.2, { bg: "#1b1730", emissive: 0.5 });
      kit.room("dining", 0, 0, 114, 38, 4, 29, 60, 29);
      kit.room("faculty-dining", 48.5, 38, 114, 58, 52, 47, 80, 48);
    },
    // ----- Hall 5 : Entertainment Hall (18 m high) -----
    entertainment() {
      floor("carpetPlum", 0, 0, 114, 70);
      stage(3.7, 34.7, "E", { w: 72 * FT, d: 16 * FT, h: 4 * FT, ledW: 60 * FT, ledH: 10 * FT, title: "ENTERTAINMENT", sub: "Gala evening", panel: 0, backH: 7.5, wing: 2 });
      [12, 56.8].forEach((v) => {
        box("metal", 8.4, 0, v - 6.3, 8.6, 5.4, v - 6.1, "#888");
        box("metal", 8.4, 0, v + 6.1, 8.6, 5.4, v + 6.3, "#888");
        box("matte", 8.45, 2, v - 6.2, 8.6, 5.3, v + 6.2, "#0b0b0e");
        sign("DERMACON 2027", 8.62, 3.65, v, "E", 40 * FT, 10 * FT, { glow: true, gradient: ["#3a1456", "#a3195b", "#1f7fa6"], sub: "Entertainment Hall", ppm: 60 });
        kit.solid(8.3, v - 6.3, 8.7, v + 6.3);
      });
      seats({ x0: 23.5, z0: 3, x1: 101.5, z1: 65.8, face: "W", rowGroups: [8, 8, 8, 8, 8, 8, 8], seatGroups: [13, 13, 13, 13, 13, 13], aisle: 2.2, pitch: 1.15, target: 4368 });
      kit.room("entertainment", 0, 0, 114, 70, 108.5, 35, 10, 35);
    },
    // ----- Hall 12-A : Registration Hall. West half: registration counters. East half: kit distribution with trolley bags -----
    registration() {
      floor("carpetGrey", 0, 0, 74, 28);
      box("carpetRed", 0, 0.1, 11.5, 60, 0.135, 16.5);
      wall("panel", 37, 0, 37, 28, 3.2, 0.2, [{ c: 14, w: 4, h: 2.6 }]);
      rug("carpetBlue", 37, 0, 74, 28);
      sign("REGISTRATION", 18.5, 3.7, 0.42, "S", 14, 1.9, { gradient: ["#4a1766", "#a3195b", "#1f7fa6"], sub: "Badges \xB7 Welcome kit \xB7 Help desk", glow: true });
      sign("KIT AREA", 55.5, 3.7, 0.42, "S", 16, 1.9, { gradient: ["#1f7fa6", "#4a1766"], sub: "Conference kit \xB7 collect your trolley bag", glow: true });
      for (let i = 0; i < 6; i++) {
        const u = 6 + i * 5.2;
        box("matte", u - 1.9, 0, 4, u + 1.9, 1.05, 4.9, "#ffffff");
        box("brand", u - 1.9, 0, 4.9, u + 1.9, 1.05, 4.96);
        box("matte", u - 1.95, 1.05, 3.95, u + 1.95, 1.1, 5, "#1b1730");
        kit.solid(u - 1.9, 4, u + 1.9, 4.9);
        sign(`COUNTER ${i + 1}`, u, 2.9, 1.32, "S", 3.8, 0.8, { bg: i === 0 ? "#a3195b" : "#1f7fa6", top: i === 0 ? "FACULTY" : void 0, emissive: 0.55 });
        kit.chair(u - 0.6, 3.2, DIR.S);
        kit.chair(u + 0.6, 3.2, DIR.S);
        box("matte", u - 0.35, 1.1, 4.2, u + 0.35, 1.5, 4.25, "#0c0c10");
      }
      for (let k = 0; k < 4; k++) {
        cyl("metal", 6 - 1.8, 0, 6.5 + k * 1.6, 0.03, 0.95, "#c9a94a", 8);
      }
      kit.roundTable(10, 14, 0.8, 6, "#efe9e2");
      kit.roundTable(22, 14, 0.8, 6, "#efe9e2");
      box("matte", 26, 0, 20, 33, 1.05, 21, "#ffffff");
      kit.solid(26, 20, 33, 21);
      sign("HELP DESK", 29.5, 2.6, 21.6, "N", 5, 0.9, { bg: "#1b1730", emissive: 0.5, both: true });
      for (let i = 0; i < 6; i++) {
        const u = 41 + i * 5.2;
        box("matte", u - 1.9, 0, 4, u + 1.9, 1.05, 4.9, "#f4f1ea");
        box("brand", u - 1.9, 0, 4.9, u + 1.9, 1.05, 4.96);
        sign(`KIT ${i + 1}`, u, 2.6, 1.32, "S", 3.6, 0.75, { bg: "#5b1f6e", emissive: 0.55 });
        kit.solid(u - 1.9, 4, u + 1.9, 4.9);
      }
      const COLS = ["#1b1730", "#c9367c", "#1f7fa6", "#5b1f6e", "#2f6f4f", "#c9772c"];
      const trolley = (u, v, c) => {
        box("matte", u - 0.24, 0.2, v - 0.17, u + 0.24, 0.72, v + 0.17, c);
        box("matte", u - 0.26, 0.72, v - 0.19, u + 0.26, 0.76, v + 0.19, "#2a2a30");
        box("metal", u - 0.22, 0.14, v - 0.14, u - 0.18, 0.8, v - 0.1, "#c9c9cf");
        box("matte", u - 0.23, 0.78, v - 0.15, u - 0.17, 0.82, v - 0.11, "#222");
        [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a2, b2]) => cyl("matte", u + a2 * 0.17, 0, v + b2 * 0.11, 0.05, 0.04, "#1d1d22", 8));
        box("matte", u - 0.14, 0.34, v + 0.175, u + 0.14, 0.5, v + 0.18, "#ffffff");
      };
      let t = 0;
      for (let r = 0; r < 4; r++) for (let c = 0; c < 6; c++) {
        trolley(43 + c * 4.9, 14 + r * 2.2, COLS[t % COLS.length]);
        t++;
      }
      box("wood", 60.5, 0, 22.5, 70, 0.75, 25.5, "#8a5a34");
      kit.solid(60.5, 22.5, 70, 25.5);
      for (let k = 0; k < 6; k++) box("matte", 61.2 + k % 3 * 2.9, 0.75, 23.1 + Math.floor(k / 3) * 1.4, 63.3 + k % 3 * 2.9, 0.75 + 0.3, 24.1 + Math.floor(k / 3) * 1.4, COLS[k % COLS.length]);
      kit.plant(1.2, 1.2, 1.4);
      kit.plant(1.2, 26.8, 1.4);
      kit.room("registration", 0, 0, 37, 28, 4, 14, 18, 6);
      kit.room("kit-distribution", 37, 0, 74, 28, 41, 14, 58, 6);
    }
  };
  BUILDINGS.forEach(shell);
  (function dome() {
    const { cx, cz, r } = DOME;
    kit.push(cx, cz);
    cyl("concrete", 0, -0.4, 0, r + 1, 0.48, "#fff", 48);
    cyl("carpetTeal", 0, 0.05, 0, r - 0.4, 0.06, "#fff", 48);
    const N = 44;
    for (let i = 0; i < N; i++) {
      const a = (i + 0.5) / N * Math.PI * 2, deg = a * 180 / Math.PI;
      if (deg > 340 || deg < 20 || deg > 250 && deg < 290) continue;
      const x = Math.cos(a) * r, z = Math.sin(a) * r, seg = 2 * Math.PI * r / N + 0.1;
      kit.boxc("clad", x, 2.5, z, 0.5, 5, seg, -a);
      kit.boxc("glass", x, 6.2, z, 0.2, 2.4, seg, -a);
      kit.solid(x - 2, z - 2, x + 2, z + 2);
    }
    roof(() => {
      kit.dome("roof", 0, 7.4, 0, r + 0.7, 10.6);
    });
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI * 2 + 0.9, x = Math.cos(a) * (r - 4), z = Math.sin(a) * (r - 4);
      kit.push(x, z, -a + Math.PI);
      box("matte", -1, 0, -2, 1, 1, 2, "#ffffff");
      box("matte", -1.2, 2.3, -2.2, 1.2, 3, 2.2, ["#a3195b", "#1f7fa6", "#5b1f6e", "#c9772c"][i % 4]);
      box("metal", -1.1, 0, -2.1, -1, 2.3, -2, "#999");
      box("metal", -1.1, 0, 2, -1, 2.3, 2.1, "#999");
      kit.solid(-1, -2, 1, 2);
      sign(`FOOD STALL ${i + 1}`, 1.22, 2.65, 0, "E", 3.6, 0.6, { bg: "#1b1730", emissive: 0.5 });
      kit.pop();
    }
    kit.beginChairs();
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * Math.PI * 2, d = i % 2 ? 9 : 15;
      kit.roundTable(Math.cos(a) * d, Math.sin(a) * d, 0.8, 5);
    }
    kit.endChairs("h3", "#2f6f8f");
    cyl("matte", 0, 0, 0, 2.2, 0.5, "#e8e4dc", 24);
    kit.sphere("foliage", 0, 2, 0, 2, 2.2, 2, "#3f7d3a");
    kit.solid(-2.2, -2.2, 2.2, 2.2);
    sign("FOOD COURT \xB7 SPOUSE AREA", r + 1.4, 4.2, 0, "E", 12, 1.6, { gradient: ["#4a1766", "#a3195b", "#1f7fa6"], glow: true });
    sign("FOOD COURT \xB7 SPOUSE AREA", 0, 4.2, -r - 1.4, "N", 12, 1.6, { gradient: ["#4a1766", "#a3195b", "#1f7fa6"], glow: true });
    kit.zone("the Food Court \xB7 Spouse Area", -r, -r, r, r, { building: "h3" });
    kit.cost(-r, -r, r, r, 1.3);
    kit.room("food-court", -r, -r, r, r, r - 3, 0, 0, 0);
    kit.pop();
  })();
  (function admin() {
    const [x0, z0, x1, z1] = ADMIN.rect, w = x1 - x0, d = z1 - z0, H = 7.5;
    kit.push(x0, z0);
    box("concrete", -0.5, -0.4, -0.5, w + 0.5, 0.08, d + 0.5);
    floor("wood", 0, 0, w, d);
    wall("clad", 0, 0, w, 0, H, 0.4, [{ c: w / 2, w: 3.2, h: 2.8 }], "#f3d9b5");
    wall("clad", 0, d, w, d, H, 0.4, [], "#f3d9b5");
    wall("clad", 0, 0, 0, d, H, 0.4, [], "#f3d9b5");
    wall("clad", w, 0, w, d, H, 0.4, [], "#f3d9b5");
    [2.2, 5.4].forEach((y) => {
      box("glass", 1.5, y - 0.7, -0.25, w / 2 - 2.6, y + 0.7, -0.18);
      box("glass", w / 2 + 2.6, y - 0.7, -0.25, w - 1.5, y + 0.7, -0.18);
    });
    box("glass", w / 2 - 1.6, 3.4, -0.25, w / 2 + 1.6, 6.2, -0.18);
    roof(() => {
      box("satin", -0.8, H, -0.8, w + 0.8, H + 0.35, d + 0.8, "#d9c3a2");
      box("matte", 0, 3.6, 0, w, 3.75, d, "#e9e6df");
    });
    box("satin", w / 2 - 2.6, 2.9, -2.6, w / 2 + 2.6, 3.1, 0, "#ffffff");
    [-2.3, 2.3].forEach((k) => cyl("metal", w / 2 + k, 0, -2.3, 0.1, 2.9, "#aaa", 10));
    sign("ADMIN", w / 2, 4.3, -0.3, "N", 14, 1.5, { gradient: ["#4a1766", "#a3195b"], glow: true });
    kit.beginChairs();
    box("wood", w / 2 - 2.5, 0, 5, w / 2 + 2.5, 1.05, 5.9);
    kit.solid(w / 2 - 2.5, 5, w / 2 + 2.5, 5.9);
    sign("RECEPTION", w / 2, 1.9, 6.57, "N", 3, 0.6, { bg: "#1b1730", emissive: 0.5 });
    box("matte", w / 2 - 1.6, 0, 6.6, w / 2 + 1.6, 2.6, 6.7, "#3d2230");
    wall("panel", 0, 9, w, 9, 3.6, 0.15, [{ c: 6, w: 1.6, h: 2.3 }, { c: w - 6, w: 1.6, h: 2.3 }]);
    wall("panel", w / 2, 9, w / 2, d, 3.6, 0.15);
    [[w * 0.25, "MEETING ROOM 1"], [w * 0.75, "MEETING ROOM 2"]].forEach(([u, t]) => {
      box("wood", u - 3.2, 0.7, 12.4, u + 3.2, 0.76, 14.6);
      box("matte", u - 2.8, 0, 13.2, u + 2.8, 0.7, 13.8, "#2a2a30");
      kit.navBlock(u - 4, 11.6, u + 4, 15.4);
      for (let k = 0; k < 6; k++) {
        kit.chair(u - 2.6 + k * 1.04, 11.9, DIR.S);
        kit.chair(u - 2.6 + k * 1.04, 15.1, DIR.N);
      }
      sign(t, u < w / 2 ? 6 : w - 6, 2.75, 8.9, "N", 3.4, 0.55, { bg: "#1b1730", emissive: 0.5 });
    });
    kit.sofa(2, 3, DIR.E, 2, "#3f5f7a");
    kit.sofa(w - 2, 3, DIR.W, 2, "#3f5f7a");
    kit.plant(1, 7.8, 1.2);
    kit.plant(w - 1, 7.8, 1.2);
    kit.endChairs("admin", "#2b3a55");
    kit.zone("Admin", 0, 0, w, d, { building: "admin" });
    kit.cost(0, 0, w, d, 1.3);
    kit.room("organizing-office", 0, 0, w, d, w / 2, 2.6, w / 2, 7);
    kit.pop();
  })();
}

// src/traffic.js
// Moving cars, autorickshaws and city buses on the outer roads (left-hand traffic, as in India).
function createTraffic(kit, parent, { low = false } = {}) {
  const KINDS = [["car", "#f2f2f2"], ["car", "#c9ccd1"], ["car", "#1b1b1f"], ["car", "#b3262e"], ["car", "#2a5db0"], ["car", "#8a8f98"], ["auto", "#2f8f3a"], ["bus", "#c8372d"]];
  let seed = 31;
  const rnd = () => (seed = seed * 16807 % 2147483647) / 2147483647;
  const lists = KINDS.map(() => []);
  const gapMul = low ? 1.7 : 1;
  OUTER_ROADS.forEach((R2) => {
    const len = R2.to - R2.from;
    [1, -1].forEach((dir) => {
      for (let l = 0; l < R2.lanes; l++) {
        const side = R2.axis === "x" ? -dir : dir;
        const u = R2.c + side * (R2.median / 2 + LANE * (l + 0.5));
        const outer = l === R2.lanes - 1;
        const speed = (outer ? 8.5 : 12.5) * (0.9 + rnd() * 0.2);
        let a = rnd() * 20;
        while (a < len - 10) {
          const r = rnd();
          const k = outer && r < 0.08 ? 7 : outer && r < 0.3 ? 6 : Math.floor(rnd() * 6);
          lists[k].push({ R: R2, u, dir, speed, a, len });
          a += (k === 7 ? 34 : 24) + rnd() * 46 * gapMul;
        }
      }
    });
  });
  const m4 = new THREE2.Matrix4();
  const meshes = KINDS.map(([kind, color], k) => {
    const n = lists[k].length;
    if (!n) return null;
    const im = new THREE2.InstancedMesh(kit.vehicleGeometry(kind, color), kit.M.matte, n);
    im.name = "traffic:" + kind + ":" + k;
    im.frustumCulled = false;
    im.castShadow = false;
    im.receiveShadow = true;
    parent.add(im);
    return im;
  });
  function update(dt) {
    meshes.forEach((im, k) => {
      if (!im) return;
      const L = lists[k];
      for (let i = 0; i < L.length; i++) {
        const v = L[i];
        v.a = (v.a + v.speed * dt) % v.len;
        const along = v.dir > 0 ? v.R.from + v.a : v.R.to - v.a;
        let x, z, rot;
        if (v.R.axis === "x") {
          x = along;
          z = v.u;
          rot = v.dir > 0 ? 0 : Math.PI;
        } else {
          x = v.u;
          z = along;
          rot = v.dir > 0 ? -Math.PI / 2 : Math.PI / 2;
        }
        m4.makeRotationY(rot).setPosition(x, 0.035, z);
        im.setMatrixAt(i, m4);
      }
      im.instanceMatrix.needsUpdate = true;
    });
  }
  update(0);
  return { update, count: lists.reduce((s, L) => s + L.length, 0) };
}

// src/nav.js
function createNav({ bounds, colliders, navBlocks, costRects, zones, cell = 1 }) {
  const minX = bounds.minX, minZ = bounds.minZ, nx = Math.ceil((bounds.maxX - minX) / cell), nz = Math.ceil((bounds.maxZ - minZ) / cell);
  const cost = new Float32Array(nx * nz).fill(1.7);
  const blocked = new Uint8Array(nx * nz);
  const ix = (x) => Math.max(0, Math.min(nx - 1, Math.floor((x - minX) / cell))), iz = (z) => Math.max(0, Math.min(nz - 1, Math.floor((z - minZ) / cell)));
  const fill = (r, fn) => {
    for (let j = iz(r[1]); j <= iz(r[3] - 1e-6); j++) for (let i = ix(r[0]); i <= ix(r[2] - 1e-6); i++) fn(j * nx + i);
  };
  costRects.forEach((r) => fill(r, (k) => {
    cost[k] = r[4] === 1 ? 1 : cost[k] === 1 ? 1 : r[4];
  }));
  const pad = 0.5;
  const block = (r, p) => {
    const a = ix(r[0] - p), b = ix(r[2] + p), c = iz(r[1] - p), d = iz(r[3] + p);
    for (let j = c; j <= d; j++) for (let i = a; i <= b; i++) {
      const cx = minX + (i + 0.5) * cell, cz = minZ + (j + 0.5) * cell;
      if (cx > r[0] - p && cx < r[2] + p && cz > r[1] - p && cz < r[3] + p) blocked[j * nx + i] = 1;
    }
  };
  colliders.forEach((r) => block(r, pad));
  navBlocks.forEach((r) => block(r, 0));
  const free = (i, j) => i >= 0 && j >= 0 && i < nx && j < nz && !blocked[j * nx + i];
  function nearestFree(x, z) {
    let i = ix(x), j = iz(z);
    if (free(i, j)) return [i, j];
    for (let r = 1; r < 14; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) if (Math.max(Math.abs(di), Math.abs(dj)) === r && free(i + di, j + dj)) return [i + di, j + dj];
    return [i, j];
  }
  function route(from, to) {
    const [si, sj] = nearestFree(from[0], from[1]), [ti, tj] = nearestFree(to[0], to[1]);
    const N = nx * nz, g = new Float32Array(N).fill(Infinity), prev = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
    const heap = [];
    const pushH = (k, f) => {
      heap.push([f, k]);
      let i = heap.length - 1;
      while (i > 0) {
        const p = i - 1 >> 1;
        if (heap[p][0] <= heap[i][0]) break;
        [heap[p], heap[i]] = [heap[i], heap[p]];
        i = p;
      }
    };
    const popH = () => {
      const top = heap[0], last = heap.pop();
      if (heap.length) {
        heap[0] = last;
        let i = 0;
        for (; ; ) {
          let l = 2 * i + 1, r = l + 1, m = i;
          if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
          if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
          if (m === i) break;
          [heap[m], heap[i]] = [heap[i], heap[m]];
          i = m;
        }
      }
      return top;
    };
    const s = sj * nx + si, t = tj * nx + ti;
    g[s] = 0;
    pushH(s, 0);
    const h = (i, j) => Math.hypot(i - ti, j - tj) * cell;
    const NB = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.4142], [1, -1, 1.4142], [-1, 1, 1.4142], [-1, -1, 1.4142]];
    let found = false;
    while (heap.length) {
      const [, k] = popH();
      if (closed[k]) continue;
      closed[k] = 1;
      if (k === t) {
        found = true;
        break;
      }
      const i = k % nx, j = (k - i) / nx;
      for (const [di, dj, d] of NB) {
        const a = i + di, b = j + dj;
        if (!free(a, b)) continue;
        if (di && dj && (!free(a, j) || !free(i, b))) continue;
        const q = b * nx + a;
        if (closed[q]) continue;
        const ng = g[k] + d * cell * (cost[k] + cost[q]) / 2;
        if (ng < g[q]) {
          g[q] = ng;
          prev[q] = k;
          pushH(q, ng + h(a, b));
        }
      }
    }
    if (!found) return null;
    const cells = [];
    for (let k = t; k !== -1; k = prev[k]) cells.push(k);
    cells.reverse();
    let pts = cells.map((k) => {
      const i = k % nx, j = (k - i) / nx;
      return [minX + (i + 0.5) * cell, minZ + (j + 0.5) * cell];
    });
    pts = smooth(pts);
    pts[0] = [from[0], from[1]];
    pts[pts.length - 1] = [to[0], to[1]];
    return finish(pts);
  }
  function segCost(a, b) {
    const d = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(d / (cell * 0.5)));
    let c = 0;
    for (let s = 0; s <= n; s++) {
      const x = a[0] + (b[0] - a[0]) * s / n, z = a[1] + (b[1] - a[1]) * s / n, k = iz(z) * nx + ix(x);
      if (blocked[k]) return Infinity;
      c += cost[k];
    }
    return c / (n + 1) * d;
  }
  function smooth(pts) {
    if (pts.length < 3) return pts;
    const acc = [0];
    for (let i2 = 1; i2 < pts.length; i2++) acc.push(acc[i2 - 1] + segCost(pts[i2 - 1], pts[i2]));
    const out = [pts[0]];
    let i = 0;
    while (i < pts.length - 1) {
      let best = i + 1;
      for (let j = Math.min(pts.length - 1, i + 220); j > i + 1; j--) {
        const c = segCost(pts[i], pts[j]);
        if (c <= (acc[j] - acc[i]) * 1.03 + 0.2) {
          best = j;
          break;
        }
      }
      out.push(pts[best]);
      i = best;
    }
    return out;
  }
  function zoneAt(x, z) {
    let best = null, area = Infinity;
    for (const zn of zones) {
      const r = zn.r;
      if (x >= r[0] && x <= r[2] && z >= r[1] && z <= r[3]) {
        const a = (r[2] - r[0]) * (r[3] - r[1]);
        if (a < area) {
          area = a;
          best = zn;
        }
      }
    }
    return best;
  }
  function finish(pts) {
    let len = 0;
    const cum = [0];
    for (let i = 1; i < pts.length; i++) {
      len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      cum.push(len);
    }
    return { points: pts, cum, length: len };
  }
  const compass = (dx, dz) => {
    const a = Math.atan2(dx, -dz) * 180 / Math.PI;
    return ["north", "north-east", "east", "south-east", "south", "south-west", "west", "north-west"][Math.round((a + 360) % 360 / 45) % 8];
  };
  const turnWord = (a) => {
    const d = a * 180 / Math.PI;
    if (Math.abs(d) < 28) return "Continue straight";
    if (Math.abs(d) > 150) return "Turn around";
    return (d > 0 ? "Turn right" : "Turn left") + (Math.abs(d) < 60 ? " slightly" : "");
  };
  function directions(rt, describe, destName) {
    const P2 = rt.points, steps = [];
    if (P2.length < 2) return steps;
    const samples = [];
    const stepLen = 1;
    for (let i = 1; i < P2.length; i++) {
      const d = Math.hypot(P2[i][0] - P2[i - 1][0], P2[i][1] - P2[i - 1][1]), n = Math.max(1, Math.round(d / stepLen));
      for (let s = i === 1 ? 0 : 1; s <= n; s++) {
        const t = s / n;
        samples.push({ x: P2[i - 1][0] + (P2[i][0] - P2[i - 1][0]) * t, z: P2[i - 1][1] + (P2[i][1] - P2[i - 1][1]) * t, seg: i, d: rt.cum[i - 1] + d * t });
      }
    }
    let cur = null, startD = 0, startS = samples[0];
    const flush = (endD, endS, nextName) => {
      const dist = endD - startD;
      if (dist < 2.5 && steps.length) {
        return;
      }
      steps.push({ place: cur, dist, from: [startS.x, startS.z], to: [endS.x, endS.z], next: nextName, at: startD });
    };
    for (const s of samples) {
      const zn = zoneAt(s.x, s.z), name = describe(zn);
      if (cur === null) {
        cur = name;
        continue;
      }
      if (name.label !== cur.label) {
        flush(s.d, s, name);
        cur = name;
        startD = s.d;
        startS = s;
      }
    }
    flush(rt.length, samples[samples.length - 1], { label: destName });
    let prevDir = null;
    steps.forEach((st, i) => {
      const dx = st.to[0] - st.from[0], dz = st.to[1] - st.from[1], dir = Math.atan2(dz, dx);
      let lead;
      if (prevDir === null) lead = `Head ${compass(dx, dz)}`;
      else {
        let a = dir - prevDir;
        while (a > Math.PI) a -= 2 * Math.PI;
        while (a < -Math.PI) a += 2 * Math.PI;
        lead = turnWord(a);
      }
      prevDir = dir;
      const m = Math.max(5, Math.round(st.dist / 5) * 5);
      st.text = `${lead} ${st.place.verb || "through"} ${st.place.label} for about ${m} m`;
      st.then = i === steps.length - 1 ? `You have arrived at ${destName}.` : `until you reach ${st.next.label}.`;
    });
    return steps;
  }
  return { route, zoneAt, directions, blocked, cost, nx, nz, cell, minX, minZ, isFree: (x, z) => !blocked[iz(z) * nx + ix(x)], nearest: (x, z) => {
    const [i, j] = nearestFree(x, z);
    return [minX + (i + 0.5) * cell, minZ + (j + 0.5) * cell];
  } };
}

// src/ui.js
var CSS = `
.dv3{--ink:#16132a;--panel:rgba(22,19,42,.9);--line:rgba(255,255,255,.14);--text:#f3f0f7;--mute:#b9b3cc;--accent:#d63d86;--accent2:#39a9d6;--ok:#58c08a;
  position:relative;width:100%;height:100%;min-height:320px;overflow:hidden;background:#bcd3e6;color:var(--text);font-family:var(--dv3-font,"Barlow","Segoe UI",system-ui,sans-serif);font-size:14px;line-height:1.35;-webkit-user-select:none;user-select:none;touch-action:none}
.dv3 *{box-sizing:border-box}
.dv3 [hidden]{display:none!important}
.dv3 canvas.dv3-gl{position:absolute;inset:0;width:100%;height:100%;display:block;outline:none;cursor:grab}
.dv3 canvas.dv3-gl:active{cursor:grabbing}
.dv3-labels{position:absolute;inset:0;pointer-events:none;overflow:hidden}
.dv3-lab{position:absolute;left:0;top:0;transform:translate(-50%,-100%);white-space:nowrap;pointer-events:auto;cursor:pointer;border:0;font:inherit;color:#fff;background:rgba(22,19,42,.86);padding:3px 9px 4px;border-radius:4px;font-weight:700;letter-spacing:.02em;font-size:12px;text-align:center;box-shadow:0 2px 10px rgba(0,0,0,.28);will-change:transform}
.dv3-lab small{display:block;font-weight:500;font-size:10px;color:#d8d2ea;letter-spacing:.03em}
.dv3-lab::after{content:"";position:absolute;left:50%;bottom:-5px;margin-left:-5px;border:5px solid transparent;border-bottom:0;border-top-color:rgba(22,19,42,.86)}
.dv3-lab.b{font-size:13px;background:rgba(74,23,102,.92)} .dv3-lab.b::after{border-top-color:rgba(74,23,102,.92)}
.dv3-lab.idle{background:rgba(70,74,84,.7);font-weight:500} .dv3-lab.idle::after{border-top-color:rgba(70,74,84,.7)}
.dv3-lab.park{background:#1a73e8;border:1.5px solid #fff;border-radius:6px;font-size:13px;z-index:5} .dv3-lab.park::after{border-top-color:#1a73e8}
.dv3-lab.poi{background:rgba(70,74,84,.85);font-size:11px;font-weight:600;padding:2px 8px} .dv3-lab.poi::after{border-top-color:rgba(70,74,84,.85)}
.dv3-lab.gate{background:#fff;color:#16132a;border-radius:999px;padding:2px 8px;font-size:11px} .dv3-lab.gate::after{border-top-color:#fff}
.dv3-lab.main{background:#d63d86;font-size:14px;padding:4px 10px 5px;border:1.5px solid #fff;border-radius:6px;z-index:6;animation:dv3pulse 1.6s ease-in-out infinite} .dv3-lab.main small{font-size:10px;color:#fff;font-weight:600} .dv3-lab.main::after{border-top-color:#d63d86;border-width:6px;bottom:-6px;margin-left:-6px}
@keyframes dv3pulse{0%,100%{box-shadow:0 0 0 0 rgba(214,61,134,.7)}50%{box-shadow:0 0 0 8px rgba(214,61,134,0)}}
.dv3-lab.sel{background:var(--accent);font-size:14px;z-index:5} .dv3-lab.sel::after{border-top-color:var(--accent)}
.dv3-lab:focus-visible,.dv3 button:focus-visible,.dv3 select:focus-visible{outline:2px solid #fff;outline-offset:2px}
.dv3-panel{position:absolute;left:12px;top:62px;width:290px;max-width:calc(100% - 24px);max-height:calc(100% - 74px);display:flex;flex-direction:column;background:var(--panel);border:1px solid var(--line);border-radius:10px;backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);box-shadow:0 10px 40px rgba(10,8,30,.35);-webkit-user-select:text;user-select:text;touch-action:auto}
.dv3-lrow{display:flex;align-items:center;justify-content:space-between;gap:10px}
.dv3-head h1{margin:0;font-family:var(--dv3-display,"Barlow Condensed","Barlow",sans-serif);font-size:22px;line-height:1;font-weight:700;letter-spacing:.04em}
.dv3-head h1 b{color:var(--accent)}
.dv3-head p{margin:3px 0 0;font-size:11.5px;color:var(--mute)}
.dv3-head .grow{flex:1;min-width:0}
.dv3-rgt{display:flex;flex-direction:column;align-items:flex-end;gap:2px}
.dv3-loc{border:0;background:transparent;padding:3px 8px;cursor:pointer;line-height:0}
.dv3-loc i{display:block;width:12px;height:12px;border-radius:50%;background:#4285f4;border:2px solid #fff;box-shadow:0 0 0 5px rgba(66,133,244,.28)}
.dv3-loc[aria-pressed="true"] i{box-shadow:0 0 0 5px rgba(66,133,244,.5)}
.dv3-fold{display:none;border:1px solid var(--line);background:transparent;color:var(--text);border-radius:6px;padding:3px 10px;font:inherit;font-size:12px;cursor:pointer}
.dv3-body{padding:10px 12px 12px;overflow:auto;display:flex;flex-direction:column;gap:8px}
.dv3-field{display:flex;flex-direction:column;gap:4px}
.dv3-field label{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--mute);font-weight:600}
.dv3 select{width:100%;appearance:none;-webkit-appearance:none;background:#221d3a url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8'%3E%3Cpath d='M1 1l5 5 5-5' fill='none' stroke='%23fff' stroke-width='1.6'/%3E%3C/svg%3E") no-repeat right 11px center;color:var(--text);border:1px solid var(--line);border-radius:7px;padding:7px 28px 7px 10px;font:inherit;font-weight:600;cursor:pointer}
.dv3 select.small{font-weight:500;font-size:13px;padding:6px 28px 6px 10px}
.dv3-gmap{display:flex;align-items:center;gap:6px;background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:10px 12px;color:#fff;text-decoration:none;font:inherit;font-weight:400;backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)}
.dv3-gmap img{width:auto;height:17px;flex:none}
.dv3-gmap:hover{border-color:#fff}
.dv3-seg button.rt{padding:7px 12px}
.dv3-card{border:1px solid var(--line);border-radius:8px;padding:8px 10px;background:rgba(255,255,255,.04)}
.dv3-card h2{margin:0 0 6px;font-family:var(--dv3-display,"Barlow Condensed","Barlow",sans-serif);font-size:20px;line-height:1.05;letter-spacing:.03em;font-weight:700}
.dv3-chips{display:flex;flex-wrap:wrap;gap:5px}
.dv3-chip{font-size:11.5px;padding:2px 8px;border-radius:999px;background:rgba(255,255,255,.1);color:#e9e5f3;font-variant-numeric:tabular-nums}
.dv3-chip.k{background:rgba(214,61,134,.25);color:#ffd3e6}
.dv3-sum{margin:8px 0 0;font-size:13px;color:#e9e5f3;font-variant-numeric:tabular-nums}
.dv3-sum b{color:#fff;font-size:15px}
.dv3-row{display:flex;gap:8px;flex-wrap:wrap}
.dv3-btn{flex:1 1 auto;border:1px solid var(--line);background:rgba(255,255,255,.07);color:var(--text);border-radius:7px;padding:7px 8px;font:inherit;font-weight:600;cursor:pointer;white-space:nowrap}
.dv3-btn:hover{background:rgba(255,255,255,.14)}
.dv3-btn.pri{background:var(--accent);border-color:var(--accent);color:#fff} .dv3-btn.pri:hover{background:#e3559a}
.dv3-btn[disabled]{opacity:.45;cursor:default}
.dv3-steps{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:0;counter-reset:s}
.dv3-steps li{position:relative;padding:7px 0 7px 30px;border-top:1px solid var(--line);font-size:13px;counter-increment:s}
.dv3-steps li:first-child{border-top:0}
.dv3-steps li::before{content:counter(s);position:absolute;left:0;top:7px;width:21px;height:21px;border-radius:50%;background:rgba(57,169,214,.28);color:#d4f0fc;font-size:11.5px;font-weight:700;display:grid;place-items:center}
.dv3-steps li.arr::before{content:"";background:var(--accent)}
.dv3-steps li span{color:var(--mute)}
.dv3-top{position:absolute;left:12px;right:12px;top:12px;display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:flex-end;touch-action:auto;pointer-events:none}
.dv3-top>*{pointer-events:auto}
.dv3-brand{margin-right:auto;font-family:var(--dv3-display,"Barlow Condensed","Barlow",sans-serif);font-size:24px;line-height:1;font-weight:700;letter-spacing:.05em;color:#fff;background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:8px 12px;backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);white-space:nowrap}
.dv3-brand b{color:var(--accent)}
.dv3-seg{display:flex;background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:3px;backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)}
.dv3-seg button{border:0;background:transparent;color:var(--mute);font:inherit;font-weight:600;padding:7px 12px;border-radius:6px;cursor:pointer}
.dv3-seg button[aria-pressed="true"]{background:#fff;color:#16132a}
.dv3-hint{position:absolute;left:50%;bottom:12px;transform:translateX(-50%);background:var(--panel);border:1px solid var(--line);border-radius:999px;padding:6px 14px;font-size:12px;color:#e3def0;white-space:nowrap;max-width:calc(100% - 24px);overflow:hidden;text-overflow:ellipsis;pointer-events:none}
.dv3-here{position:absolute;left:50%;top:12px;transform:translateX(-50%);background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:6px 14px;text-align:center;pointer-events:none;display:none}
.dv3-here small{display:block;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--mute)}
.dv3-here b{font-family:var(--dv3-display,"Barlow Condensed","Barlow",sans-serif);font-size:19px;letter-spacing:.04em}
.dv3-map{position:absolute;right:12px;bottom:12px;width:210px;height:150px;border-radius:8px;border:1px solid var(--line);background:var(--panel);display:block}
.dv3-toast{position:absolute;left:50%;top:22%;transform:translate(-50%,-50%);background:var(--accent);color:#fff;padding:12px 22px;border-radius:10px;font-family:var(--dv3-display,"Barlow Condensed","Barlow",sans-serif);font-size:24px;font-weight:700;letter-spacing:.04em;box-shadow:0 10px 40px rgba(10,8,30,.4);opacity:0;transition:opacity .35s;pointer-events:none;text-align:center}
.dv3-toast.on{opacity:1}
.dv3-load{position:absolute;inset:0;display:grid;place-items:center;background:#16132a;color:#fff;font-size:15px;letter-spacing:.06em;z-index:20;transition:opacity .5s}
.dv3.walk .dv3-here{display:block}
@media (max-width:720px){
  .dv3-panel{left:8px;right:8px;top:auto;bottom:8px;width:auto;max-width:none;max-height:58%}
  .dv3-fold{display:block}
  .dv3-panel.folded{left:auto;width:auto}
  .dv3-panel.folded .dv3-body>*:not(.dv3-to),.dv3-panel.folded .dv3-to select{display:none}
  .dv3-top{left:8px;right:8px;top:8px;gap:6px}
  .dv3-brand{font-size:19px;padding:7px 10px}
  .dv3-seg button{padding:6px 9px;font-size:12.5px}
  .dv3-gmap{padding:9px 10px;font-size:12.5px}
  .dv3-gmap img{height:15px}
  .dv3-hint{display:none}
  .dv3-map{bottom:auto;top:96px;right:8px;width:132px;height:96px}
  .dv3-here{top:96px;left:8px;transform:none}
}
@media (prefers-reduced-motion:reduce){.dv3-toast,.dv3-load{transition:none}.dv3-lab.main{animation:none}}
`;
var el = (tag, cls, html) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== void 0) e.innerHTML = html;
  return e;
};
var esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
function createUI(root, { rooms, starts, title, subtitle, showPanel = true }, on) {
  if (!document.getElementById("dv3-css")) {
    const st = el("style");
    st.id = "dv3-css";
    st.textContent = CSS;
    document.head.appendChild(st);
  }
  const uid = "dv3" + Math.random().toString(36).slice(2, 7);
  const ui = {};
  ui.labels = el("div", "dv3-labels");
  root.appendChild(ui.labels);
  const panel = el("div", "dv3-panel");
  if (!showPanel) panel.style.display = "none";
  const groups = [...new Set(rooms.map((r) => r.group))];
  panel.innerHTML = `
        <div class="dv3-body">
      <div class="dv3-field dv3-to"><div class="dv3-lrow"><label for="${uid}-to">Where to?</label><div class="dv3-rgt"><button class="dv3-loc" type="button" id="${uid}-loc" aria-pressed="false" aria-label="Show my location on the map" title="My location"><i></i></button><button class="dv3-fold" type="button" id="${uid}-fold" aria-expanded="true">Hide</button></div></div>
        <select id="${uid}-to"><option value="">Choose a hall or room</option>${groups.map((g) => `<optgroup label="${esc(g)}">${rooms.filter((r) => r.group === g).map((r) => `<option value="${r.id}">${esc(r.name)}</option>`).join("")}</optgroup>`).join("")}</select></div>
      <div class="dv3-field"><label for="${uid}-from">Starting from</label>
        <select id="${uid}-from" class="small">${starts.map((s) => `<option value="${s.id}">${esc(s.name)}</option>`).join("")}</select></div>
      <div class="dv3-card" id="${uid}-info" hidden></div>
      <div class="dv3-row" id="${uid}-acts" hidden>
        <button class="dv3-btn pri" type="button" data-a="tour">Walk me there</button>
        <button class="dv3-btn" type="button" data-a="inside">Step inside</button>
        <button class="dv3-btn" type="button" data-a="top">View from above</button>
      </div>
      <ol class="dv3-steps" id="${uid}-steps" hidden></ol>
    </div>`;
  root.appendChild(panel);
  const $ = (s) => panel.querySelector("#" + uid + "-" + s);
  const top = el("div", "dv3-top", `
    <div class="dv3-brand">${esc(title[0])} <b>${esc(title[1])}</b></div>
    <a class="dv3-gmap" href="https://maps.app.goo.gl/JDSsvENLr2fv1TJa9" target="_blank" rel="noopener" aria-label="Google Maps directions to Main Gate G9"><img src="data:image/png;base64,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" alt="" width="12" height="17">To Main Gate G9</a>
    <div class="dv3-seg" role="group" aria-label="View"><button type="button" data-m="overview" aria-pressed="true">Overview</button><button type="button" data-m="walk" aria-pressed="false">Walk</button></div>
    <div class="dv3-seg" role="group" aria-label="Roofs"><button type="button" class="rt" data-rt="1" aria-pressed="false">Roofs</button></div>`);
  root.appendChild(top);
  ui.here = el("div", "dv3-here", "<small>You are in</small><b></b>");
  root.appendChild(ui.here);
  ui.hint = el("div", "dv3-hint");
  root.appendChild(ui.hint);
  ui.map = el("canvas", "dv3-map");
  ui.map.width = 420;
  ui.map.height = 300;
  root.appendChild(ui.map);
  ui.toast = el("div", "dv3-toast");
  ui.toast.setAttribute("role", "status");
  root.appendChild(ui.toast);
  $("to").addEventListener("change", (e) => on.select(e.target.value || null));
  $("from").addEventListener("change", (e) => on.start(e.target.value));
  $("acts").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (b) on.action(b.dataset.a);
  });
  $("fold").addEventListener("click", () => {
    const f = panel.classList.toggle("folded");
    $("fold").textContent = f ? "Show" : "Hide";
    $("fold").setAttribute("aria-expanded", String(!f));
  });
  top.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.m) on.mode(b.dataset.m);
    if (b.dataset.rt) on.roofs(b.getAttribute("aria-pressed") === "true" ? "off" : "on");
  });
  $("loc").addEventListener("click", () => on.locate && on.locate());
  ui.setLoc = (v) => $("loc").setAttribute("aria-pressed", String(v));
  ui.setMode = (m) => {
    top.querySelectorAll("[data-m]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.m === m)));
    root.classList.toggle("walk", m === "walk");
    ui.hint.textContent = m === "walk" ? "Click the floor to walk there \xB7 drag to look around \xB7 W A S D or arrow keys to move \xB7 Shift to run" : "Drag to rotate \xB7 scroll or pinch to zoom \xB7 right-drag or two fingers to pan \xB7 double-click a spot to stand there";
  };
  ui.setRoofs = (r) => top.querySelectorAll("[data-rt]").forEach((b) => b.setAttribute("aria-pressed", String(r === "on")));
  ui.setStart = (id) => {
    $("from").value = id;
  };
  ui.setTouring = (t) => {
    const b = panel.querySelector('[data-a="tour"]');
    b.textContent = t ? "Stop walking" : "Walk me there";
  };
  ui.setDestination = (room, building, route, steps) => {
    $("to").value = room ? room.id : "";
    const info = $("info"), acts = $("acts"), list = $("steps");
    if (!room) {
      info.hidden = acts.hidden = list.hidden = true;
      return;
    }
    const chips = [];
    if (room.seats) chips.push(`<span class="dv3-chip k">${room.seats.toLocaleString("en-IN")} seats</span>`);
    if (room.tables) chips.push(`<span class="dv3-chip k">${room.tables} stations</span>`);
    if (room.size) chips.push(`<span class="dv3-chip">${esc(room.size)}</span>`);
    if (building) chips.push(`<span class="dv3-chip">${esc(building)}</span>`);
    if (room.note) chips.push(`<span class="dv3-chip">${esc(room.note)}</span>`);
    const mins = route ? Math.max(1, Math.round(route.length / 75)) : 0;
    info.innerHTML = `<h2>${esc(room.name)}</h2><div class="dv3-chips">${chips.join("")}</div>${route ? `<p class="dv3-sum"><b>${Math.round(route.length / 5) * 5} m</b> \xB7 about <b>${mins} min</b> on foot</p>` : '<p class="dv3-sum">No walking route found from this start.</p>'}`;
    info.hidden = acts.hidden = false;
    list.innerHTML = (steps || []).map((s) => `<li>${esc(s.text)} <span>${esc(s.then)}</span></li>`).join("");
    list.hidden = !steps || !steps.length;
    if (list.lastElementChild) list.lastElementChild.classList.add("arr");
  };
  let toastT = 0;
  ui.say = (t, ms = 2600) => {
    ui.toast.textContent = t;
    ui.toast.classList.add("on");
    clearTimeout(toastT);
    toastT = setTimeout(() => ui.toast.classList.remove("on"), ms);
  };
  ui.setHere = (t) => {
    const b = ui.here.lastElementChild;
    if (b.textContent !== t) b.textContent = t;
  };
  ui.dispose = () => {
    clearTimeout(toastT);
    [ui.labels, panel, top, ui.here, ui.hint, ui.map, ui.toast].forEach((n) => n.remove());
  };
  ui.panel = panel;
  return ui;
}

// src/index.js
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

export { BUILDINGS, GATES, ROOMS, createVenue, findRoom };
