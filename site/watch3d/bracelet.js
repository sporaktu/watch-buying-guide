// Seven-row bracelet: fitted end links, articulated links on pins, and a butterfly clasp.
//
// The rows are laid like bricks. A "segment" is the rigid body between two neighbouring pins.
// Odd segments carry the four wide brushed rows (1, 3, 5, 7), even segments the three narrow polished
// rows (2, 4, 6). Each piece is one pitch between its two pin holes with a rounded end beyond each, so a
// row reads as a run of links with a hair of clearance between them, and every pin ties all seven rows.
// Each segment is its own object placed at its pin and turned to its heading, so the bracelet drapes by
// moving links, not by bending a mesh.
import * as THREE from './vendor/three.module.js';
import { DEG, arc, extrude, roundPoly, merge, xform } from './geo.js';
import { BRACELET, solveLoop, widthAt, rowsAt, checkLoop } from './loop.js';
import { D, lugSlope, underLugTop } from './dims.js';

const B = BRACELET;
export const RHO = B.pitch / 2 - B.endGap / 2; // radius of a link's rounded end about its pin
const UP = B.thicknessUp;
const TOP_GAP = 0.15;      // the end link sits this far below the lug tops
const PIN_BASE_Y = 23.0;   // where along the lug the first pin sits

/** Finish of the rows, outside to centre to outside. Research could not confirm which rows are polished. */
export const ROW_FINISH = ['brushed', 'polished', 'brushed', 'polished', 'brushed', 'polished', 'brushed'];

function mesh(geo, mat, name) {
  const m = new THREE.Mesh(geo, mat);
  m.name = name; m.castShadow = true; m.receiveShadow = true;
  return m;
}

/** Add points just inside the ends of long straight runs so flat faces shade flat. */
function relieve(poly, long = 0.7, inset = 0.1) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    out.push(a);
    const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (d > long) {
      const k = inset / d;
      out.push([a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]);
      const mid = Math.floor(d / 1.6);
      for (let j = 1; j <= mid; j++) { const f = j / (mid + 1); out.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]); }
      out.push([b[0] - (b[0] - a[0]) * k, b[1] - (b[1] - a[1]) * k]);
    }
  }
  return out;
}

/** Side profile of one link piece, pins at (0, 0) and (len, 0), outside face up. */
function linkProfile(len, corner, up = UP) {
  const q = Math.PI / 2;
  return relieve([
    ...arc(0, 0, RHO, 2 * q, 3 * q, 7),
    ...arc(len, 0, RHO, 3 * q, 4 * q, 7),
    ...arc(len + RHO - corner, up - corner, corner, 0, q, 5),
    ...arc(-RHO + corner, up - corner, corner, q, 2 * q, 5),
  ]);
}

function rod(width, r = 0.34) {
  return new THREE.CylinderGeometry(r, r, width, 14).rotateZ(Math.PI / 2);
}

/** Geometry of segment k (pin k to pin k + 1) in its own frame: +Y along the link, +Z outward. */
function segmentGeometry(k) {
  const wide = k % 2 === 1;
  const s0 = k * B.pitch;
  const prof = linkProfile(B.pitch, wide ? 0.32 : 0.5);
  const at = (y) => rowsAt(widthAt(s0 + y));
  const skins = [], caps = [];
  for (let i = 0; i < 7; i++) {
    if ((i % 2 === 0) !== wide) continue;
    const nominal = wide ? B.rowsWide : B.rowsNarrow;
    const e = extrude(prof, nominal, {
      edge: wide ? 0.14 : 0.1, crown: wide ? 0.035 : 0.2, nx: wide ? 2 : 6,
      x0: (y) => at(y)[i].x0, x1: (y) => at(y)[i].x1,
    });
    skins.push(e.skin); caps.push(e.capA, e.capB);
  }
  return { wide, body: merge([...skins, ...caps]), pin: rod(widthAt(s0) + 0.05) };
}

/** Profiles of the end link in the watch's own (y, z): fingers that hold the first pin, and the short rows between. */
function endLinkProfiles() {
  const P0 = underLugTop(PIN_BASE_Y, TOP_GAP + RHO);
  const s = lugSlope(PIN_BASE_Y), l = Math.hypot(1, s);
  const t = [1 / l, s / l], n = [-s / l, 1 / l]; // along the lug toward its tip, and outward
  const y0 = 14.6, floor = 0.15;
  const top = (yEnd) => {
    const pts = [];
    for (let y = yEnd; y > y0; y -= 0.45) pts.push([...underLugTop(y, TOP_GAP), 0]);
    pts.push([...underLugTop(y0, TOP_GAP), 0]);
    return pts;
  };
  const Bp = [P0[0] - RHO * n[0], P0[1] - RHO * n[1]];
  const yc = Bp[0] + (floor - Bp[1]) / s; // where the underside levels off into the case
  const an = Math.atan2(n[1], n[0]);
  const finger = roundPoly([
    [y0, floor, 0], [yc, floor, 2.4],
    ...arc(P0[0], P0[1], RHO, an - Math.PI, an, 14).map(p => [p[0], p[1], 0]),
    ...top(PIN_BASE_Y - 0.3),
  ], 0, 8);
  const cut = RHO + B.endGap;
  const Eb = [P0[0] - cut * t[0] - RHO * n[0], P0[1] - cut * t[1] - RHO * n[1]];
  const Et = [P0[0] - cut * t[0] + RHO * n[0], P0[1] - cut * t[1] + RHO * n[1]];
  const short = roundPoly([
    [y0, floor, 0], [yc, floor, 2.4], [Eb[0], Eb[1], 0.3], [Et[0], Et[1], 0.3],
    ...top(Et[0] - 0.5),
  ], 0, 8);
  return { P0, finger: relieve(finger, 1.2), short: relieve(short, 1.2), tangent: t, normal: n };
}

