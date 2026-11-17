// Headless check: run the real kit/site/halls code against the three.js stub and report room registration and seat counts.
const ctx = new Proxy({}, { get: (t, k) => k === 'measureText' ? (() => ({ width: 10 })) : k === 'getImageData' ? ((x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4) })) : k === 'createLinearGradient' ? (() => ({ addColorStop() {} })) : (() => {}) , set(t,k,v){t[k]=v;return true;} });
globalThis.document = { createElement: () => { const c = { width: 0, height: 0, getContext: () => ctx }; return c; } };
globalThis.matchMedia = () => ({ matches: false });
const warns = []; console.warn = (...a) => warns.push(a.join(' '));
const { createKit } = await import('./src/kit.js');
const { buildSite } = await import('./src/site.js');
const { buildHalls } = await import('./src/halls.js');
const { ROOMS, BUILDINGS } = await import('./src/data.js');
const kit = createKit({ font: 'Arial', lowQuality: false, maxAniso: 8 });
const roofBatch = new kit.Batch();
buildSite(kit); buildHalls(kit, roofBatch);
const missing = ROOMS.filter(r => !kit.rooms[r.id]).map(r => r.id);
console.log('rooms registered:', Object.keys(kit.rooms).length, '/ ROOMS defined:', ROOMS.length);
console.log('ROOMS without geometry:', missing.length ? missing.join(', ') : 'none');
console.log('seat warnings:', warns.length ? warns : 'none');
let totalSeats = 0; const bySeat = {};
for (const c of kit.chairs) { const n = c.list.length / 4; totalSeats += n; bySeat[c.name] = (bySeat[c.name] || 0) + n; }
console.log('chair blocks by building:', JSON.stringify(bySeat));
console.log('total chair instances (incl. tables/dining):', totalSeats);
console.log('\nroom footprints (world m) and plan size:');
for (const r of ROOMS) { const k = kit.rooms[r.id]; if (!k) continue; const [x0,z0,x1,z1] = k.rect; console.log(`${r.id.padEnd(22)} ${(x1-x0).toFixed(1).padStart(6)} x ${(z1-z0).toFixed(1).padStart(5)}   seats ${String(r.seats ?? '-').padStart(5)}   plan ${r.size}`); }
import fs from 'node:fs';
const out = { rooms: {}, buildings: BUILDINGS.map(b => ({ id: b.id, hec: b.hec, cx: b.cx, cz: b.cz, W: b.W, D: b.D, rot: !!b.rot })) };
for (const r of ROOMS) { const k = kit.rooms[r.id]; if (k) out.rooms[r.id] = { name: r.name, rect: k.rect, seats: r.seats || null }; }
fs.writeFileSync('/home/claude/plan/verify_out.json', JSON.stringify(out));
console.log('dumped overlay json');
