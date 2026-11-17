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

export { createNav };
