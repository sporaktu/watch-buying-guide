// Brand map: every brand plotted by cost, desirability and value. Reads the brand data that app.js prepares.
(function () {
  'use strict';
  let IX;
  try { IX = BRAND_INDEX; } catch (e) { return; }                 // app.js is missing or stopped part-way, so there is nothing to draw
  const $ = id => document.getElementById(id);
  const root = $('map'), plot = $('mapPlot'), legend = $('mapLegend'), viewEl = $('mapView'), toggle = $('mapToggle'),
    body = $('mapBody'), live = $('mapLive'), detail = $('mapDetail');
  if (!root || !plot || !legend || !viewEl || !toggle || !body || !live || !detail) return;

  const NS = 'http://www.w3.org/2000/svg';
  const S = (tag, at, parent, text) => { const e = document.createElementNS(NS, tag); for (const k in at) e.setAttribute(k, at[k]); if (text != null) e.textContent = text; if (parent) parent.appendChild(e); return e; };
  const H = (tag, cls, parent, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; if (parent) parent.appendChild(e); return e; };
  const f = n => Math.round(n * 100) / 100;

  // ---------- The three measures

  const VIEWS = { cd: 'Cost and desirability', cv: 'Cost and value', vd: 'Value and desirability' };
  const DES = { 10: 'revered', 9: 'coveted', 8: 'admired', 7: 'well liked', 6: 'respectable', 5: 'ordinary', 4: 'forgettable', 3: 'generic', 2: 'looked down on' };
  const VAL = { 5: 'outstanding', 4: 'good', 3: 'fair', 2: 'poor', 1: 'paying for the name' };
  const tierBands = IX.tiers.filter(t => t.band);
  const cuts = tierBands.map(t => t.band[0]).filter(c => c > 0);  // where one price tier ends and the next begins
  // Cost is one figure: the middle of a closed range (on a log scale, so the geometric middle), or the
  // starting price of an open-ended one. Two brands have no list price at all.
  const dots = IX.all.map(x => {
    const open = !!x.rng && x.rng[1] === Infinity, des = x.cred + x.cool;
    const cost = !x.rng ? null : open ? x.rng[0] : Math.sqrt(x.rng[0] * x.rng[1]);
    return { x, name: x.r[0], cost, open, des, val: x.value, pick: x.picks.length > 0, skip: x.skip, worth: x.worth,
      kc: cost == null ? 0 : 1 + cuts.filter(c => cost >= c).length,          // colour class for cost: the list's five price tiers
      kd: des <= 3 ? 1 : des <= 5 ? 2 : des <= 7 ? 3 : des <= 9 ? 4 : 5 };    // colour class for desirability: 2–3, 4–5, 6–7, 8–9, 10
  });
  const priced = dots.filter(d => d.cost != null);
  const LO = Math.min(...priced.map(d => d.x.rng[0])), HI = Math.max(...priced.map(d => d.open ? d.cost : d.x.rng[1]), ...priced.map(d => d.cost));
  const byCost = (a, b) => (a.cost == null) - (b.cost == null) || a.cost - b.cost || a.x.i - b.x.i;
  const money = n => '$' + n.toLocaleString('en-US');

  // ---------- Marks

  const GAP = 2;                                                  // clear space kept between any two marks
  const ext = (d, r) => d.pick ? r + 1.5 : r;                     // how far a mark reaches from its centre
  // A mark as circles, [x offset, radius], for working out what touches what. The "and up" point is a second small circle.
  const parts = (d, r) => d.open ? [[0, ext(d, r)], [r * 1.08, r * 0.48]] : [[0, ext(d, r)]];
  // Draw one brand's mark around 0,0: a yellow ring for a pick, a hollow ring for a logo-first brand,
  // a point on the right where the price is a starting price, and a slash where there is no list price.
  function mark(g, d, r) {
    while (g.firstChild) g.removeChild(g.firstChild);
    if (d.pick) S('circle', { class: 'pk', r: r + 0.5 }, g);
    const rr = d.skip ? r - 0.75 : d.pick ? r - 0.5 : r;
    if (d.open) {
      const tip = r * 1.55, a = Math.acos(rr / tip), px = f(rr * Math.cos(a)), py = f(rr * Math.sin(a));
      S('path', { class: 'm', d: `M${px} ${-py}A${rr} ${rr} 0 1 0 ${px} ${py}L${f(tip)} 0Z` }, g);
    } else S('circle', { class: 'm', r: rr }, g);
    if (d.kc === 0) { const s = f(r * 0.62); S('path', { class: 'np', d: `M${-s} ${s}L${s} ${-s}` }, g); }
  }

  // ---------- Layout

  let view = 'cd', G = null;
  const cvs = document.createElement('canvas').getContext('2d'), widths = new Map();
  const FONT = getComputedStyle(root).fontFamily;
  function tw(text, size, weight) {
    const k = weight + '/' + size + '/' + text; let w = widths.get(k);
    if (w == null) { if (cvs) { cvs.font = `${weight} ${size}px ${FONT}`; w = cvs.measureText(text).width; } else w = text.length * size * 0.55; widths.set(k, w); }
    return w;
  }
  // Break a label into lines no wider than maxW.
  function wrap(text, maxW, size, weight) {
    const lines = []; let cur = '';
    for (const word of text.split(' ')) { const t = cur ? cur + ' ' + word : word; if (cur && tw(t, size, weight) > maxW) { lines.push(cur); cur = word; } else cur = t; }
    lines.push(cur); return lines;
  }

  // Views 1 and 2 are banded swarms. Each dot keeps its true place across, and moves up or down from the middle
  // of its band by the smallest amount that clears everything already placed. The picks go in last, each with
  // room held beside it for its name, so they end up on the outside of a crowd with their names attached.
  function swarm(list, g) {
    const r = g.r, hh = (g.fs + 3) / 2, placed = [], held = [];   // held: the room kept for a name, [left, right, middle]
    const seat = ban => {                                         // the free place nearest the middle of the band
      let best = 0, far = Infinity;
      for (const c of [0].concat(...ban)) { if (Math.abs(c) >= far || ban.some(b => c > b[0] + 1e-6 && c < b[1] - 1e-6)) continue; best = c; far = Math.abs(c); }
      return best;
    };
    // The stretches of the band a new dot cannot sit in: too close to a dot, or to a name, already there.
    const dotBans = d => {
      const ban = [];
      for (const b of parts(d, r)) {
        const x = d.px + b[0], q = b[1] + GAP;
        for (const p of placed) for (const a of parts(p, r)) { const dx = x - p.px - a[0], s = a[1] + q; if (Math.abs(dx) < s) { const h = Math.sqrt(s * s - dx * dx); ban.push([p.oy - h, p.oy + h]); } }
        for (const k of held) { const dx = Math.max(k[0] - x, 0, x - k[1]); if (dx < q) { const h = hh + Math.sqrt(q * q - dx * dx); ban.push([k[2] - h, k[2] + h]); } }
      }
      return ban;
    };
    // The same for a name that would run from x0 to x1.
    const nameBans = (x0, x1, ban) => {
      for (const p of placed) for (const a of parts(p, r)) { const ox = p.px + a[0], q = a[1] + GAP, dx = Math.max(x0 - ox, 0, ox - x1); if (dx < q) { const h = hh + Math.sqrt(q * q - dx * dx); ban.push([p.oy - h, p.oy + h]); } }
      for (const k of held) if (x0 < k[1] + 4 && x1 > k[0] - 4) ban.push([k[2] - 2 * hh - 1, k[2] + 2 * hh + 1]);
    };
    for (const d of list) if (!d.pick) { d.oy = seat(dotBans(d)); placed.push(d); }
    for (const d of list) if (d.pick) {
      const w = tw(d.name, g.fs, 500) + 2, e = ext(d, r) + 2;
      let best = null;
      for (const side of [1, -1]) {
        const x0 = side > 0 ? d.px + e : d.px - e - w, ban = dotBans(d), far = side > 0 ? [x0, x0 + w + 7] : [x0 - 7, x0 + w];   // clear space past the far end, so no other dot reads as this name's
        if (x0 < g.left + 2 || x0 + w > g.right - 2) continue;
        nameBans(far[0], far[1], ban);
        const y = seat(ban);
        if (!best || Math.abs(y) < Math.abs(best[2]) - 0.5) best = [x0, x0 + w, y, far];
      }
      d.oy = best ? best[2] : seat(dotBans(d)); placed.push(d);
      if (best) { held.push([best[3][0], best[3][1], best[2]]); d.hold = best; }
    }
    return hh;
  }

  function layout(W) {
    const compact = W < 640, wide = W >= 900, r = compact ? 4 : 4.5;
    const g = { W, compact, r, fs: compact ? 11 : 12, lv: compact ? 12 : 13, ln: compact ? 12.5 : 14, cs: compact ? 14 : 16, pad: compact ? 8 : 14,   // sizes of the names, the band names and numbers, and the corner captions
      gut: wide ? 132 : 0,                                        // a wide chart names its bands in a gutter on the left
      cap: wide ? 0 : compact ? 15 : 18,                          // a narrower one names each band in the band's top left corner
      maxLab: compact ? 26 : W < 1000 ? 44 : 70, levels: view === 'cv' ? [5, 4, 3, 2, 1] : [10, 9, 8, 7, 6, 5, 4, 3, 2], words: view === 'cv' ? VAL : DES };
    const level = view === 'cv' ? (d => d.val) : (d => d.des), bp = compact ? 5 : 8, minH = compact ? 18 : 34;
    let y = g.pad;
    dots.forEach(d => { d.hold = null; });
    if (view === 'cd') { g.capT = y + 8; y += 22; }               // a line for the two top corner captions
    g.left = g.pad + g.gut; g.right = W - g.pad;
    // Add one band under the last. Its dots arrive placed from the top of the band's own space, and are moved down the chart.
    // A corner name that would sit on a dot, or on a pick's name, gets a line of its own above the dots instead.
    const stack = (L, m, inner) => {
      const capW = g.cap ? tw(String(L), g.ln, 600) + tw(g.words[L], g.lv, 400) + 14 : 0;
      const hit = m.some(d => (d.X - ext(d, r) - 3 < g.pad + capW && d.Y - ext(d, r) - 2 < g.cap) || (d.hold && d.hold[0] - 3 < g.pad + capW && d.hold[1] - 1 < g.cap));
      const cap = g.cap && hit ? g.cap : 0, b = { L, m, y0: y, y1: y + cap + inner, cap, capW };
      m.forEach(d => { d.Y += y + cap; if (d.hold) { d.hold[1] += y + cap; d.hold[3] += y + cap; } });
      y = b.y1; return b;
    };
    if (view === 'vd') {
      // View 3 is a grid: one cell for each pair of levels, its dots packed in rows, cheapest first.
      const colW = (g.right - g.left) / 5, P = 2 * r + (compact ? 4 : 5);
      const K = Math.max(1, Math.floor((colW - (compact ? 4 : 40) - 2 * r - 3) / P) + 1);       // the most dots in one row of a cell
      g.colW = colW; g.cols = [1, 2, 3, 4, 5].map(v => ({ v, x0: g.left + (v - 1) * colW, x1: g.left + v * colW }));
      g.colLines = g.cols.map(c => wrap(VAL[c.v], colW - 8, g.fs, 400));
      if (g.cap) { g.headY = y; y += 6 + 13 * (1 + Math.max(...g.colLines.map(l => l.length))); }
      g.top = y;
      g.bands = g.levels.map(L => {
        const cells = g.cols.map(c => dots.filter(d => d.des === L && d.val === c.v).sort(byCost));
        const shape = cells.map(c => { const n = c.length; if (!n) return [0, 0]; const rows = Math.ceil(n / Math.min(K, Math.ceil(Math.sqrt(n * 3)))); return [Math.ceil(n / rows), rows]; });
        const inner = Math.max((Math.max(...shape.map(s => s[1])) - 1) * P + 2 * r + 3 + 2 * bp, minH);
        cells.forEach((cell, i) => cell.forEach((d, k) => {
          d.X = (g.cols[i].x0 + g.cols[i].x1) / 2 + (k % shape[i][0] - (shape[i][0] - 1) / 2) * P;
          d.Y = inner / 2 + (Math.floor(k / shape[i][0]) - (shape[i][1] - 1) / 2) * P;
        }));
        return stack(L, [].concat(...cells), inner);
      });
      g.A = y; y += 8 + 13 * (1 + Math.max(...g.colLines.map(l => l.length)));
    } else {
      const slotW = 2 * r + (compact ? 12 : 34), brk = compact ? 12 : 22, x0 = g.left + r + 5, x1 = g.right - slotW - brk - r - 3, lg = Math.log10;
      g.cx = c => x0 + (lg(Math.max(c, LO)) - lg(LO)) / (lg(HI) - lg(LO)) * (x1 - x0);
      g.ppd = (x1 - x0) / (lg(HI) - lg(LO));                      // pixels for each tenfold step in price
      g.axR = x1 + r + 3; g.slot0 = g.right - slotW; g.slotX = g.right - slotW / 2;
      g.headY = y; y += 22;                                       // tier names on a wide screen, dollar marks on a narrow one
      g.top = y;
      dots.forEach(d => { d.px = d.cost == null ? g.slotX : g.cx(d.cost); });
      g.bands = g.levels.map(L => {
        const m = dots.filter(d => level(d) === L).sort((a, b) => a.px - b.px || a.x.i - b.x.i), hh = swarm(m, g);
        let lo = m.length ? Infinity : -r, hi = m.length ? -Infinity : r;
        m.forEach(d => { const e = d.hold ? Math.max(hh, ext(d, r)) : ext(d, r); lo = Math.min(lo, d.oy - e); hi = Math.max(hi, d.oy + e); });
        const inner = Math.max(hi - lo + 2 * bp, minH), top = lo - (inner - (hi - lo)) / 2;
        m.forEach(d => { d.X = d.px; d.Y = d.oy - top; if (d.hold) d.hold = [d.hold[0], d.Y - hh, d.hold[1], d.Y + hh]; });
        return stack(L, m, inner);
      });
      g.A = y; y += compact ? 40 : 26;
    }
    if (view === 'cd') { g.capB = y + 12; y += 26; }
    g.H = Math.round(y + g.pad - 4);
    return g;
  }

  // ---------- Drawing

  const svg = S('svg', { class: 'map-svg', 'aria-hidden': 'true', focusable: 'false' }, plot);
  const flt = S('g', { class: 'flt' }, svg), fur = S('g', { class: 'fur' }, svg), und = S('g', { class: 'und' }, svg),
    dotsG = S('g', { class: 'dots' }, svg), ann = S('g', { class: 'ann' }, svg), hov = S('g', { class: 'hov' }, svg);
  const rb = S('g', { class: 'rb' }, hov), selRing = S('circle', { class: 'ring sel' }, hov), actRing = S('circle', { class: 'ring act' }, hov);
  const tip = H('div', 'map-tip', plot); tip.hidden = true;
  dots.forEach(d => { d.g = S('g', { class: `d v${d.val} s${d.kd} k${d.kc}${d.skip ? ' skip' : ''}` }, dotsG); });
  for (const k in VIEWS) { const b = H('button', '', viewEl, VIEWS[k]); b.type = 'button'; b.dataset.v = k; }

  const text = (parent, cls, x, y, str, anchor) => S('text', { class: cls, x: f(x), y: f(y), dy: '.35em', 'text-anchor': anchor || 'start' }, parent, str);
  const line = (parent, cls, x1, y1, x2, y2) => S('line', { class: cls, x1: f(x1), y1: f(y1), x2: f(x2), y2: f(y2) }, parent);
  // A level's name: the number in ink, the word beside it in grey.
  function levelName(parent, x, y, L, word, anchor) {
    const t = text(parent, 'lv', x, y, '', anchor);
    S('tspan', { class: 'n' }, t, L); S('tspan', { dx: 6 }, t, word);
  }

  function furniture() {
    const g = G;
    fur.textContent = '';
    g.bands.forEach((b, i) => {
      if (i) line(fur, 'rule', g.pad, b.y0, g.right, b.y0);
      const word = g.words[b.L];
      if (g.cap) levelName(fur, g.pad, b.y0 + g.cap / 2 + 2, b.L, word);
      else {
        const lines = wrap(word, g.gut - 40, 13, 400), mid = (b.y0 + b.y1) / 2;
        text(fur, 'lv n', g.pad + 22, mid - (lines.length - 1) * 8, b.L, 'end');
        lines.forEach((s, k) => text(fur, 'lv', g.pad + 30, mid + (k - (lines.length - 1) / 2) * 16, s));
      }
    });
    line(fur, 'rule', g.pad, g.top, g.right, g.top);
    const upright = (x, short) => g.bands.forEach((b, i) => line(fur, 'rule', x, b.y0 + (x < g.pad + b.capW + 4 ? g.cap : 0), x, b.y1 - (short && i === g.bands.length - 1 ? 8 : 0)));   // stops short of a band's name in its corner
    if (view === 'vd') {
      g.cols.forEach((c, i) => {
        if (i) upright(c.x0);
        const mid = (c.x0 + c.x1) / 2, names = y => { text(fur, 'lv n', mid, y, c.v, 'middle'); g.colLines[i].forEach((s, k) => text(fur, 'lv', mid, y + 14 + k * 13, s, 'middle')); };
        names(g.A + 14); if (g.cap) names(g.headY + 6);
      });
      line(fur, 'axis', g.left, g.A, g.right, g.A);
      return;
    }
    // The cost axis: a faint rule where each price tier ends, dollar marks at round numbers, then a break and the slot for brands with no list price.
    cuts.forEach(c => upright(g.cx(c)));
    line(fur, 'axis', g.left, g.A, g.axR, g.A); line(fur, 'axis', g.slot0, g.A, g.right, g.A);
    const bx = (g.axR + g.slot0) / 2;
    upright(bx, true);
    [-3, 3].forEach(o => line(fur, 'axis', bx + o - 2.5, g.A + 5, bx + o + 2.5, g.A - 5));
    const major = g.ppd >= 200 ? [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000, 200000] : [100, 1000, 10000, 100000];
    const label = n => g.ppd >= 75 ? money(n) : n >= 1000 ? '$' + n / 1000 + 'K' : '$' + n;
    for (let p = 10; p <= HI; p *= 10) [1, 2, 5].forEach(k => { const n = p * k; if (n >= LO && n <= HI) line(fur, 'axis', g.cx(n), g.A, g.cx(n), g.A + (major.includes(n) ? 5 : 3)); });
    major.forEach(n => { text(fur, 'tk', g.cx(n), g.A + 15, label(n), 'middle'); if (g.ppd < 200) text(fur, 'tk', g.cx(n), g.headY + 10, label(n), 'middle'); });
    wrap('no list price', g.compact ? 40 : 200, g.fs, 400).forEach((s, k) => text(fur, 'tk', g.right, g.A + 15 + k * 12, s, 'end'));
    if (g.ppd >= 200) tierBands.forEach((t, i) => {
      const a = i ? g.cx(t.band[0]) : g.left, b = t.band[1] === Infinity ? g.axR : g.cx(t.band[1]);
      text(fur, 'tier', (a + b) / 2, g.headY + 10, t.name.toLowerCase(), 'middle').dataset.t = i;
    });
    if (view === 'cd') {
      // The four corners in plain words. Where a pair will not fit side by side, the longer one is cut short.
      const fits = (a, b) => tw(a, g.cs, 400) + tw(b, g.cs, 400) + 14 <= g.right - g.left;
      text(fur, 'corner hot', g.left, g.capT, fits('loved and affordable: start here', 'loved, at a price') ? 'loved and affordable: start here' : 'loved and affordable');
      text(fur, 'corner', g.right, g.capT, 'loved, at a price', 'end');
      text(fur, 'corner', g.left, g.capB, 'cheap, and it shows');
      text(fur, 'corner', g.right, g.capB, fits('cheap, and it shows', 'costly, and nothing special') ? 'costly, and nothing special' : 'costly and ordinary', 'end');
    }
  }

  // The legend says what the axes and the colour mean in this view, which levels each colour step stands for,
  // and what the special marks are. Desirability and cost are grouped into five steps: more would blur together.
  const RAMP = {
    cd: ['v', 'poor value', 'great value', 'Across is cost, up is desirability, and colour is value for money.', ['1', '2', '3', '4', '5']],
    cv: ['s', 'looked down on', 'revered', 'Across is cost, up is value for money, and colour is desirability.', ['2–3', '4–5', '6–7', '8–9', '10']],
    vd: ['k', '', '', 'Across is value for money, up is desirability, and colour is cost.', tierBands.map(t => t.name.toLowerCase())]
  };
  function sample(parent, d, cls) {
    const s = S('svg', { class: 'map-key', width: 22, height: 16, viewBox: '-9 -8 22 16', 'aria-hidden': 'true', focusable: 'false', 'data-view': view }, parent);
    mark(S('g', { class: 'd ' + cls }, s), d, 5);
  }
  function drawLegend() {
    const [k, low, high, how, bins] = RAMP[view];
    legend.textContent = '';
    H('span', 'how', legend, how);
    const ramp = H('span', 'item ramp', legend);
    if (low) H('span', '', ramp, low);
    bins.forEach((name, i) => { const b = H('span', 'bin', ramp); sample(b, {}, k + (i + 1)); H('span', '', b, name); });
    if (high) H('span', '', ramp, high);
    const item = (d, cls, label) => { const s = H('span', 'item', legend); sample(s, d, cls); H('span', '', s, label); };
    item({ pick: true }, k + 4, 'makes one of the 25 picks');
    item({ skip: true }, 'skip', 'mostly sells a logo');
    item({ open: true }, k + 4, 'starting price, no top');
    if (view === 'vd') item({ kc: 0 }, 'k0', 'no list price');
  }

  // ---------- Labels: a few names, placed only where they touch nothing

  const DIRS = [[1, 0], [-1, 0], [0, -1], [0, 1], [1, -1], [1, 1], [-1, -1], [-1, 1]];
  let sel = null, act = null, shown = new Set(), labelTimer = 0;
  const on = d => shown.has(d.x);
  const fadeIn = e => { if (e.animate) e.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, easing: 'ease' }); };
  function labels(fade) {
    ann.textContent = ''; if (fade) fadeIn(ann);
    const g = G, r = g.r, fs = g.fs, hgt = fs + 3, boxes = [];
    // Worth a look and the picks come first, then the best known; logo-first brands come last.
    // With a filter on, every brand it keeps may be named, and the faded dots are no obstacle: a name may sit over them.
    const rank = d => d === sel ? 99 : (d.worth ? 4 : 0) + (d.pick ? 3 : 0) - (d.skip ? 1 : 0) + d.x.known / 10 + d.x.sum / 1000;
    const some = shown.size < dots.length;
    const want = dots.filter(d => d === sel || (on(d) && (some || d.worth || d.pick || d.x.known >= 4))).sort((a, b) => rank(b) - rank(a) || a.x.i - b.x.i);
    const band = new Map(); g.bands.forEach(b => { b.m.forEach(d => band.set(d, b)); if (g.cap) boxes.push([g.pad, b.y0, g.pad + b.capW, b.y0 + g.cap]); });   // names keep off the band's own name
    const ink = [], along = (x0, y0, x1, y1) => { const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 2), pts = []; for (let i = 0; i <= n; i++) pts.push([x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n]); return pts; };   // points along the leaders drawn so far
    const drawn = [], near = (q, x0, y0, x1, y1) => x0 < q[2] + 3 && x1 > q[0] - 3 && y0 < q[3] + 1 && y1 > q[1] - 1;
    const put = (d, x0, y0, x1, forced) => {
      const left = x1 < d.X, box = [x0, y0, x1, y0 + hgt];        // a name on the left of its dot is set flush right
      drawn.push([box, text(ann, 'lab' + (d.worth || d === sel ? ' w' : '') + (d.skip ? ' skip' : '') + (d === sel ? ' sel' : '') + (forced ? ' forced' : ''), left ? x1 - 1 : x0 + 1, y0 + hgt / 2, d.name, left ? 'end' : 'start')]);
      boxes.push(box);
    };
    let n = 0;
    for (const d of want) if (d.hold) { put(d, d.hold[0], d.hold[1], d.hold[2]); n++; }
    for (const d of want) {
      if (d.hold) continue;
      if (n >= g.maxLab && d !== sel) break;
      const b = band.get(d), heavy = d.worth || d === sel, w = tw(d.name, fs, heavy ? 500 : 400) + 2, e = ext(d, r) + 2;
      // A label stays inside its own band, and in the grid inside its own cell, clear of the dots there.
      const col = view === 'vd' ? g.cols[d.val - 1] : null;
      let lim = [col ? col.x0 + 2 : g.left, b.y0 + b.cap + 1, col ? col.x1 - 2 : g.right, b.y1 - 1], among = b.m, home = true;
      const clear = (x0, y0, x1, y1, ax, ay) => {
        if (x0 < lim[0] || y0 < lim[1] || x1 > lim[2] || y1 > lim[3]) return false;
        if (boxes.some(q => near(q, x0, y0, x1, y1))) return false;
        if (ink.some(q => q[0] > x0 - 2 && q[0] < x1 + 2 && q[1] > y0 - 1 && q[1] < y1 + 1)) return false;        // not on top of another name's leader
        if (ax != null && along(d.X, d.Y, ax, ay).some(q => boxes.some(k => q[0] > k[0] - 2 && q[0] < k[2] + 2 && q[1] > k[1] - 1 && q[1] < k[3] + 1) || ink.some(k => (k[0] - q[0]) ** 2 + (k[1] - q[1]) ** 2 < 9))) return false;   // nor its leader across a name or another leader
        for (const o of among) {
          if (o === d || !on(o)) continue;
          const oe = ext(o, r) + 2.5 + (o.open ? r * 0.55 : 0), nx = Math.max(x0, Math.min(o.X, x1)), ny = Math.max(y0, Math.min(o.Y, y1));
          if ((o.X - nx) ** 2 + (o.Y - ny) ** 2 < oe * oe) return false;
          if (home && o.Y > y0 - 1 && o.Y < y1 + 1 && o.X > x0 - oe - 6 && o.X < x1 + oe + 6) return false;   // another dot level with the name and close to its end would look like the name's own
          if (ax != null) {                                       // a leader line must not cross another dot either
            const vx = ax - d.X, vy = ay - d.Y, t = Math.max(0, Math.min(1, ((o.X - d.X) * vx + (o.Y - d.Y) * vy) / (vx * vx + vy * vy)));
            if ((o.X - d.X - t * vx) ** 2 + (o.Y - d.Y - t * vy) ** 2 < oe * oe) return false;
          }
        }
        return true;
      };
      // Beside the dot first; then above, below or at a corner on a short tick; then a little further out on a leader.
      // On the right of a mark with a point, the name starts clear of the point.
      const past = (ux, uy) => d.open && ux > 0 && !uy ? r * 0.55 : 0;
      const seek = () => {
        for (const q of d === sel || d.pick ? [0, 5, 10, 16, 24, 34, 46] : [0, 5, 10, 16]) for (const [ux, uy] of DIRS) {
          if (!q && uy) continue;
          const k = (ux && uy ? 0.74 : 1) * (e + q) + past(ux, uy), ax = d.X + ux * k, ay = d.Y + uy * k;
          const x0 = ux > 0 ? ax : ux < 0 ? ax - w : ax - w / 2, y0 = uy > 0 ? ay : uy < 0 ? ay - hgt : ay - hgt / 2;
          if (clear(x0, y0, x0 + w, y0 + hgt, q ? ax : null, ay)) return [x0, y0, q ? [ux, uy, ax, ay] : null];
        }
        return null;
      };
      let spot = seek();
      if (!spot && d !== sel) continue;
      // The chosen brand is always named. If its own band has no room, anywhere on the chart that touches no dot and no name will do.
      if (!spot) { lim = [g.left, g.top + 1, g.right, g.A - 1]; among = dots; home = false; spot = seek(); }
      // Failing that its name goes right beside the dot on a patch of the background, on the side where it covers the fewest dots
      // and no other name. A pick's name that it still lands on gives way.
      if (!spot) {
        let low = Infinity;
        for (const [ux, uy] of DIRS) {
          const k = (ux && uy ? 0.74 : 1) * e + past(ux, uy), ax = d.X + ux * k, ay = d.Y + uy * k;
          const x0 = Math.max(g.left, Math.min(g.right - w, ux > 0 ? ax : ux < 0 ? ax - w : ax - w / 2)), y0 = Math.max(g.top + 1, Math.min(g.A - 1 - hgt, uy > 0 ? ay : uy < 0 ? ay - hgt : ay - hgt / 2));
          const under = (o, m) => { const nx = Math.max(x0, Math.min(o.X, x0 + w)), ny = Math.max(y0, Math.min(o.Y, y0 + hgt)); return (o.X - nx) ** 2 + (o.Y - ny) ** 2 < m * m; };
          let cost = (under(d, ext(d, r)) ? 500 : 0) + 1000 * boxes.filter(q => near(q, x0, y0, x0 + w, y0 + hgt)).length;
          for (const o of dots) if (o !== d && on(o) && under(o, ext(o, r) + 1)) cost++;
          if (cost < low) { low = cost; spot = [x0, y0, null, true]; }
        }
        for (const k of drawn) if (near(k[0], spot[0], spot[1], spot[0] + w, spot[1] + hgt)) { k[1].remove(); boxes.splice(boxes.indexOf(k[0]), 1); }
      }
      const [x0, y0, lead, forced] = spot;
      if (lead) { const k = ext(d, r) + 1.5 + past(lead[0], lead[1]), m = lead[0] && lead[1] ? 0.74 : 1; line(ann, 'lead', d.X + lead[0] * k * m, d.Y + lead[1] * k * m, lead[2], lead[3]); ink.push(...along(d.X, d.Y, lead[2], lead[3])); }
      put(d, x0, y0, x0 + w, forced); n++;
    }
  }

  // ---------- Hover, focus and selection

  const sentence = d => {
    const x = d.x, p = !x.rng ? 'No list price, ' + x.r[3].toLowerCase() : 'Typical price ' + (d.open ? 'from ' + money(x.rng[0]) + ' with no top' : money(x.rng[0]) + ' to ' + money(x.rng[1]));
    return `${d.name}, ${x.r[1]}. ${p}. Value ${d.val} of 5, desirability ${d.des} of 10.` +
      (d.worth ? ' Worth a look.' : '') + (d.pick ? ' Makes one of the 25 picks.' : '') + (x.unusual ? ' Unusual.' : '') + (d.skip ? ' Mostly sells a logo.' : '');
  };
  function tags(parent, d) {
    if (d.worth) H('span', 'tag w', parent, 'Worth a look');
    if (d.pick) H('span', 'tag pk', parent, 'Pick');
    if (d.x.unusual) H('span', 'tag u', parent, 'Unusual');
  }
  function place(ring, d) {
    ring.style.display = d ? '' : 'none';
    if (d) { ring.setAttribute('r', ext(d, G.r) + 3); ring.style.transform = `translate(${f(d.X)}px,${f(d.Y)}px)`; }
  }
  // The brand's whole price range, drawn along the cost axis under the dot.
  function range(d) {
    rb.textContent = ''; und.textContent = '';
    if (!d || !G || view === 'vd' || !d.x.rng) return;
    const a = G.cx(d.x.rng[0]), b = d.open ? G.axR : G.cx(d.x.rng[1]), y = G.A;
    line(und, 'drop', d.X, d.Y, d.X, y);
    line(rb, 'bar', a, y, b, y); line(rb, 'end', a, y - 5, a, y + 5);
    if (d.open) S('path', { class: 'end', d: `M${f(b - 7)} ${f(y - 5)}L${f(b)} ${f(y)}L${f(b - 7)} ${f(y + 5)}` }, rb);
    else line(rb, 'end', b, y - 5, b, y + 5);
  }
  function showTip(d) {
    tip.textContent = '';
    if (!d) { tip.hidden = true; return; }
    H('b', 'tn', tip, d.name);
    const row = (value, name, cls) => { const p = H('span', 'tr', tip); if (cls) sample(p, {}, cls); H('b', '', p, value); H('span', '', p, name); };
    row(d.x.r[3], d.x.rng ? 'typical new' : '', view === 'vd' ? 'k' + d.kc : '');
    row(d.val + ' of 5', 'value', view === 'cd' ? 'v' + d.val : '');
    row(d.des + ' of 10', 'desirability', view === 'cv' ? 's' + d.kd : '');
    const t = H('span', 'tt', tip); tags(t, d); if (d.skip) H('span', '', t, 'Mostly sells a logo');
    if (!t.firstChild) t.remove();
    if (d === sel) H('span', 'tm', tip, 'Chosen. Details are under the map.');   // the panel may be a screen below
    tip.hidden = false;
    const w = tip.offsetWidth, h = tip.offsetHeight, e = ext(d, G.r) + 9, top = d.Y - e - h;
    tip.style.left = f(Math.max(4, Math.min(G.W - w - 4, d.X - w / 2))) + 'px';
    // Above the dot; under it where the chart or the window ends above. It may run over the legend sooner than off the screen.
    const pt = plot.getBoundingClientRect().top, up = pt + top >= 4, down = pt + d.Y + e + h <= innerHeight - 4;
    tip.style.top = f(up && (top >= 4 || !down) ? top : d.Y + e) + 'px';
  }
  // Words for a screen reader. The same words twice running would not be read again, so a repeat is made to differ.
  const say = s => { live.textContent = s === live.textContent ? s + '\u00a0' : s; };
  function setActive(d, how) {
    if (d === act) return;
    act = d;
    if (d && how === 'key') {
      const y = plot.getBoundingClientRect().top + d.Y, m = 90;   // keep the focused dot on screen; first, so the tooltip is placed for where the dot ends up
      if (y < m) scrollBy(0, y - m); else if (y > innerHeight - m) scrollBy(0, y - innerHeight + m);
    }
    place(actRing, d); showTip(d); range(d || sel);
    plot.style.cursor = d && how !== 'key' ? 'pointer' : '';
    if (d && how === 'key') say(sentence(d));
  }
  function select(d) {
    if (d === sel) return;
    sel = d; place(selRing, d); range(act || sel); fill();
    if (act) showTip(act);                                        // its tooltip says whether it is the chosen one
    clearTimeout(labelTimer); labels(false);
  }

  // The detail panel under the chart.
  function fill() {
    detail.textContent = '';
    if (!sel) { H('p', 'md-hint', detail, 'Choose a dot to see the brand here. Click or tap one, or move to it with the arrow keys and press Enter.'); return; }
    const x = sel.x, r = x.r, box = H('div', 'md', detail), t = H('span', 't', box);
    const a = (parent, href, str, out) => { if (!href) return H('span', '', parent, str); const e = H('a', '', parent, str); e.href = href; if (out) { e.target = '_blank'; e.rel = 'noopener'; } return e; };
    if (r[8]) { const im = H('img', '', t); im.src = r[8]; im.alt = ''; im.width = 176; im.height = 176; }
    const main = H('div', 'md-main', box), h = H('h4', '', main);
    a(h, r[6], r[0], true); tags(h, sel);
    H('p', 'md-from', main, r[1]); H('p', 'md-known', main, r[2]);
    box.insertAdjacentHTML('beforeend', IX.meters(x));            // the same four rating bars as the list
    const dl = H('dl', 'md-facts', box), fact = name => { const row = H('div', '', dl); H('dt', '', row, name); return H('dd', '', row); };
    fact('Typical new').textContent = r[3] + (x.lines ? `, about ${x.lines} model line${x.lines === 1 ? '' : 's'}` : '');
    a(fact('Standout watch'), r[7], r[4], true);
    if (x.picks.length) { const dd = fact(x.picks.length > 1 ? 'Our picks' : 'Our pick'); x.picks.forEach(p => { const li = H('span', 'md-pick', dd); a(li, '#picks', p.model); H('span', '', li, ', ' + p.price); }); }
    const acts = H('div', 'md-acts', box), go = H('button', '', acts, 'Show in the list'), clr = H('button', '', acts, 'Clear');
    go.type = clr.type = 'button';
    go.addEventListener('click', () => IX.reveal(x));
    clr.addEventListener('click', () => { select(null); plot.focus(); });
  }

  // The nearest brand to a point on the chart, if one is within about 24px. Faded brands do not count.
  function nearest(e) {
    const box = plot.getBoundingClientRect(), x = e.clientX - box.left, y = e.clientY - box.top;
    let best = null, far = 24 * 24;
    for (const d of dots) { if (!on(d)) continue; const q = (d.X - x) ** 2 + (d.Y - y) ** 2; if (q < far) { far = q; best = d; } }
    return best;
  }
  // A mouse or a pen hovers; a finger does not, so a touch is left to the click below.
  plot.addEventListener('pointermove', e => { if (e.pointerType !== 'touch' && G) setActive(nearest(e), 'mouse'); });
  plot.addEventListener('pointerleave', e => { if (e.pointerType !== 'touch') setActive(null); });
  plot.addEventListener('click', e => {
    if (!G) return;
    const d = nearest(e);
    select(d); setActive(d, 'tap');                               // on a touch screen the tooltip is the first answer; the panel may be a screen below
    if (d) say(d.name + ' chosen. Details are under the map.');
  });
  // Escape puts a hover tooltip away even when the chart does not have the keyboard.
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && act && document.activeElement !== plot) setActive(null); });
  // Arrow keys move to the nearest brand in that direction, looking mostly straight ahead.
  function step(from, ux, uy) {
    let best = null, low = Infinity, wide = null, lowWide = Infinity;
    for (const d of dots) {
      if (d === from || !on(d)) continue;
      const dx = d.X - from.X, dy = d.Y - from.Y, along = dx * ux + dy * uy, across = Math.abs(dx * uy - dy * ux);
      if (along < 1) continue;
      const s = along + 2 * across;
      if (across <= along * 1.5) { if (s < low) { low = s; best = d; } } else if (s < lowWide) { lowWide = s; wide = d; }
    }
    return best || wide;
  }
  plot.addEventListener('keydown', e => {
    if (!G || e.altKey || e.ctrlKey || e.metaKey) return;
    const k = e.key, from = act || (sel && on(sel) ? sel : null), list = dots.filter(on).sort(byCost);
    const move = { ArrowRight: [1, 0, 'right'], ArrowLeft: [-1, 0, 'left'], ArrowUp: [0, -1, 'up'], ArrowDown: [0, 1, 'down'] }[k];
    let to;
    if (k === 'Escape') { if (!act && !sel) return; setActive(null); select(null); say('Cleared.'); }
    else if (k === 'Enter' || k === ' ') { if (act) { select(act); say(act.name + ' chosen. Details are under the map.'); } }
    else if (k === 'Home') to = list[0];
    else if (k === 'End') to = list.filter(d => d.cost != null).pop() || list[list.length - 1];   // the dearest: a brand with no list price is not it
    else if (move) to = from ? step(from, move[0], move[1]) || (from === act ? null : from) : list[0];
    else return;
    e.preventDefault();
    if (to) { if (to === act) say(sentence(to)); else setActive(to, 'key'); }
    else if (move || k === 'Home' || k === 'End') say(list.length ? `No brand further ${move[2]}.` : 'No brands match the filters.');   // at the edge, or nothing to move to
  });
  plot.addEventListener('blur', () => setActive(null));

  // ---------- Putting it together

  let lastR = 0, moveTimer = 0;
  function draw(move) {
    const W = plot.clientWidth;
    if (!W) return;                                               // the map is hidden
    G = layout(W);
    const glide = move && !calm.matches;                          // dots glide only when the view changes
    svg.classList.toggle('moving', glide); clearTimeout(moveTimer);
    if (glide) moveTimer = setTimeout(() => svg.classList.remove('moving'), 450);
    svg.setAttribute('width', W); svg.style.height = G.H + 'px'; svg.dataset.view = view;
    ['fs', 'lv', 'ln', 'cs'].forEach(k => svg.style.setProperty('--' + k, G[k] + 'px'));
    if (glide) fadeIn(fur);
    if (G.r !== lastR) { dots.forEach(d => mark(d.g, d, G.r)); lastR = G.r; }
    dots.forEach(d => { d.g.style.transform = `translate(${f(d.X)}px,${f(d.Y)}px)`; });
    viewEl.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === view));
    furniture(); drawLegend(); filter(true);
    act = null; place(actRing, null); showTip(null); place(selRing, sel); range(sel);
    ann.textContent = ''; clearTimeout(labelTimer);
    if (glide) labelTimer = setTimeout(labels, 380, true); else labels(false);
  }
  // The list's filters drive the map too: brands they hide fade to a ghost, and nothing moves.
  function filter(quiet) {
    shown = IX.shown;
    dots.forEach(d => d.g.classList.toggle('off', !on(d)));
    if (act && !on(act)) setActive(null);
    flt.textContent = '';
    const b = IX.band;
    if (G && b && view !== 'vd') {
      const a = b[0] > LO ? G.cx(b[0]) : G.left, z = b[1] >= HI ? G.axR : G.cx(b[1]);
      if (z > a) S('rect', { x: f(a), y: f(G.A), width: f(z - a), height: 24 }, flt);
    }
    fur.querySelectorAll('.tier').forEach(t => { const tb = tierBands[t.dataset.t].band; t.classList.toggle('on', !!b && b[0] === tb[0] && b[1] === tb[1]); });
    if (!quiet && G) { clearTimeout(labelTimer); labels(false); }
  }
  const calm = matchMedia('(prefers-reduced-motion: reduce)');
  viewEl.addEventListener('click', e => { const b = e.target.closest('button'); if (b && b.dataset.v !== view) { view = b.dataset.v; draw(true); } });
  let hidden = false;
  try { hidden = localStorage.getItem('wbm-map') === 'hide'; } catch (e) {}
  function setHidden(h) {
    hidden = h; body.hidden = h; viewEl.hidden = h;
    root.classList.toggle('shut', h);                             // hidden, the map is one line: its heading and the button
    toggle.setAttribute('aria-expanded', String(!h)); toggle.textContent = h ? 'Show map' : 'Hide map';
    if (!h) draw(false);
  }
  toggle.addEventListener('click', () => { setHidden(!hidden); try { localStorage.setItem('wbm-map', hidden ? 'hide' : 'show'); } catch (e) {} });
  // The map's place on the page, and its link at the top, stay hidden until here: if anything above failed,
  // or the first drawing does, the page shows no empty frame and the list carries on without the map.
  const link = document.querySelector('.jump a[href="#map"]'), reveal = on => { root.hidden = !on; if (link) link.hidden = !on; };
  reveal(true);
  try { fill(); setHidden(hidden); } catch (e) { reveal(false); throw e; }
  if (location.hash === '#map') root.scrollIntoView();
  document.addEventListener('wbm-index', () => filter(false));    // the list's filters changed
  // Lay out again when the width changes, and once the typeface has loaded (label widths depend on it).
  // The redraw waits for the next frame: it changes the chart's height, which must not happen inside the observer.
  let frame = 0;
  const resized = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(() => { if (!hidden && (!G || G.W !== plot.clientWidth)) draw(false); }); };
  if (window.ResizeObserver) new ResizeObserver(resized).observe(plot); else addEventListener('resize', resized);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { widths.clear(); if (!hidden) draw(false); });
})();