function endLink(M, prof) {
  const rows = rowsAt(B.widthLug);
  const brushed = [], polished = [];
  rows.forEach((r, i) => {
    const wide = r.wide;
    const e = extrude(wide ? prof.finger : prof.short, r.x1 - r.x0, {
      edge: wide ? 0.14 : 0.1, crown: wide ? 0.035 : 0.2, nx: wide ? 2 : 6, center: (r.x0 + r.x1) / 2,
    });
    (ROW_FINISH[i] === 'brushed' ? brushed : polished).push(e.skin, e.capA, e.capB);
  });
  polished.push(xform(rod(B.widthLug - 0.02), { t: [0, prof.P0[0], prof.P0[1]] }));
  const g = new THREE.Group();
  g.name = 'end link';
  g.add(mesh(merge(brushed), M.brushed, 'end link brushed rows'), mesh(merge(polished), M.polished, 'end link polished rows'));
  return g;
}

/** Evenly spaced points along seam -> pin N -> pin N-1 ..., smoothed, with the normal that points at the wrist. */
function claspPath(L, length, step = 0.35) {
  const raw = [L.seam, ...L.pins.slice().reverse()];
  const pts = [];
  let i = 0, carry = 0, done = 0;
  while (done <= length + 1e-6 && i < raw.length - 1) {
    const a = raw[i], b = raw[i + 1];
    const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (carry > d) { carry -= d; i++; continue; }
    pts.push([a[0] + (b[0] - a[0]) * carry / d, a[1] + (b[1] - a[1]) * carry / d]);
    carry += step; done += step;
  }
  for (let pass = 0; pass < 6; pass++) {
    for (let k = 1; k < pts.length - 1; k++) {
      // the first few points stay on the flat run under the cover so the two halves meet in a line
      if (k * step < 2) continue;
      pts[k] = [(pts[k - 1][0] + 2 * pts[k][0] + pts[k + 1][0]) / 4, (pts[k - 1][1] + 2 * pts[k][1] + pts[k + 1][1]) / 4];
    }
  }
  return pts.map((p, k) => {
    const a = pts[Math.max(0, k - 1)], b = pts[Math.min(pts.length - 1, k + 1)];
    const tl = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const ty = (b[0] - a[0]) / tl, tz = (b[1] - a[1]) / tl;
    return { p, n: [-tz, ty], u: k * step };
  });
}

function strip(path, u0, u1, d0, d1) {
  const use = path.filter(q => q.u >= u0 - 1e-6 && q.u <= u1 + 1e-6);
  const a = use.map(q => [q.p[0] + q.n[0] * d0, q.p[1] + q.n[1] * d0]);
  const b = use.map(q => [q.p[0] + q.n[0] * d1, q.p[1] + q.n[1] * d1]).reverse();
  return [...a, ...b];
}

