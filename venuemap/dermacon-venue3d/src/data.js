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

export { P, R, GEO0, LANE, FOOT, OUTER_ROADS, PARKING, PARK_WALK, SITE, BUILDINGS, DOME, ADMIN, TUNNELS, ROOMS, GATES, CARPETS, LAWNS, WASHROOMS, FOOD_COURTS, REG_COUNTERS, FIRST_AID, FIRE_STATION, SCULPTURES, EX1, EXPO1_STALLS, EXPO2_STALLS, findRoom };
