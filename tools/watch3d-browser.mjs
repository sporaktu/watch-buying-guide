// Shared by the watch3d-*.mjs checking tools; not run by itself. It starts headless Chromium, drives it over the
// DevTools protocol with node's own WebSocket (so there is nothing to install), waits for the 3D watch, collects
// what the console says, and reads PNG pictures. Needs node 22 or later and chromium or chrome on PATH.
//
// Settings every browser tool takes from the environment:
//   WATCH3D_RENDERER  gpu (default) or software, with the same meaning as tools/watch3d-shots.sh.
//                     software asks for SwiftShader by name; use it whenever the graphics card cannot be used.
//   WATCH3D_FLAGS     Chromium flags to use instead of the ones WATCH3D_RENDERER picks.
//   CHROME            path of the browser, when it is not on PATH.
//   HANDLE            name of the page's own debug handle on window (default __nav, which only the lab page has).
//   TIMEOUT           seconds to wait for the watch (default 60).
//   W, H, SCALE       window size in CSS pixels and the device scale (defaults differ per tool).
//
// A page counts as showing the watch in one of two ways:
//   with a handle     window[HANDLE].ready is true and window[HANDLE].errors is empty (the lab page);
//   without one       #dialStage has the class full and not loading, and holds a canvas.watch3d that is not hidden
//                     (the site page; this is the test tools/watch3d-shots.sh makes).

import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
export const HANDLE = process.env.HANDLE || '__nav';

/** Messages Chromium raises by itself that say nothing about the page. They are counted, not failed on. */
const NOISE = [
  /GPU stall due to ReadPixels/, // taking a screenshot of a WebGL canvas
  /^404 \S+\/favicon\.ico$/, // the browser's own request when a page names no icon
];

/** A usage mistake: printed without a stack, exit code 2. */
export class UsageError extends Error {}

/** Runs a tool's main function and exits with what it returns (0 pass, 1 a check failed, 2 wrong usage). */
export async function run(main) {
  let code = 1;
  try {
    code = (await main()) ?? 0;
  } catch (e) {
    if (e instanceof UsageError) { console.error(e.message); code = 2; }
    else console.error('FAILED: ' + (e && e.message ? e.message : e));
  }
  process.exit(code);
}

/** A number from the environment, or the default. */
export function envNumber(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) throw new UsageError(`${name} must be a number, not "${raw}"`);
  return n;
}

function findChrome() {
  if (process.env.CHROME) return process.env.CHROME;
  const dirs = (process.env.PATH || '').split(path.delimiter).filter(Boolean);
  for (const name of ['chromium', 'chromium-browser', 'google-chrome', 'google-chrome-stable', 'chrome']) {
    for (const dir of dirs) {
      const file = path.join(dir, name);
      if (existsSync(file)) return file;
    }
  }
  throw new UsageError('no chromium or chrome on PATH; set CHROME=/path/to/the/browser');
}

