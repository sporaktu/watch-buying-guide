#!/usr/bin/env node
// Close-up camera: takes pictures of a watch page from the set views, from a view turned by a few degrees (a real
// mouse drag, so it works on any page), or from any camera position (only on a page whose handle has setCamera,
// which today is the lab page). Also prints the renderer and the console messages, and fails on them.
//
//   node tools/watch3d-closeup.mjs <page-url> <out-dir> <shot>...
//   WATCH3D_RENDERER=software SCALE=2 CLIP=canvas node tools/watch3d-closeup.mjs \
//       'http://127.0.0.1:8000/site/?dial=<slug>&full=1&time=10:08:30' shots front front~10,0 clasp~0,-15
//
// A shot is one of:
//   NAME                      a set view (hero, front, side, back, clasp, bracelet). With a handle it is set through
//                             the handle; without one the page is loaded again with view=NAME in its address.
//   NAME~AZ,EL                that view after the camera is swung AZ degrees to the right and EL degrees up.
//                             Two shots 10 degrees apart tell a real gap (the page behind shows) from a dark reflection.
//   cam:x,y,z:tx,ty,tz[:name] camera position and target in millimetres. Needs window[HANDLE].setCamera.
//   asis[:name]               the page as loaded.
// Settings: W, H (window, default 1400 by 900), SCALE (device scale, default 1; 2 doubles the pixels), CLIP
// (x,y,w,h in CSS pixels, or "canvas"), HIDE (CSS selectors of page furniture to hide), WAIT (ms after each move,
// default 250), ROTATE_SPEED (the page's orbit rotate speed, default 0.8), SETTLE (frames to let a drag's damping
// die away on a page without a handle, default 90). Others: see tools/watch3d-browser.mjs.

import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const lib = await import(new URL('watch3d-browser.mjs', import.meta.url).href);
const USAGE = 'usage: node tools/watch3d-closeup.mjs <page-url> <out-dir> <shot>...\n  a shot is NAME, NAME~AZ,EL, cam:x,y,z:tx,ty,tz[:name] or asis[:name]';
const H = JSON.stringify(lib.HANDLE);

function parseShot(text, index) {
  const three = (s) => { const v = String(s).split(',').map(Number); return v.length === 3 && v.every(Number.isFinite) ? v : null; };
  if (text.startsWith('cam:')) {
    const [, pos, target, name] = text.split(':');
    if (!three(pos) || !three(target)) throw new lib.UsageError(`a camera shot is cam:x,y,z:tx,ty,tz[:name], not "${text}"`);
    return { kind: 'cam', pos: three(pos), target: three(target), name: name || `cam${index + 1}` };
  }
  if (text === 'asis' || text.startsWith('asis:')) return { kind: 'asis', name: text.split(':')[1] || 'asis' };
  const [view, turn] = text.split('~');
  if (!/^[a-z][\w-]*$/i.test(view)) throw new lib.UsageError(`"${text}" is not a shot\n${USAGE}`);
  if (turn === undefined) return { kind: 'view', view, name: view };
  const [az, el] = turn.split(',').map(Number);
  if (!Number.isFinite(az) || !Number.isFinite(el)) throw new lib.UsageError(`a turned view is NAME~AZ,EL in degrees, not "${text}"`);
  const sign = (v) => (v < 0 ? `m${-v}` : `p${v}`);
  return { kind: 'view', view, az, el, name: `${view}_az${sign(az)}_el${sign(el)}` };
}

