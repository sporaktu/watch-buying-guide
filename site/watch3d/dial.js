// Dial: the printed plate with its fixed slide rule scale, the rotating scale ring, three sunk
// registers, the date under its window, and the applied markers and wings.
// All print is drawn in millimetres on canvases; everything with height is real geometry.
import * as THREE from './vendor/three.module.js';
import { TAU, lathe, flatRing, bevelPlate, planarUV, merge, xform, rng } from './geo.js';
import { D } from './dims.js';
import { DEG, polar, digits, letters, arcLetters, onCircle, mmCanvas } from './type.js';

export const INK = {
  blue: '#1d477c', blueEdge: '#143460',
  cream: '#ece0c2', creamDeep: '#e3d6b2', creamShade: '#b9ad8c',
  ink: '#161a23', print: '#f4efe1', red: '#c4221c',
};

const HALF = 19.2;        // half-extent of the dial texture, mm
const FLOOR_HALF = 4.8;   // half-extent of a register texture, mm
const DATE_HALF = 13.2;   // half-extent of the date ring texture, mm
const DATE_R = D.subOff + 3.0; // the window sits 3 mm below the centre of the 6 o'clock register

/** Slide rule position of the number n, in degrees clockwise from 12: one decade a turn, 60 at the top. */
export const slide = (n) => ((360 * Math.log10(n / 60)) % 360 + 360) % 360;

// ---------------------------------------------------------------------------------------------
// drawing helpers (millimetres, +Y up, angles clockwise from 12)

function tick(x, deg, r0, r1, w) {
  const a = polar(r0, deg), b = polar(r1, deg);
  x.lineWidth = w; x.lineCap = 'butt';
  x.beginPath(); x.moveTo(a[0], a[1]); x.lineTo(b[0], b[1]); x.stroke();
}
function disc(x, r, fill) { x.fillStyle = fill; x.beginPath(); x.arc(0, 0, r, 0, TAU); x.fill(); }
function circle(x, r, w) { x.lineWidth = w; x.beginPath(); x.arc(0, 0, r, 0, TAU); x.stroke(); }
/** Filled triangle on the radius at `deg`, its point at rApex and its base at rBase. */
function triangle(x, deg, rApex, rBase, half) {
  x.save(); x.rotate(-deg * DEG);
  x.beginPath(); x.moveTo(0, rApex); x.lineTo(-half, rBase); x.lineTo(half, rBase); x.closePath(); x.fill();
  x.restore();
}

/** Logarithmic graduation of both slide rule scales. span(len) gives [r0, r1] for len 0 long, 1 medium, 2 short. */
function slideTicks(x, span) {
  for (let t = 100; t < 1000; t++) {
    const keep = t < 120 || (t < 250 && t % 2 === 0) || (t < 400 && t % 5 === 0) || t % 10 === 0;
    if (!keep) continue;
    const long = t < 400 ? t % 10 === 0 : t % 50 === 0;
    const len = long ? 0 : (t < 120 && t % 5 === 0) ? 1 : 2;
    const [r0, r1] = span(len);
    tick(x, slide(t / 10), r0, r1, long ? 0.075 : 0.055);
  }
}

const RING_NUMERALS = [60, 65, 70, 75, 80, 85, 90, 95, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 30, 35, 40, 45, 50, 55];
// The fixed scale is sparser, and shows 70, 80 and 90 as 7, 8, 9.
const FIXED_NUMERALS = [[70, '7'], [80, '8'], [90, '9'], [10, '10'], [12, '12'], [13, '13'], [14, '14'],
  ...[16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 30, 35, 40, 45, 50, 55].map(n => [n, String(n)])];

/**
 * Paint the dial plate and the rotating ring. `pal` supplies the paints, so the same drawing gives
 * the colour texture and, with another palette, the roughness and metalness texture.
 */
