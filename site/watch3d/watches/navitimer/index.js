// Assembles the watch and drives its hands.
import * as THREE from '../../vendor/three.module.js';
import { buildCase } from './case.js';
import { buildBracelet } from './bracelet.js';
import { buildDial } from './dial.js';
import { buildHands } from './hands.js';
import { buildBack } from './back.js';

/** frozen: the time is pinned for a screenshot, so the chronograph stays at zero. */
export async function buildWatch({ M, renderer, frozen = false }) {
  const group = new THREE.Group();
  group.name = 'watch';
  const report = {};
  const parts = {};

  const head = buildCase(M);
  group.add(head.group);
  parts.case = head;

  const part = async (build, key) => {
    const built = await build({ M, renderer, frozen, head, report });
    if (built && built.group) group.add(built.group);
    parts[key] = built;
    return built;
  };

  await part(buildBracelet, 'bracelet');
  const dial = await part(buildDial, 'dial');
  const hands = await part(buildHands, 'hands');
  const back = await part(buildBack, 'back');

  const chrono = hands ? hands.chrono : null;
  const tick = (date, dt, camera) => {
    if (hands) hands.tick(date, dt);
    if (dial && dial.tick) dial.tick(date, dt);
    if (back && back.tick) back.tick(date, dt, camera);
    for (const p of Object.values(head.pushers)) {
      const target = p.userData.pressed ? 1 : 0;
      p.userData.press += (target - p.userData.press) * Math.min(1, dt * 22);
      p.userData.moving.position.z = -0.55 * p.userData.press;
    }
  };
  return { group, tick, parts, chrono, report };
}

