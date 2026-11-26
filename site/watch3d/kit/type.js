// Lettering for the canvas textures.
// Digits drawn as strokes rather than taken from a font: squarish, with rounded corners. Letters use the bundled
// Jost.
// Everything draws centred on the origin of the current transform, in millimetres with +Y up.

export const DEG = Math.PI / 180;

/** Point at radius r and clock angle `deg` (clockwise from 12 o'clock). */
export function polar(r, deg) {
  return [r * Math.sin(deg * DEG), r * Math.cos(deg * DEG)];
}

const W = 0.6, R = 0.2;
// Each glyph sits in a box W wide and 1 tall. A stroke is a polyline whose corners are rounded by
// the third number of each point; `c` marks a closed loop.
const GLYPHS = {
  0: { w: W, s: [{ c: true, p: [[0, 0, R], [W, 0, R], [W, 1, R], [0, 1, R]] }] },
  1: { w: 0.34, s: [{ p: [[0, 0.74], [0.3, 1, 0.02], [0.3, 0]] }] },
  2: { w: W, s: [{ p: [[0, 0.78], [0, 1, R], [W, 1, R], [W, 0.52, R], [0, 0.52, R], [0, 0, 0.03], [W, 0]] }] },
  3: { w: W, s: [{ p: [[0, 1], [W, 1, R], [W, 0, R], [0, 0]] }, { p: [[0.17, 0.52], [W, 0.52]] }] },
  4: { w: W + 0.04, s: [{ p: [[0.46, 0], [0.46, 1, 0.02], [0, 0.3, 0.02], [W + 0.04, 0.3]] }] },
  5: { w: W, s: [{ p: [[W, 1], [0, 1, 0.03], [0, 0.56, 0.03], [W, 0.56, R], [W, 0, R], [0, 0]] }] },
  6: { w: W, s: [{ p: [[W, 1], [0, 1, R], [0, 0, R], [W, 0, R], [W, 0.56, R], [0, 0.56]] }] },
  7: { w: W, s: [{ p: [[0, 1], [W, 1, 0.03], [0.2, 0]] }] },
  8: { w: W, s: [
    { c: true, p: [[0, 0.52, R], [W, 0.52, R], [W, 1, R], [0, 1, R]] },
    { c: true, p: [[0, 0, R], [W, 0, R], [W, 0.52, R], [0, 0.52, R]] },
  ] },
  9: { w: W, s: [{ p: [[0, 0], [W, 0, R], [W, 1, R], [0, 1, R], [0, 0.44, R], [W, 0.44]] }] },
};

function strokeGlyph(x, g) {
  for (const s of g.s) {
    const p = s.p, n = p.length;
    x.beginPath();
    if (s.c) {
      x.moveTo((p[0][0] + p[1][0]) / 2, (p[0][1] + p[1][1]) / 2);
      for (let i = 1; i <= n; i++) {
        const a = p[i % n], b = p[(i + 1) % n];
        x.arcTo(a[0], a[1], b[0], b[1], a[2] ?? 0);
      }
      x.closePath();
    } else {
      x.moveTo(p[0][0], p[0][1]);
      for (let i = 1; i < n - 1; i++) x.arcTo(p[i][0], p[i][1], p[i + 1][0], p[i + 1][1], p[i][2] ?? 0);
      x.lineTo(p[n - 1][0], p[n - 1][1]);
    }
    x.stroke();
  }
}

/** Width of a number set `h` tall. */
export function digitsWidth(str, h, { gap = 0.2, squeeze = 1 } = {}) {
  const gl = [...str].map(ch => GLYPHS[ch]);
  return (gl.reduce((s, g) => s + g.w, 0) * squeeze + gap * (gl.length - 1)) * h;
}

/** Stroke a number `h` tall, centred on the origin. Uses the current strokeStyle. */
export function digits(x, str, h, { weight = 0.15, gap = 0.2, squeeze = 1 } = {}) {
  const gl = [...str].map(ch => GLYPHS[ch]);
  const total = gl.reduce((s, g) => s + g.w, 0) * squeeze + gap * (gl.length - 1);
  x.save();
  x.scale(h, h);
  x.translate(-total / 2, -0.5);
  x.lineWidth = weight; x.lineJoin = 'round'; x.lineCap = 'round';
  for (const g of gl) {
    x.save(); x.scale(squeeze, 1); strokeGlyph(x, g); x.restore();
    x.translate(g.w * squeeze + gap, 0);
  }
  x.restore();
  return total * h;
}

const FS = 100; // text is set at 100 px per mm and scaled down, so font sizes stay sane
const CAP = 0.7; // Jost's cap height, in ems

function measure(x, str, cap, { weight = 500, tracking = 0.08, fit = 0, family = 'Jost' } = {}) {
  x.font = `${weight} ${(cap / CAP) * FS}px ${family}`;
  const chars = [...str];
  const widths = chars.map(ch => x.measureText(ch).width / FS);
  const sum = widths.reduce((a, b) => a + b, 0);
  const track = fit && chars.length > 1 ? (fit - sum) / (chars.length - 1) : tracking * cap;
  return { chars, widths, track, total: sum + track * (chars.length - 1) };
}

function glyph(x, ch, cx, cap) {
  x.save();
  x.scale(1 / FS, -1 / FS);
  x.textBaseline = 'alphabetic'; x.textAlign = 'center';
  x.fillText(ch, cx * FS, (cap / 2) * FS);
  x.restore();
}

/** Fill a straight line of capitals `cap` tall, centred on the origin. `fit` spaces it out to a width. */
export function letters(x, str, cap, opts = {}) {
  const m = measure(x, str, cap, opts);
  let cx = -m.total / 2;
  m.chars.forEach((ch, i) => {
    glyph(x, ch, cx + m.widths[i] / 2, cap);
    cx += m.widths[i] + m.track;
  });
  return m.total;
}

/**
 * Set something at radius r and clock angle deg, turned to follow the circle.
 * Tops point outward by default (read from outside the dial); `inward` turns them to the centre.
 */
export function onCircle(x, r, deg, fn, inward = false) {
  const p = polar(r, deg);
  x.save();
  x.translate(p[0], p[1]);
  x.rotate(-deg * DEG + (inward ? Math.PI : 0));
  fn();
  x.restore();
}

/** Capitals along a circle, centred on clock angle deg. */
export function arcLetters(x, str, r, deg, cap, opts = {}) {
  const m = measure(x, str, cap, opts);
  const dir = opts.inward ? -1 : 1;
  let c = -m.total / 2;
  m.chars.forEach((ch, i) => {
    const mid = c + m.widths[i] / 2;
    onCircle(x, r, deg + dir * (mid / r) / DEG, () => glyph(x, ch, 0, cap), opts.inward);
    c += m.widths[i] + m.track;
  });
  return m.total;
}

/** A canvas whose drawing units are millimetres from its centre, +Y up. `half` is the half-extent in mm. */
export function mmCanvas(size, half) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const x = c.getContext('2d');
  const k = size / (2 * half);
  x.setTransform(k, 0, 0, -k, size / 2, size / 2);
  return { c, x, k };
}
