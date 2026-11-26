#!/usr/bin/env node
// One shot of the 3D watch, for tools/watch3d-shots.sh, which is the way to use it. Plain node (18 or later: it uses
// the built-in fetch and WebSocket), no packages.
//
//   node tools/watch3d-shot.mjs [--no-report] [--allow-warnings] <png> <json> <site-url> <seconds> <page-url> <chrome> [chrome flags...]
//
// Starts headless Chromium on a fresh profile with the given flags (a --window-size and --force-device-scale-factor
// among them are also given to the page as its exact size and pixel ratio), drives it over the DevTools protocol, loads
// <page-url> and waits until the 3D watch is on screen: the stage (#dialStage) has the class full and not loading,
// the watch's canvas is there, not hidden and not empty. It stops waiting at once, and fails, when the page has given
// up: the stage has neither class once it began to load, or the caption (#dialName) reads "The 3D watch could not be
// shown"; the problem is then the page's last console line. It reads the watch's report from the stage's
// data-watch3d-report attribute, which the page writes in the same step as it shows the watch. A page with no report
// fails the run, unless --no-report is given (for shooting a commit from before the attribute existed; the report is
// then null). It then lets three frames and 250 ms go by and takes the picture of the window. Then it lets the watch
// run for 2 seconds more and checks again that it is still on screen, so a watch that throws once it is running
// fails.
// Meanwhile it records what a console would show: console errors and warnings (the page's own and the browser's, such
// as a failed load), uncaught page errors, and failed requests (no response, or a status of 400 or more). It also reads
// the WebGL renderer string from the watch's own context (no second context is made), the time zone, the window's
// size and pixel ratio. A page address with cam= must leave the view chooser on Turned by hand (the camera was placed),
// or the run fails.
//
// Writes <png> only when the watch was on screen, and <json> always:
//   { url, ok, problem, renderer, timeZone, clock, viewport, report, console: [{ level, text }], pageErrors: [],
//     failedRequests: [{ url, error }] }
// and prints the same in a few lines.
//
// Exit status: 0 clean; 1 the watch was not on screen, no picture was taken, Chromium could not be started, closed,
// or did not answer in time; 2 usage; 3 a console error (or a console line of the page's own saying the 3D watch could
// not be shown or stopped), a page error, a failed request under <site-url>, no report (without --no-report), or the
// watch left the screen in the 2 seconds after the picture; 4 none of those, but the watch's report has warnings or
// the console has warnings, unless --allow-warnings is given (they are printed either way). Failed requests outside
// <site-url> are recorded and printed, not counted. The whole run is stopped after <seconds> of wall-clock time.
// The console and the rest are printed on a failure too.
// Chromium is started inside its profile with TMPDIR=., as tools/watch3d-browser.mjs does: it stops with "Socket
// path too long" when the temporary folder's path is long.
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const USAGE = 'usage: watch3d-shot.mjs [--no-report] [--allow-warnings] <png> <json> <site-url> <seconds> <page-url> <chrome> [chrome flags...]';
const argv = process.argv.slice(2);
let needReport = true, allowWarnings = false;
while (argv.length && argv[0].startsWith('--')) {
  const o = argv.shift();
  if (o === '--no-report') needReport = false;
  else if (o === '--allow-warnings') allowWarnings = true;
  else { console.error(USAGE); process.exit(2); }
}
const [png, jsonOut, site, secs, url, chrome, ...flags] = argv;
// A headless window is a little taller than the page inside it, so the page is given exactly the window's size (and
// the pixel scale, if one was asked for), as Chromium's own --screenshot does.
const size = flags.map(f => /^--window-size=(\d+),(\d+)$/.exec(f)).find(Boolean);
const scale = flags.map(f => /^--force-device-scale-factor=(.*)$/.exec(f)).find(Boolean);
if (!chrome || !(+secs > 0) || (scale && !(+scale[1] > 0))) {
  console.error(USAGE);
  if (scale && !(+scale[1] > 0)) console.error(`the scale must be a number above 0, not ${scale[1]}`);
  process.exit(2);
}

const out = { url, ok: false, problem: null, renderer: null, timeZone: null, clock: null, viewport: null, report: null,
  console: [], pageErrors: [], failedRequests: [] };
