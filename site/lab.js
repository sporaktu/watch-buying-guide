// Working models of the trickier functions: a slide rule, the two stopwatch scales, a flyback, a second time zone and
// timing bezels. Hand-drawn SVG with no library. It reads nothing from app.js, so it works on its own; the cards only
// link to it, as #lab-<model> or #lab-<model>-<mode>.
(function () {
  'use strict';
  const root = document.getElementById('lab'), tabsEl = document.getElementById('labTabs'),
    stage = document.getElementById('labStage'), side = document.getElementById('labSide');
  if (!root || !tabsEl || !stage || !side) return;

  const NS = 'http://www.w3.org/2000/svg';
  const S = (tag, at, parent, text) => { const e = document.createElementNS(NS, tag); for (const k in at) e.setAttribute(k, at[k]); if (text != null) e.textContent = text; if (parent) parent.appendChild(e); return e; };
  const H = (tag, cls, parent, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; if (parent) parent.appendChild(e); return e; };
  const mod = (a, n) => ((a % n) + n) % n;
  const f = n => Math.round(n * 100) / 100;
  const still = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const put = (el, text) => { if (el.textContent !== text) el.textContent = text; };   // a readout is only announced when its words change

  // Every angle here is in degrees clockwise from 12 o'clock, as on a dial.
  const at = (deg, r) => { const a = (deg - 90) * Math.PI / 180; return [f(r * Math.cos(a)), f(r * Math.sin(a))]; };
  // A dial with buttons on its side needs room for them; one without fills the frame, which matters on a phone.
  const dial = (label, buttons) => { const r = buttons ? 236 : 212; return S('svg', { viewBox: `${-r} ${-r} ${2 * r} ${2 * r}`, class: 'lab-dial', role: 'img', 'aria-label': label }, stage); };
  const tick = (g, deg, r0, r1, cls) => { const [x1, y1] = at(deg, r0), [x2, y2] = at(deg, r1); return S('line', { x1, y1, x2, y2, class: cls || 'l-t' }, g); };
  const num = (g, deg, r, text, cls) => { const [x, y] = at(deg, r); return S('text', { x, y, class: 'l-n' + (cls ? ' ' + cls : '') }, g, text); };
  const band = (g, r0, r1, cls) => S('path', { class: cls, 'fill-rule': 'evenodd', d: `M0 ${-r1}A${r1} ${r1} 0 1 1 0 ${r1}A${r1} ${r1} 0 1 1 0 ${-r1}ZM0 ${-r0}A${r0} ${r0} 0 1 0 0 ${r0}A${r0} ${r0} 0 1 0 0 ${-r0}Z` }, g);
  const hand = (g, back, len, cls) => S('line', { x1: 0, y1: back, x2: 0, y2: -len, class: cls }, g);
  const arrow = (g, deg, r, size, cls) => S('path', { d: `M0 ${-r}L${-size * .6} ${-(r - size)}L${size * .6} ${-(r - size)}Z`, transform: `rotate(${f(deg)})`, class: cls }, g);
  const turn = (el, deg) => el.setAttribute('transform', `rotate(${f(deg)})`);

  const para = (text, cls) => H('p', cls || '', side, text);
  const button = (parent, text, fn) => { const b = H('button', '', parent, text); b.type = 'button'; b.addEventListener('click', fn); return b; };
  const slider = (parent, text, max, step, fn) => { const l = H('label', 'lab-range', parent); H('span', '', l, text); const i = H('input', '', l); i.type = 'range'; i.min = 0; i.max = max; i.step = step; i.addEventListener('input', () => fn(+i.value)); return i; };
  const steps = list => { const ol = H('ol', 'lab-steps', side); list.forEach(t => H('li', '', ol, t)); return ol; };

  // Dragging turns a ring. Only the ring itself takes over touches, so the page still scrolls from anywhere else on the dial.
  function draggable(el, svg, onTurn, onEnd) {
    let last = null;
    const ang = e => { const b = svg.getBoundingClientRect(); return Math.atan2(e.clientY - (b.top + b.height / 2), e.clientX - (b.left + b.width / 2)) * 180 / Math.PI; };
    el.addEventListener('pointerdown', e => { if (e.button) return; last = ang(e); try { el.setPointerCapture(e.pointerId); } catch (x) {} el.classList.add('held'); e.preventDefault(); });
    el.addEventListener('pointermove', e => { if (last == null) return; const a = ang(e); let d = a - last; if (d > 180) d -= 360; if (d < -180) d += 360; last = a; onTurn(d); });
    const up = () => { if (last == null) return; last = null; el.classList.remove('held'); if (onEnd) onEnd(); };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('lostpointercapture', up);
    el.addEventListener('touchstart', e => e.preventDefault(), { passive: false });   // a finger that lands on the ring turns it and doesn't scroll the page
  }

  // One animation loop for whichever model is showing. It runs only while that model asks for frames (by having a frame
  // function), the section is on screen and the tab is in front.
  let demo = null, raf = 0, seen = true;
  function loop(now) { raf = 0; if (demo && demo.frame && seen && !document.hidden) { demo.frame(now); kick(); } }
  function kick() { if (!raf && demo && demo.frame && seen && !document.hidden) raf = requestAnimationFrame(loop); }
  if (window.IntersectionObserver) new IntersectionObserver(es => { seen = es[es.length - 1].isIntersecting; kick(); }).observe(root);
  document.addEventListener('visibilitychange', kick);

  /* ---------- Slide rule ---------- */

  // Both rings carry the same scale: one turn for each factor of ten, so 10 and 100 share a mark. The fixed inner ring has
  // its 60 at the top, where the speed arrow is.
  const L60 = Math.log10(60);
  const where = v => 360 * (Math.log10(v) - L60);                          // the angle of a number on the inner ring
  const reading = deg => Math.pow(10, mod(deg / 360 + L60, 1) + 1);        // the number at an angle on the inner ring, 10 up to 100
  const show = v => { const s = +v.toPrecision(3); return String(s >= 100 ? 10 : s); };
  // The distance marks on the inner ring, spaced as 1 nautical mile : 1.1508 miles : 1.852 km.
  const NAUT = 33, STAT = 33 * 1.15078, KM = 33 * 1.852;

  function scale(g, r, out, labelR, cls, red10) {
    for (let i = 20; i < 200; i++) {                                        // half units up to 20, whole units after that
      const v = i / 2; if (v >= 20 && i % 2) continue;
      const whole = !(i % 2), named = whole && (v <= 20 || v % 5 === 0);
      tick(g, where(v), r, r + out * (named ? 12 : whole ? 8 : 5), 'l-t');
      if (named) { const t = num(g, where(v), labelR, v, cls + (red10 && v === 10 ? ' l-redt' : '')); t.setAttribute('transform', `rotate(${f(where(v))} ${t.getAttribute('x')} ${t.getAttribute('y')})`); }   // numbers stand on the scale, feet towards the centre
    }
  }

  function slideRule() {
    const svg = dial('A slide rule: a turning outer ring of numbers around a fixed inner ring');
    S('circle', { r: 208, class: 'l-case' }, svg);
    const outer = S('g', { class: 'l-turn' }, svg);
    band(outer, 150, 206, 'l-ring');
    for (let d = 0; d < 360; d += 5) tick(outer, d, 200, 206, 'l-t');     // the grip, so the turning shows
    scale(outer, 150, 1, 176, '');
    S('circle', { r: 150, class: 'l-face' }, svg);
    scale(svg, 150, -1, 124, 'l-s', true);
    S('circle', { r: 104, class: 'l-well' }, svg);
    // The marks on the fixed ring: the speed arrow at 60, the unit mark at 10 and the three distance marks.
    arrow(svg, 0, 150, 11, 'l-inkf'); num(svg, -7, 111, 'MPH', 'l-tag');
    arrow(svg, where(10), 150, 11, 'l-redf');
    [[NAUT, 'NAUT', 0], [STAT, 'STAT', 0], [KM, 'KM', 6]].forEach(([v, t, nudge]) => { arrow(svg, where(v), 150, 9, 'l-redf'); num(svg, where(v) + nudge, 111, t, 'l-tag l-redt'); });
    const line = S('line', { x1: 0, y1: -104, x2: 0, y2: -206, class: 'l-cursor' }, svg);
    S('text', { x: 0, y: -22, class: 'l-n l-small' }, svg, 'outer ÷ inner');
    const ratioEl = S('text', { x: 0, y: 14, class: 'l-n l-big' }, svg);

    H('h3', '', side, 'Slide rule');
    para('Two rings carry the same scale. The outer ring turns and the inner one stays put. Line up any two numbers and every other pair around the dial is in the same proportion, which is how it multiplies and divides. Pilots used it for speed, fuel and distance.');
    const rotIn = slider(side, 'Turn the outer ring', 360, 0.1, v => { rot = v; story = ''; me.frame = null; draw(); });
    const curIn = slider(side, 'Move the red line', 360, 0.1, v => { cur = v; story = ''; me.frame = null; draw(); });
    const out = H('div', 'lab-out', side); out.setAttribute('aria-live', 'polite');
    const pair = H('p', 'lab-read', out), tale = H('p', '', out);
    H('h4', '', side, 'Try a sum');
    const sums = H('div', 'lab-btns', side);
    const HINT = 'Drag the outer ring or use the sliders. You place the decimal point yourself: 12 can stand for 1.2, 12 or 120.';
    // Each sum puts one number on the outer ring against one on the inner ring, then moves the red line to the answer.
    [['45 minutes at 120 km/h', 12, 60, where(45), 'Driving at 120 km/h. The 12 on the outer ring is at the MPH arrow, which is the 60 on the inner ring, because a speed is a distance every 60 minutes. The red line is on 45 minutes on the inner ring, and the outer ring reads 90 there: 90 km.'],
     ['How long for 200 km?', 12, 60, where(10), 'Still 120 km/h. Find 20 on the outer ring, standing for 200 km. The inner ring reads 10 there, standing for 100 minutes: 1 hour 40.'],
     ['50 euros in dollars', 11, 10, where(50), 'One euro is 1.10 dollars, so 11 on the outer ring is at the red 10. Euros are now on the inner ring and dollars on the outer: 50 euros is next to 55 dollars.'],
     ['100 miles in km', 10, STAT, where(KM), 'The 10 on the outer ring, standing for 100 miles, is at the STAT mark. At the KM mark the outer ring reads about 16.1: 161 km.'],
     ['7 × 8', 70, 10, where(80), 'The 7 on the outer ring (marked 70) is at the red 10. Against 8 on the inner ring (marked 80), the outer ring reads 56.']
    ].forEach(([name, a, b, c, text]) => button(sums, name, () => glide(where(b) - where(a), c, text)));

    let rot = 0, cur = where(45), story = '';
    function draw() {
      turn(outer, rot); turn(line, cur);
      rotIn.value = f(mod(rot, 360)); curIn.value = f(mod(cur, 360));
      const o = show(reading(cur - rot)), i = show(reading(cur));
      ratioEl.textContent = String(+Math.pow(10, mod(-rot / 360, 1)).toPrecision(3)).replace(/^10$/, '1');
      if (me.frame) return;                                                 // mid-glide: the words wait for the last frame
      put(pair, `At the red line: outer ${o}, inner ${i}`); put(tale, story || HINT);
    }
    // Turn the ring to a setting by the shorter way round, then tell the story of the sum.
    function glide(toRot, toCur, text) {
      const r0 = rot, c0 = cur, dr = mod(toRot - r0 + 180, 360) - 180, dc = mod(toCur - c0 + 180, 360) - 180;
      story = text;
      if (still) { rot = r0 + dr; cur = c0 + dc; me.frame = null; draw(); return; }
      let t0 = 0;
      me.frame = now => { t0 = t0 || now; const k = Math.min(1, (now - t0) / 700), e = k * k * (3 - 2 * k); rot = r0 + dr * e; cur = c0 + dc * e; if (k === 1) me.frame = null; draw(); };
      kick();
    }
    draggable(outer, svg, d => { rot += d; story = ''; me.frame = null; draw(); });
    // A tap on the face moves the red line there.
    svg.addEventListener('click', e => { if (outer.contains(e.target)) return; const b = svg.getBoundingClientRect(); cur = Math.atan2(e.clientY - (b.top + b.height / 2), e.clientX - (b.left + b.width / 2)) * 180 / Math.PI + 90; story = ''; me.frame = null; draw(); });
    const me = { frame: null };
    glide(where(60) - where(12), where(45), 'Driving at 120 km/h. The 12 on the outer ring is at the MPH arrow, which is the 60 on the inner ring, because a speed is a distance every 60 minutes. The red line is on 45 minutes on the inner ring, and the outer ring reads 90 there: 90 km.');
    return me;
  }

  /* ---------- The stopwatch, shared by three models ---------- */

  // A chronograph dial with working buttons. The model using it draws its own scale on the ring around the dial and is told
  // about each press: 'top', 'reset', 'blocked' (reset pressed while an ordinary stopwatch is running) or 'lap' with a time.
  function stopwatch(label, onPress) {
    const svg = dial(label, true);
    S('rect', { x: -15, y: -228, width: 30, height: 22, class: 'l-case', transform: 'rotate(90)' }, svg);
    const push = deg => S('rect', { x: -11, y: -232, width: 22, height: 28, rx: 2, class: 'l-push', transform: `rotate(${deg})`, 'aria-hidden': 'true' }, svg);
    const pTop = push(60), pBot = push(120);
    S('circle', { r: 208, class: 'l-case' }, svg);
    const ringG = S('g', {}, svg); band(ringG, 160, 206, 'l-ring');
    S('circle', { r: 160, class: 'l-face' }, svg);
    for (let s = 0; s < 60; s++) tick(svg, s * 6, s % 5 ? 153 : 147, 159, s % 5 ? 'l-t' : 'l-t2');
    const sub = (cx, n, marks) => {
      const g = S('g', { transform: `translate(${cx} 0)` }, svg); S('circle', { r: 42, class: 'l-sub' }, g);
      for (let i = 0; i < n; i++) tick(g, i * 360 / n, i % (n / 6) ? 37 : 33, 41, 'l-t');
      marks.forEach((m, i) => num(g, (i + 1) * 120, 23, m, 'l-s'));
      const h = hand(g, 6, 34, 'l-thin'); S('circle', { r: 3, class: 'l-inkf' }, g); return h;
    };
    const secs = sub(-82, 60, [20, 40, 60]), mins = sub(82, 30, [10, 20, 30]);
    S('text', { x: -82, y: 58, class: 'l-n l-small' }, svg, 'seconds'); S('text', { x: 82, y: 58, class: 'l-n l-small' }, svg, 'minutes');
    const sweep = hand(svg, 34, 150, 'l-sec'); S('circle', { r: 6, class: 'l-redf' }, svg);

    const time = H('p', 'lab-time', stage, '0.0 s');
    const row = H('div', 'lab-btns lab-pushers', stage);
    const c = { run: false, acc: 0, t0: 0, flyback: false, ms: now => c.acc + (c.run ? now - c.t0 : 0) };
    const dip = el => { el.classList.add('in'); setTimeout(() => el.classList.remove('in'), 160); };
    function top() { const now = performance.now(); if (c.run) { c.acc += now - c.t0; c.run = false; } else { c.t0 = now; c.run = true; } dip(pTop); paint(now); onPress('top'); }
    function bottom() {
      const now = performance.now(); dip(pBot);
      if (!c.run) { c.acc = 0; paint(now); onPress('reset'); }
      else if (c.flyback) { const lap = c.ms(now); c.acc = 0; c.t0 = now; paint(now); onPress('lap', lap); }
      else onPress('blocked');
    }
    button(row, 'Top button: start / stop', top); button(row, 'Bottom button: reset', bottom);
    pTop.addEventListener('click', top); pBot.addEventListener('click', bottom);
    function paint(now) {
      const ms = c.ms(now);
      turn(sweep, ms / 1000 * 6 % 360); turn(mins, ms / 60000 * 12 % 360); turn(secs, Date.now() / 1000 * 6 % 360);
      time.textContent = ms < 60000 ? (ms / 1000).toFixed(1) + ' s' : Math.floor(ms / 60000) + ' min ' + (ms / 1000 % 60).toFixed(1) + ' s';
    }
    paint(performance.now());
    return { svg, ring: ringG, c, paint, top, bottom };
  }
  const scene = (h, label) => S('svg', { viewBox: `0 0 472 ${h}`, class: 'lab-scene', role: 'img', 'aria-label': label }, stage);

  /* ---------- Tachymeter ---------- */

  function tachymeter() {
    // A car covers the kilometre between two posts at a speed the reader doesn't know.
    const sc = scene(92, 'A road with two posts one kilometre apart');
    S('line', { x1: 0, y1: 72, x2: 472, y2: 72, class: 'l-t2' }, sc);
    [[120, 'start'], [360, '1 km']].forEach(([x, t]) => { S('line', { x1: x, y1: 30, x2: x, y2: 72, class: 'l-t2' }, sc); S('text', { x, y: 20, class: 'l-n' }, sc, t); });
    const car = S('g', { class: 'l-car', visibility: 'hidden' }, sc);
    S('path', { d: 'M-17 -6h7l5 -8h13l6 8h4v9h-35z', class: 'l-redf' }, car); S('circle', { cx: -8, cy: 4, r: 4, class: 'l-inkf' }, car); S('circle', { cx: 10, cy: 4, r: 4, class: 'l-inkf' }, car);

    const w = stopwatch('A stopwatch with a tachymeter scale around the dial', what => { if (what === 'reset' && go && go.done) { go = null; car.setAttribute('visibility', 'hidden'); } tell(); });
    [500, 400, 350, 300, 275, 250, 225, 200, 190, 180, 170, 160, 150, 140, 130, 120, 110, 100, 90, 85, 80, 75, 70, 65, 60].forEach(v => { tick(w.ring, 3600 / v * 6, 160, 168, 'l-t'); num(w.ring, 3600 / v * 6, 185, v); });

    H('h3', '', side, 'Tachymeter');
    para('The scale around the dial turns a time into a speed. Time one kilometre (or one mile) and the long hand points at the speed per hour. The sum it does for you is 3,600 divided by the seconds.');
    steps(['Press "Send a car".', 'Start the stopwatch as the car passes the first post.', 'Stop it as the car passes the second post, one kilometre on.', 'Read the speed where the long hand points.']);
    const row = H('div', 'lab-btns', side);
    let go = null;                                                          // the car on the road: its speed, when it set off and where
    button(row, 'Send a car', () => {
      const v = 110 + Math.round(Math.random() * 180), pps = 240 / (3600 / v);
      if (!w.c.run) { w.c.acc = 0; w.paint(performance.now()); }           // a fresh car starts from zero
      go = { v, t0: performance.now(), x0: 120 - 2.5 * pps, pps, done: false }; car.setAttribute('visibility', 'visible'); tell(); kick();
    });
    const out = H('p', 'lab-out', side); out.setAttribute('aria-live', 'polite');
    function tell() {
      const s = w.c.ms(performance.now()) / 1000;
      let say;
      if (w.c.run) say = 'Timing. Stop it at the second post.';
      else if (!s) say = go ? 'Here it comes. Start the stopwatch at the first post.' : 'Send a car, or just start the stopwatch and stop it anywhere to see what the scale reads.';
      else if (s < 7.2 || s > 60) say = `Stopped at ${s.toFixed(1)} seconds, which is off the scale. It only reads times between about 7 seconds and a minute.`;
      else say = `Stopped at ${s.toFixed(1)} seconds. The long hand points at about ${Math.round(3600 / s)} on the scale: ${Math.round(3600 / s)} km/h.` + (go && go.done ? ` The car was doing ${go.v}.` : '');
      put(out, say);
    }
    tell();
    return { frame(now) {
      w.paint(now);
      if (go) { const x = go.x0 + go.pps * (now - go.t0) / 1000; car.setAttribute('transform', `translate(${f(Math.min(x, 500))} 66)`); if (!go.done && x >= 360) { go.done = true; if (!w.c.run) tell(); } }
    } };
  }

  /* ---------- Telemeter ---------- */

  const SOUND = 0.343;                                                      // kilometres a second
  function telemeter() {
    const sc = scene(118, 'A storm cloud in the distance, and you');
    const flash = S('rect', { x: 0, y: 0, width: 472, height: 118, class: 'l-flash', opacity: 0 }, sc);
    S('line', { x1: 0, y1: 104, x2: 472, y2: 104, class: 'l-t2' }, sc);
    S('circle', { cx: 44, cy: 76, r: 6, class: 'l-inkf' }, sc); S('line', { x1: 44, y1: 82, x2: 44, y2: 104, class: 'l-t2' }, sc); S('text', { x: 44, y: 60, class: 'l-n' }, sc, 'you');
    S('path', { d: 'M366 50a16 16 0 0 1 4 -31a22 22 0 0 1 42 -2a18 18 0 0 1 22 33z', class: 'l-cloud' }, sc);
    const bolt = S('path', { d: 'M404 50l-13 26h10l-9 28l25 -37h-11l8 -17z', class: 'l-bolt', visibility: 'hidden' }, sc);
    const wave = S('circle', { cx: 396, cy: 80, r: 0, class: 'l-wave', visibility: 'hidden' }, sc);
    const boom = S('text', { x: 96, y: 84, class: 'l-n l-redt l-boom', visibility: 'hidden' }, sc, 'BOOM');

    const w = stopwatch('A stopwatch with a telemeter scale around the dial', what => { if (what === 'reset' && (!hit || hit.heard)) clear(); tell(); });
    for (let d = 0.5; d <= 20; d += 0.5) { const a = d / SOUND * 6; tick(w.ring, a, 160, d % 1 ? 165 : 170, 'l-t'); if (!(d % 1)) num(w.ring, a, 186, d); }

    H('h3', '', side, 'Telemeter');
    para('The scale around the dial turns the gap between seeing something and hearing it into a distance. Sound takes about three seconds to cover a kilometre, so the long hand reads off how far away it happened.');
    steps(['Press "Make lightning".', 'Start the stopwatch when you see the flash.', 'Stop it when the thunder reaches you.', 'Read the distance in kilometres where the long hand points.']);
    const row = H('div', 'lab-btns', side);
    let hit = null;                                                         // the strike: how far away, and when
    function clear() { hit = null; [bolt, wave, boom].forEach(e => e.setAttribute('visibility', 'hidden')); flash.setAttribute('opacity', 0); }
    button(row, 'Make lightning', () => { clear(); if (!w.c.run) { w.c.acc = 0; w.paint(performance.now()); } hit = { km: Math.round((1.5 + Math.random() * 5) * 10) / 10, t0: performance.now(), heard: false }; bolt.setAttribute('visibility', 'visible'); wave.setAttribute('visibility', 'visible'); tell(); kick(); });
    const out = H('p', 'lab-out', side); out.setAttribute('aria-live', 'polite');
    function tell() {
      const s = w.c.ms(performance.now()) / 1000;
      let say;
      if (w.c.run) say = hit && hit.heard ? 'There\'s the thunder. Stop it now.' : 'Timing. Stop it when the thunder arrives.';
      else if (!s) say = hit ? 'Flash! Start the stopwatch.' : 'Make lightning, or just start the stopwatch and stop it anywhere to see what the scale reads.';
      else if (s > 58) say = `Stopped at ${s.toFixed(1)} seconds, which is off the scale. It reads up to about 20 km.`;
      else say = `Stopped at ${s.toFixed(1)} seconds. The long hand points at about ${(s * SOUND).toFixed(1)} on the scale: the strike was about ${(s * SOUND).toFixed(1)} km away.` + (hit && hit.heard ? ` It was really ${hit.km.toFixed(1)} km.` : '');
      put(out, say);
    }
    tell();
    return { frame(now) {
      w.paint(now);
      if (!hit) return;
      const t = (now - hit.t0) / 1000, due = hit.km / SOUND;
      flash.setAttribute('opacity', still ? 0 : f(Math.max(0, .7 - t * 3)));
      if (t > .6) bolt.setAttribute('visibility', 'hidden');
      wave.setAttribute('r', f(Math.min(1, t / due) * 352));              // the sound spreading from the strike to you
      if (!hit.heard && t >= due) { hit.heard = true; wave.setAttribute('visibility', 'hidden'); boom.setAttribute('visibility', 'visible'); tell(); }
      if (hit.heard && t > due + 2.5) boom.setAttribute('visibility', 'hidden');
    } };
  }

  /* ---------- Stopwatch and flyback ---------- */

  function flyback(mode) {
    let presses = 0, legs = [];
    const w = stopwatch('A stopwatch with two buttons', (what, lap) => {
      presses++;
      if (what === 'lap') legs.push(lap);
      if (what === 'reset') legs = [], presses = 0;
      note = what === 'blocked' ? 'Nothing happens. An ordinary stopwatch has to be stopped before it can be reset, so timing the next thing takes three presses: stop, reset, start.'
        : what === 'lap' ? 'One press: the hand flew back to zero and is already timing the next leg.' : '';
      tell(); kick();
    });
    for (let s = 5; s <= 60; s += 5) num(w.ring, s * 6, 184, s);

    H('h3', '', side, 'Stopwatch and flyback');
    para('The top button starts and stops the long hand. The bottom button sends it back to zero. The small dial on the right counts the minutes, and the one on the left is the watch\'s own seconds, which never stop.');
    const pick = H('div', 'tabs lab-mode', side);
    const kinds = [['plain', 'Ordinary stopwatch'], ['flyback', 'Flyback']].map(([k, t]) => { const b = button(pick, t, () => set(k)); b.dataset.k = k; return b; });
    const how = para('');
    const out = H('div', 'lab-out', side); out.setAttribute('aria-live', 'polite');
    const line = H('p', '', out), list = H('ol', 'lab-legs', out);
    let note = '';
    function set(k) {
      w.c.flyback = k === 'flyback'; kinds.forEach(b => b.setAttribute('aria-pressed', b.dataset.k === k));
      how.textContent = w.c.flyback ? 'Flyback: start it, then press the bottom button while it is running. Each press ends one leg and starts the next, with nothing lost in between.'
        : 'Ordinary: start it, then try the bottom button while it is running.';
      note = ''; tell();
    }
    function tell() {
      line.textContent = note || (presses ? `Presses so far: ${presses}.` : 'Press the top button to start.');
      list.textContent = ''; legs.forEach((ms, i) => H('li', '', list, `Leg ${i + 1}: ${(ms / 1000).toFixed(1)} seconds`));
    }
    set(mode === 'flyback' ? 'flyback' : 'plain');
    return { frame: now => w.paint(now) };
  }

  /* ---------- Second time zone ---------- */

  function gmt() {
    const svg = dial('A watch with a fourth hand that shows the time at home on a 24-hour bezel');
    S('circle', { r: 208, class: 'l-case' }, svg); band(svg, 160, 206, 'l-ring');
    for (let h = 1; h <= 24; h++) { if (h === 24) arrow(svg, 0, 198, 22, 'l-inkf'); else if (h % 2) tick(svg, h * 15, 176, 190, 'l-t2'); else num(svg, h * 15, 184, h); }
    S('circle', { r: 160, class: 'l-face' }, svg);
    for (let h = 0; h < 12; h++) tick(svg, h * 30, h % 3 ? 132 : 122, 152, 'l-t3');
    S('rect', { x: 92, y: -14, width: 36, height: 28, class: 'l-sub' }, svg);
    const dateEl = S('text', { x: 110, y: 0, class: 'l-n l-date' }, svg);
    const far = S('g', {}, svg); S('line', { x1: 0, y1: 0, x2: 0, y2: -128, class: 'l-gmt' }, far); S('path', { d: 'M0 -156L-11 -128L11 -128Z', class: 'l-gmtf' }, far);
    const hr = hand(svg, 14, 92, 'l-hour'), mn = hand(svg, 16, 140, 'l-min'); S('circle', { r: 7, class: 'l-inkf' }, svg);

    H('h3', '', side, 'Second time zone');
    para('The yellow hand goes round once in 24 hours and points at the 24-hour numbers on the bezel. The ordinary hour hand moves on its own, an hour at a time, without stopping the watch. So one hand stays on home time and the other goes with you.');
    steps(['The watch starts on your own time, on both hands.', 'Fly somewhere: jump the hour hand forwards or back.', 'Read local time from the ordinary hands and home time from the yellow one.']);
    const row = H('div', 'lab-btns', side);
    // The time on the wall when the model opens, held as UTC so that a clock change at home can't bend the arithmetic.
    const d0 = new Date(), base = Date.UTC(d0.getFullYear(), d0.getMonth(), d0.getDate(), d0.getHours(), d0.getMinutes()); let shift = 0;
    button(row, 'Hour hand back 1 hour', () => { shift--; draw(); });
    button(row, 'Hour hand forward 1 hour', () => { shift++; draw(); });
    button(row, 'Back to home time', () => { shift = 0; draw(); });
    const out = H('p', 'lab-out', side); out.setAttribute('aria-live', 'polite');
    const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const nth = n => n + (n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th');
    const clock = d => `${d.getUTCHours() % 12 || 12}:${String(d.getUTCMinutes()).padStart(2, '0')} ${d.getUTCHours() < 12 ? 'am' : 'pm'}`;
    function draw() {
      const home = new Date(base), here = new Date(base + shift * 3600000), m = home.getUTCMinutes();
      turn(mn, m * 6); turn(hr, (here.getUTCHours() % 12 + m / 60) * 30); turn(far, (home.getUTCHours() + m / 60) * 15);
      dateEl.textContent = here.getUTCDate();
      const gap = shift ? `${Math.abs(shift)} hour${Math.abs(shift) === 1 ? '' : 's'} ${shift > 0 ? 'ahead of' : 'behind'} home` : 'at home';
      put(out, `You are ${gap}. The ordinary hands say ${clock(here)} on ${DAYS[here.getUTCDay()]} the ${nth(here.getUTCDate())}. The yellow hand points at ${home.getUTCHours()}:${String(m).padStart(2, '0')} on the bezel, which is ${clock(home)} at home` + (here.getUTCDate() !== home.getUTCDate() ? ', and the date has changed with the hour hand.' : '.'));
    }
    draw();
    return { frame: null };
  }

  /* ---------- Timing bezels ---------- */

  function bezel(mode) {
    const svg = dial('A watch with a turning bezel marked in minutes');
    S('circle', { r: 208, class: 'l-case' }, svg);
    const ringG = S('g', { class: 'l-turn' }, svg);
    S('circle', { r: 160, class: 'l-face' }, svg);
    for (let m = 0; m < 60; m++) tick(svg, m * 6, m % 5 ? 150 : 138, 157, m % 5 ? 'l-t' : 'l-t3');
    const hr = hand(svg, 14, 92, 'l-hour'), mn = hand(svg, 16, 142, 'l-min'); S('circle', { r: 7, class: 'l-inkf' }, svg);

    H('h3', '', side, 'Timing bezels');
    para('A ring of minutes that turns around the dial. Set it against the minute hand and it remembers when you started, or when you have to stop, with no buttons to press.');
    const pick = H('div', 'tabs lab-mode', side);
    const kinds = [['dive', 'Dive bezel (counts up)'], ['countdown', 'Countdown bezel']].map(([k, t]) => { const b = button(pick, t, () => set(k)); b.dataset.k = k; return b; });
    const list = steps(['', '', '']);
    H('h4', '', side, 'Turn the bezel');
    const row = H('div', 'lab-btns', side);
    let down = false, b = 0, t = 610, note = '', fresh = true, due = null;  // b: how far the bezel is turned, in degrees. t: minutes since 12:00. due: when a countdown runs out
    const WONT = 'It won\'t go that way. A dive bezel only turns anticlockwise, so a knock can only make it show more time gone, never less.';
    const mark = () => { due = down ? t + mod(b - handAt(), 360) / 6 : null; };
    const handAt = () => mod(t, 60) * 6;
    const nudge = d => { if (d > 0 && !down) { note = WONT; draw(); return; } b = Math.round((b + d) / 6) * 6; note = ''; fresh = false; mark(); draw(); };
    button(row, 'Anticlockwise 5 minutes', () => nudge(-30)); button(row, 'Anticlockwise 1 minute', () => nudge(-6));
    button(row, 'Clockwise 1 minute', () => nudge(6)); button(row, 'Clockwise 5 minutes', () => nudge(30));
    const row2 = H('div', 'lab-btns', side);
    button(row2, 'Set it for me', () => { b = handAt() + (down ? 150 : 0); note = ''; fresh = false; mark(); draw(); });
    button(row2, 'Let 5 minutes pass', () => pass(5));
    const out = H('p', 'lab-out', side); out.setAttribute('aria-live', 'polite');
    function set(k) {
      down = k === 'countdown'; kinds.forEach(x => x.setAttribute('aria-pressed', x.dataset.k === k));
      ringG.textContent = ''; band(ringG, 160, 206, 'l-ring'); arrow(ringG, 0, 200, 24, 'l-redf');
      for (let m = 1; m < 60; m++) { const a = down ? -m * 6 : m * 6; if (m % 10 === 0) num(ringG, a, 184, m); else if (m % 5 === 0 || (!down && m < 15)) tick(ringG, a, m % 5 ? 172 : 176, m % 5 ? 196 : 192, m % 5 ? 'l-t' : 'l-t2'); }
      const say = down ? ['Turn the bezel so the minutes you have (try 25) sit at the minute hand, or press "Set it for me".', 'Let some time pass.', 'The number at the minute hand is the minutes left. When the hand reaches the red triangle, time is up.']
        : ['Turn the bezel so the red triangle meets the minute hand, or press "Set it for me".', 'Let some time pass.', 'The number at the minute hand is the minutes gone. Then try turning the bezel clockwise.'];
      [].forEach.call(list.children, (li, i) => { li.textContent = say[i]; });
      b = 0; note = ''; fresh = true; due = null; draw();
    }
    function draw() {
      turn(ringG, b); turn(mn, handAt()); turn(hr, mod(t, 720) / 2);
      if (me.frame) return;                                                 // while time is passing, the words wait for the last frame
      const n = Math.round(mod(down ? b - handAt() : handAt() - b, 360) / 6) % 60, late = due == null ? 0 : Math.round(t - due);
      put(out, note || (late > 0 ? `Time was up ${late} minute${late === 1 ? '' : 's'} ago: the minute hand has gone past the red triangle.` : fresh ? (down ? 'Start by turning the bezel until 25 sits at the minute hand.' : 'Start by turning the bezel until the red triangle meets the minute hand.') : down ? (n ? `The minute hand points at ${n} on the bezel: ${n} minute${n === 1 ? '' : 's'} left.` : 'The minute hand is at the red triangle: time is up.')
        : (n ? `The minute hand points at ${n} on the bezel: ${n} minute${n === 1 ? '' : 's'} since you set it.` : 'The red triangle is at the minute hand. Now let some time pass.')));
    }
    function pass(mins) {
      if (me.frame) return;                                                 // one stretch of time at a time
      const from = t; note = '';
      if (still) { t = from + mins; draw(); return; }
      let t0 = 0;
      me.frame = now => { t0 = t0 || now; const k = Math.min(1, (now - t0) / 900); t = from + mins * k; if (k === 1) { t = from + mins; me.frame = null; } draw(); };
      kick();
    }
    let push = 0;                                                           // how far a drag has leaned on a dive bezel the wrong way; a wobble doesn't count
    draggable(ringG, svg, d => {
      if (!down) { push = Math.max(-4, Math.min(8, push + d)); if (d > 0) { if (push > 4 && note !== WONT) { note = WONT; draw(); } return; } }
      b += d; fresh = false; if (down || push < 0) note = ''; mark(); draw();
    }, () => { push = 0; b = Math.round(b / 6) * 6; mark(); draw(); });
    const me = { frame: null };
    set(mode === 'countdown' ? 'countdown' : 'dive');
    return me;
  }

  /* ---------- Choosing a model ---------- */

  const MODELS = [['sliderule', 'Slide rule', slideRule], ['tachymeter', 'Tachymeter', tachymeter], ['telemeter', 'Telemeter', telemeter],
    ['stopwatch', 'Stopwatch and flyback', flyback], ['gmt', 'Second time zone', gmt], ['bezel', 'Timing bezels', bezel]];
  const tabs = MODELS.map(([id, name]) => { const b = button(tabsEl, name, () => choose(id)); b.dataset.id = id; return b; });
  function choose(id, mode) {
    const m = MODELS.find(x => x[0] === id) || MODELS[0];
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    demo = null; stage.textContent = ''; side.textContent = '';
    tabs.forEach(b => b.setAttribute('aria-pressed', b.dataset.id === m[0]));
    demo = m[2](mode); kick();
  }
  // A link such as #lab-bezel-countdown opens that model in that mode and brings the section into view.
  function fromHash(focus) {
    const m = /^#lab-([a-z]+)(?:-([a-z]+))?$/.exec(location.hash);
    if (!m || !MODELS.some(x => x[0] === m[1])) return false;
    choose(m[1], m[2]); root.scrollIntoView({ behavior: still ? 'auto' : 'smooth' });
    if (focus) tabs.find(b => b.dataset.id === m[1]).focus({ preventScroll: true });   // so Tab carries on from the model, not from the card left behind
    return true;
  }
  root.hidden = false;
  // A browser can pair this page with an older style sheet for a few minutes after an update. Without its styles the
  // dials would be solid black shapes, so the section stays away until they arrive.
  if (getComputedStyle(stage).display !== 'grid') { root.hidden = true; return; }
  const nav = document.querySelector('.jump a[href="#lab"]'); if (nav) nav.hidden = false;
  // Tell app.js the models are here, so it can put its "Try it" links on the cards. An older app.js just ignores this.
  document.documentElement.classList.add('has-lab'); document.dispatchEvent(new Event('wbm-lab'));
  addEventListener('hashchange', () => fromHash(true));
  // Following the same link twice doesn't change the address, so it needs opening by hand.
  document.addEventListener('click', e => { const a = e.target.closest && e.target.closest('a[href^="#lab-"]'); if (a && a.getAttribute('href') === location.hash) fromHash(true); });
  if (!fromHash()) choose('sliderule');
})();