/** The renderer asked for, as Chromium flags and as words. */
export function renderMode() {
  const mode = process.env.WATCH3D_RENDERER || 'gpu';
  const custom = (process.env.WATCH3D_FLAGS || '').split(/\s+/).filter(Boolean);
  if (custom.length) return { mode: 'custom', flags: custom, words: `flags given (${custom.join(' ')})` };
  if (mode === 'gpu') return { mode, flags: ['--enable-gpu'], words: 'graphics card (--enable-gpu)' };
  if (mode === 'software') {
    return { mode, flags: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'], words: 'software (SwiftShader)' };
  }
  throw new UsageError(`WATCH3D_RENDERER must be gpu or software, not "${mode}"`);
}

function devtoolsAddress(child) {
  return new Promise((resolve, reject) => {
    let text = '';
    const timer = setTimeout(() => reject(new Error('the browser did not open its DevTools port in 30 seconds\n' + text)), 30000);
    child.stderr.on('data', (chunk) => {
      text += chunk;
      const found = text.match(/DevTools listening on (ws:\/\/\S+)/);
      if (found) { clearTimeout(timer); resolve(found[1]); }
    });
    child.on('exit', (code) => { clearTimeout(timer); reject(new Error(`the browser exited with ${code} before it could be used\n` + text)); });
    child.on('error', (e) => { clearTimeout(timer); reject(new Error('the browser could not be started: ' + e.message)); });
  });
}

function textOf(arg) {
  if (arg.value !== undefined) return typeof arg.value === 'string' ? arg.value : JSON.stringify(arg.value);
  return arg.description || arg.unserializableValue || arg.type;
}

/** The test for "the watch is showing", run in the page. */
const READY = `(() => {
  const h = window[${JSON.stringify(HANDLE)}];
  if (h && typeof h === 'object' && 'ready' in h) {
    const errors = (h.errors || []).map(String);
    return { how: 'handle', ready: !!h.ready && !errors.length, gaveUp: errors.length > 0, why: errors.length ? 'the page reported: ' + errors.join('; ') : 'window.${HANDLE}.ready is not true yet' };
  }
  const stage = document.getElementById('dialStage');
  if (!stage) return { how: 'none', ready: false, why: 'the page has neither window.${HANDLE} nor #dialStage' };
  const canvas = document.querySelector('canvas.watch3d');
  const shown = stage.classList.contains('full') && !stage.classList.contains('loading');
  const why = !shown ? 'the stage is not showing the 3D watch (class: ' + stage.className + ')'
    : !canvas ? 'no 3D watch canvas in the page' : canvas.hidden ? 'the 3D watch canvas is hidden' : '';
  return { how: 'stage', ready: !why, why, says: (stage.innerText || '').trim().split('\\n').filter(Boolean).slice(0, 3).join(' / ') };
})()`;

/**
 * What the watch is drawn with, read in the page once the watch is showing. Without a handle the context comes from
 * the canvas itself: asking a canvas for the kind of context it already has returns that same context, so this must
 * only run after the watch is showing, when three.js has made it.
 */
const INFO = `(() => {
  const h = window[${JSON.stringify(HANDLE)}];
  const three = h && h.three;
  // Never the "largest canvas": asking a canvas that has no context yet would make one, and report on the wrong thing.
  const canvas = (three && three.renderer && three.renderer.domElement) || document.querySelector('canvas.watch3d')
    || (h ? document.querySelector('canvas') : null);
  if (!canvas) return { renderer: 'no 3D watch canvas in the page', lost: null, env: null, canvas: null };
  const gl = (three && three.renderer && three.renderer.getContext()) || canvas.getContext('webgl2') || canvas.getContext('webgl');
  const box = canvas.getBoundingClientRect();
  const out = { canvas: { x: box.x, y: box.y, w: box.width, h: box.height, pixels: [canvas.width, canvas.height] }, env: three && three.scene ? !!three.scene.environment : null };
  if (!gl) return { ...out, renderer: 'the canvas has no WebGL context', lost: null };
  if (gl.isContextLost()) return { ...out, renderer: 'cannot be read, the context is lost', lost: true };
  const names = gl.getExtension('WEBGL_debug_renderer_info');
  return { ...out, renderer: String(names ? gl.getParameter(names.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)), lost: false };
})()`;

/** What a canvas of its own gets from this browser; safe at any time, used when the watch never showed. */
const FRESH = `(() => {
  const gl = document.createElement('canvas').getContext('webgl2');
  if (!gl) return 'no WebGL 2 at all';
  const names = gl.getExtension('WEBGL_debug_renderer_info');
  return String(names ? gl.getParameter(names.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
})()`;

/**
 * Starts the browser, opens one page of the given size and hands it to `body`. The browser is closed and its
 * profile removed whatever happens. Returns what `body` returns.
 */
export async function withPage({ width = 1400, height = 900, scale = 1 }, body) {
  const render = renderMode();
  const profile = mkdtempSync(path.join(os.tmpdir(), 'watch3d-check-'));
  // Chromium puts a socket in its temporary folder and stops with "Socket path too long" when that folder's path is
  // longer than about 60 characters. Starting it inside the profile with TMPDIR=. keeps the socket path short
  // whatever TMPDIR is, and keeps everything it writes inside the one folder removed at the end.
  const child = spawn(findChrome(), [
    '--headless=new', '--no-sandbox', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check',
    '--remote-debugging-port=0', `--user-data-dir=${profile}`, `--window-size=${width},${height}`, ...render.flags, 'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'], cwd: profile, env: { ...process.env, TMPDIR: '.' } });
  const kill = () => { try { child.kill('SIGKILL'); } catch { /* already gone */ } };
  const gone = new Promise((resolve) => child.on('exit', resolve));
  process.on('exit', kill);
  let socket;
  try {
    socket = new WebSocket(await devtoolsAddress(child));
    await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = () => reject(new Error('could not connect to the browser')); });

    let nextId = 0;
    const waiting = new Map();
    const listeners = new Set();
    const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
      const id = ++nextId;
      waiting.set(id, { resolve, reject, method });
      socket.send(JSON.stringify({ id, method, params, sessionId }));
    });
    socket.onmessage = (event) => {
      const m = JSON.parse(event.data);
      if (m.id && waiting.has(m.id)) {
        const w = waiting.get(m.id);
        waiting.delete(m.id);
        if (m.error) w.reject(new Error(`${w.method}: ${m.error.message}`)); else w.resolve(m.result);
      } else for (const fn of listeners) fn(m);
    };
    socket.onclose = () => { for (const w of waiting.values()) w.reject(new Error('the browser closed while ' + w.method + ' was running')); waiting.clear(); };

    const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
    const call = (method, params) => send(method, params, sessionId);

    const messages = []; // { kind: 'error' | 'warning' | 'uncaught' | 'request', text }
    const requests = new Map();
    listeners.add((m) => {
      const p = m.params || {};
      if (m.method === 'Runtime.consoleAPICalled' && (p.type === 'error' || p.type === 'warning' || p.type === 'assert')) {
        messages.push({ kind: p.type === 'warning' ? 'warning' : 'error', text: p.args.map(textOf).join(' ') });
      } else if (m.method === 'Runtime.exceptionThrown') {
        const d = p.exceptionDetails;
        messages.push({ kind: 'uncaught', text: (d.exception && d.exception.description) || d.text });
      } else if (m.method === 'Log.entryAdded' && (p.entry.level === 'error' || p.entry.level === 'warning') && p.entry.source !== 'network') {
        // What the browser itself says: a lost WebGL context, a blocked feature, a bad import map.
        messages.push({ kind: p.entry.level, text: `${p.entry.text}${p.entry.url ? ' (' + p.entry.url + ')' : ''}` });
      } else if (m.method === 'Network.requestWillBeSent') {
        requests.set(p.requestId, p.request.url);
      } else if (m.method === 'Network.responseReceived' && p.response.status >= 400) {
        messages.push({ kind: 'request', text: `${p.response.status} ${p.response.url}` });
      } else if (m.method === 'Network.loadingFailed' && !p.canceled) {
        messages.push({ kind: 'request', text: `${p.errorText} ${requests.get(p.requestId) || ''}`.trim() });
      }
    });

    await call('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: scale, mobile: false });
    for (const domain of ['Runtime', 'Log', 'Page', 'Network']) await call(`${domain}.enable`, {});

    const evaluate = async (expression) => {
      const r = await call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) throw new Error('in the page: ' + ((r.exceptionDetails.exception && r.exceptionDetails.exception.description) || r.exceptionDetails.text));
      return r.result.value;
    };

    const page = {
      render, messages, width, height, scale,
      send: call,
      evaluate,

      /** Loads an address and waits for the page's load event. */
      async goto(url) {
        const loaded = new Promise((resolve) => {
          const fn = (m) => { if (m.method === 'Page.loadEventFired' && m.sessionId === sessionId) { listeners.delete(fn); resolve(); } };
          listeners.add(fn);
        });
        const r = await call('Page.navigate', { url });
        if (r.errorText) throw new Error(`could not load ${url}: ${r.errorText}`);
        await Promise.race([loaded, sleep(30000)]);
      },

      /** Waits until the watch is showing. Returns { how, ready, why }; never throws for a page that is merely not ready. */
      async waitForWatch() {
        const limit = envNumber('TIMEOUT', 60) * 1000, start = Date.now();
        let state = { how: 'none', ready: false, why: 'the page never answered' };
        while (Date.now() - start < limit) {
          try { state = await evaluate(READY); } catch { /* the page is still loading */ }
          if (state.ready || state.gaveUp) break;
          await sleep(250);
        }
        if (!state.ready && !state.gaveUp) state.why += ` after ${Math.round((Date.now() - start) / 1000)} seconds`;
        state.waited = Date.now() - start;
        return state;
      },

      /** The renderer, whether the context is lost, whether the scene has something to reflect (handle only), and where the canvas is. */
      info: () => evaluate(INFO),
      fresh: () => evaluate(FRESH),
      /** The "is the watch showing" test, once, now. */
      showing: () => evaluate(READY),

      /** Waits for n drawn frames (capped at `cap` ms), then `extra` ms more. */
      async frames(n = 3, extra = 0, cap = 30000) {
        await Promise.race([
          evaluate(`new Promise((done) => { let left = ${n}; const step = () => (--left <= 0 ? done(true) : requestAnimationFrame(step)); requestAnimationFrame(step); })`),
          sleep(cap),
        ]);
        if (extra) await sleep(extra);
      },

      /** Hides page furniture (a CSS selector list) so that it does not cover the watch. */
      hide: (selectors) => evaluate(`(() => { const s = document.createElement('style'); s.textContent = ${JSON.stringify(selectors + '{display:none!important}')}; document.head.appendChild(s); return true; })()`),

      /** Presses the left button at (x, y), moves by (dx, dy) in steps, and lets go. CSS pixels. */
      async drag(x, y, dx, dy, steps = 12) {
        await call('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
        await call('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 });
        for (let i = 1; i <= steps; i++) {
          await call('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x + (dx * i) / steps, y: y + (dy * i) / steps, button: 'left', buttons: 1 });
          await sleep(16);
        }
        await call('Input.dispatchMouseEvent', { type: 'mouseReleased', x: x + dx, y: y + dy, button: 'left', buttons: 0, clickCount: 1 });
      },

      /** A PNG of the window, or of `clip` = { x, y, width, height } in CSS pixels. Returns a Buffer. */
      async screenshot(clip) {
        const r = await call('Page.captureScreenshot', { format: 'png', ...(clip ? { clip: { ...clip, scale: 1 } } : {}) });
        return Buffer.from(r.data, 'base64');
      },
    };
    return await body(page);
  } finally {
    if (socket && socket.readyState === WebSocket.OPEN) {
      try { socket.send(JSON.stringify({ id: 0, method: 'Browser.close' })); } catch { /* closing anyway */ }
    }
    await Promise.race([gone, sleep(5000)]);
    kill();
    await Promise.race([gone, sleep(2000)]);
    process.off('exit', kill);
    rmSync(profile, { recursive: true, force: true, maxRetries: 3 });
  }
}

/**
 * Prints the renderer line and everything the page reported, and returns the list of reasons this run fails
 * (empty when it passes). `state` is what waitForWatch returned.
 */
export async function verdict(page, state) {
  const reasons = [];
  console.log(`renderer asked for: ${page.render.words}`);
  if (state.ready) {
    const info = await page.info();
    // The watch can stop showing after it first showed (a lost context makes the site page fall back to the flat dial).
    const now = await page.showing().catch(() => ({ ready: false, why: 'the page no longer answers' }));
    console.log(`renderer in use:    ${info.renderer}`);
    console.log(`watch showing:      yes, by the ${state.how === 'handle' ? `page's handle window.${HANDLE}` : 'stage test (no handle on this page)'}, after ${(state.waited / 1000).toFixed(1)} s${now.ready ? '' : '; BUT NOT ANY MORE'}`);
    if (!now.ready) reasons.push(`the watch showed and then stopped showing: ${now.why}`);
    if (info.lost) reasons.push('the WebGL context is lost');
    if (info.env === false) reasons.push('the scene has no environment to reflect, so steel will be near black');
    if (info.env === null) console.log('environment:        cannot be read without a handle; a lost context shows up in the messages below');
    if (page.render.mode === 'gpu' && /swiftshader|llvmpipe|software/i.test(info.renderer)) {
      reasons.push('the graphics card was asked for but a software renderer is in use; run again with WATCH3D_RENDERER=software');
    }
  } else {
    console.log(`renderer in use:    a canvas of its own gets "${await page.fresh().catch(() => 'unknown')}"`);
    console.log('watch showing:      NO');
    reasons.push(state.why + (state.says ? ` (the stage says: ${state.says})` : ''));
    if (page.render.mode === 'gpu') reasons.push('if the graphics card cannot be used here, run again with WATCH3D_RENDERER=software');
  }
  const real = page.messages.filter((m) => !NOISE.some((re) => re.test(m.text)));
  const noise = page.messages.length - real.length;
  if (real.length) {
    console.log(`messages (${real.length}):`);
    for (const m of real) console.log(`  [${m.kind}] ${m.text.split('\n').join('\n      ')}`);
    reasons.push(`${real.length} console message${real.length > 1 ? 's' : ''} (errors, warnings or failed requests)`);
    if (real.some((m) => /CONTEXT_LOST|context lost/i.test(m.text))) reasons.push('the WebGL context was lost at some point; what was drawn afterwards cannot be trusted');
  } else console.log('messages:           none');
  if (noise) console.log(`ignored:            ${noise} message${noise > 1 ? 's' : ''} from the browser itself (reading pixels for a screenshot, or a missing favicon.ico)`);
  return reasons;
}

/** Prints the result line for a tool and returns its exit code. */
export function finish(reasons) {
  if (!reasons.length) { console.log('PASS'); return 0; }
  console.log('FAIL');
  for (const r of reasons) console.log('  - ' + r);
  return 1;
}

// ---------- pictures ----------

/** Decodes an 8-bit RGB or RGBA PNG (what Chromium's screenshots are). Returns { width, height, channels, px }. */
export function readPng(buf) {
  if (buf.length < 8 || buf.readUInt32BE(0) !== 0x89504e47 || buf.readUInt32BE(4) !== 0x0d0a1a0a) throw new Error('not a PNG file');
  let pos = 8, width = 0, height = 0, depth = 0, type = 0, interlace = 0;
  const parts = [];
  while (pos + 8 <= buf.length) {
    const length = buf.readUInt32BE(pos), name = buf.toString('latin1', pos + 4, pos + 8), data = buf.subarray(pos + 8, pos + 8 + length);
    if (name === 'IHDR') { width = data.readUInt32BE(0); height = data.readUInt32BE(4); depth = data[8]; type = data[9]; interlace = data[12]; }
    else if (name === 'IDAT') parts.push(data);
    else if (name === 'IEND') break;
    pos += 12 + length;
  }
  if (depth !== 8 || (type !== 2 && type !== 6) || interlace) throw new Error('only 8-bit RGB or RGBA PNGs without interlacing can be read');
  const n = type === 6 ? 4 : 3, stride = width * n;
  const raw = zlib.inflateSync(Buffer.concat(parts));
  const px = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)], src = y * (stride + 1) + 1, dst = y * stride;
    for (let i = 0; i < stride; i++) {
      const left = i >= n ? px[dst + i - n] : 0, up = y ? px[dst + i - stride] : 0, corner = y && i >= n ? px[dst + i - stride - n] : 0;
      let v = raw[src + i];
      if (filter === 1) v += left;
      else if (filter === 2) v += up;
      else if (filter === 3) v += (left + up) >> 1;
      else if (filter === 4) {
        const p = left + up - corner, a = Math.abs(p - left), b = Math.abs(p - up), c = Math.abs(p - corner);
        v += a <= b && a <= c ? left : b <= c ? up : corner;
      }
      px[dst + i] = v & 255;
    }
  }
  return { width, height, channels: n, px };
}

