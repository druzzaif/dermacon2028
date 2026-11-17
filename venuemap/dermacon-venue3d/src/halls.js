import { DIR } from "./kit.js";
import { BUILDINGS, DOME, ADMIN, EXPO1_STALLS, EXPO2_STALLS } from "./data.js";

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

export { buildHalls };