const profile = mkdtempSync(join(tmpdir(), 'watch3d-shot-'));
// Started inside its profile with TMPDIR=., so the socket Chromium makes in its temporary folder has a short path
// whatever TMPDIR is (it stops with "Socket path too long" otherwise), and all it writes is in the profile.
const browser = spawn(chrome, ['--headless=new', '--no-sandbox', '--hide-scrollbars', '--no-first-run',
  '--no-default-browser-check', `--user-data-dir=${profile}`, '--remote-debugging-port=0', ...flags, 'about:blank'],
{ stdio: 'ignore', cwd: profile, env: { ...process.env, TMPDIR: '.' } });
let ws = null, ended = false;
browser.on('error', (e) => { clearTimeout(deadline); fail(`cannot start ${chrome}: ${e.message}`); });
browser.on('exit', (code, sig) => { if (!ended) { clearTimeout(deadline); fail(`Chromium closed before the picture was taken (${sig || 'exit ' + code})`); } });
const firstLine = t => String(t).split('\n')[0];
function summary() {
  const r = out.report || {};
  const warnings = out.report && Array.isArray(out.report.warnings) ? out.report.warnings : [];
  if (out.renderer || out.viewport) console.log(`  renderer: ${out.renderer}; zone ${out.timeZone}; window ${(out.viewport || []).join(' x ')}`);
  if (out.ok) {
    if (!out.report) console.log(`  report: none (the page wrote no data-watch3d-report)${needReport ? '' : '; allowed by --no-report'}`);
    else console.log(`  report: ${r.watch}, ${r.triangles} triangles, ${r.drawCalls} draw calls, ${r.geometries} geometries, ${r.textures} textures, ${warnings.length} warnings`);
  }
  for (const w of warnings) console.log(`  report warning: ${w}`);
  for (const c of out.console) console.log(`  console ${c.level}: ${c.text}`);
  for (const e of out.pageErrors) console.log(`  page error: ${e}`);
  for (const f of out.failedRequests) console.log(`  failed request${f.url.startsWith(site) ? '' : ' (outside the site)'}: ${f.url} ${f.error}`);
  if (out.afterwards) console.log(`  after the picture: ${out.afterwards}`);
  if (out.problem) console.log(`  problem: ${out.problem}`);
}
function finish(code) {
  if (ended) return;
  ended = true;
  try { if (ws) ws.close(); } catch (e) { /* closing anyway */ }
  try { browser.kill('SIGKILL'); } catch (e) { /* gone already */ }
  try { writeFileSync(jsonOut, JSON.stringify(out, null, 2) + '\n'); } catch (e) { console.error(`cannot write ${jsonOut}: ${e.message}`); }
  // Chromium may still be writing to its profile for a moment after the kill.
  setTimeout(() => { try { rmSync(profile, { recursive: true, force: true }); } catch (e) { /* tmp */ } process.exit(code); }, 300);
}
const fail = (problem) => {
  if (ended) return;
  out.problem = problem; out.ok = false;
  try { rmSync(png, { force: true }); } catch (e) { /* none */ }
  summary();
  finish(1);
};
const deadline = setTimeout(() => fail(`Chromium did not finish within ${secs} seconds and was stopped`), secs * 1000);
for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => { clearTimeout(deadline); fail(`stopped by ${sig}`); });
const sleep = ms => new Promise(r => setTimeout(r, ms));

