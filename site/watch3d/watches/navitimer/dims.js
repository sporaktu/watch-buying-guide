// Shared dimensions, mm. The dial faces +Z, 12 o'clock is +Y, 3 o'clock is +X.
// z = 0 is the underside of the mid-case; the case back hangs below it and the crystal apex is the top.
// Overall: 41 mm across the bezel, 13.6 mm from the case back to the crystal apex, about 46.6 mm lug to lug.

export const D = {
  // mid-case
  caseR: 19.75,
  caseTop: 5.0,
  // case back
  backR: 17.6,
  backZ: -2.0,
  windowR: 12.4,
  // bezel
  bezelZ0: 5.05,
  bezelZ1: 8.4,
  beadZ0: 5.12,
  beadZ1: 7.72,
  beads: 56,
  beadValley: 19.85,
  beadTop: 20.5,
  rimR: 19.5,
  // crystal
  glassR: 18.9,
  glassWall: 8.9,
  glassApex: 11.6,
  // dial
  dialZ: 7.3,
  ringZ: 7.42,         // the rotating slide rule ring sits a touch proud of the dial
  ringR0: 16.1,
  ringR1: 18.9,
  fixedR0: 14.1,       // inner edge of the fixed slide rule scale
  subOff: 7.95,        // subdial centres from the dial centre
  subR: 4.75,
  subDrop: 0.28,
  dateDrop: 0.75,
  // lugs
  lugGap: 22,
  lugOuter: 14.6,
  lugTipY: 23.3,
  // crown and pushers
  sideZ: 2.4,
  crownR: 3.2,
  pusherAngle: 30,
};

/** Height of the top of a lug (and of the end link between them) at a distance |y| from the centre. */
export function lugTop(y) {
  const t = Math.max(0, (Math.abs(y) - 13.5) / 9.6);
  return 4.55 - 4.0 * Math.pow(t, 1.5);
}

/** Slope dz/dy of the lug top for y > 0. */
export function lugSlope(y) {
  const t = Math.max(0, (Math.abs(y) - 13.5) / 9.6);
  return -(4.0 * 1.5 / 9.6) * Math.sqrt(t);
}

/** A point `depth` below the lug-top curve at y, measured square to the curve. Returns [y, z]. */
export function underLugTop(y, depth) {
  const s = lugSlope(y), l = Math.hypot(1, s);
  return [y + (s / l) * depth, lugTop(y) - (1 / l) * depth];
}

/** Underside of a lug. */
export function lugUnder(y) {
  const u = Math.max(0, (Math.abs(y) - 14) / 9.3);
  return -0.05 - 1.85 * Math.pow(u, 1.3);
}
