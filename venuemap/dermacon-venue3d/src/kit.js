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

export { DIR, createKit };
