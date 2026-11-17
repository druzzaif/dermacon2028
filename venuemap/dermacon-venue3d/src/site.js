import { buildOuterRoads } from "./roads.js";
import { DIR } from "./kit.js";
import { SITE, BUILDINGS, DOME, ADMIN, GATES, CARPETS, LAWNS, WASHROOMS, FOOD_COURTS, REG_COUNTERS, FIRST_AID, FIRE_STATION, SCULPTURES, TUNNELS, PARKING, PARK_WALK, OUTER_ROADS } from "./data.js";

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

export { buildSite };