function paintDial(x, pal) {
  x.fillStyle = pal.cream; x.fillRect(-HALF, -HALF, 2 * HALF, 2 * HALF);

  // sunray-brushed blue centre
  disc(x, D.fixedR0, pal.plate(x));
  const rnd = rng(31);
  for (let i = 0; i < 1500; i++) {
    const a = rnd() * 360, da = 0.04 + rnd() * 0.3, u = rnd(), v = rnd();
    const p = polar(D.fixedR0, a - da), q = polar(D.fixedR0, a + da);
    x.fillStyle = pal.streak(u, v);
    x.beginPath(); x.moveTo(0, 0); x.lineTo(p[0], p[1]); x.lineTo(q[0], q[1]); x.closePath(); x.fill();
  }

  // quarter-second track, broken at 12 for MPH and at 3, 6 and 9 for the lume squares
  x.strokeStyle = pal.print;
  for (let i = 0; i < 240; i++) {
    const a = i * 1.5;
    if (Math.min(a, 360 - a) < 3.2) continue;
    if ([90, 180, 270].some(q => Math.abs(a - q) < 2.3)) continue;
    const whole = i % 4 === 0;
    tick(x, a, whole ? 13.2 : 13.62, D.fixedR0, whole ? 0.085 : 0.05);
  }

  // fixed scale: graduated along its outer edge, where it meets the ring
  x.strokeStyle = pal.ink;
  circle(x, D.fixedR0 + 0.13, 0.05);
  slideTicks(x, (len) => [D.ringR0 - [0.7, 0.5, 0.36][len], D.ringR0 - 0.05]);
  for (const [n, label] of FIXED_NUMERALS) {
    x.strokeStyle = n === 10 ? pal.red : pal.ink;
    onCircle(x, 14.78, slide(n), () => digits(x, label, 0.8, { weight: 0.155 }));
  }
  // MPH index at 60, and the unit marks
  x.fillStyle = pal.ink; x.strokeStyle = pal.ink;
  tick(x, 0, 14.32, 15.45, 0.1);
  triangle(x, 0, 16.03, 15.4, 0.3);
  x.fillStyle = pal.red;
  for (const n of [33, 36, 38, 61]) triangle(x, slide(n), 16.03, 15.5, 0.2);
  arcLetters(x, 'KM', 14.78, 5.4, 0.42, { weight: 700 });
  x.fillStyle = pal.ink;
  arcLetters(x, 'NAUT.', 14.78, 262.3, 0.42, { weight: 600 });
  arcLetters(x, 'STAT.', 14.78, 286.2, 0.42, { weight: 600 });

  // rotating scale: graduated along its inner edge
  x.strokeStyle = pal.ink;
  slideTicks(x, (len) => [D.ringR0 + 0.05, D.ringR0 + [0.7, 0.5, 0.36][len]]);
  for (const n of RING_NUMERALS) {
    x.strokeStyle = (n === 60 || n === 10) ? pal.red : pal.ink;
    onCircle(x, 17.86, slide(n), () => digits(x, String(n), 0.98, { weight: 0.155 }));
  }
  x.fillStyle = pal.red;
  for (const n of [60, 10, 36]) triangle(x, slide(n), 16.86, 17.24, 0.2);

  // dial print
  x.fillStyle = pal.print;
  arcLetters(x, 'MPH', 13.62, 0, 0.4, { weight: 600 });
  x.save(); x.translate(0, 5.6); letters(x, 'BREITLING', 0.8, { weight: 600, fit: 7.4 }); x.restore();
  x.save(); x.translate(0, 4.45); letters(x, '1884', 0.5, { weight: 500, fit: 2.0 }); x.restore();
  x.save(); x.translate(0, -2.15); letters(x, 'NAVITIMER', 0.52, { weight: 500, tracking: 0.2 }); x.restore();
  arcLetters(x, 'SWISS', 12.84, 193.4, 0.33, { weight: 600, inward: true, tracking: 0.14 });
  arcLetters(x, 'MADE', 12.84, 166.6, 0.33, { weight: 600, inward: true, tracking: 0.14 });
}

const COLOUR = {
  cream: INK.cream, ink: INK.ink, print: INK.print, red: INK.red,
  plate: (x) => {
    const g = x.createRadialGradient(0, 0, 0, 0, 0, D.fixedR0);
    g.addColorStop(0, INK.blue); g.addColorStop(1, INK.blueEdge);
    return g;
  },
  streak: (u, v) => (u < 0.5 ? `rgba(170,205,255,${0.02 + 0.05 * v})` : `rgba(0,8,30,${0.03 + 0.07 * v})`),
};
// Green is roughness, blue is metalness.
const SURFACE = {
  cream: '#00cf00', ink: '#008a00', print: '#009c00', red: '#008600',
  plate: () => '#00629e',
  streak: (u, v) => (u < 0.5 ? `rgba(0,140,158,${0.1 + 0.2 * v})` : `rgba(0,56,158,${0.1 + 0.2 * v})`),
};

