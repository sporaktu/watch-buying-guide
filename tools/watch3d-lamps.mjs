#!/usr/bin/env node
// Lamp test: scales every directional lamp in the scene (off, half, normal, double) and prints the mean brightness
// of fixed boxes on the steel and the dial at each strength, so "how much do the lamps do?" is a number.
// It needs the page's scene, so it runs only on a page with a handle (window.__nav.three.scene: the lab page);
// on any other page it says so and exits 2.
//
//   node tools/watch3d-lamps.mjs <page-url> [out-dir]
//   WATCH3D_RENDERER=software node tools/watch3d-lamps.mjs 'http://127.0.0.1:8000/lab/fable-navitimer/?t=10:08:30'
//
// Pictures are written only when an out-dir is given. Settings: FACTORS (default 1,0,0.5,2,1; the first and last
// should be the same, as a check that the page is steady), REGIONS (view:label:x0,y0,x1,y1 separated by ";", in
// picture pixels; the default boxes fit the lab Navitimer in a 1400 by 900 window), HIDE (page furniture to hide,
// default header,nav,#hint,#boot), WAIT (ms after each change, default 600). Others: see tools/watch3d-browser.mjs.
// Compare the figures only between runs on the same renderer and browser.

import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const lib = await import(new URL('watch3d-browser.mjs', import.meta.url).href);
const H = JSON.stringify(lib.HANDLE);

/** Boxes on the lab Navitimer at 1400 by 900: left, top, right, bottom. */
const DEFAULT_REGIONS = 'hero:steel (bracelet top):620,60,900,200;hero:dial centre:560,330,760,520;bracelet:steel (links):490,150,962,570;front:whole frame:0,0,1400,900';

function parseRegions(text) {
  return text.split(';').map((s) => s.trim()).filter(Boolean).map((item) => {
    const parts = item.split(':');
    if (parts.length !== 3) throw new lib.UsageError(`a region is view:label:x0,y0,x1,y1, not "${item}"`);
    return { view: parts[0].trim(), label: parts[1].trim(), box: lib.parseBox(parts[2]) };
  });
}