/** Grey level of red, green and blue, 0 to 255, with the weights Pillow's "L" mode uses (0.299, 0.587, 0.114). */
const grey = (r, g, b) => (r * 19595 + g * 38470 + b * 7471 + 0x8000) >> 16;

/** A box "x0,y0,x1,y1" (left, top, right, bottom in picture pixels; right and bottom not included) as four numbers. */
export function parseBox(text) {
  const box = String(text).split(',').map(Number);
  if (box.length !== 4 || box.some((v) => !Number.isFinite(v)) || box[2] <= box[0] || box[3] <= box[1]) throw new UsageError(`a box is x0,y0,x1,y1 with x1 > x0 and y1 > y0, not "${text}"`);
  return box;
}

/** Mean grey level of a box, and the share of its pixels at 250 or above ("white") and below 8 ("black"), in per cent. */
export function boxStats(img, box = [0, 0, img.width, img.height]) {
  const [x0, y0, x1, y1] = [Math.max(0, box[0]), Math.max(0, box[1]), Math.min(img.width, box[2]), Math.min(img.height, box[3])];
  let sum = 0, white = 0, black = 0, count = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * img.width + x) * img.channels, v = grey(img.px[i], img.px[i + 1], img.px[i + 2]);
      sum += v; count++;
      if (v >= 250) white++;
      if (v < 8) black++;
    }
  }
  if (!count) throw new UsageError(`the box ${box.join(',')} lies outside the ${img.width} by ${img.height} picture`);
  return { mean: sum / count, white: (white / count) * 100, black: (black / count) * 100, count };
}

/**
 * Compares two pictures of the same size. Returns the share of pixels, in per cent, that differ in any channel, and
 * whose difference as a grey level is more than 8 and more than 24, and the largest difference in any channel.
 */
export function diffStats(a, b) {
  if (a.width !== b.width || a.height !== b.height) throw new Error(`the pictures differ in size: ${a.width} by ${a.height} against ${b.width} by ${b.height}`);
  const count = a.width * a.height;
  let any = 0, over8 = 0, over24 = 0, largest = 0;
  for (let p = 0; p < count; p++) {
    const i = p * a.channels, j = p * b.channels;
    const dr = Math.abs(a.px[i] - b.px[j]), dg = Math.abs(a.px[i + 1] - b.px[j + 1]), db = Math.abs(a.px[i + 2] - b.px[j + 2]);
    if (dr || dg || db) any++;
    const v = grey(dr, dg, db);
    if (v > 8) over8++;
    if (v > 24) over24++;
    largest = Math.max(largest, dr, dg, db);
  }
  return { any: (any / count) * 100, over8: (over8 / count) * 100, over24: (over24 / count) * 100, largest, count };
}