function canvasTexture(canvas, { srgb = true, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = aniso;
  return t;
}

/** Direction of the sunray grain for the anisotropic highlight: tangential, and only on the blue. */
function sunrayMap(size = 512) {
  const data = new Uint8Array(size * size * 4);
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const xm = ((i + 0.5) / size * 2 - 1) * HALF, ym = ((j + 0.5) / size * 2 - 1) * HALF;
      const r = Math.hypot(xm, ym) || 1e-6, k = (j * size + i) * 4;
      data[k] = Math.round(127.5 - 127.5 * ym / r);
      data[k + 1] = Math.round(127.5 + 127.5 * xm / r);
      data[k + 2] = r < D.fixedR0 ? 255 : 0;
      data[k + 3] = 255;
    }
  }
  const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
}

/** Fine concentric grooves (azurage) in the middle of each register, as a normal map. */
function azurageMap(size = 1024) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const x = c.getContext('2d'), img = x.createImageData(size, size), d = img.data;
  const period = 0.17, rMax = 3.3;
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const xm = ((i + 0.5) / size * 2 - 1) * FLOOR_HALF, ym = (1 - (j + 0.5) / size * 2) * FLOOR_HALF;
      const r = Math.hypot(xm, ym) || 1e-6, k = (j * size + i) * 4;
      const fade = Math.min(1, Math.max(0, (rMax - r) / 0.08));
      const slope = fade * 0.55 * Math.sin(TAU * r / period);
      const nx = -slope * xm / r, ny = -slope * ym / r, l = Math.hypot(nx, ny, 1);
      d[k] = Math.round(127.5 + 127.5 * nx / l);
      d[k + 1] = Math.round(127.5 + 127.5 * ny / l);
      d[k + 2] = Math.round(127.5 + 127.5 / l);
      d[k + 3] = 255;
    }
  }
  x.putImageData(img, 0, 0);
  return canvasTexture(c, { srgb: false });
}

// ---------------------------------------------------------------------------------------------
// registers

const REGISTERS = {
  seconds: { at: [-D.subOff, 0], count: 60, major: 5, labels: [[0, '60'], [120, '20'], [240, '40']] },
  minutes: { at: [D.subOff, 0], count: 30, major: 5, labels: [[0, '30'], [120, '10'], [240, '20']] },
  hours: { at: [0, -D.subOff], count: 24, major: 2, labels: [[0, '12'], [90, '3'], [270, '9']], date: true },
};
const WINDOW = { w: 1.36, h: 1.72, y: -3.0 };

function paintRegister(x, spec) {
  x.fillStyle = INK.cream; x.fillRect(-FLOOR_HALF, -FLOOR_HALF, 2 * FLOOR_HALF, 2 * FLOOR_HALF);
  disc(x, 3.3, INK.creamDeep);
  x.strokeStyle = 'rgba(70,58,30,0.09)';
  for (let r = 0.17; r < 3.3; r += 0.17) circle(x, r, 0.04);
  x.strokeStyle = INK.ink;
  for (let i = 0; i < spec.count; i++) {
    const a = i * 360 / spec.count, major = i % spec.major === 0;
    if (spec.date && Math.abs(a - 180) < 1) continue;
    tick(x, a, major ? 3.78 : 4.0, 4.32, major ? 0.08 : 0.055);
  }
  for (const [a, label] of spec.labels) {
    const p = polar(2.52, a);
    x.save(); x.translate(p[0], p[1]); digits(x, label, 0.95, { weight: 0.15 }); x.restore();
  }
  if (spec.date) {
    x.lineWidth = 0.06; x.lineJoin = 'miter';
    x.strokeRect(-WINDOW.w / 2 - 0.07, WINDOW.y - WINDOW.h / 2 - 0.07, WINDOW.w + 0.14, WINDOW.h + 0.14);
  }
}

