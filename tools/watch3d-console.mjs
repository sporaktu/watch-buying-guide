#!/usr/bin/env node
// Console capture: loads a watch page in headless Chromium and prints the WebGL renderer in use, whether the context
// was lost, and every console error and warning, uncaught error and failed request. Exits 0 only when the watch
// showed and nothing was reported; run it before judging any picture.
//
//   node tools/watch3d-console.mjs <page-url> [seconds-to-listen]
//   WATCH3D_RENDERER=software node tools/watch3d-console.mjs 'http://127.0.0.1:8000/site/?dial=<slug>&full=1&time=10:08:30'
//
// Listens for 3 seconds after the watch shows unless told otherwise. REPORT=1 also prints the page handle's own
// report (the lab page's window.__nav.report), when there is one. A failed bracelet check on the site page is a
// console warning, so it fails this tool. Other settings: see tools/watch3d-browser.mjs.

const lib = await import(new URL('watch3d-browser.mjs', import.meta.url).href);

await lib.run(async () => {
  const [url, seconds = '3'] = process.argv.slice(2);
  if (!url || !Number.isFinite(Number(seconds))) throw new lib.UsageError('usage: node tools/watch3d-console.mjs <page-url> [seconds-to-listen]');
  return lib.withPage({ width: lib.envNumber('W', 1400), height: lib.envNumber('H', 900), scale: lib.envNumber('SCALE', 1) }, async (page) => {
    console.log(`page: ${url}`);
    await page.goto(url);
    const state = await page.waitForWatch();
    if (state.ready) await page.frames(3, Number(seconds) * 1000);
    const reasons = await lib.verdict(page, state);
    if (process.env.REPORT === '1') {
      const report = await page.evaluate(`(() => { const h = window[${JSON.stringify(lib.HANDLE)}]; return h && h.report ? JSON.stringify(h.report, null, 1) : null; })()`).catch(() => null);
      console.log(report ? `report from window.${lib.HANDLE}.report:\n${report}` : `report: this page has no window.${lib.HANDLE}.report`);
    }
    return lib.finish(reasons);
  });
});
