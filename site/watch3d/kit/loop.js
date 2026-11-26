// The bracelet as a chain: pins at a fixed pitch, each link rigid between two neighbouring pins.
// One half is solved in the (y, z) plane, from the end link's pin down to the middle of the clasp;
// the other half is the same shape turned half a turn about the watch's axis.
// Pure maths, no three.js, so it can be checked on its own.

export const DEG = Math.PI / 180;

/** Fixed bracelet dimensions, mm. */
export const BRACELET = {
  pitch: 3.0,          // pin to pin
  segments: 20,        // articulated links per half, pin 0 to pin 20
  head: 7.6,           // rigid half of the clasp cover, from pin 20 to the seam
  pin0: [22.75, 0.85], // (y, z) of the end link's pin
  heading0: -40 * DEG, // the first link leaves the end link pointing down by this much
  widthLug: 22,
  widthClasp: 18,
  taperLength: 44,     // the taper is spent over this length from the lugs, then the band runs parallel
  thicknessUp: 1.42,   // top surface above the pin line
  rowsWide: 3.7,       // rows 1, 3, 5, 7 (brushed)
  rowsNarrow: 2.4,     // rows 2, 4, 6 (polished); 4 * 3.7 + 3 * 2.4 = 22
  rowGap: 0.07,        // clearance between neighbouring rows
  endGap: 0.13,        // clearance between consecutive links in a row
};

/**
 * Solve the drape of one half.
 * The heading turns from heading0 to straight back (-180 deg) over the joints at pins 1..N.
 * How the turn is shared out follows a wrist: gentle over the top, tight round the side, flat underneath.
 * `bump` is the strength of the tight part and is found by bisection so the clasp seam lands on y = 0.
 */
export function solveLoop(opts = {}) {
  const o = { ...BRACELET, peak: 0.2, spread: 0.16, peak2: 0.8, spread2: 0.14, second: 0.3, base: 0.32, ...opts };
  const N = o.segments, p = o.pitch;
  const total = -Math.PI - o.heading0; // negative: the chain turns clockwise seen from +X
  const weights = (bump) => {
    const w = [];
    let sum = 0;
    for (let k = 1; k <= N; k++) {
      const u = (k - 0.5) / N;
      const v = Math.max(0.02, o.base + bump * Math.exp(-(((u - o.peak) / o.spread) ** 2)) + o.second * Math.exp(-(((u - o.peak2) / o.spread2) ** 2)));
      w.push(v); sum += v;
    }
    return w.map(v => v / sum);
  };
  const run = (bump) => {
    const w = weights(bump);
    const pins = [[o.pin0[0], o.pin0[1]]], heading = [];
    let th = o.heading0;
    for (let k = 0; k < N; k++) {
      heading.push(th);
      const a = pins[k];
      pins.push([a[0] + p * Math.cos(th), a[1] + p * Math.sin(th)]);
      th += total * w[k];
    }
    // th is now exactly -180 deg: the rigid clasp head runs straight back to the seam.
    const last = pins[N];
    const seam = [last[0] + o.head * Math.cos(th), last[1] + o.head * Math.sin(th)];
    return { pins, heading, headHeading: th, seam, turns: w.map(v => v * total) };
  };
  let lo = -0.25, hi = 40;
  const f = (b) => run(b).seam[0];
  let flo = f(lo), fhi = f(hi);
  if (flo * fhi > 0) throw new Error(`bracelet loop cannot close: seam y is ${flo.toFixed(2)} to ${fhi.toFixed(2)}`);
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2, fm = f(mid);
    if (fm * flo <= 0) { hi = mid; fhi = fm; } else { lo = mid; flo = fm; }
  }
  const bump = (lo + hi) / 2;
  const out = run(bump);
  out.bump = bump;
  out.opts = o;
  // arc length at each pin, for the taper
  out.s = out.pins.map((_, k) => k * p);
  out.length = N * p + o.head;
  return out;
}

/** Bracelet width at a distance s along the chain from pin 0. */
export function widthAt(s, o = BRACELET) {
  const t = Math.min(1, Math.max(0, (s + 2.2) / o.taperLength));
  const e = t * t * (3 - 2 * t);
  return o.widthLug + (o.widthClasp - o.widthLug) * (0.15 * t + 0.85 * e);
}

/**
 * The seven rows across the bracelet at width w: [{ index, wide, x0, x1 }] left to right.
 * Row widths keep their proportions as the bracelet narrows.
 */
export function rowsAt(w, o = BRACELET) {
  const k = w / o.widthLug;
  const rows = [];
  let x = -w / 2;
  for (let i = 0; i < 7; i++) {
    const wide = i % 2 === 0;
    const rw = (wide ? o.rowsWide : o.rowsNarrow) * k;
    rows.push({ index: i, wide, x0: x + o.rowGap / 2, x1: x + rw - o.rowGap / 2 });
    x += rw;
  }
  return rows;
}

/** Checks that must hold for the chain to be a real, closed bracelet. Returns a list of failures. */
export function checkLoop(L) {
  const o = L.opts, bad = [];
  for (let k = 0; k < L.pins.length - 1; k++) {
    const a = L.pins[k], b = L.pins[k + 1];
    const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (Math.abs(d - o.pitch) > 1e-9) bad.push(`pin ${k} to ${k + 1} is ${d} apart, not the pitch`);
  }
  if (Math.abs(L.seam[0]) > 0.01) bad.push(`clasp seam misses the centre line by ${L.seam[0].toFixed(4)} mm`);
  if (Math.abs(L.headHeading + Math.PI) > 1e-9) bad.push('clasp head is not level');
  L.turns.forEach((t, k) => {
    if (t > 1e-12) bad.push(`joint ${k + 1} bends backwards`);
    if (Math.abs(t) > 24 * DEG) bad.push(`joint ${k + 1} bends ${(Math.abs(t) / DEG).toFixed(1)} deg, more than a link allows`);
  });
  return bad;
}
