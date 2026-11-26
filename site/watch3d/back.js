// Case back: a screwed steel ring with engraving and wrench notches, a flat sapphire window, and
// a simplified automatic chronograph movement with a swinging rotor behind it.
// Everything here is built facing +Z in a group turned half a turn about Y, so that it faces the
// wrist and its lettering reads the right way round from behind.
import * as THREE from './vendor/three.module.js';
import { TAU, DEG, lathe, bevelPlate, planarUV, merge, xform, rng } from './geo.js';
import { D } from './dims.js';
import { arcLetters, mmCanvas } from './type.js';

const DEPTH = -D.backZ;          // 2.0 mm from the mid-case to the lowest point of the back
const BAND = [13.3, 17.0];       // engraved band, inner and outer radius
const RING_HALF = 18;            // half-extent of the engraving texture, mm
const MOVE_HALF = 12.6;          // half-extent of the movement textures, mm
const NOTCHES = 6;

const mesh = (geo, mat, name) => { const m = new THREE.Mesh(geo, mat); m.name = name; return m; };
const texture = (canvas, srgb, aniso) => {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = aniso;
  return t;
};
/** Points on an arc, angles in degrees anticlockwise from +X. */
function arcPts(r, a0, a1, n) {
  const out = [];
  for (let i = 0; i <= n; i++) { const a = (a0 + (a1 - a0) * i / n) * DEG; out.push([r * Math.cos(a), r * Math.sin(a)]); }
  return out;
}
const sector = (r0, r1, a0, a1, n = 48) => [...arcPts(r1, a0, a1, n), ...arcPts(r0, a1, a0, n)];

// ---------------------------------------------------------------------------------------------
// the steel ring

/** Engraved wording. Plausible for the watch, not copied from a real case back. */
const ENGRAVING = {
  top: 'BREITLING  ·  NAVITIMER  ·  B01 CHRONOGRAPH 41',
  bottom: 'STAINLESS STEEL  ·  3 BAR  ·  SWISS MADE',
};
const ENGRAVING_SPAN = 146;      // degrees of the band each line may fill

function engraving(aniso) {
  // one letter size for both lines, chosen so the longer line fits its share of the band
  const r = (BAND[0] + BAND[1]) / 2;
  const probe = mmCanvas(8, RING_HALF).x;
  const longest = Math.max(...[ENGRAVING.top, ENGRAVING.bottom].map(t => arcLetters(probe, t, r, 0, 1, { weight: 500, tracking: 0.26 })));
  const fit = Math.min(1, ENGRAVING_SPAN * DEG * r / longest);
  const cap = fit, tracking = 0.26 * fit;
  const draw = (size, base, cut, grain) => {
    const { c, x } = mmCanvas(size, RING_HALF);
    x.fillStyle = base; x.fillRect(-RING_HALF, -RING_HALF, 2 * RING_HALF, 2 * RING_HALF);
    if (grain) {
      // circular graining
      const rnd = rng(7);
      for (let i = 0; i < 2600; i++) {
        const r = 12.6 + rnd() * 5.2, a = rnd() * TAU, len = 0.2 + rnd() * 0.9, v = rnd();
        x.strokeStyle = v < 0.5 ? `rgba(255,255,255,${0.05 + 0.12 * rnd()})` : `rgba(0,0,0,${0.04 + 0.1 * rnd()})`;
        x.lineWidth = 0.03 + rnd() * 0.04;
        x.beginPath(); x.arc(0, 0, r, a, a + len); x.stroke();
      }
    }
    x.fillStyle = cut;
    arcLetters(x, ENGRAVING.top, r, 0, cap, { weight: 500, tracking });
    arcLetters(x, ENGRAVING.bottom, r, 180, cap, { weight: 500, tracking, inward: true });
    return c;
  };
  return {
    map: texture(draw(2048, '#e9eaec', '#4a4d52', true), true, aniso),
    bump: texture(draw(2048, '#ffffff', '#000000', false), false, aniso),
  };
}