try {
  // With port 0 Chromium picks a free port and writes it to DevToolsActivePort in the profile.
  let port = null;
  for (let i = 0; i < 300 && !port; i++) {
    try { port = +readFileSync(join(profile, 'DevToolsActivePort'), 'utf8').split('\n')[0] || null; } catch (e) { /* not yet */ }
    if (!port) await sleep(100);
  }
  if (!port) throw new Error('Chromium did not open its DevTools port');
  let target = null;
  for (let i = 0; i < 100 && !target; i++) {
    try { target = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t => t.type === 'page'); } catch (e) { /* not yet */ }
    if (!target) await sleep(100);
  }
  if (!target) throw new Error('Chromium has no page to drive');
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', () => rej(new Error('DevTools connection failed'))); });

  let id = 0;
  const waiting = new Map(), requests = new Map();
  const send = (method, params = {}) => new Promise((res, rej) => {
    if (ws.readyState !== WebSocket.OPEN) { rej(new Error('the DevTools connection is closed (Chromium may have crashed)')); return; }
    const i = ++id; waiting.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params }));
  });
  // A closed connection (Chromium crashed or was killed) fails whatever is waiting at once, not at the deadline.
  ws.addEventListener('close', () => {
    for (const w of waiting.values()) w.rej(new Error('the DevTools connection closed (Chromium may have crashed)'));
    waiting.clear();
  });
  const arg = a => a.value !== undefined ? (typeof a.value === 'string' ? a.value : JSON.stringify(a.value)) : (a.description || a.type);
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && waiting.has(m.id)) {
      const w = waiting.get(m.id); waiting.delete(m.id);
      if (m.error) w.rej(new Error(m.error.message)); else w.res(m.result);
      return;
    }
    const p = m.params;
    if (m.method === 'Runtime.consoleAPICalled' && (p.type === 'error' || p.type === 'warning' || p.type === 'assert')) {
      out.console.push({ level: p.type === 'warning' ? 'warning' : 'error', text: p.args.map(arg).join(' ') });
    } else if (m.method === 'Log.entryAdded' && (p.entry.level === 'error' || p.entry.level === 'warning')) {
      out.console.push({ level: p.entry.level, text: p.entry.text + (p.entry.url ? ` (${p.entry.url})` : '') });
    } else if (m.method === 'Runtime.exceptionThrown') {
      const d = p.exceptionDetails;
      out.pageErrors.push((d.exception && d.exception.description) || d.text);
    } else if (m.method === 'Network.requestWillBeSent') {
      requests.set(p.requestId, p.request.url);
    } else if (m.method === 'Network.responseReceived' && p.response.status >= 400) {
      out.failedRequests.push({ url: p.response.url, error: `status ${p.response.status}` });
    } else if (m.method === 'Network.loadingFailed') {
      out.failedRequests.push({ url: requests.get(p.requestId) || '(unknown)', error: p.errorText + (p.canceled ? ' (canceled)' : '') });
    }
  });
  await send('Runtime.enable'); await send('Log.enable'); await send('Network.enable'); await send('Page.enable');
  const page = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception ? r.exceptionDetails.exception.description : r.exceptionDetails.text);
    return r.result.value;
  };

  if (size) {
    await send('Emulation.setDeviceMetricsOverride', { width: +size[1], height: +size[2], deviceScaleFactor: scale ? +scale[1] : 1, mobile: false });
  }
  await send('Page.navigate', { url });
  // The watch is on screen (''), or why not; 'gave up: ...' when the page has given up (the stage left the mode after
  // starting to load, or the caption says the watch could not be shown).
  const state = `(() => {
    const s = document.getElementById('dialStage');
    if (!s) return 'no #dialStage in the page';
    const c = s.querySelector('canvas.watch3d'), name = document.getElementById('dialName');
    const full = s.classList.contains('full'), loading = s.classList.contains('loading');
    if (full || loading) window.__watch3dBegan = true;
    if (name && /^The 3D watch could not be shown/.test(name.textContent)) return 'gave up: the caption reads ' + JSON.stringify(name.textContent);
    if (!full && !loading && window.__watch3dBegan) return 'gave up: the stage left the 3D watch (class: ' + JSON.stringify(s.className) + ')';
    if (!full || loading) return 'the stage is not showing the 3D watch (class: ' + s.className + ')';
    if (!c) return 'no 3D watch canvas in the page';
    if (c.hidden || !c.width || !c.height) return 'the 3D watch canvas is hidden or empty';
    return '';
  })()`;
  let why = 'the page did not load';
  for (;;) {
    try { why = await page(state); } catch (e) { why = e.message; if (/connection/.test(why)) throw e; }
    if (why === '') break;
    if (why.startsWith('gave up: ')) {
      const said = out.console.length ? firstLine(out.console[out.console.length - 1].text) : '';
      throw new Error(said ? `the page gave up: ${said}` : `the page ${why}`);
    }
    await sleep(250);   // the deadline stops this if the watch never shows
  }
  await page('new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 250)))))');
  const facts = await page(`(() => {
    const s = document.getElementById('dialStage'), c = s.querySelector('canvas.watch3d');
    const gl = c.getContext('webgl2') || c.getContext('webgl');   // the context the stage made: no second one is created
    let renderer = null;
    if (gl) { const e = gl.getExtension('WEBGL_debug_renderer_info'); renderer = gl.getParameter(e ? e.UNMASKED_RENDERER_WEBGL : gl.RENDERER); }
    const chooser = document.getElementById('dialView');
    return { renderer, report: s.dataset.watch3dReport, label: c.getAttribute('aria-label'), view: chooser ? chooser.value : null,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone, clock: new Date().toString(),
      viewport: [innerWidth, innerHeight, devicePixelRatio] };
  })()`);
  // A camera asked for by cam= that the page ignored (malformed, or out of range) would leave a named view on screen.
  if (new URL(url).searchParams.has('cam') && facts.view !== '') throw new Error(`the page ignored cam= (the view chooser reads ${JSON.stringify(facts.view)})`);
  Object.assign(out, { view: facts.view, renderer: facts.renderer, timeZone: facts.timeZone, clock: facts.clock, viewport: facts.viewport, label: facts.label });
  try { out.report = facts.report ? JSON.parse(facts.report) : null; } catch (e) { out.report = facts.report; }
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(png, Buffer.from(shot.data, 'base64'));
  // The watch runs on: one whose tick throws a moment later is freed by the stage, and the page leaves the mode.
  await sleep(2000);
  let after = '';
  try { after = await page(state); } catch (e) { after = e.message; if (/connection/.test(after)) throw e; }
  if (after) out.afterwards = after.replace(/^gave up: /, 'the page gave up: ');
  await sleep(200);   // let messages from the last frames arrive
  out.ok = true;
} catch (e) {
  clearTimeout(deadline);
  fail(e.message);
}

if (out.ok && !ended) {
  clearTimeout(deadline);
  const under = out.failedRequests.filter(r => r.url.startsWith(site));
  // The page's own word that the watch failed is a warning in the console; it counts as an error.
  const gaveUp = c => /^The 3D watch (could not be shown|stopped)/.test(c.text);
  const errors = out.console.filter(c => c.level === 'error' || gaveUp(c));
  const warnings = out.report && Array.isArray(out.report.warnings) ? out.report.warnings : [];
  const consoleWarnings = out.console.filter(c => c.level === 'warning' && !gaveUp(c));
  if (!out.report && needReport) out.problem = 'the page wrote no report (data-watch3d-report); --no-report allows that for a commit from before it existed';
  summary();
  const bad = errors.length || out.pageErrors.length || under.length || out.afterwards || (!out.report && needReport);
  finish(bad ? 3 : (warnings.length || consoleWarnings.length) && !allowWarnings ? 4 : 0);
}
