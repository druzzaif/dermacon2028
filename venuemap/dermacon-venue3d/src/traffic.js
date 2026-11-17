import * as THREE2 from "three";
import { OUTER_ROADS, LANE } from "./data.js";

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

export { createTraffic };