function ring(M, aniso) {
  const out = [];
  // notches for the case back wrench, cut into the wall and its chamfer
  const notch = (r, z, phi) => {
    const step = TAU / NOTCHES;
    const d = Math.abs(((phi + step / 2) % step + step) % step - step / 2) / DEG;   // degrees from the nearest notch
    const k = 1 - Math.min(1, Math.max(0, (d - 3.4) / 0.9));
    return [r - 0.62 * k * Math.min(1, Math.max(0, (z - 0.06) / 0.1)), z];
  };
  const wall = lathe([[[D.backR, -0.03], [D.backR, 0.7]]], { segs: 360, mod: notch });
  const chamfer = lathe([
    [[D.backR, 0.7], [BAND[1], 1.1]],
    [[BAND[0], 1.86], [BAND[0] - 0.32, DEPTH]],
    [[BAND[0] - 0.32, DEPTH], [D.windowR, DEPTH]],
    [[D.windowR, DEPTH], [D.windowR, 0.9]],
  ], { segs: 360, mod: (r, z, phi) => (r > BAND[1] - 0.01 ? notch(r, z, phi) : [r, z]) });
  out.push(mesh(wall, M.brushed, 'case back wall'), mesh(chamfer, M.polished, 'case back bevels'));

  const tex = engraving(aniso);
  const band = planarUV(lathe([[[BAND[1], 1.1], [BAND[0], 1.86]]], { segs: 240 }), RING_HALF);
  const bandMat = new THREE.MeshPhysicalMaterial({
    color: 0xc9cbce, metalness: 1, roughness: 0.3, map: tex.map, bumpMap: tex.bump, bumpScale: 1.6,
  });
  out.push(mesh(band, bandMat, 'case back engraving'));
  return out;
}

// ---------------------------------------------------------------------------------------------
// the movement

function stripes() {
  // Geneva stripes: each stripe a shallow scallop, as a normal map one stripe wide
  const w = 128, c = document.createElement('canvas');
  c.width = w; c.height = 4;
  const x = c.getContext('2d'), img = x.createImageData(w, 4);
  for (let i = 0; i < w; i++) {
    const u = (i + 0.5) / w, slope = 0.5 * (u * 2 - 1), l = Math.hypot(slope, 1);
    for (let j = 0; j < 4; j++) {
      const k = (j * w + i) * 4;
      img.data[k] = Math.round(127.5 - 127.5 * slope / l); img.data[k + 1] = 128; img.data[k + 2] = Math.round(127.5 + 127.5 / l); img.data[k + 3] = 255;
    }
  }
  x.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1 / 1.7, 1 / 1.7);
  t.rotation = 24 * DEG;
  return t;
}

function perlage() {
  // overlapping circular graining on the main plate, as a height map tiling every 3 mm
  const size = 256, c = document.createElement('canvas');
  c.width = c.height = size;
  const x = c.getContext('2d');
  x.fillStyle = '#808080'; x.fillRect(0, 0, size, size);
  const spot = (cx, cy) => {
    const r = size * 0.3, g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, '#9a9a9a'); g.addColorStop(0.75, '#c8c8c8'); g.addColorStop(0.97, '#4a4a4a'); g.addColorStop(1, '#808080');
    x.fillStyle = g; x.beginPath(); x.arc(cx, cy, r, 0, TAU); x.fill();
  };
  for (let j = -1; j <= 4; j++) for (let i = -1; i <= 4; i++) spot((i + (j % 2 ? 0.5 : 0)) * size / 2, j * size / 4);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1 / 3, 1 / 3);
  return t;
}

function lettering(aniso, draw, base = '#ffffff') {
  const { c, x } = mmCanvas(1024, MOVE_HALF);
  x.fillStyle = base; x.fillRect(-MOVE_HALF, -MOVE_HALF, 2 * MOVE_HALF, 2 * MOVE_HALF);
  draw(x);
  const t = texture(c, true, aniso);
  // these parts carry their UVs in millimetres
  t.repeat.set(1 / (2 * MOVE_HALF), 1 / (2 * MOVE_HALF));
  t.offset.set(0.5, 0.5);
  return t;
}