await lib.run(async () => {
  const [url, outDir, ...texts] = process.argv.slice(2);
  if (!url || !outDir || !texts.length) throw new lib.UsageError(USAGE);
  const shots = texts.map(parseShot);
  const out = path.resolve(outDir);
  mkdirSync(out, { recursive: true });
  const width = lib.envNumber('W', 1400), height = lib.envNumber('H', 900), scale = lib.envNumber('SCALE', 1);
  const wait = lib.envNumber('WAIT', 250), speed = lib.envNumber('ROTATE_SPEED', 0.8), settle = lib.envNumber('SETTLE', 90);
  const clipText = process.env.CLIP || '';

  return lib.withPage({ width, height, scale }, async (page) => {
    const reasons = [];
    let state = null, loaded = null;
    const load = async (address) => {
      await page.goto(address);
      state = await page.waitForWatch();
      loaded = address;
      if (state.ready && process.env.HIDE) await page.hide(process.env.HIDE);
      if (state.ready) await page.frames(3, wait);
      return state.ready;
    };
    console.log(`page: ${url}`);
    if (!(await load(url))) return lib.finish(await lib.verdict(page, state));
    const handle = state.how === 'handle';
    console.log(`window ${width} by ${height} at device scale ${scale}; ${handle ? `views and camera set through window.${lib.HANDLE}` : 'no handle on this page: views by address, turns by mouse drag'}`);

    for (const shot of shots) {
      if (shot.kind === 'cam') {
        const ok = handle && await page.evaluate(`(() => { const h = window[${H}]; if (typeof h.setCamera !== 'function') return false; h.setCamera(${JSON.stringify(shot.pos)}, ${JSON.stringify(shot.target)}); return true; })()`);
        if (!ok) throw new lib.UsageError(`"${texts[shots.indexOf(shot)]}" needs a page whose handle has setCamera; this page has none. Use NAME or NAME~AZ,EL here.`);
      } else if (shot.kind === 'view') {
        if (handle) {
          const ok = await page.evaluate(`(() => { const h = window[${H}]; return typeof h.setView === 'function' && h.setView(${JSON.stringify(shot.view)}, true) !== false; })()`);
          if (!ok) throw new lib.UsageError(`this page has no view "${shot.view}"; it has: ${await page.evaluate(`(window[${H}].views || []).join(', ')`)}`);
        } else {
          const address = new URL(url);
          address.searchParams.set('view', shot.view);
          // A turned view always starts from a fresh load, so that one drag never adds to another.
          if ((address.href !== loaded || shot.az !== undefined) && !(await load(address.href))) { reasons.push(`${shot.name}: ${state.why}`); break; }
        }
        if (shot.az !== undefined) {
          const box = (await page.info()).canvas;
          // Orbit controls turn 360 x rotate speed degrees for a drag as long as the canvas is high.
          const perDegree = box.h / (360 * speed), dx = -shot.az * perDegree, dy = shot.el * perDegree;
          const x = box.x + box.w / 2 - dx / 2, y = box.y + box.h / 2 - dy / 2;
          if (Math.min(x, x + dx) < box.x + 2 || Math.max(x, x + dx) > box.x + box.w - 2 || Math.min(y, y + dy) < box.y + 2 || Math.max(y, y + dy) > box.y + box.h - 2) {
            throw new lib.UsageError(`a turn of ${shot.az},${shot.el} degrees needs a drag longer than the ${Math.round(box.w)} by ${Math.round(box.h)} canvas`);
          }
          await page.drag(x, y, dx, dy);
          const settled = handle && await page.evaluate(`(() => { const c = window[${H}].three && window[${H}].three.controls; if (!c) return false; for (let i = 0; i < 300; i++) c.update(); return true; })()`);
          if (!settled) await page.frames(settle, 0, 90000);
        }
      } else if (loaded !== url && !(await load(url))) { reasons.push(`${shot.name}: ${state.why}`); break; }
      await page.frames(3, wait);

      let clip;
      if (clipText === 'canvas') { const b = (await page.info()).canvas; clip = { x: b.x, y: b.y, width: b.w, height: b.h }; }
      else if (clipText) {
        const v = clipText.split(',').map(Number);
        if (v.length !== 4 || v.some((n) => !Number.isFinite(n))) throw new lib.UsageError(`CLIP is x,y,w,h in CSS pixels or "canvas", not "${clipText}"`);
        clip = { x: v[0], y: v[1], width: v[2], height: v[3] };
      }
      const png = await page.screenshot(clip);
      const file = path.join(out, `${shot.name}.png`);
      writeFileSync(file, png);
      const img = lib.readPng(png), whole = lib.boxStats(img);
      console.log(`  ${shot.name}.png  ${img.width} by ${img.height}, mean brightness ${whole.mean.toFixed(1)}`);
      if (whole.mean < 2 || whole.mean > 253) reasons.push(`${shot.name}: the picture is blank (mean brightness ${whole.mean.toFixed(1)})`);
    }
    console.log(`pictures in ${out}`);
    reasons.push(...(await lib.verdict(page, state)));
    return lib.finish(reasons);
  });
});
