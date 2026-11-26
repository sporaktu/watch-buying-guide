// Geometry helpers. Everything in the watch is built from three primitives:
//   gridGeo  - a surface from a grid of points, with finite-difference normals
//   lathe    - a body of revolution, optionally modulated round the axis (bezel beads, crown flutes)
//   extrude  - a side profile pushed across a width, with softened edges and optional crowning
// Units are millimetres throughout.
import * as THREE from '../vendor/three.module.js';
import { mergeGeometries } from '../vendor/BufferGeometryUtils.js';

export const TAU = Math.PI * 2;
export const DEG = Math.PI / 180;

/** Size in mm of one tile of the brushed-steel texture. UVs on brushed parts are mm / BRUSH_TILE. */
export const BRUSH_TILE = 9;

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _n = new THREE.Vector3();

/**
 * Surface from a grid. pos(i, j, out[3]) gives the point, uv(i, j, out[2]) its texture coordinate.
 * closedI / closedJ wrap that direction (the seam column is duplicated so UVs can run on).
 * The normal is dP/di x dP/dj, or the reverse when flip is set.
 */
export function gridGeo(ni, nj, pos, uv, { closedI = false, closedJ = false, flip = false, color = null } = {}) {
  const rows = closedI ? ni + 1 : ni, cols = closedJ ? nj + 1 : nj;
  const count = rows * cols;
  const P = new Float32Array(count * 3), U = new Float32Array(count * 2), N = new Float32Array(count * 3);
  const C = color ? new Float32Array(count * 3) : null;
  const t3 = [0, 0, 0], t2 = [0, 0];
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const k = i * cols + j;
      pos(closedI ? i % ni : i, closedJ ? j % nj : j, t3);
      P[k * 3] = t3[0]; P[k * 3 + 1] = t3[1]; P[k * 3 + 2] = t3[2];
      if (uv) { uv(i, j, t2); U[k * 2] = t2[0]; U[k * 2 + 1] = t2[1]; }
      if (color) { color(closedI ? i % ni : i, closedJ ? j % nj : j, t3); C[k * 3] = t3[0]; C[k * 3 + 1] = t3[1]; C[k * 3 + 2] = t3[2]; }
    }
  }
  const at = (i, j, v) => {
    if (closedI) i = ((i % ni) + ni) % ni; else i = Math.min(Math.max(i, 0), ni - 1);
    if (closedJ) j = ((j % nj) + nj) % nj; else j = Math.min(Math.max(j, 0), nj - 1);
    return v.fromArray(P, (i * cols + j) * 3);
  };
  const p0 = new THREE.Vector3(), p1 = new THREE.Vector3();
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const ii = closedI ? i % ni : i, jj = closedJ ? j % nj : j;
      _a.subVectors(at(ii + 1, jj, p0), at(ii - 1, jj, p1));
      _b.subVectors(at(ii, jj + 1, p0), at(ii, jj - 1, p1));
      if (flip) _n.crossVectors(_b, _a); else _n.crossVectors(_a, _b);
      let len = _n.length();
      if (len < 1e-12) { // degenerate (a pole): borrow from the next row in
        const i2 = ii + (ii === 0 ? 1 : -1);
        _a.subVectors(at(i2 + 1, jj, p0), at(i2 - 1, jj, p1));
        _b.subVectors(at(i2, jj + 1, p0), at(i2, jj - 1, p1));
        if (flip) _n.crossVectors(_b, _a); else _n.crossVectors(_a, _b);
        len = _n.length() || 1;
      }
      const k = (i * cols + j) * 3;
      N[k] = _n.x / len; N[k + 1] = _n.y / len; N[k + 2] = _n.z / len;
    }
  }
  const idx = [];
  for (let i = 0; i < rows - 1; i++) {
    for (let j = 0; j < cols - 1; j++) {
      const a = i * cols + j, b = (i + 1) * cols + j, c = (i + 1) * cols + j + 1, d = i * cols + j + 1;
      if (flip) idx.push(a, d, b, b, d, c); else idx.push(a, b, d, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(P, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(N, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(U, 2));
  if (C) g.setAttribute('color', new THREE.BufferAttribute(C, 3));
  g.setIndex(idx);
  return g;
}

/**
 * Body of revolution about +Z. `runs` is a list of polylines of [r, z]; each run is smooth and a new run
 * starts a crease. List the cross-section anticlockwise (r to the right, z up) for outward normals.
 * mod(r, z, phi, t) -> [r, z] reshapes a point round the axis (t is 0..1 along the run).
 * shade(r, z, phi, t) -> grey level 0..1 for vertex colour (used for cheap occlusion in grooves).
 */
export function lathe(runs, { segs = 160, mod = null, shade = null, rRef = null, phi0 = 0, phiLen = TAU, tile = BRUSH_TILE } = {}) {
  const closed = Math.abs(phiLen - TAU) < 1e-9;
  const parts = [];
  for (const run of runs) {
    const n = run.length;
    const len = [0];
    for (let i = 1; i < n; i++) len.push(len[i - 1] + Math.hypot(run[i][0] - run[i - 1][0], run[i][1] - run[i - 1][1]));
    const total = len[n - 1] || 1;
    let rr = rRef;
    if (rr == null) { rr = 0; for (const p of run) rr = Math.max(rr, p[0]); }
    const reps = Math.max(1, Math.round(TAU * rr / tile));
    const nj = closed ? segs : segs + 1;
    const q = [0, 0];
    const pos = (i, j, out) => {
      const phi = phi0 + phiLen * (j / segs);
      let r = run[i][0], z = run[i][1];
      if (mod) { const m = mod(r, z, phi, len[i] / total); r = m[0]; z = m[1]; }
      out[0] = r * Math.cos(phi); out[1] = r * Math.sin(phi); out[2] = z;
    };
    const uv = (i, j, out) => { out[0] = (phiLen / TAU) * (j / segs) * reps; out[1] = len[i] / tile; };
    const color = shade ? (i, j, out) => {
      const phi = phi0 + phiLen * (j / segs);
      const s = shade(run[i][0], run[i][1], phi, len[i] / total);
      out[0] = out[1] = out[2] = s;
    } : null;
    void q;
    parts.push(gridGeo(n, nj, pos, uv, { closedJ: closed, flip: true, color }));
  }
  return parts.length === 1 ? parts[0] : mergeGeometries(parts, false);
}

/** Points of an arc in a plane: centre (cx, cy), radius r, from angle a0 to a1 (radians), n steps. */
export function arc(cx, cy, r, a0, a1, n, skipFirst = false) {
  const out = [];
  for (let i = skipFirst ? 1 : 0; i <= n; i++) {
    const a = a0 + (a1 - a0) * (i / n);
    out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return out;
}

/** Round the corners of a closed polygon. pts: [x, y, radius?]; returns a dense closed polyline. */
export function roundPoly(pts, defaultR = 0.2, steps = 6) {
  const n = pts.length, out = [];
  for (let i = 0; i < n; i++) {
    const p = pts[i], a = pts[(i + n - 1) % n], b = pts[(i + 1) % n];
    const r = p[2] == null ? defaultR : p[2];
    let ax = a[0] - p[0], ay = a[1] - p[1], bx = b[0] - p[0], by = b[1] - p[1];
    const la = Math.hypot(ax, ay), lb = Math.hypot(bx, by);
    ax /= la; ay /= la; bx /= lb; by /= lb;
    const cos = ax * bx + ay * by;
    const half = Math.acos(Math.min(1, Math.max(-1, cos))) / 2;
    if (r <= 1e-6 || half < 1e-3 || Math.abs(Math.PI / 2 - half) < 1e-4) { out.push([p[0], p[1]]); continue; }
    const d = Math.min(r / Math.tan(half), la * 0.49, lb * 0.49);
    const rr = d * Math.tan(half);
    const mx = ax + bx, my = ay + by, ml = Math.hypot(mx, my);
    const cx = p[0] + (mx / ml) * (rr / Math.sin(half)), cy = p[1] + (my / ml) * (rr / Math.sin(half));
    const s0 = Math.atan2(p[1] + ay * d - cy, p[0] + ax * d - cx);
    let s1 = Math.atan2(p[1] + by * d - cy, p[0] + bx * d - cx);
    let da = s1 - s0;
    while (da > Math.PI) da -= TAU;
    while (da < -Math.PI) da += TAU;
    for (let k = 0; k <= steps; k++) {
      const t = s0 + da * (k / steps);
      out.push([cx + rr * Math.cos(t), cy + rr * Math.sin(t)]);
    }
  }
  return out;
}

/** Signed area of a closed polygon (positive when anticlockwise). */
export function polyArea(p) {
  let s = 0;
  for (let i = 0, n = p.length; i < n; i++) { const a = p[i], b = p[(i + 1) % n]; s += a[0] * b[1] - b[0] * a[1]; }
  return s / 2;
}

/** Smooth outward normals of a closed anticlockwise polygon. */
export function polyNormals(p) {
  const n = p.length, out = [];
  for (let i = 0; i < n; i++) {
    const a = p[(i + n - 1) % n], b = p[(i + 1) % n];
    const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
    out.push([dy / l, -dx / l]);
  }
  return out;
}

/** Triangulated flat cap of a closed polygon lying in the plane x = const of (y, z). */
function capGeo(poly, x, facePlusX, tile) {
  const contour = poly.map(p => new THREE.Vector2(p[0], p[1]));
  const faces = THREE.ShapeUtils.triangulateShape(contour, []);
  const P = new Float32Array(poly.length * 3), N = new Float32Array(poly.length * 3), U = new Float32Array(poly.length * 2);
  poly.forEach((p, i) => {
    P[i * 3] = x; P[i * 3 + 1] = p[0]; P[i * 3 + 2] = p[1];
    N[i * 3] = facePlusX ? 1 : -1;
    U[i * 2] = p[0] / tile; U[i * 2 + 1] = p[1] / tile;
  });
  const idx = [];
  for (const f of faces) {
    const [a, b, c] = f;
    const ar = (poly[b][0] - poly[a][0]) * (poly[c][1] - poly[a][1]) - (poly[c][0] - poly[a][0]) * (poly[b][1] - poly[a][1]);
    const ccw = ar > 0; // anticlockwise in (y, z) faces +x
    if (ccw === facePlusX) idx.push(a, b, c); else idx.push(a, c, b);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(P, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(N, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(U, 2));
  g.setIndex(idx);
  return g;
}

/**
 * Push a closed side profile (points [y, z], anticlockwise seen from +X) across a width along X.
 *   edge   - how far the long edges are eased in (a soft chamfer), mm
 *   crown  - sag of the surface at the edges relative to the middle (a pillow cross-section), mm
 *   x0, x1 - optional functions of y giving the two side positions (for tapering plan shapes)
 * Returns { skin, capA, capB } so the faces can take different finishes. capA is at -X, capB at +X.
 */
export function extrude(profile, width, { edge = 0.12, crown = 0, nx = 0, x0 = null, x1 = null, tile = BRUSH_TILE, center = 0 } = {}) {
  let poly = profile.map(p => [p[0], p[1]]);
  if (polyArea(poly) < 0) poly.reverse();
  const n = poly.length, nor = polyNormals(poly);
  const len = [0];
  for (let i = 1; i <= n; i++) { const a = poly[i - 1], b = poly[i % n]; len.push(len[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1])); }
  // columns across the width: fraction f in -1..1 and inset d
  const cols = [];
  const half = width / 2;
  const e = Math.min(edge, half * 0.45);
  const fe = e / half;
  cols.push([-1, e + crown]);
  cols.push([-1 + fe, crown * (1 - fe) * (1 - fe)]);
  const inner = Math.max(nx, crown > 0 ? 6 : 1);
  for (let k = 1; k < inner; k++) { const f = (-1 + fe) + (2 - 2 * fe) * (k / inner); cols.push([f, crown * f * f]); }
  cols.push([1 - fe, crown * (1 - fe) * (1 - fe)]);
  cols.push([1, e + crown]);
  const xa = (y) => (x0 ? x0(y) : center - half), xb = (y) => (x1 ? x1(y) : center + half);
  const pos = (i, j, out) => {
    const [f, d] = cols[j];
    const y = poly[i][0] - nor[i][0] * d, z = poly[i][1] - nor[i][1] * d;
    const A = xa(poly[i][0]), B = xb(poly[i][0]);
    out[0] = A + (B - A) * (f + 1) / 2; out[1] = y; out[2] = z;
  };
  const uv = (i, j, out) => { out[0] = len[i] / tile; out[1] = (cols[j][0] * half) / tile; };
  const skin = gridGeo(n, cols.length, pos, uv, { closedI: true });
  const dEdge = e + crown;
  const inset = poly.map((p, i) => [p[0] - nor[i][0] * dEdge, p[1] - nor[i][1] * dEdge]);
  const capA = capGeo(inset, 0, false, tile), capB = capGeo(inset, 0, true, tile);
  const fix = (g, fn) => { const p = g.attributes.position; for (let i = 0; i < p.count; i++) p.setX(i, fn(poly[i][0])); };
  fix(capA, xa); fix(capB, xb);
  return { skin, capA, capB };
}

/** Flat ring or disc in the plane z, facing +Z (or -Z when down is set). UVs are planar: (x, y) / tile. */
export function flatRing(r0, r1, z, { segs = 128, down = false, tile = 1, planar = true, rings = 1 } = {}) {
  const pos = (i, j, out) => {
    const r = r0 + (r1 - r0) * (i / rings), a = TAU * j / segs;
    out[0] = r * Math.cos(a); out[1] = r * Math.sin(a); out[2] = z;
  };
  const uv = (i, j, out) => {
    const r = r0 + (r1 - r0) * (i / rings), a = TAU * j / segs;
    if (planar) { out[0] = r * Math.cos(a) / tile; out[1] = r * Math.sin(a) / tile; } else { out[0] = j / segs; out[1] = i / rings; }
  };
  // i runs outward, j anticlockwise: dP/di x dP/dj = +Z
  return gridGeo(rings + 1, segs, pos, uv, { closedJ: true, flip: down });
}

/** Inset a closed anticlockwise polygon by d, mitring the corners. */
export function insetPoly(poly, d) {
  const n = poly.length, out = [];
  for (let i = 0; i < n; i++) {
    const a = poly[(i + n - 1) % n], p = poly[i], b = poly[(i + 1) % n];
    let ux = p[0] - a[0], uy = p[1] - a[1], vx = b[0] - p[0], vy = b[1] - p[1];
    const lu = Math.hypot(ux, uy) || 1, lv = Math.hypot(vx, vy) || 1;
    ux /= lu; uy /= lu; vx /= lv; vy /= lv;
    // the inside of an anticlockwise polygon is to the left of travel
    const k = d / Math.max(0.25, 1 + (uy * vy + ux * vx));
    out.push([p[0] + (-uy - vy) * k, p[1] + (ux + vx) * k]);
  }
  return out;
}

/**
 * A flat part with diamond-cut edges, as dial furniture and hands are made: the outline ([x, y],
 * anticlockwise) rises from z0 as a wall, then chamfers in by `bevel` to a flat top at z1.
 * Faces are flat shaded, so every facet reflects on its own. `under` adds the bottom face.
 */
export function bevelPlate(outline, z0, z1, bevel = 0, { drop = bevel, under = false } = {}) {
  let poly = outline.map(p => [p[0], p[1]]);
  if (polyArea(poly) < 0) poly.reverse();
  const top = bevel > 0 ? insetPoly(poly, bevel) : poly;
  const zs = bevel > 0 ? z1 - drop : z1;
  const P = [], U = [];
  const tri = (a, b, c) => { for (const v of [a, b, c]) { P.push(v[0], v[1], v[2]); U.push(v[0], v[1]); } };
  const quad = (a, b, c, d) => { tri(a, b, c); tri(a, c, d); };
  const n = poly.length;
  for (let i = 0; i < n; i++) {
    const p = poly[i], q = poly[(i + 1) % n];
    if (zs > z0) quad([p[0], p[1], z0], [q[0], q[1], z0], [q[0], q[1], zs], [p[0], p[1], zs]);
    if (bevel > 0) { const s = top[i], t = top[(i + 1) % n]; quad([p[0], p[1], zs], [q[0], q[1], zs], [t[0], t[1], z1], [s[0], s[1], z1]); }
  }
  const cap = (pts, z, up) => {
    const faces = THREE.ShapeUtils.triangulateShape(pts.map(p => new THREE.Vector2(p[0], p[1])), []);
    for (const [a, b, c] of faces) {
      const A = pts[a], B = pts[b], C = pts[c];
      const ccw = (B[0] - A[0]) * (C[1] - A[1]) - (C[0] - A[0]) * (B[1] - A[1]) > 0;
      if (ccw === up) tri([A[0], A[1], z], [B[0], B[1], z], [C[0], C[1], z]);
      else tri([A[0], A[1], z], [C[0], C[1], z], [B[0], B[1], z]);
    }
  };
  cap(top, z1, true);
  if (under) cap(poly, z0, false);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
  g.computeVertexNormals();
  return g;
}

/** Planar UVs for a texture whose canvas covers +-half mm about (cx, cy). */
export function planarUV(g, half, cx = 0, cy = 0) {
  const p = g.attributes.position, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    uv[i * 2] = 0.5 + (p.getX(i) - cx) / (2 * half);
    uv[i * 2 + 1] = 0.5 + (p.getY(i) - cy) / (2 * half);
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

/** Give a geometry flat, per-face normals (for small faceted parts). */
export function faceted(g) {
  const out = g.index ? g.toNonIndexed() : g;
  out.computeVertexNormals();
  return out;
}

export function merge(list) { return list.length === 1 ? list[0] : mergeGeometries(list, false); }

export function xform(g, { rx = 0, ry = 0, rz = 0, t = null, s = null } = {}) {
  if (s) g.scale(s[0], s[1], s[2]);
  if (rx) g.rotateX(rx);
  if (ry) g.rotateY(ry);
  if (rz) g.rotateZ(rz);
  if (t) g.translate(t[0], t[1], t[2]);
  return g;
}

/** Tiny deterministic random source so the model is identical on every load. */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