function movement(M, aniso) {
  const g = new THREE.Group();
  g.name = 'movement';
  const stripe = stripes();
  stripe.anisotropy = aniso;
  const gilt = '#c9a04e';

  const plateMat = new THREE.MeshPhysicalMaterial({ color: 0xaeb1b6, metalness: 1, roughness: 0.38, bumpMap: perlage(), bumpScale: 0.9 });
  const bridgeMat = new THREE.MeshPhysicalMaterial({
    color: 0xdcdde0, metalness: 1, roughness: 0.24, normalMap: stripe, normalScale: new THREE.Vector2(0.55, 0.55),
    map: lettering(aniso, (x) => {
      x.fillStyle = gilt;
      arcLetters(x, 'BREITLING  ·  CALIBRE B01', 10.6, 62, 0.62, { weight: 600, tracking: 0.2 });
      arcLetters(x, 'FORTY-SEVEN JEWELS', 8.9, 62, 0.5, { weight: 600, tracking: 0.18 });
    }),
  });
  const gold = new THREE.MeshPhysicalMaterial({ color: 0xd9b56a, metalness: 1, roughness: 0.22 });
  const ruby = new THREE.MeshPhysicalMaterial({ color: 0xa3123f, metalness: 0, roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.04 });
  const blued = new THREE.MeshPhysicalMaterial({ color: 0x2a3a8c, metalness: 1, roughness: 0.2 });

  // main plate
  const plate = lathe([[[D.windowR + 0.6, 0.1], [0, 0.1]]], { segs: 96 });
  const pp = plate.attributes.position, puv = plate.attributes.uv;
  for (let i = 0; i < pp.count; i++) puv.setXY(i, pp.getX(i), pp.getY(i));
  g.add(mesh(plate, plateMat, 'main plate'));
  g.add(mesh(lathe([[[D.windowR + 0.6, 0.1], [D.windowR + 0.6, 1.2]]], { segs: 96 }), M.dark, 'movement ring'));

  // bridges, striped and bevelled
  const bridges = [
    bevelPlate(sector(3.3, 11.9, -72, 112), 0.1, 0.52, 0.1),            // train and automatic bridge
    bevelPlate(sector(4.2, 11.9, 198, 276), 0.1, 0.46, 0.1),            // chronograph bridge
  ];
  // balance cock, running in from the edge over the balance
  const B = [-5.72, 3.3];
  const cock = xform(bevelPlate([[4.6, -1.25], [11.3, -1.5], [11.75, -0.8], [11.75, 0.8], [11.3, 1.5], [4.6, 1.25], [4.1, 0.6], [4.1, -0.6]], 0.3, 0.64, 0.1), { rz: 150 * DEG });
  const cp = cock.attributes.position;
  for (let i = 0; i < cp.count; i++) cock.attributes.uv.setXY(i, cp.getX(i), cp.getY(i));
  bridges.push(cock);
  g.add(mesh(merge(bridges), bridgeMat, 'bridges'));

  // jewels in gold chatons, and screws
  const chaton = [], stone = [], screw = [], slot = [];
  const jewel = (x, y, z, s = 1) => {
    chaton.push(xform(lathe([[[0.62 * s, z - 0.02], [0.62 * s, z + 0.04]], [[0.62 * s, z + 0.04], [0.5 * s, z + 0.08], [0.36 * s, z + 0.04]]], { segs: 28 }), { t: [x, y, 0] }));
    stone.push(xform(lathe([[[0.37 * s, z + 0.03], [0.28 * s, z + 0.075], [0, z + 0.09]]], { segs: 20 }), { t: [x, y, 0] }));
  };
  const rnd = rng(11);
  const fix = (x, y, z, r = 0.46) => {
    screw.push(xform(lathe([[[r, z - 0.02], [r, z + 0.07]], [[r, z + 0.07], [r - 0.08, z + 0.13], [0, z + 0.13]]], { segs: 24 }), { t: [x, y, 0] }));
    slot.push(xform(new THREE.BoxGeometry(r * 1.9, 0.11, 0.03).toNonIndexed(), { rz: rnd() * Math.PI, t: [x, y, z + 0.135] }));
  };
  for (const [x, y] of [[3.6, 5.6], [7.4, 1.2], [5.6, -4.4], [0.6, 8.4], [2.2, -6.9]]) jewel(x, y, 0.52);
  jewel(-4.6, -6.6, 0.46);
  jewel(B[0], B[1], 0.64, 1.25);
  for (const [x, y] of [[9.9, 4.9], [2.1, 10.8], [9.6, -5.4], [-2.5, 10.1], [4.2, -10.4], [6.4, 6.9]]) fix(x, y, 0.52);
  for (const [x, y] of [[-9.0, -5.5], [-2.6, -10.6]]) fix(x, y, 0.46);
  fix(-9.18, 5.3, 0.64, 0.52);
  g.add(mesh(merge(chaton), gold, 'chatons'), mesh(merge(stone), ruby, 'jewels'), mesh(merge(screw), blued, 'screws'));
  for (const s of slot) s.deleteAttribute('uv');
  g.add(mesh(merge(slot), M.dark, 'screw slots'));

  // balance wheel under its cock
  const balance = new THREE.Group();
  balance.name = 'balance wheel';
  balance.position.set(B[0], B[1], 0);
  const rim = lathe([[[2.25, 0.22], [2.75, 0.22]], [[2.75, 0.22], [2.75, 0.4]], [[2.75, 0.4], [2.25, 0.4]], [[2.25, 0.4], [2.25, 0.22]]].map(r => r.slice().reverse()), { segs: 64 });
  const spokes = [0, 60, 120].map(a => xform(bevelPlate([[-2.3, -0.16], [2.3, -0.16], [2.3, 0.16], [-2.3, 0.16]], 0.24, 0.38, 0.03), { rz: a * DEG }));
  balance.add(mesh(rim, gold, 'balance rim'), mesh(merge(spokes), gold, 'balance spokes'));
  g.add(balance);

  // rotor: a heavy rim on three arms, free to swing
  const rotor = new THREE.Group();
  rotor.name = 'rotor';
  const massMat = new THREE.MeshPhysicalMaterial({
    color: 0xd4d6d9, metalness: 1, roughness: 0.27,
    map: lettering(aniso, (x) => {
      const r2 = rng(5);
      for (let i = 0; i < 900; i++) {
        const r = 9 + r2() * 3.4, a = Math.PI + r2() * Math.PI, len = 0.1 + r2() * 0.5;
        x.strokeStyle = r2() < 0.5 ? `rgba(255,255,255,${0.1 * r2()})` : `rgba(0,0,0,${0.03 + 0.07 * r2()})`;
        x.lineWidth = 0.03 + r2() * 0.03;
        x.beginPath(); x.arc(0, 0, r, a, a + len); x.stroke();
      }
      x.fillStyle = '#3c3f45';
      arcLetters(x, 'BREITLING', 10.72, 180, 1.12, { weight: 600, tracking: 0.42, inward: true });
    }, '#f2f2f3'),
  });
  const mass = bevelPlate(sector(9.25, 12.15, 181, 359, 80), 0.64, 1.04, 0.14);
  rotor.add(mesh(mass, massMat, 'rotor mass'));
  const arms = [214, 270, 326].map(a => xform(bevelPlate([[1.2, -1.05], [9.5, -0.62], [9.5, 0.62], [1.2, 1.05]], 0.7, 0.84, 0.06), { rz: a * DEG }));
  arms.push(bevelPlate(arcPts(2.0, 0, 360, 40).slice(0, -1), 0.66, 0.9, 0.08));
  rotor.add(mesh(merge(arms), M.brushed, 'rotor arms'));
  const bearing = lathe([[[1.05, 0.9], [1.05, 1.0]], [[1.05, 1.0], [0.9, 1.06], [0, 1.06]]], { segs: 32 });
  rotor.add(mesh(bearing, M.polished, 'rotor bearing'));
  g.add(rotor);

  return { group: g, balance, rotor };
}

