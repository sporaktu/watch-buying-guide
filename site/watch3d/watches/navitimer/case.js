// The head without its dial: mid-case, lugs, beaded bezel, crystal, crown and pushers.
import * as THREE from '../../vendor/three.module.js';
import { TAU, DEG, lathe, extrude, roundPoly, planarUV, merge, xform } from '../../kit/geo.js';
import { D, lugTop, lugUnder } from './dims.js';

function part(geo, mat, name, { cast = true, receive = true } = {}) {
  const m = new THREE.Mesh(geo, mat);
  m.name = name;
  m.castShadow = cast; m.receiveShadow = receive;
  return m;
}

/** Mid-case: a brushed band with polished edge chamfers, slightly barrelled. */
function midCase(M) {
  const R = D.caseR, T = D.caseTop;
  const band = lathe([[
    [R - 0.13, 0.55], [R - 0.05, 1.3], [R, 2.1], [R, 2.9], [R - 0.05, 3.7], [R - 0.13, T - 0.55],
  ]], { segs: 240, rRef: R });
  const edges = lathe([
    [[R - 0.62, 0], [R - 0.5, 0.06], [R - 0.2, 0.36], [R - 0.13, 0.55]],
    [[R - 0.13, T - 0.55], [R - 0.2, T - 0.36], [R - 0.5, T - 0.06], [R - 0.62, T]],
  ], { segs: 240 });
  const flats = lathe([
    [[D.backR - 0.4, 0], [R - 0.62, 0]],
    [[R - 0.62, T], [18.2, T]],
  ], { segs: 240 });
  return [part(band, M.brushed, 'case band'), part(edges, M.polished, 'case chamfers'), part(flats, M.brushed, 'case flats')];
}

/** Side profile of a lug, [y, z], for y > 0. */
export function lugProfile() {
  const pts = [];
  const tip = D.lugTipY;
  for (let y = 11.5; y < tip - 0.55; y += 0.4) pts.push([y, lugTop(y), 0]);
  pts.push([tip + 0.02, lugTop(tip) - 0.05, 1.0]);
  pts.push([tip - 0.42, lugUnder(tip) - 0.02, 1.2]);
  for (let y = tip - 1.3; y > 11.5; y -= 0.5) pts.push([y, lugUnder(y), 0]);
  pts.push([11.5, lugUnder(11.5), 0]);
  return roundPoly(pts, 0, 8);
}

/** Four lugs: polished tops and undersides with a chamfer, brushed flanks. */
function lugs(M) {
  const prof = lugProfile();
  const inner = D.lugGap / 2, outer = D.lugOuter;
  // The outer flank eases in toward the tip, as the lug leaves the round of the case.
  const out = (y) => outer - 0.35 * Math.pow(Math.max(0, (y - 15) / 8.3), 1.4);
  const skins = [], flanks = [];
  for (const side of [1, -1]) {
    const e = side > 0
      ? extrude(prof, outer - inner, { edge: 0.3, x0: () => inner, x1: out, nx: 2 })
      : extrude(prof, outer - inner, { edge: 0.3, x0: (y) => -out(y), x1: () => -inner, nx: 2 });
    for (const turn of [0, Math.PI]) {
      skins.push(xform(e.skin.clone(), { rz: turn }));
      flanks.push(xform(e.capA.clone(), { rz: turn }), xform(e.capB.clone(), { rz: turn }));
    }
  }
  return [part(merge(skins), M.polished, 'lug tops'), part(merge(flanks), M.brushed, 'lug flanks')];
}

