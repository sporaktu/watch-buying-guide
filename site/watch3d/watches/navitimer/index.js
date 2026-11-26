// The Navitimer: what the stage needs to know about it, and the build that assembles it and drives its hands.
import * as THREE from '../../vendor/three.module.js';
import { buildCase } from './case.js';
import { buildBracelet } from './bracelet.js';
import { buildDial } from './dial.js';
import { buildHands } from './hands.js';
import { buildBack } from './back.js';

export const about = {
  id: 'navitimer',
  label: '3D model of a blue and cream chronograph on a steel bracelet. Drag to turn.',
  hint: 'Drag to turn. Press the pushers to run the stopwatch.',
};

/** frozen: the time is pinned for a screenshot, so the chronograph stays at zero. */
export async function build({ M, renderer, frozen = false }) {
  const group = new THREE.Group();
  group.name = 'watch';
  const report = { warnings: [] };   // the parts add their own entries, and a line to warnings for a check that fails
  const parts = {};

  const head = buildCase(M);
  group.add(head.group);
  parts.case = head;

  const part = async (make, key) => {
    const built = await make({ M, renderer, frozen, head, report });
    if (built && built.group) group.add(built.group);
    parts[key] = built;
    return built;
  };

  await part(buildBracelet, 'bracelet');
  const dial = await part(buildDial, 'dial');
  const hands = await part(buildHands, 'hands');
  const back = await part(buildBack, 'back');

  const chrono = hands ? hands.chrono : null;
  const { start, reset } = head.pushers;
  const tick = (date, dt, camera) => {
    if (hands) hands.tick(date, dt);
    if (dial && dial.tick) dial.tick(date, dt);
    if (back && back.tick) back.tick(date, dt, camera);
    // A pressed pusher travels in, and springs back out when let go.
    for (const p of [start, reset]) {
      const target = p.userData.pressed ? 1 : 0;
      p.userData.press += (target - p.userData.press) * Math.min(1, dt * 22);
      p.userData.moving.position.z = -0.55 * p.userData.press;
    }
  };

  // The pushers work: the upper one starts and stops the chronograph, the lower one resets it.
  const press = [];
  if (chrono) {
    const pusher = (object, act) => ({
      object,
      down() { object.userData.pressed = true; act(); },
      up() { object.userData.pressed = false; },
    });
    press.push(pusher(start, () => chrono.toggle()), pusher(reset, () => chrono.reset()));
  }

  // The stopwatch counts frame by frame, so give it the time it missed while the frame loop was stopped.
  const idle = (seconds) => { if (chrono && chrono.running) chrono.elapsed += seconds; };

  return { group, tick, press, idle, report };
}