function register(spec, shared, name) {
  const { c, x } = mmCanvas(1024, FLOOR_HALF);
  paintRegister(x, spec);
  const map = canvasTexture(c, { aniso: shared.aniso });
  const shape = new THREE.Shape();
  shape.absarc(0, 0, D.subR - 0.17, 0, TAU, false);
  if (spec.date) {
    const w = WINDOW.w / 2, h = WINDOW.h / 2, hole = new THREE.Path();
    hole.moveTo(-w, WINDOW.y - h); hole.lineTo(-w, WINDOW.y + h); hole.lineTo(w, WINDOW.y + h); hole.lineTo(w, WINDOW.y - h); hole.closePath();
    shape.holes.push(hole);
  }
  const floor = planarUV(new THREE.ShapeGeometry(shape, 72), FLOOR_HALF);
  const mat = new THREE.MeshStandardMaterial({
    map, normalMap: shared.azurage, normalScale: new THREE.Vector2(0.55, 0.55), roughness: 0.56, metalness: 0.0,
  });
  const g = new THREE.Group();
  g.name = name;
  g.position.set(spec.at[0], spec.at[1], D.dialZ - D.subDrop);
  const floorMesh = new THREE.Mesh(floor, mat);
  floorMesh.receiveShadow = true;
  floorMesh.name = `${name} floor`;
  // the step down from the dial: a narrow polished chamfer in the dial colour
  const step = new THREE.Mesh(lathe([[[D.subR, D.subDrop], [D.subR - 0.2, 0]]], { segs: 96 }), shared.stepMat);
  step.name = `${name} step`;
  step.receiveShadow = true;
  g.add(floorMesh, step);
  return g;
}

// ---------------------------------------------------------------------------------------------
// date

function dateRing(shared) {
  const { c, x } = mmCanvas(2048, DATE_HALF);
  x.fillStyle = INK.cream; x.fillRect(-DATE_HALF, -DATE_HALF, 2 * DATE_HALF, 2 * DATE_HALF);
  x.strokeStyle = INK.ink;
  for (let i = 1; i <= 31; i++) {
    onCircle(x, DATE_R, 180 + (i - 1) * 360 / 31, () => digits(x, String(i), 0.98, { weight: 0.17, gap: 0.17, squeeze: 0.8 }), true);
  }
  const ring = planarUV(flatRing(DATE_R - 1.7, DATE_R + 1.7, 0, { segs: 124 }), DATE_HALF);
  const mesh = new THREE.Mesh(ring, new THREE.MeshStandardMaterial({ map: canvasTexture(c, { aniso: shared.aniso }), roughness: 0.7, metalness: 0 }));
  mesh.name = 'date ring';
  mesh.position.z = D.dialZ - D.dateDrop;
  return mesh;
}

// ---------------------------------------------------------------------------------------------
// applied furniture

const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];

function furniture(M) {
  const metal = [], lume = [];
  const place = (g, hour) => xform(g, { rz: -hour * 30 * DEG });
  // batons at the hours without a register
  for (const h of [1, 2, 4, 5, 7, 8, 10, 11]) {
    metal.push(place(bevelPlate(rect(-0.4, 10.5, 0.4, 14.05), -0.05, 0.42, 0.13), h));
    lume.push(place(bevelPlate(rect(-0.17, 10.86, 0.17, 13.7), 0.4, 0.465, 0.025), h));
  }
  // twin baton at 12
  for (const s of [-1, 1]) {
    metal.push(bevelPlate(rect(s * 0.55 - 0.35, 10.4, s * 0.55 + 0.35, 13.1), -0.05, 0.42, 0.12));
    lume.push(bevelPlate(rect(s * 0.55 - 0.14, 10.72, s * 0.55 + 0.14, 12.78), 0.4, 0.465, 0.025));
  }
  // lume squares outside the registers
  for (const h of [3, 6, 9]) {
    metal.push(place(bevelPlate(rect(-0.42, 13.1, 0.42, 13.94), -0.05, 0.3, 0.09), h));
    lume.push(place(bevelPlate(rect(-0.26, 13.26, 0.26, 13.78), 0.28, 0.345, 0.025), h));
  }
  // winged emblem under 12: a boss between two fans of feathers
  const wy = 7.75, boss = [];
  for (let i = 0; i < 28; i++) boss.push([0.56 * Math.cos(TAU * i / 28), wy + 0.06 + 0.56 * Math.sin(TAU * i / 28)]);
  metal.push(bevelPlate(boss, -0.02, 0.24, 0.07));
  for (const s of [-1, 1]) {
    for (let k = 0; k < 4; k++) {
      const yt = wy + 0.8 - k * 0.39, yb = yt - 0.27;
      const xi = 0.72 - 0.05 * k * k + 0.1 * k, xo = 4.1 - k * 0.82 - k * k * 0.06;
      const pts = [[xi, yb], [xo - 0.34, yb], [xo, yt], [xi + 0.03, yt]].map(p => [s * p[0], p[1]]);
      metal.push(bevelPlate(pts, -0.02, 0.2, 0.06));
    }
  }
  const g = new THREE.Group();
  g.name = 'applied markers';
  g.position.z = D.dialZ;
  const a = new THREE.Mesh(merge(metal), M.rhodium), b = new THREE.Mesh(merge(lume), M.lume);
  a.name = 'markers and wings'; b.name = 'marker lume';
  a.castShadow = true; a.receiveShadow = true; b.receiveShadow = true;
  g.add(a, b);
  return g;
}