await lib.run(async () => {
  const [url, outDir] = process.argv.slice(2);
  if (!url) throw new lib.UsageError('usage: node tools/watch3d-lamps.mjs <page-url> [out-dir]');
  const width = lib.envNumber('W', 1400), height = lib.envNumber('H', 900), scale = lib.envNumber('SCALE', 1), wait = lib.envNumber('WAIT', 600);
  const regions = parseRegions(process.env.REGIONS || DEFAULT_REGIONS);
  const factors = (process.env.FACTORS || '1,0,0.5,2,1').split(',').map(Number);
  if (!factors.length || factors.some((k) => !Number.isFinite(k) || k < 0)) throw new lib.UsageError('FACTORS is a list of numbers such as 1,0,0.5,2,1');
  if (!process.env.REGIONS && (width !== 1400 || height !== 900 || scale !== 1)) {
    throw new lib.UsageError('the default boxes fit a 1400 by 900 window at device scale 1; give REGIONS for any other size');
  }
  const views = [...new Set(regions.map((r) => r.view))];
  const out = outDir ? path.resolve(outDir) : null;
  if (out) mkdirSync(out, { recursive: true });

  return lib.withPage({ width, height, scale }, async (page) => {
    console.log(`page: ${url}`);
    await page.goto(url);
    const state = await page.waitForWatch();
    if (!state.ready) return lib.finish(await lib.verdict(page, state));
    const lamps = state.how === 'handle' ? await page.evaluate(`(() => {
      const h = window[${H}], scene = h.three && h.three.scene;
      if (!scene || typeof h.setView !== 'function') return null;
      const found = { lamps: [], others: 0 };
      scene.traverse((o) => {
        if (o.isDirectionalLight) { if (o.userData.lampBase === undefined) o.userData.lampBase = o.intensity; found.lamps.push(o.userData.lampBase); }
        else if (o.isLight) found.others++;
      });
      return found;
    })()`) : null;
    if (!lamps) {
      console.error(`The lamp test cannot run on this page: it needs window.${lib.HANDLE}.three.scene and window.${lib.HANDLE}.setView, and this page has no such handle.\nOnly the lab page has one today. On other pages, change the lamp figures in the code and compare shots with tools/watch3d-measure.mjs.`);
      return 2;
    }
    if (!lamps.lamps.length) { console.error('The scene has no directional lamps to scale.'); return 2; }
    await page.hide(process.env.HIDE || 'header,nav,#hint,#boot');
    console.log(`lamps: ${lamps.lamps.length} directional, strengths ${lamps.lamps.join(', ')}${lamps.others ? `; ${lamps.others} other light${lamps.others > 1 ? 's' : ''} left alone` : ''}`);
    console.log(`window ${width} by ${height} at device scale ${scale}; views ${views.join(', ')}`);

    const reasons = [];
    const runs = []; // one per factor: Map of "view|label" to stats
    for (const [n, k] of factors.entries()) {
      await page.evaluate(`window[${H}].three.scene.traverse((o) => { if (o.isDirectionalLight) o.intensity = o.userData.lampBase * ${k}; })`);
      const got = new Map();
      for (const view of views) {
        const ok = await page.evaluate(`window[${H}].setView(${JSON.stringify(view)}, true) !== false`);
        if (!ok) throw new lib.UsageError(`this page has no view "${view}"; it has: ${await page.evaluate(`(window[${H}].views || []).join(', ')`)}`);
        await page.frames(3, wait);
        const png = await page.screenshot();
        if (out) writeFileSync(path.join(out, `${view}-x${k}${factors.indexOf(k) !== n ? '-again' : ''}.png`), png);
        const img = lib.readPng(png);
        for (const r of regions.filter((q) => q.view === view)) got.set(`${r.view}|${r.label}`, lib.boxStats(img, r.box));
      }
      runs.push(got);
    }
    await page.evaluate(`window[${H}].three.scene.traverse((o) => { if (o.isDirectionalLight) o.intensity = o.userData.lampBase; })`);

    const first = factors.indexOf(1), repeat = factors.lastIndexOf(1);
    const head = factors.map((k, n) => `x${k}${factors.indexOf(k) !== n ? ' again' : ''}`);
    const cell = (s) => String(s).padStart(10);
    console.log(`\n${'mean brightness, 0 to 255'.padEnd(34)}${head.map(cell).join('')}`);
    for (const r of regions) {
      const key = `${r.view}|${r.label}`, base = first >= 0 ? runs[first].get(key).mean : null;
      console.log(`${`${r.view}: ${r.label}`.padEnd(34)}${runs.map((g) => cell(g.get(key).mean.toFixed(1))).join('')}`);
      if (base) console.log(`${'  change against x1'.padEnd(34)}${runs.map((g) => cell(`${(((g.get(key).mean - base) / base) * 100).toFixed(1)}%`)).join('')}`);
      console.log(`${'  pixels at 250 or above'.padEnd(34)}${runs.map((g) => cell(`${g.get(key).white.toFixed(2)}%`)).join('')}`);
      console.log(`${'  pixels below 8'.padEnd(34)}${runs.map((g) => cell(`${g.get(key).black.toFixed(2)}%`)).join('')}`);
      if (first >= 0 && repeat > first) {
        const drift = Math.abs(runs[repeat].get(key).mean - base);
        if (drift > 0.5) reasons.push(`${r.view}: ${r.label}: two runs at normal strength differ by ${drift.toFixed(2)}, so the page is not steady and the figures cannot be compared`);
      }
    }
    console.log(`boxes: ${regions.map((r) => `${r.view} ${r.label} ${r.box.join(',')}`).join('; ')}`);
    if (out) console.log(`pictures in ${out}`);
    console.log('');
    reasons.push(...(await lib.verdict(page, state)));
    return lib.finish(reasons);
  });
});
