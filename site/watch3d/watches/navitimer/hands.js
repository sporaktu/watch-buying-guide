// Hands: hour and minute swords with lume, the red chronograph needle, and the three register hands.
// The time comes from the clock passed to tick(); the chronograph keeps its own elapsed time.
import * as THREE from '../../vendor/three.module.js';
import { DEG, lathe, bevelPlate } from '../../kit/geo.js';
import { D } from './dims.js';

// Heights above the dial plate (mm). The crystal's inner face is 1.4 mm up at the edge of the dial.
const Z = {
  hour: [0.5, 0.72],
  minute: [0.82, 1.04],
  chrono: [1.14, 1.26],
  sub: [0.12, 0.22],     // above a register floor
};
const BEAT = 8;          // 28,800 vibrations an hour: eight steps of the seconds hands a second

const mesh = (geo, mat, name) => {
  const m = new THREE.Mesh(geo, mat);
  m.name = name; m.castShadow = true; m.receiveShadow = true;
  return m;
};

/** A straight sword: parallel sides, a short point, a narrower tail behind the pivot. */
function sword(len, half, tail, tailHalf, point) {
  return [[-tailHalf, -tail], [tailHalf, -tail], [half, -0.2], [half, len - point], [0, len], [-half, len - point], [-half, -0.2]];
}
/** A disc with a chamfered top edge, standing from z0 to z1. */
function boss(r, z0, z1, chamfer = 0.06, segs = 48) {
  return lathe([[[r, z0], [r, z1 - chamfer]], [[r, z1 - chamfer], [r - chamfer, z1]], [[r - chamfer, z1], [0, z1]]], { segs });
}

function mainHand(M, name, { len, half, tail, tailHalf, point, z, hub, lume }) {
  const g = new THREE.Group();
  g.name = name;
  const blade = bevelPlate(sword(len, half, tail, tailHalf, point), z[0], z[1], half * 0.34, { drop: 0.09, under: true });
  g.add(mesh(blade, M.rhodium, `${name} blade`));
  g.add(mesh(boss(hub, z[0] - 0.03, z[1] + 0.035), M.rhodium, `${name} hub`));
  const strip = bevelPlate([[-lume.half, lume.y0], [lume.half, lume.y0], [lume.half, lume.y1], [-lume.half, lume.y1]], z[1] - 0.02, z[1] + 0.03, 0.02);
  const l = mesh(strip, M.lume, `${name} lume`);
  l.castShadow = false;
  g.add(l);
  g.position.z = D.dialZ;
  return g;
}

function chronoHand(M) {
  const g = new THREE.Group();
  g.name = 'chronograph seconds hand';
  const [z0, z1] = Z.chrono;
  const needle = bevelPlate([[-0.15, 0.3], [0.15, 0.3], [0.055, 15.55], [-0.055, 15.55]], z0, z1, 0.03, { under: true });
  g.add(mesh(needle, M.red, 'chronograph needle'));
  g.add(mesh(boss(0.82, z0 - 0.02, z1 + 0.02, 0.05), M.red, 'chronograph hub'));
  // the counterweight is left in steel
  const tail = bevelPlate([[-0.36, -3.3], [0.36, -3.3], [0.44, -3.0], [0.22, -0.4], [-0.22, -0.4], [-0.44, -3.0]], z0, z1, 0.05, { under: true });
  g.add(mesh(tail, M.rhodium, 'chronograph counterweight'));
  // polished cap over the pivot
  const cap = lathe([[[0.46, z1 + 0.02], [0.46, z1 + 0.2]], [[0.46, z1 + 0.2], [0.4, z1 + 0.3], [0.24, z1 + 0.36], [0, z1 + 0.38]]], { segs: 40 });
  g.add(mesh(cap, M.polished, 'centre cap'));
  g.position.z = D.dialZ;
  return g;
}