/** Bezel: a ring of 56 rounded beads below a narrow polished rim, with the inner wall under the crystal. */
function bezel(M) {
  const n = D.beads, z0 = D.beadZ0, z1 = D.beadZ1;
  const rows = 15, base = [];
  for (let i = 0; i < rows; i++) base.push([19.45, z0 + (z1 - z0) * (i / (rows - 1))]);
  const bead = (phi) => Math.pow(0.5 + 0.5 * Math.cos(n * phi), 0.5);
  const swell = (t) => Math.pow(Math.sin(Math.PI * Math.min(1, Math.max(0, t))), 0.45);
  const beads = lathe([base], {
    segs: n * 18,
    mod: (r, z, phi, t) => {
      const s = swell(t);
      return [r + (D.beadValley - 19.45) * s + (D.beadTop - D.beadValley) * s * bead(phi), z];
    },
    shade: (r, z, phi, t) => 0.3 + 0.7 * Math.min(1, bead(phi) * 1.25) * (0.7 + 0.3 * swell(t)),
  });
  const rim = lathe([
    [[18.4, D.bezelZ0], [19.45, D.bezelZ0], [19.45, z0]],
    [[19.45, z1], [D.rimR, z1 + 0.03], [19.46, z1 + 0.2], [19.3, z1 + 0.42], [19.08, z1 + 0.6], [D.glassR, D.bezelZ1]],
  ], { segs: 240 });
  const wall = lathe([[[D.glassR, D.bezelZ1], [D.glassR, D.dialZ - 0.2]]], { segs: 200 });
  const g = new THREE.Group();
  g.name = 'bezel';
  g.add(part(beads, M.polishedAO, 'bezel beads'), part(rim, M.polished, 'bezel rim'), part(wall, M.rehaut, 'bezel inner wall', { cast: false }));
  return g;
}

/** Crystal: a double-domed sapphire, drawn as two reflecting shells over the dial. */
function crystal(M) {
  const R = D.glassR - 0.08, edge = 18.5, rise = D.glassApex - (D.glassWall + 0.05);
  const S = (edge * edge + rise * rise) / (2 * rise);
  const dome = (r) => D.glassApex - S + Math.sqrt(S * S - r * r);
  const outer = [[R, D.bezelZ1 - 0.05], [R, D.glassWall - 0.2], [R - 0.06, D.glassWall - 0.06], [R - 0.2, D.glassWall + 0.02]];
  for (let i = 0; i <= 30; i++) { const u = i / 30; outer.push([edge * (1 - u * u * 0.4 - u * 0.6), 0]); }
  for (let i = 4; i < outer.length; i++) outer[i][1] = dome(outer[i][0]);
  outer[outer.length - 1][0] = 0;
  const inner = [];
  for (let i = 0; i <= 26; i++) { const r = (R - 0.5) * (1 - i / 26); inner.push([r, dome(Math.min(r, edge)) - 1.15 + 0.35 * (r / R) * (r / R)]); }
  const g = new THREE.Group();
  g.name = 'crystal';
  const a = part(lathe([outer], { segs: 160 }), M.crystal, 'crystal', { cast: false, receive: false });
  const b = part(lathe([inner], { segs: 120 }), M.crystalInner, 'crystal underside', { cast: false, receive: false });
  a.renderOrder = 20; b.renderOrder = 19;
  g.add(a, b);
  return g;
}

/** Crown at 3 o'clock: fluted, with a flat polished end. Built along +Z, then laid along +X. */
/** Satin crown end with an engraved initial. */
function crownCapMaterial() {
  const size = 256, c = document.createElement('canvas');
  c.width = c.height = size;
  const x = c.getContext('2d');
  x.fillStyle = '#ffffff'; x.fillRect(0, 0, size, size);
  x.strokeStyle = '#8a8a8a'; x.lineWidth = 5;
  x.beginPath(); x.arc(size / 2, size / 2, size * 0.36, 0, TAU); x.stroke();
  x.fillStyle = '#000000';
  x.font = `700 ${size * 0.46}px Jost`;
  x.textAlign = 'center'; x.textBaseline = 'alphabetic';
  x.fillText('B', size / 2, size * 0.665);
  const bump = new THREE.CanvasTexture(c);
  bump.anisotropy = 8;
  return new THREE.MeshPhysicalMaterial({ color: 0xc9cbce, metalness: 1, roughness: 0.3, bumpMap: bump, bumpScale: 1.2 });
}