// ---------------------------------------------------------------------------------------------

export function buildDial({ M, renderer, report }) {
  const group = new THREE.Group();
  group.name = 'dial';
  const maxSize = renderer.capabilities.maxTextureSize;
  const size = Math.min(4096, maxSize);
  const aniso = M.maxAniso;

  const colour = mmCanvas(size, HALF);
  paintDial(colour.x, COLOUR);
  const surface = mmCanvas(size / 2, HALF);
  paintDial(surface.x, SURFACE);
  const map = canvasTexture(colour.c, { aniso });
  const orm = canvasTexture(surface.c, { srgb: false, aniso });

  // plate, pierced for the three registers
  const shape = new THREE.Shape();
  shape.absarc(0, 0, D.ringR0 + 0.3, 0, TAU, false);
  for (const spec of Object.values(REGISTERS)) {
    const hole = new THREE.Path();
    hole.absarc(spec.at[0], spec.at[1], D.subR, 0, TAU, true);
    shape.holes.push(hole);
  }
  const plateGeo = planarUV(new THREE.ShapeGeometry(shape, 160), HALF);
  const plateMat = new THREE.MeshPhysicalMaterial({
    map, roughnessMap: orm, metalnessMap: orm, roughness: 1, metalness: 1,
    anisotropy: 0.8, anisotropyMap: sunrayMap(),
    clearcoat: 0.22, clearcoatRoughness: 0.1,
  });
  const plate = new THREE.Mesh(plateGeo, plateMat);
  plate.name = 'dial plate';
  plate.position.z = D.dialZ;
  plate.receiveShadow = true;
  group.add(plate);

  // rotating slide rule ring, a step above the dial and turning with the bezel
  const ring = new THREE.Group();
  ring.name = 'rotating scale';
  const ringMat = new THREE.MeshStandardMaterial({ map, roughness: 0.74, metalness: 0 });
  const ringTop = new THREE.Mesh(planarUV(flatRing(D.ringR0, D.glassR + 0.25, D.ringZ, { segs: 200 }), HALF), ringMat);
  ringTop.receiveShadow = true;
  const ringEdge = new THREE.Mesh(
    lathe([[[D.ringR0, D.ringZ], [D.ringR0, D.dialZ - 0.02]]], { segs: 200 }),
    new THREE.MeshStandardMaterial({ color: INK.creamShade, roughness: 0.8, metalness: 0 }),
  );
  ring.add(ringTop, ringEdge);
  group.add(ring);

  // registers
  const shared = {
    aniso,
    azurage: azurageMap(),
    stepMat: new THREE.MeshPhysicalMaterial({ color: INK.blue, metalness: 0.7, roughness: 0.2, clearcoat: 0.3, side: THREE.DoubleSide }),
  };
  shared.azurage.anisotropy = aniso;
  const registers = {};
  for (const [key, spec] of Object.entries(REGISTERS)) {
    registers[key] = register(spec, shared, `${key} register`);
    group.add(registers[key]);
  }

  // date: a printed ring under the 6 o'clock register, seen through a real opening
  const date = dateRing(shared);
  group.add(date);
  const depth = D.dateDrop - D.subDrop + 0.08;
  const shaft = new THREE.Mesh(
    new THREE.BoxGeometry(WINDOW.w, WINDOW.h, depth),
    new THREE.MeshStandardMaterial({ color: INK.creamShade, roughness: 0.85, metalness: 0, side: THREE.BackSide }),
  );
  shaft.name = 'date window walls';
  shaft.position.set(0, -D.subOff + WINDOW.y, D.dialZ - D.subDrop - depth / 2);
  group.add(shaft);

  group.add(furniture(M));

  report.dial = { texture: size, registers: Object.keys(registers), scaleTop: slide(60), tenAt: +slide(10).toFixed(2) };

  const tick = (now) => { date.rotation.z = (now.getDate() - 1) * TAU / 31; };
  return { group, tick, ring, registers, centres: Object.fromEntries(Object.entries(REGISTERS).map(([k, s]) => [k, s.at])) };
}
