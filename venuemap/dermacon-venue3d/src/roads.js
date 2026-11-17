import { OUTER_ROADS, LANE, FOOT } from "./data.js";

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

export { buildOuterRoads };