function crown(M) {
  const R = D.crownR, flutes = 24;
  const body = [[R - 0.42, 0], [R - 0.12, 0.12], [R, 0.42]];
  for (let i = 1; i <= 8; i++) body.push([R, 0.42 + 2.1 * (i / 8)]);
  body.push([R - 0.12, 2.82], [R - 0.45, 3.0]);
  const groove = (phi) => Math.pow(0.5 - 0.5 * Math.cos(flutes * phi), 1.5);
  const fade = (t) => Math.min(1, Math.max(0, Math.min(t - 0.06, 0.94 - t) / 0.1));
  const fluted = lathe([body], {
    segs: flutes * 14,
    mod: (r, z, phi, t) => [r - 0.3 * groove(phi) * fade(t), z],
    shade: (r, z, phi, t) => 1 - 0.6 * groove(phi) * fade(t),
  });
  const ends = lathe([
    [[1.6, -0.02], [R - 0.42, 0]],
    [[R - 0.45, 3.0], [R - 0.62, 3.05]],
  ], { segs: 96 });
  const cap = planarUV(lathe([[[R - 0.62, 3.05], [1.4, 3.11], [0, 3.14]]], { segs: 72 }), R);
  const stem = lathe([[[1.95, -1.2], [1.95, 0.02]]], { segs: 48 });
  const g = new THREE.Group();
  g.name = 'crown';
  g.add(part(fluted, M.polishedAO, 'crown flutes'), part(ends, M.polished, 'crown ends'), part(stem, M.polished, 'crown tube'));
  g.add(part(cap, crownCapMaterial(), 'crown emblem'));
  g.rotation.y = Math.PI / 2;
  g.position.set(D.caseR + 0.42, 0, D.sideZ);
  return g;
}

/** A pump pusher: a collar on the case, a narrow stem and a wider cap with a polished end. */
function pusher(M, angleDeg, name) {
  const g = new THREE.Group();
  g.name = name;
  const collar = lathe([[[1.62, -0.9], [1.62, 0.28], [1.5, 0.4], [1.2, 0.42]]], { segs: 40 });
  const stem = lathe([[[1.12, 0], [1.12, 1.6]]], { segs: 32 });
  const capSide = lathe([[[1.72, 0.2], [1.72, 3.0]]], { segs: 48, rRef: 1.72, tile: 3 });
  const capEnds = lathe([
    [[0.9, 0], [1.5, 0], [1.72, 0.2]],
    [[1.72, 3.0], [1.52, 3.2], [0.8, 3.26], [0, 3.28]],
  ], { segs: 48 });
  const moving = new THREE.Group();
  moving.name = name + ' cap';
  const capGroup = new THREE.Group();
  capGroup.add(part(capSide, M.satin, name + ' cap side'), part(capEnds, M.polished, name + ' cap ends'));
  capGroup.position.z = 1.3;
  moving.add(part(stem, M.polished, name + ' stem'), capGroup);
  g.add(part(collar, M.polished, name + ' collar'), moving);
  const a = angleDeg * DEG;
  // local +Z points outward along the radius
  g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(Math.cos(a), Math.sin(a), 0));
  g.position.set(Math.cos(a) * (D.caseR - 0.1), Math.sin(a) * (D.caseR - 0.1), D.sideZ);
  g.userData.moving = moving;
  g.userData.press = 0;
  return g;
}

export function buildCase(M) {
  const g = new THREE.Group();
  g.name = 'case';
  g.add(...midCase(M), ...lugs(M));
  const bz = bezel(M);
  const glass = crystal(M);
  const cr = crown(M);
  const start = pusher(M, D.pusherAngle, 'start pusher');
  const reset = pusher(M, -D.pusherAngle, 'reset pusher');
  g.add(bz, glass, cr, start, reset);
  void TAU;
  return { group: g, bezel: bz, crystal: glass, crown: cr, pushers: { start, reset } };
}