// ---------------------------------------------------------------------------------------------

export function buildBack({ M, report }) {
  const group = new THREE.Group();
  group.name = 'case back';
  group.rotation.y = Math.PI;
  const aniso = M.maxAniso;

  for (const m of ring(M, aniso)) group.add(m);
  const works = movement(M, aniso);
  group.add(works.group);

  // flat sapphire window
  const glass = mesh(lathe([[[D.windowR, 1.66], [0, 1.66]]], { segs: 96 }), M.crystal, 'case back window');
  glass.renderOrder = 20;
  group.add(glass);

  // The rotor hangs toward the bottom of the screen and swings as the view turns, as it would on a wrist.
  const state = { angle: 0, speed: 0, t: 0 };
  const down = new THREE.Vector3();
  function tick(now, dt, camera) {
    state.t += dt;
    works.balance.rotation.z = 2.4 * Math.sin(TAU * 4 * state.t);
    let pull = 0, target = 0;
    if (camera) {
      down.set(0, -1, 0).applyQuaternion(camera.quaternion);
      pull = Math.hypot(down.x, down.y);
      target = Math.atan2(down.y, -down.x) + Math.PI / 2;   // world +X is this group's -X
    }
    const steps = 4, h = dt / steps;
    for (let i = 0; i < steps; i++) {
      const err = Math.atan2(Math.sin(target - state.angle), Math.cos(target - state.angle));
      state.speed += (26 * pull * Math.sin(err) - 1.5 * state.speed) * h;
      state.angle += state.speed * h;
    }
    works.rotor.rotation.z = state.angle;
  }

  report.back = { engraving: ENGRAVING, notches: NOTCHES };
  return { group, tick, rotor: works.rotor };
}
