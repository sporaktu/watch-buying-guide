// Masthead dial. Forty-three dials drawn after well-known watch and clock designs; each shows the
// reader's local time. Each page load shows a random dial the visitor has not seen yet, unless they
// have chosen one for the session or pinned one. Randomize picks another unseen one and removes the pin.
//
// A design is built once into a scene: a display list of drawing operations in dial units (a box of 400 by
// 400, origin at the centre, y down), each tagged with the part of the watch it draws. The flat Canvas 2D
// renderer in this file replays the list. The lit renderer in dial3d.js is handed the same scene and makes
// its colour, height and material maps by asking the scene to paint chosen parts.
(function () {
  'use strict';
  const el = document.getElementById('dial'), cap = document.getElementById('dialName');
  if (!el) return;
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const SANS = "Jost,Futura,'Century Gothic',sans-serif", SERIF = "Georgia,'Times New Roman',serif";
  const ROM = ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
  const rad = d => d * Math.PI / 180, f1 = n => +n.toFixed(1);

  // Page parameters. ?dial=N shows design N. ?time=HH:MM or HH:MM:SS freezes the clock at that local time.
  // ?light=x,y or x,y,z fixes the lamp and ?gl=0 keeps the dial flat (both are for the lit renderer).
  // ?debug exposes a few counters as window.__wbmDial for the test tools.
  let query = location.search; try { query = decodeURIComponent(query); } catch (e) {}
  const tm = /[?&]time=(\d\d?):(\d\d)(?::(\d\d))?(?:&|$)/.exec(query), lt = /[?&]light=(-?[\d.]+),(-?[\d.]+)(?:,(-?[\d.]+))?(?:&|$)/.exec(query);
  const frozen = tm && +tm[1] < 24 && +tm[2] < 60 && +(tm[3] || 0) < 60 ? [+tm[1], +tm[2], +(tm[3] || 0)] : null;
  const lamp = lt && lt.slice(1).filter(v => v != null).map(Number), light = lamp && lamp.every(isFinite) ? lamp : null;
  const flatOnly = /[?&]gl=0(?:&|$)/.test(query);
  const dbg = /[?&]debug(?:[=&]|$)/.test(query) ? (window.__wbmDial = { mode: null, frames: 0, light: null, texSize: 0, buildMs: 0 }) : null;
  const clock = () => { const d = new Date(); if (frozen) d.setHours(frozen[0], frozen[1], frozen[2], 0); return d; };

  // Colours
  const STEEL = '#c9ccd1', GOLD = '#c8a04a', ROSE = '#cf9a78', INK = '#17181b', LUME = '#ece8d0', WHITE = '#f7f6f1',
    BLUED = '#1f3f9c', CREAM = '#f1ead8', RED = '#d3311f', NAVY = '#17305f', OLD = '#e3c98e';

  // ---- the display list ----
  // op = { k: 'circle' | 'rect' | 'line' | 'poly' | 'path' | 'text' | 'tex', part, m: [a, b, c, d, e, f], geometry,
  //        fill or stroke and sw, alpha, and for the lit renderer sometimes prof (a hand's shape) and fin (the design's
  //        finish data for the part) }
  // m is the whole transform from the op's own coordinates to the box (or, in a hand, to the hand's own space).
  // An op has a fill or a stroke, never both: a shape drawn with both becomes two ops, because the two are often
  // different parts (lume in its metal surround, a dial and its ink outline). A few ops have neither: an unfilled
  // sub-dial still has a 'sub' op, so the lit renderer can find its shape. 'tex' is a procedural fill inside a clip
  // shape: grid, ribs, snow, sun, or the concentric rings of engine turning.
  //
  // part says what the op is, and the lit renderer picks height, profile and material from it:
  //   outline      ink lines that only make the flat drawing read; left out when lit
  //   case         the case body         bezel       the bezel ring or insert     bezelMark   its numerals, ticks, triangle
  //   bezelPip     the lume pip          screw       a bezel screw                screwSlot   its slot
  //   dial         the dial base         dialTex     a dial texture               print       printed flat: tracks, ticks, numerals, rings
  //   applied      raised metal: markers, or the surround of a lume plot          appliedLume lume set in an applied marker
  //   lume         luminous paint on the dial: plots, numerals, triangles (design 24 cuts them into the dial instead)
  //   window       a date aperture       windowText  the date                     frame       a metal frame round a window
  //   sub          a sub-dial base       subPrint    its ticks and numerals
  //   handBody     a hand                handLume    lume set in a hand           handShade   the flat drawing's dark half of a dauphine hand
  //   cap          the centre cap or a small pinion
  // Which of these a design's markers are is a fact about the watch it is after, set in D: mk.ap for applied metal,
  // mk.lu for luminous, neither for printed. D[i].fin says how each part is finished and shaped when lit (see D).
  const ID = [1, 0, 0, 1, 0, 0];
  const mul = (a, b) => [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1], a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3], a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]];
  const mv = (x, y) => [1, 0, 0, 1, x, y], zoom = k => [k, 0, 0, k, 0, 0];
  const turn = (d, x, y) => { const c = Math.cos(rad(d)), s = Math.sin(rad(d)); x = x || 0; y = y || 0; return [c, s, -s, c, x - c * x + s * y, y - s * x - c * y]; };
  let ops, mat, fin, hands, over, hprof;   // the list being filled, the transform in force, the design's hints, its hands
  const within = (m, fn) => { const s = mat; mat = mul(mat, m); fn(); mat = s; };
  const put = (part, o) => { ops.push(Object.assign({ k: o.k, part, m: mat }, o, part === 'handBody' && hprof ? { prof: hprof } : null, fin[part] ? { fin: fin[part] } : null)); };
  const both = (g, fill, part, stroke, sw, spart) => { put(part, fill ? Object.assign({ fill }, g) : g); if (stroke) put(spart, Object.assign({ stroke, sw }, g)); };
  // A hand's ops point up from the origin in its own units. A renderer scales them, turns them by the clock angle
  // (h, H, m, s or g) or by the fixed one, and moves them to the pivot. Pivot and scale come from the transform in force.
  // at is for the flat drawing alone, which keeps the paint order it always had instead of the hands' real stacking:
  // a hand is painted just before base op number at, or after the whole base when at is the base's length or more.
  const hand = (key, fn, angle, list, last) => {
    const o = ops, m = mat, h = { key, angle: angle || 0, pivot: [m[4], m[5]], scale: m[0], ops: ops = [], hideWhenStill: key === 's', at: o.length + (last ? 1 : 0) };
    mat = ID; fn(); ops = o; mat = m; h.box = bounds(h.ops); (list || hands).push(h);
  };

  // ---- geometry helpers (origin at the dial centre, 12 o'clock is up) ----
  function pos(r, d, c) {
    const s = Math.sin(rad(d)), k = -Math.cos(rad(d));
    if (c.sq) { const t = Math.min(r * c.mx / Math.abs(s || 1e-9), r * c.my / Math.abs(k || 1e-9)); return [f1(s * t), f1(k * t)]; }
    return [f1(r * s), f1(r * k)];
  }
  const ln = (r1, r2, d, w, col, c, part) => { const a = pos(r1, d, c), b = pos(r2, d, c); put(part, { k: 'line', x1: a[0], y1: a[1], x2: b[0], y2: b[1], stroke: col, sw: w }); };
  const num = (t, r, d, size, c, o, part) => { const [x, y] = pos(r, d, c), go = () => put(part, { k: 'text', t: '' + t, x, y, size, wt: o.wt || 500, serif: o.serif ? 1 : 0, fill: o.col }); if (o.radial) within(turn(d, x, y), go); else go(); };
  const dot = (r, d, rr, col, c, part, st, spart) => { const [x, y] = pos(r, d, c); both({ k: 'circle', cx: x, cy: y, r: rr }, col, part, st, 1.5, spart); };
  const tri = (r, s, col, part, st, spart) => both({ k: 'poly', pts: [-s, -(r + s * .8), s, -(r + s * .8), 0, -(r - s * .9)] }, col, part, st, 1.5, spart);
  const bar = (r, d, len, w, col, part, st, spart) => within(turn(d), () => both({ k: 'rect', x: -w / 2, y: -(r + len / 2), w, h: len }, col, part, st, 1.5, spart));

  function shape(sh, inset) {
    const R = 198 - inset;
    if (sh === 'oct') { const pts = []; for (let i = 0; i < 8; i++) pts.push(f1(R * Math.sin(rad(22.5 + i * 45))), f1(-R * Math.cos(rad(22.5 + i * 45)))); return { k: 'poly', pts }; }
    if (sh === 'cushion') return { k: 'rect', x: -R, y: -R, w: 2 * R, h: 2 * R, rx: R * .46 };
    if (sh === 'softoct') return { k: 'rect', x: -R, y: -R * .92, w: 2 * R, h: 2 * R * .92, rx: R * .5 };
    if (sh === 'beaded') {   // a round case with a toothed edge: 56 rounded teeth with sharp valleys between them
      const pts = [], n = 56;
      for (let i = 0; i < n * 8; i++) { const a = i * 45 / n, r = R - 4.5 * (1 - Math.pow(Math.abs(Math.cos(rad(a * n / 2))), .7)); pts.push(f1(r * Math.sin(rad(a))), f1(-r * Math.cos(rad(a)))); }
      return { k: 'poly', pts };
    }
    if (sh === 'rect') return { k: 'rect', x: -138 + inset, y: -194 + inset, w: 276 - 2 * inset, h: 388 - 2 * inset, rx: Math.max(4, 22 - inset) };
    return { k: 'circle', cx: 0, cy: 0, r: R };
  }

  // ---- minute tracks ----
  function track(c) {
    const t = c.tk, col = c.tc || c.mc;
    if (t === 'ticks') for (let i = 0; i < 60; i++) { if (i % 5 || c.tkAll) ln(176, 187, i * 6, i % 5 ? 1.2 : 2.4, col, c, 'print'); }
    if (t === 'dots') for (let i = 0; i < 60; i++) dot(182, i * 6, i % 5 ? 1.6 : 3.2, col, c, 'print');
    if (t === 'rail') {
      const out = r => put('print', Object.assign(c.sq ? { k: 'rect', x: -r * c.mx, y: -r * c.my, w: 2 * r * c.mx, h: 2 * r * c.my } : { k: 'circle', cx: 0, cy: 0, r }, { stroke: col, sw: 1.3 }));
      const a = c.ra || 174, b = c.rb || 187; out(a); out(b);
      for (let i = 0; i < 60; i++) ln(a, b, i * 6, i % 5 ? 1.2 : 3.4, col, c, 'print');
    }
  }

  // ---- hour markers ----
  function marks(c) {
    const m = c.mk, col = c.mc, lu = c.lume || col, st = c.mst;
    // What the markers are: applied metal (a stroke is then only an outline), lume set in applied metal (the stroke
    // is the metal surround), luminous paint, or plain print.
    const P = m.ap ? (m.lu ? 'appliedLume' : 'applied') : (m.lu ? 'lume' : 'print'), SP = m.ap && m.lu ? 'applied' : 'outline';
    const each = fn => { for (let h = 0; h < 12; h++) fn(h, h * 30); };
    const B = (r, d, len, w, f, s) => bar(r, d, len, w, f, P, s, SP), T = (r, s, f, e) => tri(r, s, f, P, e, SP), O = (r, d, rr, f, s) => dot(r, d, rr, f, c, P, s, SP);
    const N = (t, r, d, size, o) => num(t, r, d, size, c, o, P), L = (r1, r2, d, w, part) => ln(r1, r2, d, w, col, c, part || P);
    const ring = (r, f, w) => put('print', { k: 'circle', cx: 0, cy: 0, r, stroke: f, sw: w });
    if (m.minutes) return each((h, d) => N(h ? h * 5 : 60, m.r, d, m.s, { col, wt: 500 }));   // regulator: minute numerals instead of hours
    switch (m.t) {
      case 'baton': each((h, d) => { if (m.dbl && !h) [-.75, .75].forEach(k => within(mv(m.w * k, 0), () => B(m.r || 166, 0, m.len || 34, m.w * .8, col, st))); else if (m.stub && m.stub.includes(h)) B(m.sr, d, m.w * .8, m.w * .8, col, st); else if (c.date !== h) B(m.r || 166, d, m.len || 34, m.w, col, st); }); break;
      case 'block': each((h, d) => L(140, 187, d, 12)); for (let i = 0; i < 60; i++) if (i % 5) L(174, 187, i * 6, 4); break;
      case 'line': each((h, d) => L(146, 187, d, 2.2)); for (let i = 0; i < 60; i++) if (i % 5) L(170, 187, i * 6, 1); break;
      case 'dots': each((h, d) => { if (!h) T(158, 15, lu, st); else if (h % 3) O(158, d, 11.5, lu, st); else if (c.date !== h) B(158, d, 30, 13, lu, st); }); break;
      case 'squares': each((h, d) => { if (!h) T(158, 15, lu, st); else if (h % 3) B(158, d, 21, 21, lu, st); else if (c.date !== h) B(156, d, 32, 15, lu, st); }); break;
      case 'arabic': each((h, d) => { if (!m.only || m.only.includes(h)) N(h || 12, m.r || 150, d, m.s || 34, { col, wt: m.wt, serif: m.serif }); else if (c.sq) L((m.r || 150) - (m.len || 30) / 2, (m.r || 150) + (m.len || 30) / 2, d, m.w || 4); else B(166, d, m.len || 30, m.w || 4, col); }); break;
      // Luminous numerals with a slightly smaller printed numeral laid over each, so the lume shows as a pale rim by day.
      case 'stack': each((h, d) => { num(h || 12, m.r || 146, d, m.s || 40, c, { col: lu, wt: 900 }, 'lume'); num(h || 12, m.r || 146, d, (m.s || 40) * (m.k || .9), c, { col, wt: m.wt || 500 }, 'overPrint'); }); break;
      case 'roman': each((h, d) => { if (!m.only || m.only.includes(h)) N(ROM[h], m.r || 146, d, m.s || 30, { col, serif: 1, radial: 1, wt: 400 }); else B(160, d, m.len || 26, m.w || 4, col); }); break;
      case 'cali': each((h, d) => { if (!h) T(152, 15, lu); else if (h % 3 === 0) B(152, d, 34, 12, lu); else if (h > 3 && h < 9) N(h, 148, d, 36, { col: lu, wt: 500 }); else N(ROM[h], 148, d, 32, { col: lu, serif: 1, radial: 1 }); }); break;
      case 'explorer': each((h, d) => { if (!h) T(156, 16, lu, st); else if (h % 3 === 0) N(h, 150, d, 42, { col: lu, wt: 500 }); else B(158, d, 34, 9, lu, st); }); break;
      case 'fliegerA': each((h, d) => { if (h) return N(h, 140, d, 34, { col: lu, wt: 500 }); T(150, 17, lu); O(160, -9, 4, lu); O(160, 9, 4, lu); }); break;
      case 'fliegerB':
        each((h, d) => { if (!h) T(152, 15, lu); else N(String(h * 5).padStart(2, '0'), 150, d, 27, { col: lu, wt: 500 }); });
        ring(98, lu, 2);
        each((h, d) => N(h || 12, 76, d, 17, { col: lu, wt: 500 })); break;
      case 'sector':
        [187, 152, 92].forEach(r => ring(r, col, 1.4));
        for (let i = 0; i < 60; i++) L(i % 5 ? 170 : 152, 187, i * 6, i % 5 ? 1.2 : 2.4, 'print');
        each((h, d) => { if (h % 2) L(92, 152, d, 1.2, 'print'); else N(h || 12, 122, d, 30, { col, wt: 400 }); }); break;
      case 'museum': put(P, { k: 'circle', cx: 0, cy: -140, r: 19, fill: col }); break;
      case 'field': each((h, d) => { N(h || 12, 142, d, 30, { col: lu, wt: 500 }); N(h ? h + 12 : 24, 100, d, 15, { col: lu, wt: 400 }); within(turn(d), () => T(180, 5, lu)); }); break;
      case 'sandwich': each((h, d) => { if (m.only.includes(h)) N(h || 12, 138, d, 52, { col: lu, wt: 400 }); else if (h % 3) B(150, d, 44, 8, lu); }); break;
    }
  }

  // ---- hands (drawn pointing up from the pivot) ----
  // How a hand's metal is shaped, for the lit renderer: dauphine hands are two facets, leaf and Breguet hands are domed.
  const PROF = { dauphine: 'roof', leaf: 'pillow', breguet: 'pillow' };
  function H(st, L, w, f, o) {
    o = o || {}; const t = o.tail == null ? 18 : o.tail, lu = o.lume, P = lu ? 'handLume' : 'handBody';
    const body = g => both(g, f, 'handBody', o.st, 1.3, 'outline'), solid = g => put('handBody', Object.assign({ fill: f }, g));
    hprof = PROF[st];
    switch (st) {
      case 'baton': body({ k: 'rect', x: -w / 2, y: -L, w, h: L + t }); break;
      case 'block': solid({ k: 'poly', pts: [-w / 2, t + 14, -w * .36, -L, w * .36, -L, w / 2, t + 14] }); break;
      case 'pencil': body({ k: 'poly', pts: [-w / 2, t, -w / 2, -L + w * 1.5, 0, -L, w / 2, -L + w * 1.5, w / 2, t] }); break;
      case 'sword': body({ k: 'poly', pts: [-w * .28, t, -w / 2, -L * .7, 0, -L, w / 2, -L * .7, w * .28, t] }); break;
      case 'dauphine': body({ k: 'poly', pts: [0, t, -w / 2, 0, 0, -L, w / 2, 0] }); put('handShade', { k: 'poly', pts: [0, t, w / 2, 0, 0, -L], fill: '#000', alpha: .2 }); break;
      case 'leaf': body({ k: 'path', d: `M0,${t} C${-w},${-L * .25} ${-w * .55},${-L * .7} 0,${-L} C${w * .55},${-L * .7} ${w},${-L * .25} 0,${t}Z` }); break;
      case 'breguet': { const cy = -L * .7, r = w * 1.5; put('handBody', { k: 'line', x1: 0, y1: t, x2: 0, y2: cy + r, stroke: f, sw: w * .62 }); put('handBody', { k: 'circle', cx: 0, cy, r, stroke: f, sw: w * .6 }); solid({ k: 'poly', pts: [-w * .34, cy - r, 0, -L, w * .34, cy - r] }); break; }
      case 'mercedes': { const cy = -L * .66, r = w * 1.2; solid({ k: 'rect', x: -w * .3, y: cy + r, w: w * .6, h: t - cy - r }); both({ k: 'circle', cx: 0, cy, r }, lu || f, P, f, w * .32, 'handBody'); both({ k: 'poly', pts: [-w * .5, cy - r, 0, -L, w * .5, cy - r] }, lu || f, P, f, 2, 'handBody'); break; }
      case 'snow': { const cy = -L * .7, r = w * 1.25; solid({ k: 'rect', x: -w * .34, y: cy, w: w * .68, h: t - cy }); within(turn(45, 0, cy), () => both({ k: 'rect', x: -r, y: cy - r, w: 2 * r, h: 2 * r }, lu || f, P, f, 2.5, 'handBody')); break; }
      case 'syringe': body({ k: 'rect', x: -w / 2, y: -L * .78, w, h: L * .78 + t }); solid({ k: 'rect', x: -w * .12, y: -L, w: w * .24, h: L * .24 }); break;
      case 'arrow': solid({ k: 'rect', x: -w * .24, y: -L * .7, w: w * .48, h: L * .7 + t }); solid({ k: 'poly', pts: [-w, -L * .68, 0, -L, w, -L * .68] }); break;
    }
    if (lu && /baton|pencil|sword|syringe|block/.test(st)) put('handLume', { k: 'rect', x: -w * .22, y: -L * .88, w: w * .44, h: L * .62, fill: lu });
    hprof = null;
  }
  function S(st, L, f, o) {
    o = o || {};
    const stem = (y1, y2, sw) => put('handBody', { k: 'line', x1: 0, y1, x2: 0, y2, stroke: f, sw }), disc = (cy, r) => put('handBody', { k: 'circle', cx: 0, cy, r, fill: f });
    if (st === 'disc') { stem(46, -L * .76, 3.4); return disc(-L * .76, 13.5); }
    if (st === 'needle') { if (o.tail) put('handBody', { k: 'line', x1: 0, y1: L * .22, x2: 0, y2: 0, stroke: o.tail, sw: o.w || 2 }); stem(o.tail ? 0 : L * .22, -L, o.w || 2); return disc(0, o.pin || 3); }   // tail: a counterweight in another colour
    stem(42, -L, 1.8);
    if (st === 'lolli') both({ k: 'circle', cx: 0, cy: -L * .68, r: 7.5 }, o.lume || f, o.lume ? 'handLume' : 'handBody', f, 2, 'handBody');
    if (st === 'counter') disc(30, 7);
    disc(0, 4.2);
  }

  // ---- extras: date windows, registers, bezel furniture ----
  function sub(x, y, r, o) {
    within(mv(x, y), () => {
      both({ k: 'circle', cx: 0, cy: 0, r }, o.f, 'sub', o.st, 1.3, 'subPrint');
      const n = o.n || 12, c = {};
      for (let i = 0; i < n; i++) ln(r * (i % (o.maj || 3) ? .84 : o.tl || .72), r * .96, i * 360 / n, i % (o.maj || 3) ? 1 : 1.8, o.tc, c, 'subPrint');
      (o.nums || []).forEach(([t, d]) => num(t, r * (o.nr || .52), d, r * (o.ns || .3), c, { col: o.tc, wt: 500, serif: o.serif }, 'subPrint'));
      if (o.hand != null) hand(null, () => S('needle', r * .8, o.hc || o.tc), o.hand);
    });
  }
  function extras(c, now) {
    (c.x || []).forEach(e => {
      const k = e[0];
      if (k === 'date') { const [x, y] = pos(e[2] || 132, e[1] * 30, c), [w, h, size] = e[6] || [38, 28, 22]; both({ k: 'rect', x: x - w / 2, y: y - h / 2, w, h }, e[3] || WHITE, 'window', e[5], 1.5, 'frame'); put('windowText', { k: 'text', t: '' + now.getDate(), x, y, size, wt: 600, serif: 0, fill: e[4] || INK }); }
      if (k === 'rule') {   // the fixed scale of a slide rule round the edge of the dial, and inside it the minute track: colour, red
        logScale(189.5, -1, [3, 4.5, 6.5], 172, 13, [2.6, 6.5], e[1], e[2], 'print', v => v === 60 ? null : v <= 25 || (v < 60 && v % 5 === 0) ? v : v % 10 ? null : v / 10, [10, 33, 36, 33 * 1.15078, 33 * 1.852]);   // 10, nautical miles, the seconds in an hour, miles and kilometres
        put('print', { k: 'poly', pts: [-5.5, -159.5, -1.7, -168, 0, -189.5, 1.7, -168, 5.5, -159.5], fill: e[1] });   // the speed arrow at 60
        put('print', { k: 'circle', cx: 0, cy: 0, r: 159, stroke: e[1], sw: 1 });
        for (let i = 0; i < 60; i++) ln(i % 5 ? 154 : 152, 159, i * 6, i % 5 ? 1 : 1.8, e[1], c, 'print');
      }
      if (k === 'sub') sub(e[1], e[2], e[3], e[4]);
      if (k === 'bigdate') { const d = String(now.getDate()).padStart(2, '0'); [0, 1].forEach(i => { both({ k: 'rect', x: e[1] + i * 32, y: e[2], w: 30, h: 40 }, WHITE, 'window', e[3], 2.2, 'frame'); put('windowText', { k: 'text', t: d[i], x: e[1] + i * 32 + 15, y: e[2] + 21, size: 30, wt: 400, serif: 1, fill: INK }); }); }
      if (k === 'pr') { // power-reserve arc: x, y, r, from, to, colour, hand angle
        const a = pos(e[3], e[4], {}), b = pos(e[3], e[5], {});
        within(mv(e[1], e[2]), () => {
          put('print', { k: 'path', d: `M${a[0]},${a[1]} A${e[3]},${e[3]} 0 0 1 ${b[0]},${b[1]}`, stroke: e[6], sw: 2 });
          for (let d = e[4]; d <= e[5]; d += (e[5] - e[4]) / 4) ln(e[3] - 7, e[3], d, 1.6, e[6], {}, 'print');
          hand(null, () => S('needle', e[3] - 4, e[8] || e[6], { w: 2.4 }), e[7]);
        });
      }
      if (k === 'needle') hand(null, () => S('needle', e[2] || 176, e[1], { w: 1.8, pin: 5, tail: e[3] }), 0, over);   // a stopped chronograph hand: above the other hands
      if (k === 'ring') put('print', { k: 'circle', cx: 0, cy: 0, r: e[1], stroke: e[2], sw: e[3] || 1.3 });
      if (k === 'guilloche') put('dialTex', { k: 'tex', tex: 'rings', from: 8, to: e[1], pitch: 6, stroke: e[2], sw: 1, alpha: .5, clip: { k: 'circle', cx: 0, cy: 0, r: e[1] } });
    });
  }
  // A slide rule's scale: one turn for each factor of ten, with 60 at 12 o'clock, as lab.js draws it. Half units up to 20
  // and whole units after that. Ticks run from r, outward if out is 1 and inward if it is -1; len is the length of a
  // half-unit tick, a whole one and a numbered one. label(v) gives the numeral at v, if it has one. The numbers in
  // reds are red, with an arrow in place of the tick; one with no numeral is an arrow alone. tri is an arrow's half
  // width and length.
  const logAt = v => 360 * (Math.log10(v) - Math.log10(60));
  function logScale(r, out, len, numR, size, tri, fg, red, part, label, reds) {
    const arrow = (v, col) => within(turn(logAt(v)), () => put(part, { k: 'poly', pts: [-tri[0], -(r + out * tri[1]), tri[0], -(r + out * tri[1]), 0, -r], fill: col }));
    for (let i = 20; i < 200; i++) {
      const v = i / 2; if (v >= 20 && i % 2) continue;
      const whole = !(i % 2), t = whole ? label(v) : null, d = logAt(v), hot = reds.includes(v);
      if (!hot) ln(r, r + out * len[t != null || (whole && v % 5 === 0) ? 2 : whole ? 1 : 0], d, t != null ? 1.3 : 1, fg, {}, part);
      if (t != null) num(t, numR, d, size, {}, { col: hot ? red : fg, radial: 1, wt: 600 }, part);
    }
    reds.forEach(v => arrow(v, red));
  }
  function bezel(c) {
    const b = c.bz; if (!b) return;
    const Ro = b.ro || 195, Ri = c.Rd + 1, R = (Ro + Ri) / 2, w = Ro - Ri, cc = {}, M = 'bezelMark';
    if (b.t === 'gmt') {
      put('bezel', { k: 'path', d: `M${-R},0 A${R},${R} 0 0 1 ${R},0`, stroke: b.a, sw: w }); put('bezel', { k: 'path', d: `M${R},0 A${R},${R} 0 0 1 ${-R},0`, stroke: b.b, sw: w });
      for (let i = 0; i < 24; i++) { if (!i) tri(R, 9, b.fg, M); else if (i % 2) dot(R, i * 15, 2.6, b.fg, cc, M); else num(i, R, i * 15, 19, cc, { col: b.fg, radial: 1, wt: 600 }, M); }
      return;
    }
    put('bezel', { k: 'circle', cx: 0, cy: 0, r: R, stroke: b.f, sw: w });
    if (b.t === 'rule') {   // the turning ring of a slide rule, set with its 10 against the 10 of the fixed scale on the dial
      put('outline', { k: 'circle', cx: 0, cy: 0, r: Ro, stroke: INK, sw: 1.2 });
      logScale(Ri, 1, [2.5, 3.5, 5], R + 2.5, 13, [2.2, 5], b.fg, b.red, M, v => v <= 25 || v % 5 === 0 ? v : null, [10, 60, 36]);   // 36: the seconds in an hour
    }
    if (b.t === 'dive') {
      for (let i = 0; i < 60; i++) { if (!i) { tri(R, 11, b.fg, M); dot(R + 2, 0, 3.5, b.lume || b.fg, cc, 'bezelPip'); } else if (i % 10 === 0) num(i, R, i * 6, 21, cc, { col: b.fg, radial: 1, wt: 600 }, M); else if (i % 5 === 0) ln(R - 9, R + 9, i * 6, 4, b.fg, cc, M); else if (i < 15) ln(R - 5, R + 5, i * 6, 1.6, b.fg, cc, M); }
    }
    if (b.t === 'tachy') {
      for (let d = 6; d < 360; d += 6) ln(Ri + 2, Ri + (d % 30 ? 7 : 11), d, 1.3, b.fg, cc, M);
      [[400, 54], [300, 72], [240, 90], [180, 120], [150, 144], [120, 180], [100, 216], [90, 240], [80, 270], [70, 308.6], [60, 360]].forEach(([n, d]) => num(n, R + 4, d, 13, cc, { col: b.fg, radial: 1, wt: 600 }, M));
    }
    if (b.screws) for (let i = 0; i < 8; i++) { const [x, y] = pos(R, 22.5 + i * 45, cc); both({ k: 'circle', cx: x, cy: y, r: 8.5 }, b.sf || '#e6e8ea', 'screw', INK, 1, 'outline'); within(turn(i * 45 + 20, x, y), () => put('screwSlot', { k: 'line', x1: x - 6, y1: y, x2: x + 6, y2: y, stroke: INK, sw: 1.6 })); }
  }
  // Dial textures. Each is one 'tex' op holding its numbers, so the lit renderer can make the same thing in relief.
  function pattern(c, clip) {
    const p = c.pat; if (!p) return;
    const t = { k: 'tex', tex: p[0], clip };
    if (p[0] === 'sun') Object.assign(t, { a: p[1], b: p[2], cx: -60, cy: -80, r: 340 });                     // a sunray dial, drawn as a soft highlight
    if (p[0] === 'grid') Object.assign(t, { a: p[1], b: p[2], pitch: 15, off: 1.5, size: 11 });                  // raised squares
    if (p[0] === 'ribs') Object.assign(t, { a: p[1], b: p[2], pitch: 22, off: 19, size: 3, shade: .28 });       // horizontal grooves on a graded dial
    if (p[0] === 'snow') Object.assign(t, { rgb: [196, 200, 209], alpha: .55, f: [.035, .09], oct: 3, seed: 7 }); // drifted snow: fractal noise
    put('dialTex', t);
  }

  // ---- the forty-three dials, newest first: a new design goes at the top of D ----
  // (A visitor's pinned and seen dials are remembered by name, so adding one at the top disturbs nothing.)
  // case: cs shape, cf fill. Rd dial radius. face, mc marker colour, lume. tk track. mk markers.
  // bz bezel: t 'dive', 'gmt', 'tachy' or 'rule' (a slide rule's turning ring; the fixed scale is the 'rule' entry in x).
  // hd hands [style, fill, hourLen, minLen, hourW, minW, opts]. sc seconds [style, colour, len] or sub-seconds {at,r,..}.
  // mk.ap: the markers are applied metal. mk.lu: they are luminous (with ap, lume set in a metal surround). Neither: printed.
  // fin: how the parts are finished and shaped when lit, { part: finish } or { part: { mat, edge, ew, prof, h, w, z, on, col, c } }.
  //   A finish is 'polish', 'brush', 'satin', 'blast', 'metallic', 'sunray', 'ceramic', 'gloss', 'lacquer', 'matte',
  //   'grained' or 'lume', and a brushed one may name its direction: 'brush 0' runs 12 to 6, 'brush 90' runs 9 to 3
  //   (degrees clockwise), 'brush circular' runs round the centre, 'brush radial' runs out from it.
  //   mat is the finish; edge is a second finish for the zone within ew dial units of the part's edge (a polished
  //   chamfer on a brushed top). prof, h, w shape the part: 'flat', 'chamfer', 'roof', 'pillow' or 'soft', rising h
  //   over w units from its edge. z is its height, col a colour used only when lit. Anything left out, a whole
  //   part or one field of it, keeps the default for the part's tag, which dial3d.js lists with the finishes.
  const D = [
    { n: 'Stacked lume numerals', fin: { case: 'brush circular', dial: 'lacquer', handBody: 'matte', cap: 'matte' }, a: 'after the Farer Resolute', cf: '#c4c7cb', face: '#f6f7f6', mc: '#101114', lume: '#8fd3ee', tk: 'ticks', tc: '#101114', tkAll: 1, mk: { t: 'stack', s: 44, r: 144, k: .86 }, hd: ['pencil', '#101114', 100, 160, 13, 10, { lume: '#8fd3ee', tail: 12 }], sc: ['counter', '#f26a1b', 170] },
    { n: 'Opaline GMT', fin: { case: { mat: 'brush circular', edge: 'polish', ew: 2 }, bezel: 'matte', dial: 'grained', handBody: 'matte' }, a: 'after the Tudor Black Bay GMT', Rd: 150, bz: { t: 'gmt', a: '#1d3466', b: '#8e1f2c', fg: '#f1f1ec' }, face: '#ecebe5', mc: '#f6f6f0', lume: '#f6f6f0', mst: '#17181b', tk: 'ticks', tc: '#17181b', date: 3, mk: { t: 'dots', lu: 1 }, hd: ['snow', '#17181b', 104, 162, 17, 13, { lume: '#f6f6f0' }], sc: ['lolli', '#17181b', 170, { lume: '#f6f6f0' }], gmt: RED, x: [['date', 3, 142, WHITE, INK]] },
    { n: 'Turquoise chronograph', fin: { case: { mat: 'brush circular', edge: 'polish', ew: 2 }, bezel: 'matte', dial: 'matte', handBody: 'polish' }, a: 'after the Tudor Black Bay Chrono', Rd: 158, bz: { t: 'tachy', f: '#101113', fg: '#e8e8e4' }, face: '#63cfd3', mc: '#f6f6f0', lume: '#f6f6f0', mst: '#d8d9da', tk: 'ticks', tc: '#17181b', tkAll: 1, date: 6, mk: { t: 'dots', ap: 1, lu: 1 }, hd: ['snow', '#e4e6e8', 100, 154, 16, 12, { lume: '#f6f6f0' }], sc: { at: [-84, 0], r: 40, col: '#f3f1ea', tc: '#f3f1ea', f: '#141517', n: 12 }, x: [['sub', 84, 0, 40, { f: '#141517', tc: '#f3f1ea', n: 30, maj: 5, hand: 0 }], ['date', 6, 138, WHITE, INK], ['needle', '#e4e6e8', 172]], pin: '#e4e6e8' },
    { n: 'Green square', fin: { case: { mat: 'brush 0', edge: 'polish', ew: 3 }, dial: 'sunray', handBody: 'polish' }, a: 'after the Trafford Crossroads', cs: 'cushion', ds: 'cushion', cf: '#c6c9cd', Rd: 168, face: '#1f5a3c', mc: '#f3f2ea', tk: 'ticks', tc: '#f3f2ea', tkAll: 1, mk: { t: 'arabic', s: 40, r: 140, wt: 600 }, hd: ['pencil', ROSE, 96, 150, 12, 9, { lume: '#f3f2ea', tail: 10 }], sc: ['thin', '#d8dadc', 166], pin: ROSE },
    { n: 'Ribbed white dial, blue batons', fin: { case: { mat: 'brush 0', edge: 'polish', ew: 3 }, bezel: 'brush circular', dial: 'lacquer' }, a: 'after the Formex Essence', Rd: 156, bz: { f: '#cdd0d4', screws: 1 }, face: '#f2f3f3', pat: ['ribs', '#dfe2e4', '#ffffff'], mc: '#2b50c4', mst: '#2b50c4', tk: 'ticks', tc: '#3a3c40', date: 6, mk: { t: 'baton', w: 10, len: 36, dbl: 1, r: 160, ap: 1 }, hd: ['baton', '#2b50c4', 100, 156, 11, 9, { tail: 12 }], sc: ['thin', '#2b50c4', 168], x: [['date', 6, 140, WHITE, '#2b50c4']] },
    { n: 'Ivory flight numerals', fin: { case: { mat: 'brush circular', edge: 'polish', ew: 2 }, dial: 'grained' }, a: 'after the Longines Spirit', face: '#ebe7d8', mc: '#3a3b3e', tk: 'rail', tc: '#3a3b3e', mk: { t: 'arabic', s: 36, r: 138, wt: 500, only: [0, 1, 2, 4, 5, 6, 7, 8, 9, 10, 11], len: 8, w: 4 }, hd: ['sword', '#b9bcc1', 98, 158, 18, 14, { lume: '#f1efe2', st: '#4a4c50' }], sc: ['thin', RED, 170], x: [['date', 3, 132, WHITE, INK]], pin: '#d9dbde' },
    { n: 'Ice-blue sunray', fin: { case: { mat: 'brush circular', edge: 'polish', ew: 3 }, dial: 'sunray' }, a: 'after the Tissot Gentleman', face: '#9fd6da', mc: '#c9ccd1', mst: '#5d646b', tk: 'ticks', tc: '#2c3a40', date: 3, mk: { t: 'baton', w: 8, len: 38, dbl: 1, r: 160, ap: 1 }, hd: ['baton', '#c9ccd1', 100, 158, 11, 8, { st: '#5d646b', tail: 12 }], sc: ['thin', '#5d646b', 170], x: [['date', 3, 146, WHITE, INK]] },
    { n: 'Blue dial, screwed bezel', fin: { case: { mat: 'brush 0', edge: 'polish', ew: 3 }, bezel: 'brush circular', dial: 'sunray' }, a: 'after the Baume & Mercier Riviera', Rd: 150, bz: { f: '#cfd2d6', screws: 1 }, face: '#1b3a8c', mc: '#eef0f4', mst: '#c9ccd1', tk: 'ticks', tc: '#dfe3ea', date: 3, mk: { t: 'roman', s: 44, r: 140, only: [0], w: 7, len: 36 }, hd: ['sword', '#eceef0', 98, 158, 14, 11, { lume: '#f4f4ee', st: '#9aa0a8' }], sc: ['thin', '#eceef0', 168], x: [['date', 3, 146, '#f4f4ee', INK]] },
    { n: 'Pastel blue diver', fin: { case: { mat: 'brush circular', edge: 'polish', ew: 3 }, dial: 'matte', handBody: 'matte', cap: 'matte' }, a: 'after the Halios Seaforth', cf: '#b9bcc0', face: '#a3d7e8', mc: '#f6f6f0', lume: '#f6f6f0', mst: '#17181b', tk: 'ticks', tc: '#17181b', tkAll: 1, mk: { t: 'baton', w: 11, len: 34, dbl: 1, r: 156, lu: 1 }, hd: ['pencil', '#17181b', 98, 158, 13, 10, { lume: '#f6f6f0', tail: 12 }], sc: ['lolli', '#17181b', 170, { lume: '#f6f6f0' }] },
    { n: 'Champagne diver', fin: { case: { mat: 'brush circular', edge: 'polish', ew: 2 }, bezel: 'ceramic', dial: 'sunray' }, a: 'after the Mido Ocean Star', Rd: 150, bz: { t: 'dive', f: '#131314', fg: '#d9b869', lume: LUME }, face: '#e2cd97', mc: LUME, lume: LUME, mst: '#c8a04a', tk: 'ticks', tc: '#4a3d1c', date: 3, mk: { t: 'dots', ap: 1, lu: 1 }, hd: ['pencil', '#c8a04a', 100, 160, 15, 12, { lume: LUME, tail: 12 }], sc: ['lolli', '#c8a04a', 170, { lume: LUME }], x: [['date', 3, 142, WHITE, INK]] },
    { n: 'White expedition dial', fin: { case: 'brush circular', bezel: 'brush circular', dial: 'matte', handBody: 'matte', cap: 'matte' }, a: 'after the Hamilton Khaki Field Expedition', Rd: 152, bz: { f: '#cdd0d4' }, face: '#f5f5f1', mc: '#131416', lume: '#d9c08c', tk: 'ticks', tc: '#131416', tkAll: 1, mk: { t: 'arabic', s: 42, r: 138, wt: 700 }, hd: ['syringe', '#131416', 96, 156, 14, 11, { lume: '#d9c08c', tail: 10 }], sc: ['thin', '#131416', 168] },
    { n: 'Titanium diver, turquoise lume', fin: { case: 'blast', bezel: 'matte', dial: 'matte', handBody: 'satin' }, a: 'after the Certina DS Action Diver', cf: '#8f918e', Rd: 150, bz: { t: 'dive', f: '#2b2d2e', fg: '#e3e4e0', lume: '#7fe3da' }, face: '#121315', mc: '#7fe3da', lume: '#7fe3da', mst: '#aeb0ad', tk: 'ticks', tc: '#e3e4e0', date: 3, mk: { t: 'dots', ap: 1, lu: 1 }, hd: ['sword', '#c5c7c4', 100, 160, 20, 15, { lume: '#7fe3da' }], sc: ['lolli', '#c5c7c4', 170, { lume: '#7fe3da' }], x: [['date', 3, 142, WHITE, INK]] },
    { n: 'Slide-rule chronograph', a: 'after the Breitling Navitimer', cs: 'beaded', Rd: 154, bz: { t: 'rule', ro: 181, f: '#141517', fg: '#f1f1ec', red: RED }, face: '#234a68', pat: ['sun', '#3f6d8f', '#234a68'], mc: '#f0f0ec', mst: '#d3d6da', mk: { t: 'baton', w: 9.5, len: 30, r: 137, dbl: 1, ap: 1, lu: 1, stub: [3, 6, 9], sr: 158 }, hd: ['pencil', '#e4e6e8', 105, 150, 13, 11, { lume: '#f0f0ec', tail: 19 }], sc: { at: [-95, 0], r: 56, col: '#dfe0e2', tc: '#f1f1ec', f: '#141517', n: 12, maj: 4, nums: [['60', 0], ['20', 120], ['40', 240]], ns: .26, nr: .58, tl: .8 },
      x: [['rule', '#f1f1ec', RED], ['sub', 95, 0, 56, { f: '#141517', tc: '#f1f1ec', hc: '#dfe0e2', n: 30, maj: 5, nums: [['30', 0], ['10', 120], ['20', 240]], ns: .26, nr: .58, tl: .8, hand: 0 }], ['sub', 0, 95, 56, { f: '#141517', tc: '#f1f1ec', hc: '#dfe0e2', n: 12, nums: [['12', 0], ['3', 90], ['9', 270]], ns: .26, nr: .58, tl: .8, hand: 0 }], ['date', 6, 131, '#1f2022', '#f1f1ec', null, [28, 30, 18]], ['needle', RED, 176, '#dfe0e2']], pin: '#d9dbde', capR: 9,
      fin: { case: { mat: 'polish', h: 3, w: 8 }, bezel: { mat: 'matte', z: 1.2, prof: 'flat', glass: 1 }, bezelMark: { z: 0 }, dial: 'sunray', sub: { mat: 'matte' }, applied: 'polish', handBody: 'polish', cap: 'polish' } },
    { n: 'Blued hands, gold indices', a: 'the house dial', face: '#f8f6ef', mc: GOLD, tk: 'ticks', mk: { t: 'baton', w: 6, len: 36, dbl: 1, ap: 1 }, hd: ['leaf', BLUED, 108, 160, 13, 10], sc: ['counter', BLUED, 172],
      fin: { case: 'polish', dial: 'grained', print: { mat: 'matte', col: '#a88a47' }, applied: { mat: 'polish', prof: 'roof', h: 1.5 }, handBody: 'polish', cap: 'polish' } },
    { n: 'Railway station clock', fin: { case: 'brush circular', dial: 'matte', handBody: 'matte', cap: 'matte' }, a: 'after Hans Hilfiker’s Swiss railway clock', cf: '#d9dadc', face: WHITE, mc: INK, mk: { t: 'block' }, hd: ['block', INK, 112, 168, 15, 12], sc: ['disc', RED, 172], pin: INK },
    { n: 'Bauhaus line dial', fin: { dial: 'grained' }, a: 'after Max Bill’s 1961 wristwatch', face: '#f4f3ee', mc: INK, mk: { t: 'line' }, hd: ['baton', INK, 104, 162, 4.5, 3.2, { tail: 0 }], sc: ['thin', INK, 176], x: [['date', 3, 128, '#f4f3ee', INK]] },
    { n: 'Glashütte numerals', fin: { dial: 'grained' }, a: 'after the Nomos Tangente', face: '#f6f5f0', mc: INK, tk: 'ticks', tc: INK, mk: { t: 'arabic', only: [0, 2, 4, 8, 10], s: 30, r: 148, wt: 400, w: 2.4, len: 34 }, hd: ['baton', BLUED, 100, 156, 5, 4, { tail: 0 }], sc: { at: [0, 88], r: 38, col: BLUED, tc: INK, n: 12 }, pin: BLUED },
    { n: 'Museum dial', fin: { dial: 'gloss' }, a: 'after Nathan George Horwitt', cf: GOLD, face: '#121214', mc: GOLD, mk: { t: 'museum', ap: 1 }, hd: ['dauphine', GOLD, 104, 154, 15, 12], sc: null, pin: GOLD },
    { n: 'Pilot’s watch, type A', fin: { case: 'blast', dial: 'matte' }, a: 'after the 1940s German observation watches', cf: '#9da1a6', face: '#16171a', mc: LUME, lume: LUME, tk: 'ticks', tkAll: 1, mk: { t: 'fliegerA', lu: 1 }, hd: ['sword', '#2a4a8a', 100, 164, 20, 15, { lume: LUME }], sc: ['thin', LUME, 172] },
    { n: 'Pilot’s watch, type B', fin: { case: 'blast', dial: 'matte' }, a: 'after the 1941 navigator’s dial', cf: '#9da1a6', face: '#16171a', mc: LUME, lume: LUME, tk: 'ticks', tkAll: 1, mk: { t: 'fliegerB', lu: 1 }, hd: ['sword', '#2a4a8a', 84, 164, 20, 15, { lume: LUME }], sc: ['thin', LUME, 172] },
    { n: 'Black dive watch', a: 'after the Rolex Submariner', Rd: 150, bz: { t: 'dive', f: '#111214', fg: '#e8e8e4', lume: LUME }, face: '#111214', mc: LUME, lume: LUME, mst: '#d8d9da', tk: 'ticks', tc: '#e8e8e4', date: 3, mk: { t: 'dots', ap: 1, lu: 1 }, hd: ['mercedes', '#dfe0e2', 100, 162, 17, 13, { lume: LUME }], sc: ['lolli', '#dfe0e2', 170, { lume: LUME }], x: [['date', 3, 142, WHITE, INK]],
      fin: { case: 'polish', bezel: { mat: 'ceramic', prof: 'chamfer', h: .8, w: 2 }, bezelMark: { mat: 'blast', z: -.5, col: '#b9bbbd' }, bezelPip: { col: '#f3f3ee' }, dial: 'gloss', print: 'matte', applied: 'polish', appliedLume: { col: '#f3f3ee' }, handBody: 'polish', handLume: { col: '#f3f3ee' }, cap: 'polish' } },
    { n: 'Snowflake diver', fin: { case: { mat: 'brush circular', edge: 'polish', ew: 2 }, bezel: 'satin circular', dial: 'matte' }, a: 'after the Tudor Submariner of 1969', Rd: 150, bz: { t: 'dive', f: NAVY, fg: '#e8e8e4', lume: LUME }, face: NAVY, mc: LUME, lume: LUME, mst: '#d8d9da', tk: 'ticks', tc: '#e8e8e4', mk: { t: 'squares', ap: 1, lu: 1 }, hd: ['snow', '#dfe0e2', 104, 162, 17, 13, { lume: LUME }], sc: ['lolli', '#dfe0e2', 170, { lume: LUME }] },
    { n: 'Expedition 3-6-9', fin: { dial: 'gloss' }, a: 'after the Rolex Explorer', face: '#131416', mc: LUME, lume: LUME, mst: '#d8d9da', tk: 'ticks', tc: '#e8e8e4', mk: { t: 'explorer', ap: 1, lu: 1 }, hd: ['mercedes', '#dfe0e2', 100, 164, 17, 13, { lume: LUME }], sc: ['lolli', '#dfe0e2', 172, { lume: LUME }] },
    { n: 'California dial', fin: { dial: 'gloss' }, a: 'after the 1940s half-Roman, half-Arabic dials', cs: 'cushion', Rd: 164, face: '#1a1a1a', mc: OLD, lume: OLD, tk: 'rail', tc: OLD, ra: 178, rb: 188, mk: { t: 'cali', lu: 1 }, hd: ['pencil', GOLD, 96, 156, 16, 13, { lume: OLD }], sc: null, pin: GOLD },
    { n: 'Sector dial', fin: { dial: 'grained' }, a: 'after the scientific dials of the 1930s', face: '#e9e4d6', mc: '#2a2a2c', mk: { t: 'sector' }, hd: ['leaf', BLUED, 100, 162, 12, 9], sc: ['counter', BLUED, 176] },
    { n: 'Rectangular Roman', fin: { dial: 'grained' }, a: 'after the Cartier Tank', cs: 'rect', cf: GOLD, sq: 1, mx: .64, my: .93, face: '#f6f4ec', mc: INK, tk: 'rail', tc: INK, ra: 96, rb: 112, mk: { t: 'roman', r: 150, s: 30 }, hd: ['sword', BLUED, 62, 92, 12, 10, { tail: 6 }], sc: null, pin: BLUED },
    { n: 'Moon chronograph', fin: { case: { mat: 'brush circular', edge: 'polish', ew: 2 }, bezel: 'satin circular', dial: 'matte', handBody: 'matte', cap: 'matte' }, a: 'after the Omega Speedmaster', Rd: 158, bz: { t: 'tachy', f: '#101113', fg: '#e8e8e4' }, face: '#141517', mc: '#efefe8', tk: 'ticks', tc: '#efefe8', tkAll: 1, mk: { t: 'baton', w: 5, len: 26, r: 158, lu: 1 }, hd: ['baton', '#f2f2ec', 100, 156, 8, 6, { tail: 10 }], sc: { at: [-84, 0], r: 38, col: '#f2f2ec', tc: '#efefe8', n: 12 }, x: [['sub', 84, 0, 38, { tc: '#efefe8', n: 30, maj: 5, hand: 0 }], ['sub', 0, 84, 38, { tc: '#efefe8', n: 12, hand: 0 }], ['needle', '#f2f2ec', 172]], pin: '#f2f2ec' },
    { n: 'Panda chronograph', fin: { bezel: 'satin circular', dial: 'matte', handBody: 'matte', cap: 'matte' }, a: 'after the 1960s racing chronographs', Rd: 158, bz: { t: 'tachy', f: '#101113', fg: '#e8e8e4' }, face: '#f3f1ea', mc: INK, tk: 'ticks', tc: INK, tkAll: 1, mk: { t: 'baton', w: 6, len: 22, r: 160 }, hd: ['baton', INK, 100, 154, 8, 6, { tail: 10 }], sc: { at: [-84, 0], r: 40, col: '#f3f1ea', tc: '#f3f1ea', f: '#141517', n: 12 }, x: [['sub', 84, 0, 40, { f: '#141517', tc: '#f3f1ea', n: 30, maj: 5, hand: 0 }], ['sub', 0, 84, 40, { f: '#141517', tc: '#f3f1ea', n: 12, hand: 0 }], ['needle', RED, 172]], pin: INK },
    { n: 'Octagon and tapisserie', a: 'after Gérald Genta’s Royal Oak', cs: 'oct', Rd: 146, bz: { f: '#d3d6da', screws: 1 }, face: '#1d3b6e', pat: ['grid', '#16305c', '#274a85'], mc: '#f0f0ec', mst: '#c9ccd1', tk: 'ticks', tc: '#dfe3ea', date: 3, mk: { t: 'baton', w: 9, len: 38, dbl: 1, r: 158, ap: 1, lu: 1 }, hd: ['baton', '#eceef0', 100, 156, 12, 10, { st: '#9aa0a8', tail: 12 }], sc: ['thin', '#eceef0', 168], x: [['date', 3, 150, '#16305c', '#f0f0ec']],
      fin: { case: { mat: 'brush 0', edge: 'polish', ew: 2 }, bezel: { mat: 'brush 0', edge: 'polish', ew: 5, prof: 'chamfer', h: 2.2, w: 5 }, screw: 'polish', dial: 'metallic', print: 'matte', applied: 'polish', handBody: 'polish', cap: 'polish' } },
    { n: 'Porthole', fin: { case: { mat: 'brush 0', edge: 'polish', ew: 3 }, dial: 'sunray' }, a: 'after Gérald Genta’s Nautilus', cs: 'softoct', Rd: 160, ds: 'softoct', face: '#1f3f66', pat: ['ribs', '#2d5d8e', '#0f2238'], mc: '#f0f0ec', mst: '#c9ccd1', date: 3, mk: { t: 'baton', w: 10, len: 36, r: 150, ap: 1, lu: 1 }, hd: ['baton', '#eceef0', 96, 150, 13, 11, { st: '#9aa0a8', tail: 10 }], sc: ['thin', '#eceef0', 160], x: [['date', 3, 142, WHITE, INK]] },
    { n: 'Field watch', fin: { dial: 'matte', handBody: 'matte' }, a: 'after the US A-11 of the 1940s', cf: '#8f9296', face: '#17181a', mc: LUME, lume: LUME, tk: 'ticks', tkAll: 1, mk: { t: 'field', lu: 1 }, hd: ['syringe', '#f0efe6', 96, 160, 11, 9, { tail: 10 }], sc: ['thin', '#f0efe6', 172] },
    { n: 'Military small seconds', fin: { case: 'blast', dial: 'matte', sub: { mat: 'satin circular', c: [0, 82] } }, a: 'after the British “Dirty Dozen” of 1945', cf: '#8f9296', face: '#151618', mc: LUME, lume: LUME, tk: 'rail', tc: LUME, mk: { t: 'arabic', s: 36, r: 142, only: [0, 1, 2, 3, 4, 5, 7, 8, 9, 10, 11], w: 0, len: 0, lu: 1 }, hd: ['pencil', '#f0efe6', 92, 150, 14, 11, { lume: LUME }], sc: { at: [0, 84], r: 42, col: '#f0efe6', tc: LUME, n: 12, rail: 1 }, pin: '#f0efe6' },
    { n: 'Marine chronometer', fin: { dial: 'grained' }, a: 'after 19th-century ship’s chronometers', cf: '#c9a85a', face: '#f3f0e6', mc: INK, tk: 'rail', tc: INK, mk: { t: 'roman', r: 146, s: 30, only: [1, 2, 3, 4, 5, 7, 8, 9, 10, 11] }, hd: ['breguet', BLUED, 92, 150, 9, 8, { tail: 14 }], sc: { at: [0, 90], r: 44, col: BLUED, tc: INK, n: 12, nums: [['60', 0], ['30', 180]] }, x: [['pr', 0, -62, 46, -60, 60, INK, 25, BLUED]], pin: BLUED },
    { n: 'Engine-turned Roman', fin: { dial: 'grained' }, a: 'after Abraham-Louis Breguet', cf: '#d9d9d6', face: '#e9e8e3', mc: '#26262a', tk: 'dots', x: [['guilloche', 122, '#b9b8b2'], ['ring', 124, '#8d8d88', 1.5], ['ring', 170, '#8d8d88', 1.5]], mk: { t: 'roman', r: 147, s: 27 }, hd: ['breguet', BLUED, 96, 160, 8, 7, { tail: 14 }], sc: null, pin: BLUED },
    { n: 'Round dress watch', fin: { dial: 'grained' }, a: 'after the Patek Philippe Calatrava', cf: GOLD, face: CREAM, mc: GOLD, mst: '#8c6d2a', tk: 'dots', tc: '#8c6d2a', mk: { t: 'baton', w: 7, len: 30, r: 158, ap: 1 }, hd: ['dauphine', GOLD, 100, 156, 17, 14, { st: '#8c6d2a' }], sc: { at: [0, 88], r: 38, col: '#8c6d2a', tc: '#8c6d2a', n: 12 }, pin: GOLD },
    { n: 'Snow-textured dial', fin: { dial: 'grained' }, a: 'after the Grand Seiko Snowflake', face: '#f4f5f7', pat: ['snow'], mc: '#dfe2e6', mst: '#70767e', date: 3, mk: { t: 'baton', w: 9, len: 34, dbl: 1, r: 160, ap: 1 }, tk: 'ticks', tc: '#70767e', hd: ['dauphine', '#d9dce1', 104, 160, 18, 14, { st: '#5d646d' }], sc: ['counter', BLUED, 174], x: [['date', 3, 142, WHITE, INK, '#70767e'], ['pr', -52, 62, 44, 200, 290, '#70767e', 262, '#3c4148']], pin: '#aab0b8' },
    { n: 'Sandwich dial', a: 'after the Panerai Luminor', cs: 'cushion', Rd: 162, face: '#141414', mc: OLD, lume: OLD, mk: { t: 'sandwich', only: [0, 3, 6], lu: 1 }, fin: { dial: 'matte', lume: { prof: 'soft', h: -1.6, w: 1.2 } }, hd: ['pencil', GOLD, 88, 150, 16, 13, { lume: OLD }], sc: { at: [-92, 0], r: 34, col: GOLD, tc: OLD, n: 4, maj: 1 }, pin: GOLD },
    { n: 'Orange diver', fin: { case: 'brush circular', bezel: 'polish', dial: 'matte', handBody: 'matte', cap: 'matte' }, a: 'after the DOXA Sub 300 of 1967', cs: 'cushion', Rd: 142, bz: { t: 'dive', f: '#d5d7da', fg: INK }, face: '#f47a1f', mc: INK, tk: 'ticks', tc: INK, tkAll: 1, date: 3, mk: { t: 'baton', w: 10, len: 26, r: 150 }, hd: ['block', INK, 62, 158, 12, 22, { lume: WHITE }], sc: ['lolli', INK, 168, { lume: WHITE }], x: [['date', 3, 126, WHITE, INK]], pin: INK },
    { n: 'Two-tone GMT', fin: { case: { mat: 'brush circular', edge: 'polish', ew: 2 }, bezel: 'gloss', dial: 'gloss' }, a: 'after the Rolex GMT-Master of 1954', Rd: 150, bz: { t: 'gmt', a: '#1c3f8f', b: '#b3262b', fg: '#f1f1ec' }, face: '#111214', mc: LUME, lume: LUME, mst: '#d8d9da', tk: 'ticks', tc: '#e8e8e4', date: 3, mk: { t: 'dots', ap: 1, lu: 1 }, hd: ['mercedes', '#dfe0e2', 100, 162, 17, 13, { lume: LUME }], sc: ['lolli', '#dfe0e2', 170, { lume: LUME }], gmt: RED, x: [['date', 3, 142, WHITE, INK]] },
    { n: 'Art Deco rectangle', fin: { case: { mat: 'blast', edge: 'polish', ew: 2 }, dial: 'matte' }, a: 'after the Jaeger-LeCoultre Reverso', cs: 'rect', cf: '#cfd2d6', sq: 1, mx: .62, my: .8, face: '#16171a', mc: '#eeeee8', tk: 'rail', tc: '#eeeee8', ra: 92, rb: 106, mk: { t: 'arabic', r: 150, s: 30, only: [0, 2, 4, 6, 8, 10], w: 4, len: 24, wt: 400 }, hd: ['dauphine', '#e4e6e8', 58, 86, 13, 11, { tail: 8 }], sc: null, pin: '#e4e6e8' },
    { n: 'German functionalism', fin: { case: 'matte', dial: 'matte', handBody: 'matte', cap: 'matte' }, a: 'after Dietrich Lubs’s Braun AW 10', cf: '#2a2b2e', face: '#18191b', mc: '#f2f2ee', tk: 'ticks', tc: '#f2f2ee', tkAll: 1, mk: { t: 'arabic', s: 26, r: 150, wt: 500 }, hd: ['baton', '#f2f2ee', 92, 150, 9, 6, { tail: 14 }], sc: ['thin', '#f2c21a', 170], x: [['date', 3, 110, '#f2f2ee', INK]], pin: '#f2c21a' },
    { n: 'Off-centre dial', fin: { dial: 'grained' }, a: 'after the A. Lange & Söhne Lange 1', cf: ROSE, face: '#e7e5df', mc: '#2a2a2c', hm: [-52, 6, .62], x: [['bigdate', 44, -122, ROSE], ['pr', 150, 0, 60, 215, 325, '#2a2a2c', 250, ROSE]], tk: 'rail', tc: '#2a2a2c', ra: 172, rb: 187, mk: { t: 'roman', r: 138, s: 40, only: [0, 3, 6, 9], len: 34, w: 7 }, hd: ['sword', ROSE, 104, 160, 22, 18, { st: '#8a5d42' }], sc: { at: [96, 92], r: 46, col: ROSE, tc: '#2a2a2c', n: 12, nums: [['60', 0], ['30', 180]] }, pin: ROSE },
    { n: 'Regulator', fin: { case: 'brush circular', dial: 'grained' }, a: 'after watchmakers’ master clocks', cf: '#d3d5d8', face: '#f2f0e8', mc: INK, tk: 'rail', tc: INK, mk: { t: 'arabic', s: 20, r: 152, wt: 500, minutes: 1 }, hAt: [0, -84, 44], hd: ['pencil', BLUED, 92, 162, 12, 8], sc: { at: [0, 84], r: 44, col: BLUED, tc: INK, n: 12, nums: [['60', 0], ['30', 180]] }, x: [['sub', 0, -84, 44, { st: INK, tc: INK, n: 12, maj: 1, nums: [['XII', 0], ['III', 90], ['VI', 180], ['IX', 270]], ns: .26, serif: 1 }]], pin: BLUED },
  ];

  // ---- building a scene ----
  // scene = { index, name, caption, box, base: [op], hands: [hand], fonts, paint }. base is everything that does not
  // move, in paint order. hands run from the lowest to the highest, as on a watch: register and power-reserve needles
  // and a small seconds hand, then GMT, hour, minute and centre seconds, a stopped chronograph hand, and the centre cap.
  // (The flat drawing paints them in its own old order, by each hand's at.)
  function build(i) {
    const c = Object.assign({ cs: 'round', cf: STEEL, Rd: 186, lume: null }, D[i]), now = clock(), oblong = c.cs === 'rect';
    const kk = oblong ? 1 : f1(c.Rd / 190 * 100) / 100;
    if (oblong) c.Rd = 190;
    ops = []; hands = []; over = []; mat = ID; fin = {};
    for (const k in c.fin || {}) fin[k] = typeof c.fin[k] === 'string' ? { mat: c.fin[k] } : c.fin[k];
    both(shape(c.cs, 0), c.cf, 'case', INK, 2, 'outline');
    bezel(c);
    within(zoom(kk), () => {
      const round = { k: 'circle', cx: 0, cy: 0, r: 190 }, sq = c.sq && { k: 'rect', x: -190 * c.mx, y: -190 * c.my, w: 380 * c.mx, h: 380 * c.my };
      both(sq ? Object.assign({ rx: 5 }, sq) : c.ds ? shape(c.ds, 8) : round, c.face, 'dial', INK, 1.5, 'outline');
      pattern(c, sq || (c.ds ? shape(c.ds, 8) : round));
      extras(c, now);
      const hm = c.hm || [0, 0, 1], HM = mul(mv(hm[0], hm[1]), zoom(hm[2])), hd = c.hd, ho = hd[6] || {}, q = c.sc, centre = Array.isArray(q);
      within(HM, () => { track(c); marks(c); });
      if (q && !centre) within(mv(q.at[0], q.at[1]), () => {   // a small seconds dial
        if (q.rail) { put('sub', { k: 'circle', cx: 0, cy: 0, r: q.r }); [1, .8].forEach(k => put('subPrint', { k: 'circle', cx: 0, cy: 0, r: q.r * k, stroke: q.tc, sw: 1.2 })); for (let j = 0; j < 12; j++) ln(q.r * .8, q.r, j * 30, 1.4, q.tc, {}, 'subPrint'); }
        else sub(0, 0, q.r, { f: q.f, tc: q.tc, n: q.n, maj: q.maj, nums: q.nums, ns: q.ns, nr: q.nr, tl: q.tl });
        hand('s', () => S('needle', q.r * .82, q.col, { w: 2 }), 0, null, 1);   // flat: painted last, over the centre cap
      });
      within(HM, () => {
        if (c.gmt) hand('g', () => { put('handBody', { k: 'line', x1: 0, y1: 0, x2: 0, y2: -150, stroke: c.gmt, sw: 3 }); put('handBody', { k: 'poly', pts: [-11, -146, 0, -170, 11, -146], fill: c.gmt }); });
        if (c.hAt) within(mv(c.hAt[0], c.hAt[1]), () => hand('h', () => { H('pencil', c.hAt[2] * .7, 7, hd[1], { tail: 6 }); put('cap', { k: 'circle', cx: 0, cy: 0, r: 3.5, fill: hd[1] }); }));
        else hand(c.h24 ? 'H' : 'h', () => H(hd[0], hd[2], hd[4], hd[1], ho));
        hand('m', () => H(/mercedes|snow|arrow/.test(hd[0]) ? 'pencil' : hd[0], hd[3], hd[5], hd[1], ho));
        if (centre) hand('s', () => S(q[0], q[2], q[1], q[3]));
        hands.push(...over);
        hand(null, () => put('cap', { k: 'circle', cx: 0, cy: 0, r: c.capR || (centre ? 3 : 6), fill: c.pin || (q && q[1]) || hd[1] }));
      });
    });
    const fonts = [...new Set(ops.filter(o => o.k === 'text' && !o.serif).map(o => o.wt + ' 30px Jost'))];
    return { index: i, name: D[i].n, caption: D[i].a.charAt(0).toUpperCase() + D[i].a.slice(1), box: { w: 400, h: 400 }, base: ops, hands, fonts, paint };
  }

  // ---- painting ----
  // A loose box round some ops in their own units, strokes included: [x0, y0, x1, y1]. It sizes a hand.
  function bounds(list) {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    list.forEach(o => {
      const m = o.m || ID, pad = (o.stroke ? (o.k === 'line' || o.k === 'circle' ? o.sw / 2 : o.sw * 2) : 0) + (o.k === 'circle' ? o.r : 0), e = pad * Math.hypot(m[0], m[1]);
      const p = o.k === 'circle' ? [o.cx, o.cy] : o.k === 'line' ? [o.x1, o.y1, o.x2, o.y2] : o.k === 'rect' ? [o.x, o.y, o.x + o.w, o.y, o.x, o.y + o.h, o.x + o.w, o.y + o.h] : o.pts || o.d.match(/-?\d*\.?\d+(?:e-?\d+)?/g).map(Number);
      for (let i = 0; i < p.length; i += 2) { const x = m[0] * p[i] + m[2] * p[i + 1] + m[4], y = m[1] * p[i] + m[3] * p[i + 1] + m[5]; x0 = Math.min(x0, x - e); y0 = Math.min(y0, y - e); x1 = Math.max(x1, x + e); y1 = Math.max(y1, y + e); }
    });
    return [x0, y0, x1, y1];
  }
  const PATHS = {}, path = d => PATHS[d] || (PATHS[d] = new Path2D(d));
  function trace(ctx, o) {
    ctx.beginPath();
    if (o.k === 'circle') ctx.arc(o.cx, o.cy, o.r, 0, 2 * Math.PI);
    else if (o.k === 'line') { ctx.moveTo(o.x1, o.y1); ctx.lineTo(o.x2, o.y2); }
    else if (o.k === 'poly') { ctx.moveTo(o.pts[0], o.pts[1]); for (let i = 2; i < o.pts.length; i += 2) ctx.lineTo(o.pts[i], o.pts[i + 1]); ctx.closePath(); }
    else if (o.rx) { const r = Math.min(o.rx, o.w / 2, o.h / 2), x = o.x, y = o.y, X = x + o.w, Y = y + o.h; ctx.moveTo(x + r, y); ctx.arcTo(X, y, X, Y, r); ctx.arcTo(X, Y, x, Y, r); ctx.arcTo(x, Y, x, y, r); ctx.arcTo(x, y, X, y, r); ctx.closePath(); }
    else ctx.rect(o.x, o.y, o.w, o.h);
  }

  // The snow dial is fractal noise exactly as SVG's feTurbulence defines it (it used to be an SVG filter): the
  // reference algorithm, alpha channel only. Returns w * h sums; pixel (i, j) samples the point ((x0 + i) / sx, (y0 + j) / sy).
  const LATTICE = {};
  function noise(w, h, x0, y0, sx, sy, o) {
    let t = LATTICE[o.seed], i, j, k;
    if (!t) {
      const lat = new Uint16Array(514), g = new Float32Array(1028); let r = o.seed;
      const rnd = () => { r = 16807 * (r % 127773) - 2836 * Math.floor(r / 127773); if (r <= 0) r += 2147483647; return r; };
      for (k = 0; k < 4; k++) for (i = 0; i < 256; i++) { const x = (rnd() % 512 - 256) / 256, y = (rnd() % 512 - 256) / 256, s = Math.hypot(x, y) || 1; if (k === 3) { g[2 * i] = x / s; g[2 * i + 1] = y / s; } }
      for (i = 0; i < 256; i++) lat[i] = i;
      for (i = 255; i > 0; i--) { k = lat[i]; j = rnd() % 256; lat[i] = lat[j]; lat[j] = k; }
      for (i = 0; i < 258; i++) { lat[256 + i] = lat[i]; g[512 + 2 * i] = g[2 * i]; g[513 + 2 * i] = g[2 * i + 1]; }
      t = LATTICE[o.seed] = { lat, g };
    }
    const lat = t.lat, g = t.g, out = new Float32Array(w * h), P = new Uint16Array(w), Q = new Uint16Array(w), RX = new Float32Array(w), EX = new Float32Array(w);
    for (let n = 0, f = 1; n < o.oct; n++, f *= 2) {
      for (i = 0; i < w; i++) { const v = (x0 + i) / sx * o.f[0] * f + 4096, b = Math.floor(v), r = v - b; P[i] = lat[b & 255]; Q[i] = lat[(b + 1) & 255]; RX[i] = r; EX[i] = r * r * (3 - 2 * r); }
      for (j = 0, k = 0; j < h; j++) {
        const v = (y0 + j) / sy * o.f[1] * f + 4096, b = Math.floor(v), ry = v - b, ey = ry * ry * (3 - 2 * ry), b0 = b & 255, b1 = (b + 1) & 255;
        for (i = 0; i < w; i++, k++) {
          const rx = RX[i], ex = EX[i], a = 2 * lat[P[i] + b0], b2 = 2 * lat[Q[i] + b0], c = 2 * lat[P[i] + b1], d = 2 * lat[Q[i] + b1];
          const u = rx * g[a] + ry * g[a + 1], v2 = rx * g[c] + (ry - 1) * g[c + 1];
          const top = u + ex * ((rx - 1) * g[b2] + ry * g[b2 + 1] - u), low = v2 + ex * ((rx - 1) * g[d] + (ry - 1) * g[d + 1] - v2);
          out[k] += (top + ey * (low - top)) / f;
        }
      }
    }
    return out;
  }
  let scratch;
  function texture(ctx, o) {
    const a = ctx.globalAlpha;
    ctx.save(); trace(ctx, o.clip); ctx.clip();
    if (o.tex === 'sun') { const g = ctx.createRadialGradient(o.cx, o.cy, 0, o.cx, o.cy, o.r); g.addColorStop(0, o.a); g.addColorStop(1, o.b); ctx.fillStyle = g; ctx.fillRect(-200, -200, 400, 400); }
    if (o.tex === 'grid') {
      ctx.fillStyle = o.a; ctx.fillRect(-200, -200, 400, 400); ctx.fillStyle = o.b; ctx.beginPath();
      for (let x = -14 * o.pitch; x < 200; x += o.pitch) for (let y = -14 * o.pitch; y < 200; y += o.pitch) ctx.rect(x + o.off, y + o.off, o.size, o.size);
      ctx.fill();
    }
    if (o.tex === 'ribs') {
      const g = ctx.createLinearGradient(0, -200, 0, 200); g.addColorStop(0, o.a); g.addColorStop(1, o.b); ctx.fillStyle = g; ctx.fillRect(-200, -200, 400, 400);
      ctx.fillStyle = '#000'; ctx.globalAlpha = a * o.shade;
      for (let y = -10 * o.pitch + o.off; y < 200; y += o.pitch) ctx.fillRect(-200, y, 400, o.size);
    }
    if (o.tex === 'rings') { ctx.strokeStyle = o.stroke; ctx.lineWidth = o.sw; ctx.beginPath(); for (let r = o.from; r < o.to; r += o.pitch) { ctx.moveTo(r, 0); ctx.arc(0, 0, r, 0, 2 * Math.PI); } ctx.stroke(); }
    if (o.tex === 'snow') {   // worked out per device pixel, on the pixel grid the SVG filter used
      const t = ctx.getTransform(), sx = Math.hypot(t.a, t.b), sy = Math.hypot(t.c, t.d), b = bounds([o.clip]), cv = ctx.canvas;
      const X = Math.max(0, Math.floor(t.e + b[0] * sx)), Y = Math.max(0, Math.floor(t.f + b[1] * sy)), w = Math.min(cv.width, Math.ceil(t.e + b[2] * sx)) - X, h = Math.min(cv.height, Math.ceil(t.f + b[3] * sy)) - Y;
      if (w > 0 && h > 0) {
        const v = noise(w, h, Math.floor(X + .5 - t.e) + 1, Math.floor(Y + .5 - t.f) + 1, sx, sy, o), img = ctx.createImageData(w, h), d = img.data;
        for (let i = 0, k = 0; i < v.length; i++, k += 4) { d[k] = o.rgb[0]; d[k + 1] = o.rgb[1]; d[k + 2] = o.rgb[2]; d[k + 3] = 127.5 * (v[i] + 1); }
        scratch = scratch || document.createElement('canvas'); scratch.width = w; scratch.height = h; scratch.getContext('2d').putImageData(img, 0, 0);
        ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(scratch, X, Y);
      }
    }
    ctx.restore();
  }

  // Replays ops on any Canvas 2D context whose transform already maps the ops' units to pixels. style(op), if given,
  // may return false to leave an op out, a colour to paint whatever the op paints in that one flat colour (a mask),
  // or { fill, stroke, alpha } to override some of it (this can also give paint to an op that has none). A 'tex' op
  // given a flat colour fills its clip shape with it. res is for a canvas shown on screen: how many of its pixels
  // make one pixel of the browser's layout, when that is not one (text is set out in layout pixels, as the browser
  // set the old SVG text out).
  function paint(ctx, list, style, res) {
    const T = ctx.getTransform(), R = res || 1, lines = {}, cut = v => Math.trunc(v * 64) / 64;
    let lm = null;
    ctx.save(); ctx.miterLimit = 4; ctx.lineCap = 'butt'; ctx.lineJoin = 'miter'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';   // miter limit as in SVG, so sharp tips are cut the same way
    for (const o of list) {
      let f = o.fill, s = o.stroke, a = o.alpha == null ? 1 : o.alpha, wash;
      if (style) {
        const v = style(o);
        if (v === false || v === null) continue;
        if (typeof v === 'string') { wash = v; a = 1; if (f) f = v; if (s) s = v; }
        else if (v && v !== true) { if ('fill' in v) wash = f = v.fill || null; if ('stroke' in v) s = v.stroke; if ('alpha' in v) a = v.alpha; }
      }
      if (o.k === 'tex' ? wash === null : !f && !s) continue;
      if (o.m !== lm) { lm = o.m; ctx.setTransform(T.a, T.b, T.c, T.d, T.e, T.f); if (lm !== ID) ctx.transform(lm[0], lm[1], lm[2], lm[3], lm[4], lm[5]); }
      ctx.globalAlpha = a;
      if (o.k === 'tex') {
        if (wash) { trace(ctx, o.clip); ctx.fillStyle = wash; ctx.fill(); } else { texture(ctx, o); lm = null; }
      } else if (o.k === 'text') {
        if (!f) continue;
        // Text is set the way SVG set it: laid out at its real pixel size and centred on the point both ways. Up and
        // down, that is the middle of the font's ascent and descent (SVG's "central" baseline; the canvas "middle"
        // baseline sits elsewhere), with the ascent and descent taken as whole layout pixels. The box is placed in
        // 64ths of a layout pixel, as the browser placed it (width rounded, corner cut toward zero). Each numeral
        // then lands on the pixels it always did.
        const t = ctx.getTransform(), k = Math.sqrt((t.a * t.a + t.b * t.b + t.c * t.c + t.d * t.d) / 2), px = o.size * k, c = k / R, font = z => `${o.wt} ${z}px ${o.serif ? SERIF : SANS}`, key = font(px);
        ctx.transform(1 / k, 0, 0, 1 / k, 0, 0); lm = null;
        let v = lines[key];
        if (!v) { ctx.font = font(px / R); const q = ctx.measureText('0'), old = q.fontBoundingBoxAscent == null; v = lines[key] = old ? [px / R * .85, px / R * .15] : [q.fontBoundingBoxAscent, q.fontBoundingBoxDescent]; }
        ctx.font = key; ctx.fillStyle = f;
        ctx.fillText(o.t, cut(o.x * c - Math.round(ctx.measureText(o.t).width / R * 64) / 128) * R, (cut(o.y * c - (v[0] + v[1]) / 2) + v[0]) * R);
      } else {
        const p = o.k === 'path' ? path(o.d) : (trace(ctx, o), null);
        if (f) { ctx.fillStyle = f; if (p) ctx.fill(p); else ctx.fill(); }
        if (s) { ctx.strokeStyle = s; ctx.lineWidth = o.sw || 1; if (p) ctx.stroke(p); else ctx.stroke(); }
      }
    }
    ctx.restore();
  }

  // ---- the flat renderer ----
  // Canvas 2D: what the visitor sees when WebGL is not there, and at once while the lit renderer gets ready.
  // The parts that do not move are painted once into a second canvas; each frame copies that and adds the hands.
  // A renderer is { mode, canvas, show(scene), draw(angles, force) -> true if it drew, resize(px) -> true if the size
  // changed (px is the box in device pixels, [w, h], when the browser reports it), destroy() }.
  function flat() {
    const cv = document.createElement('canvas'), ctx = cv.getContext('2d'), back = document.createElement('canvas'), bx = back.getContext('2d');
    cv.setAttribute('aria-hidden', 'true');
    let sc, nw = 0, nh = 0, u = 1, res = 1, last, under = [], above = [], dev;
    // The canvas has as many pixels as its box has device pixels (up to three a CSS pixel). When the browser says
    // exactly how many that is (px, from the ResizeObserver) the picture is never resampled, even in a box whose CSS
    // size is not a whole number. The dial is then drawn as the browser drew the SVG: from the box's corner, at the
    // box's true size, which can leave part of a pixel spare. Until the browser says, and in browsers that never
    // do, the canvas is the CSS size times the ratio, rounded.
    // The report also shows how the page is being laid out. With a real pixel ratio the browser works in device
    // pixels and reports the box in them. With a simulated one (developer tools, test browsers) it works in CSS
    // pixels, reports those and magnifies the result; res then has paint set text out in the same pixels.
    const fit = px => {
      const cw = el.getBoundingClientRect().width, r = window.devicePixelRatio || 1;
      if (px) dev = [px[0], px[1], cw, r];
      const told = dev && dev[2] === cw && dev[3] === r, real = !told || Math.abs(dev[0] - cw * r) <= Math.abs(dev[0] - cw);
      const exact = told && real && r <= 3 && Math.abs(dev[0] - cw * r) < 1 && Math.abs(dev[1] - cw * r) < 1;
      const w = Math.max(1, exact ? dev[0] : Math.round(cw * Math.min(r, 3))), h = Math.max(1, exact ? dev[1] : w);
      const to = exact ? cw * r / 400 : w / 400, lay = exact ? 1 : (cw ? w / cw : 1) / (real ? r : 1), same = w === nw && h === nh && to === u && lay === res;
      u = to; res = lay;   // canvas pixels to a dial unit, and to a pixel of the browser's layout
      if (same) return false;
      if (w !== nw) nw = cv.width = back.width = w;
      if (h !== nh) nh = cv.height = back.height = h;
      return true;
    };
    const unit = x => x.setTransform(u, 0, 0, u, 200 * u, 200 * u);
    const turned = (x, h, deg) => { const k = u * h.scale, a = rad(h.key ? deg[h.key] : h.angle), c = Math.cos(a) * k, s = Math.sin(a) * k; x.setTransform(c, s, -s, c, (200 + h.pivot[0]) * u, (200 + h.pivot[1]) * u); paint(x, h.ops); };
    const inOrder = list => list.map((h, i) => [h, i]).sort((a, b) => a[0].at - b[0].at || a[1] - b[1]).map(v => v[0]);
    // The still layer: the base, with the needles that never move painted where the drawing has always had them
    // (a stopped chronograph hand lies under the hour markers there, though on a watch it is the topmost hand).
    const base = () => {
      let i = 0; last = null; bx.setTransform(1, 0, 0, 1, 0, 0); bx.clearRect(0, 0, nw, nh);
      for (const h of under) { unit(bx); paint(bx, sc.base.slice(i, h.at), null, res); i = h.at; turned(bx, h); }
      unit(bx); paint(bx, sc.base.slice(i), null, res);
    };
    return {
      mode: '2d', canvas: cv,
      show(s) { sc = s; const fixed = h => !h.key && h.at < s.base.length; under = inOrder(s.hands.filter(fixed)); above = inOrder(s.hands.filter(h => !fixed(h))); fit(); base(); },
      resize(px) { if (!fit(px)) return false; if (sc) base(); return true; },
      draw(deg, force) {
        // Angles are compared to a hundredth of a degree, so a clock that has not moved is not painted again.
        const now = above.map(h => h.key && !(h.hideWhenStill && still) ? Math.round(deg[h.key] * 100) : 0).join();
        if (now === last && !force) return false;
        last = now; ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, nw, nh); ctx.drawImage(back, 0, 0);
        for (const h of above) if (!(h.hideWhenStill && still)) turned(ctx, h, deg);
        return true;
      },
      destroy() { cv.remove(); }
    };
  }

  // ---- the clock, and which renderer draws it ----
  const angles = () => {
    const d = clock(), s = d.getSeconds() + d.getMilliseconds() / 1000, m = d.getMinutes() + s / 60, h = d.getHours() + m / 60;
    return { h: (h % 12) * 30, H: h * 15, m: m * 6, s: s * 6, g: (d.getUTCHours() + d.getUTCMinutes() / 60) * 15 };
  };
  // dial3d.js, if it loaded, offers window.WBMDial3D.create(button, options): a renderer like the flat one with mode
  // 'gl', whose show(scene, done) calls done() once it can draw that scene, or done(false) if it never can. It returns
  // null (or throws) when WebGL is not there; the flat renderer then does everything. The options also give it three
  // ways back: redraw (the lamp moved while nothing else was drawing), lost (the graphics context went away, so the
  // flat picture takes over) and restored (it came back, so the scene is lit again).
  const plain = flat();
  let lit = null, R = plain, scene, token = 0, inView = true, raf = 0, paused = false;   // paused: another picture has the stage (watch3d.js)
  const mount = r => { R = r; if (r.canvas.parentNode !== el) { el.textContent = ''; el.appendChild(r.canvas); } if (dbg) dbg.mode = r.mode; };
  const frame = force => { if (scene && R.draw(angles(), force) && dbg) dbg.frames++; };
  // Hands the scene to the lit renderer; the dial is marked as drawn (data-r3d) when it takes over, or at once if it cannot.
  const relight = () => {
    const my = token;
    const taken = lit && lit.show(scene, ok => { if (my !== token) return; if (ok === false) lit = null; else { mount(lit); frame(true); } el.dataset.r3d = R.mode; });
    if (!taken) el.dataset.r3d = R.mode;
  };
  const toFlat = () => { if (R === plain || !scene) return; mount(plain); plain.resize(); frame(true); el.dataset.r3d = R.mode; };
  try {
    if (!flatOnly && window.WBMDial3D) lit = window.WBMDial3D.create(el, { light, still, debug: dbg, redraw: () => { if (inView && !paused) frame(); }, lost: toFlat, restored: () => { if (scene) relight(); } }) || null;
  } catch (e) { lit = null; }
  // Smooth sweep; with reduced motion the seconds hand is hidden and the hands step every 15 seconds. Nothing is
  // drawn while the dial is scrolled out of view, or while it is paused. wake() is the return to view.
  const loop = () => { raf = 0; if (!inView || paused) return; frame(); raf = requestAnimationFrame(loop); };
  const wake = () => { if (!inView || paused) return; if (still) frame(); else if (!raf) loop(); };
  function render(i) {
    const my = ++token, t0 = performance.now(), F = document.fonts;
    scene = build(i);
    el.removeAttribute('data-r3d');   // not drawn yet; the test tools wait for this to come back
    mount(plain); plain.show(scene); frame(true);
    if (cap) cap.textContent = scene.caption;
    if (dbg) dbg.buildMs = performance.now() - t0;
    // The flat picture is up. The lit renderer, if there is one, takes over when it says it can draw this scene.
    const handOver = () => { if (my === token) relight(); };
    // Numerals are set in Jost. If it has not arrived, the paint above used a fallback font: paint again when Jost is
    // there (or after a short wait, and then once more when it does arrive), so a fallback never gets stuck in the picture.
    const missing = () => F && F.check ? scene.fonts.filter(f => !F.check(f)) : [];
    let late = missing();
    if (!late.length) return handOver();
    const again = () => { if (my !== token || !late.length) return; late = missing(); plain.show(scene); if (R === plain) frame(true); handOver(); };
    Promise.race([Promise.all(late.map(f => F.load(f))), new Promise(r => setTimeout(r, 1500))]).then(again, again);
    F.ready.then(again);
  }
  // The box is watched in device pixels where the browser offers that (it also notices a change of zoom); elsewhere in
  // CSS pixels, with the window's resize event to catch a change of zoom.
  let sharp = false;
  if (window.ResizeObserver) {
    const ro = new ResizeObserver(es => { const d = es[es.length - 1].devicePixelContentBoxSize, px = d && d[0] ? [d[0].inlineSize, d[0].blockSize] : null; sharp = !!px; if (R.resize(px)) frame(true); });
    try { ro.observe(el, { box: 'device-pixel-content-box' }); } catch (e) { ro.observe(el); }
  }
  addEventListener('resize', () => { if (!sharp && R.resize()) frame(true); });
  if (window.IntersectionObserver) new IntersectionObserver(es => { inView = es[es.length - 1].isIntersecting; wake(); }).observe(el);

  // Which dial to show: a choice made this session wins, then a pinned dial, otherwise a random unseen one.
  const pick = document.getElementById('dialPick'), pinBtn = document.getElementById('dialPin'), rnd = document.getElementById('dialRandom');
  const store = (st, k, v) => { try { if (v === undefined) return st.getItem(k); if (v === null) st.removeItem(k); else st.setItem(k, v); } catch (e) {} return null; };
  const LS = () => localStorage, SS = () => sessionStorage;
  // A dial is remembered by its name, because new designs go at the top of D and move every position. A number is a
  // record from before that, when there were thirty-one in the order they were made: the last of them, the slide
  // rule, now comes second and the other thirty close the list.
  const at = v => { const i = /^\d+$/.test('' + v) ? (+v === 30 ? D.findIndex(d => d.n === 'Slide-rule chronograph') : +v < 30 ? D.length - 30 + +v : -1) : D.findIndex(d => d.n === v); return i >= 0 && i < D.length ? i : null; };
  const get = (st, k) => { try { const v = store(st(), k); return v == null ? null : at(v); } catch (e) { return null; } };
  const set = (st, k, v) => { try { store(st(), k, v === null ? null : D[v].n); } catch (e) {} };
  // Dials this visitor has already been shown. A random pick always comes from the ones not yet
  // seen; once all have been seen the record starts again.
  let seen = [];
  try { seen = [...new Set((JSON.parse(localStorage.getItem('wbm-dial-seen')) || []).map(at).filter(n => n !== null))]; } catch (e) { seen = []; }
  const mark = i => { if (!seen.includes(i)) seen.push(i); try { localStorage.setItem('wbm-dial-seen', JSON.stringify(seen.map(n => D[n].n))); } catch (e) {} };
  function fresh(not) {
    let left = D.map((_, i) => i).filter(i => !seen.includes(i) && i !== not);
    if (!left.length) { const last = seen[seen.length - 1]; seen = []; left = D.map((_, i) => i).filter(i => i !== last && i !== not); }
    return left[Math.floor(Math.random() * left.length)];
  }
  let idx, pinned = get(LS, 'wbm-dial-pin');
  const q = /[?&]dial=(\d+)/.exec(location.search), chosen = get(SS, 'wbm-dial-session');
  if (q && +q[1] >= 1 && +q[1] <= D.length) idx = +q[1] - 1;
  else if (chosen !== null) idx = chosen;
  else if (pinned !== null) idx = pinned;
  else idx = fresh();

  if (pick) pick.innerHTML = D.map((d, i) => `<option value="${i}">${i + 1}. ${d.n}</option>`).join('');
  function show(i) {
    idx = i; render(i); mark(i);
    // The case, for band.js, which draws the bracelet or strap to suit it.
    el.dataset.cs = D[i].cs || 'round'; el.dataset.cf = D[i].cf || STEEL; document.dispatchEvent(new Event('wbm-dial'));
    if (pick) pick.value = i;
    if (pinBtn) { const on = pinned === i; pinBtn.setAttribute('aria-pressed', on); pinBtn.textContent = on ? 'Pinned' : 'Pin'; pinBtn.title = on ? 'Unpin this dial' : 'Keep this dial on every visit'; }
  }
  const choose = i => { set(SS, 'wbm-dial-session', i); show(i); };
  // For other scripts (watch3d.js): choose a dial by its name, as the menu does for this visit, and ask which is showing.
  // pause(true) stops the dial drawing while something else covers it (its own loop, the 15-second step and the redraws
  // the lamp asks for); pause(false) draws it and starts again, as coming back into view does.
  window.WBMDials = {
    choose(name) { const i = D.findIndex(d => d.n === name); if (i < 0) return false; choose(i); return true; },
    current() { return D[idx].n; },
    pause(on) { on = !!on; if (on === paused) return; paused = on; if (raf && on) { cancelAnimationFrame(raf); raf = 0; } wake(); }
  };
  show(idx);
  if (still) setInterval(() => { if (inView && !paused) frame(); }, 15000); else loop();
  el.addEventListener('click', () => choose((idx + 1) % D.length));
  if (pick) pick.addEventListener('change', () => choose(+pick.value));
  if (pinBtn) pinBtn.addEventListener('click', () => {
    if (pinned === idx) { pinned = null; set(LS, 'wbm-dial-pin', null); }
    else { pinned = idx; set(LS, 'wbm-dial-pin', idx); set(SS, 'wbm-dial-session', idx); }
    show(idx);
  });
  if (rnd) rnd.addEventListener('click', () => {
    const i = fresh(idx);
    pinned = null; set(LS, 'wbm-dial-pin', null); set(SS, 'wbm-dial-session', null);
    show(i);
  });
})();