/** One half of the butterfly clasp, in the frame of the first half of the bracelet. */
function claspHalf(M, L) {
  const g = new THREE.Group();
  g.name = 'clasp half';
  const w = B.widthClasp;
  const N = B.segments;

  // Cover: three knuckles round the last pin, then a plate out to the seam.
  const cover = new THREE.Group();
  cover.name = 'clasp cover';
  const rows = rowsAt(w);
  const knuckleProf = linkProfile(1.9, 0.5);
  const knuckles = [];
  rows.forEach((r) => {
    if (r.wide) return;
    const e = extrude(knuckleProf, r.x1 - r.x0, { edge: 0.1, crown: 0.2, nx: 6, center: (r.x0 + r.x1) / 2 });
    knuckles.push(e.skin, e.capA, e.capB);
  });
  knuckles.push(rod(w + 0.05));
  const y0 = RHO + B.endGap, y1 = B.head - 0.035, top = UP + 0.1;
  const plateProf = relieve(roundPoly([
    [y0, -RHO, 0.25], [y1, -RHO, 0.12], [y1, top, 0.16], [y0, top, 0.45],
  ], 0.2, 6));
  const plate = extrude(plateProf, w, { edge: 0.22, crown: 0.05, nx: 4 });
  cover.add(
    mesh(merge(knuckles), M.polished, 'clasp knuckles'),
    mesh(plate.skin, M.brushed, 'clasp cover plate'),
    mesh(merge([plate.capA, plate.capB]), M.polished, 'clasp cover sides'),
  );
  cover.position.set(0, L.pins[N][0], L.pins[N][1]);
  cover.rotation.x = L.headHeading;
  g.add(cover);

  // Release buttons: one each side, split across the seam like the cover.
  const btnProf = roundPoly([[0, -0.75, 0], [2.9, -0.75, 0.55], [2.9, 0.75, 0.55], [0, 0.75, 0]], 0.3, 5);
  const btns = [];
  for (const side of [-1, 1]) {
    const e = extrude(btnProf, 1.1, { edge: 0.16, center: side * (w / 2 + 0.12) });
    btns.push(e.skin, e.capA, e.capB);
  }
  const buttons = mesh(merge(btns), M.polished, 'clasp buttons');
  // lies along the seam side of the cover, in the watch's frame
  buttons.position.set(0, L.seam[0], L.seam[1] + 0.05);
  g.add(buttons);

  // Folding parts on the wrist side: the bridge against the wrist, and the arm that folds onto it.
  const path = claspPath(L, 22);
  const reach = 19.2;
  const bridge = extrude(strip(path, 0, reach, RHO + 0.98, RHO + 1.62), 9.2, { edge: 0.12, nx: 2 });
  const arm = extrude(strip(path, 0.7, reach - 0.4, RHO + 0.16, RHO + 0.8), 6.4, { edge: 0.1, nx: 2 });
  const at = path.reduce((best, q) => (Math.abs(q.u - reach) < Math.abs(best.u - reach) ? q : best), path[0]);
  const hinge = xform(new THREE.CylinderGeometry(0.78, 0.78, 9.6, 20).rotateZ(Math.PI / 2), {
    t: [0, at.p[0] + at.n[0] * (RHO + 0.9), at.p[1] + at.n[1] * (RHO + 0.9)],
  });
  g.add(
    mesh(merge([bridge.skin, bridge.capA, bridge.capB]), M.satin, 'clasp bridge'),
    mesh(merge([arm.skin, arm.capA, arm.capB]), M.satin, 'clasp arm'),
    mesh(hinge, M.polished, 'clasp hinge'),
  );
  return g;
}

export function buildBracelet({ M, report }) {
  const ends = endLinkProfiles();
  const L = solveLoop({ pin0: ends.P0 });
  const bad = checkLoop(L);

  // Extra checks against the head: the end link fits the lugs, and no pin sits inside the case.
  const rowsLug = rowsAt(B.widthLug);
  if (rowsLug[0].x0 < -D.lugGap / 2 || rowsLug[6].x1 > D.lugGap / 2) bad.push('end link is wider than the gap between the lugs');
  L.pins.forEach((p, k) => {
    if (p[1] > -2.2 && p[1] < 12 && Math.abs(p[0]) < D.beadTop + RHO) bad.push(`pin ${k} sits inside the case`);
  });
  if (report) {
    report.bracelet = {
      failures: bad,
      pin0: ends.P0.map(v => +v.toFixed(3)),
      seam: L.seam.map(v => +v.toFixed(4)),
      pins: L.pins.length * 2,
      links: B.segments * 2,
      length: +(2 * L.length + 2 * RHO).toFixed(1),
      maxTurnDeg: +(Math.max(...L.turns.map(Math.abs)) / DEG).toFixed(1),
      widthAtLug: B.widthLug, widthAtClasp: +widthAt(L.s[B.segments]).toFixed(2),
    };
  }
  if (bad.length) console.warn('bracelet checks failed:\n' + bad.join('\n'));

  const group = new THREE.Group();
  group.name = 'bracelet';
  const geos = [];
  for (let k = 0; k < B.segments; k++) geos.push(segmentGeometry(k));

  const halves = [];
  for (let h = 0; h < 2; h++) {
    const half = new THREE.Group();
    half.name = h === 0 ? 'bracelet, 12 o\'clock half' : 'bracelet, 6 o\'clock half';
    half.rotation.z = h * Math.PI;
    half.add(endLink(M, ends));
    const links = [];
    for (let k = 0; k < B.segments; k++) {
      const s = new THREE.Group();
      s.name = `link ${k + 1}`;
      s.add(mesh(geos[k].body, geos[k].wide ? M.brushed : M.polished, geos[k].wide ? 'wide rows' : 'narrow rows'));
      s.add(mesh(geos[k].pin, M.satin, 'pin'));
      half.add(s);
      links.push(s);
    }
    half.add(claspHalf(M, L));
    halves.push({ half, links });
    group.add(half);
  }

  /** Place every link on a solved loop. */
  function pose(loop) {
    for (const { links } of halves) {
      links.forEach((s, k) => {
        s.position.set(0, loop.pins[k][0], loop.pins[k][1]);
        s.rotation.x = loop.heading[k];
      });
    }
  }
  pose(L);
  return { group, loop: L, pose, halves };
}