function subHand(M, name, at) {
  const g = new THREE.Group();
  g.name = name;
  const [z0, z1] = Z.sub;
  const stick = bevelPlate([[-0.1, -1.05], [0.1, -1.05], [0.13, 0], [0.055, 4.2], [-0.055, 4.2], [-0.13, 0]], z0, z1, 0.025, { under: true });
  g.add(mesh(stick, M.ink, `${name} stick`));
  g.add(mesh(boss(0.48, z0 - 0.04, z1 + 0.05, 0.05, 32), M.ink, `${name} boss`));
  g.add(mesh(boss(0.19, z1 + 0.05, z1 + 0.13, 0.04, 20), M.polished, `${name} pin`));
  g.add(mesh(lathe([[[0.16, 0], [0.16, z0]]], { segs: 16 }), M.dark, `${name} post`));
  g.position.set(at[0], at[1], D.dialZ - D.subDrop);
  return g;
}

export function buildHands({ M, frozen = false, report }) {
  const group = new THREE.Group();
  group.name = 'hands';

  const hour = mainHand(M, 'hour hand', {
    len: 9.0, half: 0.62, tail: 2.1, tailHalf: 0.42, point: 0.85, z: Z.hour, hub: 1.2,
    lume: { half: 0.2, y0: 3.9, y1: 7.75 },
  });
  const minute = mainHand(M, 'minute hand', {
    len: 13.05, half: 0.5, tail: 2.5, tailHalf: 0.36, point: 0.85, z: Z.minute, hub: 1.0,
    lume: { half: 0.16, y0: 6.3, y1: 11.9 },
  });
  const chronoSeconds = chronoHand(M);
  const seconds = subHand(M, 'running seconds hand', [-D.subOff, 0]);
  const minutes = subHand(M, 'minute counter hand', [D.subOff, 0]);
  const hours = subHand(M, 'hour counter hand', [0, -D.subOff]);
  // the cannon the hands ride on
  const post = mesh(lathe([[[0.55, D.dialZ], [0.55, D.dialZ + Z.chrono[0]]]], { segs: 24 }), M.dark, 'hand post');
  group.add(hour, minute, chronoSeconds, seconds, minutes, hours, post);

  // --- chronograph: started and stopped by the top pusher, zeroed by the bottom one when stopped
  const chrono = {
    running: !frozen,
    elapsed: 0,
    back: null,              // fly-back animation after a reset
    toggle() { this.running = !this.running; this.back = null; },
    reset() {
      if (this.running) return false;
      this.back = { from: this.elapsed, t: 0 };
      this.elapsed = 0;
      return true;
    },
  };

  const turn = (hand, degrees) => { hand.rotation.z = -degrees * DEG; };
  const step = (s) => Math.floor(s * BEAT + 1e-6) / BEAT;

  function tick(now, dt) {
    const s = now.getSeconds() + now.getMilliseconds() / 1000;
    const m = now.getMinutes() + s / 60;
    const h = (now.getHours() % 12) + m / 60;
    turn(hour, h * 30);
    turn(minute, m * 6);
    turn(seconds, step(s) * 6);

    if (chrono.running) chrono.elapsed += dt;
    let e = step(chrono.elapsed);
    let cs = (e % 60) * 6, cm = ((e / 60) % 30) * 12, ch = ((e / 3600) % 12) * 30;
    if (chrono.back) {
      // hands snap home the short way round
      chrono.back.t = Math.min(1, chrono.back.t + dt / 0.22);
      const k = 1 - Math.pow(1 - chrono.back.t, 3), f = chrono.back.from;
      const home = (deg) => { const d = deg > 180 ? deg - 360 : deg; return d * (1 - k); };
      cs = home((f % 60) * 6); cm = home(((f / 60) % 30) * 12); ch = home(((f / 3600) % 12) * 30);
      if (chrono.back.t >= 1) chrono.back = null;
    }
    turn(chronoSeconds, cs); turn(minutes, cm); turn(hours, ch);
  }

  report.hands = { beat: BEAT, chronographRunning: chrono.running };
  return { group, tick, chrono, hands: { hour, minute, chronoSeconds, seconds, minutes, hours } };
}
