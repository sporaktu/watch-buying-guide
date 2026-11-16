// Masthead dial. Thirty dials drawn after well-known watch and clock designs; each shows the
// reader's local time. A new one appears on every page load unless the reader has chosen one for
// the session or pinned one. Randomize picks another and removes the pin.
(function () {
  'use strict';
  const el = document.getElementById('dial'), cap = document.getElementById('dialName');
  if (!el) return;
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const SANS = "Jost,Futura,'Century Gothic',sans-serif", SERIF = "Georgia,'Times New Roman',serif";
  const ROM = ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
  const rad = d => d * Math.PI / 180, f1 = n => +n.toFixed(1);

  // Colours
  const STEEL = '#c9ccd1', GOLD = '#c8a04a', ROSE = '#cf9a78', INK = '#17181b', LUME = '#ece8d0', WHITE = '#f7f6f1',
    BLUED = '#1f3f9c', CREAM = '#f1ead8', RED = '#d3311f', NAVY = '#17305f', OLD = '#e3c98e';

  // ---- geometry helpers (origin at the dial centre, 12 o'clock is up) ----
  function pos(r, d, c) {
    const s = Math.sin(rad(d)), k = -Math.cos(rad(d));
    if (c.sq) { const t = Math.min(r * c.mx / Math.abs(s || 1e-9), r * c.my / Math.abs(k || 1e-9)); return [f1(s * t), f1(k * t)]; }
    return [f1(r * s), f1(r * k)];
  }
  const ln = (r1, r2, d, w, col, c, cap) => { const a = pos(r1, d, c), b = pos(r2, d, c); return `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="${col}" stroke-width="${w}"${cap ? ' stroke-linecap="round"' : ''}/>`; };
  const num = (t, r, d, size, c, o) => { const [x, y] = pos(r, d, c); return `<text x="${x}" y="${y}" font-size="${size}" font-family="${o.serif ? SERIF : SANS}" font-weight="${o.wt || 500}" fill="${o.col}" text-anchor="middle" dominant-baseline="central"${o.radial ? ` transform="rotate(${d} ${x} ${y})"` : ''}>${t}</text>`; };
  const dot = (r, d, rr, col, c, st) => { const [x, y] = pos(r, d, c); return `<circle cx="${x}" cy="${y}" r="${rr}" fill="${col}"${st ? ` stroke="${st}" stroke-width="1.5"` : ''}/>`; };
  const tri = (r, s, col, st) => `<polygon points="${-s},${-(r + s * .8)} ${s},${-(r + s * .8)} 0,${-(r - s * .9)}" fill="${col}"${st ? ` stroke="${st}" stroke-width="1.5"` : ''}/>`;
  const bar = (r, d, len, w, col, st) => `<rect x="${-w / 2}" y="${-(r + len / 2)}" width="${w}" height="${len}" fill="${col}"${st ? ` stroke="${st}" stroke-width="1.5"` : ''} transform="rotate(${d})"/>`;

  function shape(sh, inset, attrs) {
    const R = 198 - inset;
    if (sh === 'oct') { let p = ''; for (let i = 0; i < 8; i++) p += `${f1(R * Math.sin(rad(22.5 + i * 45)))},${f1(-R * Math.cos(rad(22.5 + i * 45)))} `; return `<polygon points="${p}" ${attrs}/>`; }
    if (sh === 'cushion') return `<rect x="${-R}" y="${-R}" width="${2 * R}" height="${2 * R}" rx="${R * .46}" ${attrs}/>`;
    if (sh === 'softoct') return `<rect x="${-R}" y="${-R * .92}" width="${2 * R}" height="${2 * R * .92}" rx="${R * .5}" ${attrs}/>`;
    if (sh === 'rect') return `<rect x="${-138 + inset}" y="${-194 + inset}" width="${276 - 2 * inset}" height="${388 - 2 * inset}" rx="${Math.max(4, 22 - inset)}" ${attrs}/>`;
    return `<circle r="${R}" ${attrs}/>`;
  }

  // ---- minute tracks ----
  function track(c) {
    const t = c.tk, col = c.tc || c.mc; let s = '';
    if (t === 'ticks') for (let i = 0; i < 60; i++) { if (i % 5 || c.tkAll) s += ln(176, 187, i * 6, i % 5 ? 1.2 : 2.4, col, c); }
    if (t === 'dots') for (let i = 0; i < 60; i++) s += dot(182, i * 6, i % 5 ? 1.6 : 3.2, col, c);
    if (t === 'rail') {
      const out = r => c.sq ? `<rect x="${-r * c.mx}" y="${-r * c.my}" width="${2 * r * c.mx}" height="${2 * r * c.my}" fill="none" stroke="${col}" stroke-width="1.3"/>` : `<circle r="${r}" fill="none" stroke="${col}" stroke-width="1.3"/>`;
      const a = c.ra || 174, b = c.rb || 187; s += out(a) + out(b);
      for (let i = 0; i < 60; i++) s += ln(a, b, i * 6, i % 5 ? 1.2 : 3.4, col, c);
    }
    return s;
  }

  // ---- hour markers ----
  function marks(c) {
    const m = c.mk, col = c.mc, lu = c.lume || col, st = c.mst; let s = '';
    const each = fn => { for (let h = 0; h < 12; h++) s += fn(h, h * 30) || ''; };
    switch (m.t) {
      case 'baton': each((h, d) => (m.dbl && !h) ? `<g transform="translate(${-m.w * .75} 0)">${bar(m.r || 166, 0, m.len || 34, m.w * .8, col, st)}</g><g transform="translate(${m.w * .75} 0)">${bar(m.r || 166, 0, m.len || 34, m.w * .8, col, st)}</g>` : (c.date === h ? '' : bar(m.r || 166, d, m.len || 34, m.w, col, st))); break;
      case 'block': each((h, d) => ln(140, 187, d, 12, col, c)); for (let i = 0; i < 60; i++) if (i % 5) s += ln(174, 187, i * 6, 4, col, c); break;
      case 'line': each((h, d) => ln(146, 187, d, 2.2, col, c)); for (let i = 0; i < 60; i++) if (i % 5) s += ln(170, 187, i * 6, 1, col, c); break;
      case 'dots': each((h, d) => !h ? tri(158, 15, lu, st) : (h % 3 === 0 ? (c.date === h ? '' : bar(158, d, 30, 13, lu, st)) : dot(158, d, 11.5, lu, c, st))); break;
      case 'squares': each((h, d) => !h ? tri(158, 15, lu, st) : (h % 3 === 0 ? (c.date === h ? '' : bar(156, d, 32, 15, lu, st)) : bar(158, d, 21, 21, lu, st))); break;
      case 'arabic': each((h, d) => (m.only && !m.only.includes(h)) ? (c.sq ? ln((m.r || 150) - (m.len || 30) / 2, (m.r || 150) + (m.len || 30) / 2, d, m.w || 4, col, c) : bar(166, d, m.len || 30, m.w || 4, col)) : num(h || 12, m.r || 150, d, m.s || 34, c, { col, wt: m.wt, serif: m.serif })); break;
      case 'roman': each((h, d) => (m.only && !m.only.includes(h)) ? bar(160, d, m.len || 26, m.w || 4, col) : num(ROM[h], m.r || 146, d, m.s || 30, c, { col, serif: 1, radial: 1, wt: 400 })); break;
      case 'cali': each((h, d) => !h ? tri(152, 15, lu) : h % 3 === 0 ? bar(152, d, 34, 12, lu) : (h > 3 && h < 9 ? num(h, 148, d, 36, c, { col: lu, wt: 500 }) : num(ROM[h], 148, d, 32, c, { col: lu, serif: 1, radial: 1 }))); break;
      case 'explorer': each((h, d) => !h ? tri(156, 16, lu, st) : h % 3 === 0 ? num(h, 150, d, 42, c, { col: lu, wt: 500 }) : bar(158, d, 34, 9, lu, st)); break;
      case 'fliegerA': each((h, d) => !h ? tri(150, 17, lu) + dot(160, -9, 4, lu, c) + dot(160, 9, 4, lu, c) : num(h, 140, d, 34, c, { col: lu, wt: 500 })); break;
      case 'fliegerB':
        each((h, d) => !h ? tri(152, 15, lu) : num(String(h * 5).padStart(2, '0'), 150, d, 27, c, { col: lu, wt: 500 }));
        s += `<circle r="98" fill="none" stroke="${lu}" stroke-width="2"/>`;
        each((h, d) => num(h || 12, 76, d, 17, c, { col: lu, wt: 500 })); break;
      case 'sector':
        s += `<circle r="187" fill="none" stroke="${col}" stroke-width="1.4"/><circle r="152" fill="none" stroke="${col}" stroke-width="1.4"/><circle r="92" fill="none" stroke="${col}" stroke-width="1.4"/>`;
        for (let i = 0; i < 60; i++) s += ln(i % 5 ? 170 : 152, 187, i * 6, i % 5 ? 1.2 : 2.4, col, c);
        each((h, d) => h % 2 ? ln(92, 152, d, 1.2, col, c) : num(h || 12, 122, d, 30, c, { col, wt: 400 })); break;
      case 'museum': s += `<circle cy="-140" r="19" fill="${col}"/>`; break;
      case 'field':
        each((h, d) => num(h || 12, 142, d, 30, c, { col: lu, wt: 500 }) + num(h ? h + 12 : 24, 100, d, 15, c, { col: lu, wt: 400 }) + tri(180, 5, lu).replace('<polygon', `<polygon transform="rotate(${d})"`)); break;
      case 'sandwich': each((h, d) => m.only.includes(h) ? num(h || 12, 138, d, 52, c, { col: lu, wt: 400 }) : (h % 3 === 0 ? '' : bar(150, d, 44, 8, lu))); break;
    }
    return s;
  }

  // ---- hands (drawn pointing up from the pivot) ----
  function H(st, L, w, f, o) {
    o = o || {}; const t = o.tail == null ? 18 : o.tail, sk = o.st ? ` stroke="${o.st}" stroke-width="1.3"` : ''; let s = '';
    switch (st) {
      case 'baton': s = `<rect x="${-w / 2}" y="${-L}" width="${w}" height="${L + t}" fill="${f}"${sk}/>`; break;
      case 'block': s = `<polygon points="${-w / 2},${t + 14} ${-w * .36},${-L} ${w * .36},${-L} ${w / 2},${t + 14}" fill="${f}"/>`; break;
      case 'pencil': s = `<polygon points="${-w / 2},${t} ${-w / 2},${-L + w * 1.5} 0,${-L} ${w / 2},${-L + w * 1.5} ${w / 2},${t}" fill="${f}"${sk}/>`; break;
      case 'sword': s = `<polygon points="${-w * .28},${t} ${-w / 2},${-L * .7} 0,${-L} ${w / 2},${-L * .7} ${w * .28},${t}" fill="${f}"${sk}/>`; break;
      case 'dauphine': s = `<polygon points="0,${t} ${-w / 2},0 0,${-L} ${w / 2},0" fill="${f}"${sk}/><polygon points="0,${t} ${w / 2},0 0,${-L}" fill="#000" opacity=".2"/>`; break;
      case 'leaf': s = `<path d="M0,${t} C${-w},${-L * .25} ${-w * .55},${-L * .7} 0,${-L} C${w * .55},${-L * .7} ${w},${-L * .25} 0,${t}Z" fill="${f}"${sk}/>`; break;
      case 'breguet': { const cy = -L * .7, r = w * 1.5; s = `<line y1="${t}" y2="${cy + r}" stroke="${f}" stroke-width="${w * .62}"/><circle cy="${cy}" r="${r}" fill="none" stroke="${f}" stroke-width="${w * .6}"/><polygon points="${-w * .34},${cy - r} 0,${-L} ${w * .34},${cy - r}" fill="${f}"/>`; break; }
      case 'mercedes': { const cy = -L * .66, r = w * 1.2; s = `<rect x="${-w * .3}" y="${cy + r}" width="${w * .6}" height="${t - cy - r}" fill="${f}"/><circle cy="${cy}" r="${r}" fill="${o.lume || f}" stroke="${f}" stroke-width="${w * .32}"/><polygon points="${-w * .5},${cy - r} 0,${-L} ${w * .5},${cy - r}" fill="${o.lume || f}" stroke="${f}" stroke-width="2"/>`; break; }
      case 'snow': { const cy = -L * .7, r = w * 1.25; s = `<rect x="${-w * .34}" y="${cy}" width="${w * .68}" height="${t - cy}" fill="${f}"/><rect x="${-r}" y="${cy - r}" width="${2 * r}" height="${2 * r}" transform="rotate(45 0 ${cy})" fill="${o.lume || f}" stroke="${f}" stroke-width="2.5"/>`; break; }
      case 'syringe': s = `<rect x="${-w / 2}" y="${-L * .78}" width="${w}" height="${L * .78 + t}" fill="${f}"${sk}/><rect x="${-w * .12}" y="${-L}" width="${w * .24}" height="${L * .24}" fill="${f}"/>`; break;
      case 'arrow': s = `<rect x="${-w * .24}" y="${-L * .7}" width="${w * .48}" height="${L * .7 + t}" fill="${f}"/><polygon points="${-w},${-L * .68} 0,${-L} ${w},${-L * .68}" fill="${f}"/>`; break;
    }
    if (o.lume && /baton|pencil|sword|syringe|block/.test(st)) s += `<rect x="${-w * .22}" y="${-L * .88}" width="${w * .44}" height="${L * .62}" fill="${o.lume}"/>`;
    return s;
  }
  function S(st, L, f, o) {
    o = o || {};
    if (st === 'disc') return `<line y1="46" y2="${-L * .76}" stroke="${f}" stroke-width="3.4"/><circle cy="${-L * .76}" r="13.5" fill="${f}"/>`;
    if (st === 'needle') return `<line y1="${L * .22}" y2="${-L}" stroke="${f}" stroke-width="${o.w || 2}"/><circle r="${o.pin || 3}" fill="${f}"/>`;
    let s = `<line y1="42" y2="${-L}" stroke="${f}" stroke-width="1.8"/>`;
    if (st === 'lolli') s += `<circle cy="${-L * .68}" r="7.5" fill="${o.lume || f}" stroke="${f}" stroke-width="2"/>`;
    if (st === 'counter') s += `<circle cy="30" r="7" fill="${f}"/>`;
    return s + `<circle r="4.2" fill="${f}"/>`;
  }

  // ---- extras: date windows, registers, bezel furniture ----
  function sub(x, y, r, o) {
    let s = `<g transform="translate(${x} ${y})"><circle r="${r}" fill="${o.f || 'none'}" stroke="${o.st || 'none'}" stroke-width="1.3"/>`;
    const n = o.n || 12, c = {};
    for (let i = 0; i < n; i++) s += ln(r * (i % (o.maj || 3) ? .84 : .72), r * .96, i * 360 / n, i % (o.maj || 3) ? 1 : 1.8, o.tc, c);
    (o.nums || []).forEach(([t, d]) => { s += num(t, r * .52, d, r * (o.ns || .3), c, { col: o.tc, wt: 500, serif: o.serif }); });
    if (o.hand != null) s += `<g transform="rotate(${o.hand})">${S('needle', r * .8, o.hc || o.tc)}</g>`;
    return s + '</g>';
  }
  function extras(c, now) {
    let s = '';
    (c.x || []).forEach(e => {
      const k = e[0];
      if (k === 'date') { const [x, y] = pos(e[2] || 132, e[1] * 30, c); s += `<rect x="${x - 19}" y="${y - 14}" width="38" height="28" fill="${e[3] || WHITE}" stroke="${e[5] || 'none'}" stroke-width="1.5"/><text x="${x}" y="${y}" font-size="22" font-family="${SANS}" font-weight="600" fill="${e[4] || INK}" text-anchor="middle" dominant-baseline="central">${now.getDate()}</text>`; }
      if (k === 'sub') s += sub(e[1], e[2], e[3], e[4]);
      if (k === 'bigdate') { const d = String(now.getDate()).padStart(2, '0'); [0, 1].forEach(i => { s += `<rect x="${e[1] + i * 32}" y="${e[2]}" width="30" height="40" fill="${WHITE}" stroke="${e[3]}" stroke-width="2.2"/><text x="${e[1] + i * 32 + 15}" y="${e[2] + 21}" font-size="30" font-family="${SERIF}" fill="${INK}" text-anchor="middle" dominant-baseline="central">${d[i]}</text>`; }); }
      if (k === 'pr') { // power-reserve arc: x, y, r, from, to, colour, hand angle
        const a = pos(e[3], e[4], {}), b = pos(e[3], e[5], {});
        s += `<g transform="translate(${e[1]} ${e[2]})"><path d="M${a[0]},${a[1]} A${e[3]},${e[3]} 0 0 1 ${b[0]},${b[1]}" fill="none" stroke="${e[6]}" stroke-width="2"/>`;
        for (let d = e[4]; d <= e[5]; d += (e[5] - e[4]) / 4) s += ln(e[3] - 7, e[3], d, 1.6, e[6], {});
        s += `<g transform="rotate(${e[7]})">${S('needle', e[3] - 4, e[8] || e[6], { w: 2.4 })}</g></g>`;
      }
      if (k === 'needle') s += S('needle', e[2] || 176, e[1], { w: 1.8, pin: 5 });
      if (k === 'ring') s += `<circle r="${e[1]}" fill="none" stroke="${e[2]}" stroke-width="${e[3] || 1.3}"/>`;
      if (k === 'guilloche') for (let r = 8; r < e[1]; r += 6) s += `<circle r="${r}" fill="none" stroke="${e[2]}" stroke-width="1" opacity=".5"/>`;
    });
    return s;
  }
  function bezel(c) {
    const b = c.bz; if (!b) return '';
    const Ro = 195, Ri = c.Rd + 1, R = (Ro + Ri) / 2, w = Ro - Ri, cc = {}; let s = '';
    if (b.t === 'gmt') {
      s += `<path d="M${-R},0 A${R},${R} 0 0 1 ${R},0" fill="none" stroke="${b.a}" stroke-width="${w}"/><path d="M${R},0 A${R},${R} 0 0 1 ${-R},0" fill="none" stroke="${b.b}" stroke-width="${w}"/>`;
      for (let i = 0; i < 24; i++) s += !i ? tri(R, 9, b.fg) : (i % 2 ? dot(R, i * 15, 2.6, b.fg, cc) : num(i, R, i * 15, 19, cc, { col: b.fg, radial: 1, wt: 600 }));
      return s;
    }
    s += `<circle r="${R}" fill="none" stroke="${b.f}" stroke-width="${w}"/>`;
    if (b.t === 'dive') {
      for (let i = 0; i < 60; i++) { if (!i) s += tri(R, 11, b.fg) + dot(R + 2, 0, 3.5, b.lume || b.fg, cc); else if (i % 10 === 0) s += num(i, R, i * 6, 21, cc, { col: b.fg, radial: 1, wt: 600 }); else if (i % 5 === 0) s += ln(R - 9, R + 9, i * 6, 4, b.fg, cc); else if (i < 15) s += ln(R - 5, R + 5, i * 6, 1.6, b.fg, cc); }
    }
    if (b.t === 'tachy') {
      for (let d = 6; d < 360; d += 6) s += ln(Ri + 2, Ri + (d % 30 ? 7 : 11), d, 1.3, b.fg, cc);
      [[400, 54], [300, 72], [240, 90], [180, 120], [150, 144], [120, 180], [100, 216], [90, 240], [80, 270], [70, 308.6], [60, 360]].forEach(([n, d]) => { s += num(n, R + 4, d, 13, cc, { col: b.fg, radial: 1, wt: 600 }); });
    }
    if (b.screws) for (let i = 0; i < 8; i++) { const [x, y] = pos(R, 22.5 + i * 45, cc); s += `<circle cx="${x}" cy="${y}" r="8.5" fill="${b.sf || '#e6e8ea'}" stroke="${INK}" stroke-width="1"/><line x1="${x - 6}" y1="${y}" x2="${x + 6}" y2="${y}" stroke="${INK}" stroke-width="1.6" transform="rotate(${i * 45 + 20} ${x} ${y})"/>`; }
    return s;
  }
  function pattern(c, id) {
    const p = c.pat; if (!p) return '';
    const clip = c.sq ? `<rect x="${-190 * c.mx}" y="${-190 * c.my}" width="${380 * c.mx}" height="${380 * c.my}"/>` : (c.ds ? shape(c.ds, 8, '') : '<circle r="190"/>');
    let d = `<defs><clipPath id="c${id}">${clip}</clipPath>`, body = '';
    if (p[0] === 'sun') { d += `<radialGradient id="g${id}" cx="35%" cy="30%" r="85%"><stop offset="0" stop-color="${p[1]}"/><stop offset="1" stop-color="${p[2]}"/></radialGradient>`; body = `<rect x="-200" y="-200" width="400" height="400" fill="url(#g${id})"/>`; }
    if (p[0] === 'grid') { d += `<pattern id="g${id}" width="15" height="15" patternUnits="userSpaceOnUse"><rect width="15" height="15" fill="${p[1]}"/><rect x="1.5" y="1.5" width="11" height="11" fill="${p[2]}"/></pattern>`; body = `<rect x="-200" y="-200" width="400" height="400" fill="url(#g${id})"/>`; }
    if (p[0] === 'ribs') { d += `<linearGradient id="h${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p[1]}"/><stop offset="1" stop-color="${p[2]}"/></linearGradient><pattern id="g${id}" width="400" height="22" patternUnits="userSpaceOnUse"><rect y="19" width="400" height="3" fill="#000" opacity=".28"/></pattern>`; body = `<rect x="-200" y="-200" width="400" height="400" fill="url(#h${id})"/><rect x="-200" y="-200" width="400" height="400" fill="url(#g${id})"/>`; }
    if (p[0] === 'snow') { d += `<filter id="g${id}" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.035 0.09" numOctaves="3" seed="7"/><feColorMatrix values="0 0 0 0 .55  0 0 0 0 .58  0 0 0 0 .64  0 0 0 .55 0"/></filter>`; body = `<rect x="-200" y="-200" width="400" height="400" filter="url(#g${id})"/>`; }
    return d + `</defs><g clip-path="url(#c${id})">${body}</g>`;
  }

  // ---- the thirty dials ----
  // case: cs shape, cf fill. Rd dial radius. face, mc marker colour, lume. tk track. mk markers.
  // hd hands [style, fill, hourLen, minLen, hourW, minW, opts]. sc seconds [style, colour, len] or sub-seconds {at,r,..}.
  const D = [
    { n: 'Blued hands, gold indices', a: 'the house dial', face: '#f8f6ef', mc: GOLD, tk: 'ticks', mk: { t: 'baton', w: 6, len: 36, dbl: 1 }, hd: ['leaf', BLUED, 108, 160, 13, 10], sc: ['counter', BLUED, 172] },
    { n: 'Railway station clock', a: 'after Hans Hilfiker’s Swiss railway clock', cf: '#d9dadc', face: WHITE, mc: INK, mk: { t: 'block' }, hd: ['block', INK, 112, 168, 15, 12], sc: ['disc', RED, 172], pin: INK },
    { n: 'Bauhaus line dial', a: 'after Max Bill’s 1961 wristwatch', face: '#f4f3ee', mc: INK, mk: { t: 'line' }, hd: ['baton', INK, 104, 162, 4.5, 3.2, { tail: 0 }], sc: ['thin', INK, 176], x: [['date', 3, 128, '#f4f3ee', INK]] },
    { n: 'Glashütte numerals', a: 'after the Nomos Tangente', face: '#f6f5f0', mc: INK, tk: 'ticks', tc: INK, mk: { t: 'arabic', only: [0, 2, 4, 8, 10], s: 30, r: 148, wt: 400, w: 2.4, len: 34 }, hd: ['baton', BLUED, 100, 156, 5, 4, { tail: 0 }], sc: { at: [0, 88], r: 38, col: BLUED, tc: INK, n: 12 }, pin: BLUED },
    { n: 'Museum dial', a: 'after Nathan George Horwitt', cf: GOLD, face: '#121214', mc: GOLD, mk: { t: 'museum' }, hd: ['dauphine', GOLD, 104, 154, 15, 12], sc: null, pin: GOLD },
    { n: 'Pilot’s watch, type A', a: 'after the 1940s German observation watches', cf: '#9da1a6', face: '#16171a', mc: LUME, lume: LUME, tk: 'ticks', tkAll: 1, mk: { t: 'fliegerA' }, hd: ['sword', '#2a4a8a', 100, 164, 20, 15, { lume: LUME }], sc: ['thin', LUME, 172] },
    { n: 'Pilot’s watch, type B', a: 'after the 1941 navigator’s dial', cf: '#9da1a6', face: '#16171a', mc: LUME, lume: LUME, tk: 'ticks', tkAll: 1, mk: { t: 'fliegerB' }, hd: ['sword', '#2a4a8a', 84, 164, 20, 15, { lume: LUME }], sc: ['thin', LUME, 172] },
    { n: 'Black dive watch', a: 'after the Rolex Submariner', Rd: 150, bz: { t: 'dive', f: '#111214', fg: '#e8e8e4', lume: LUME }, face: '#111214', mc: LUME, lume: LUME, mst: '#d8d9da', tk: 'ticks', tc: '#e8e8e4', date: 3, mk: { t: 'dots' }, hd: ['mercedes', '#dfe0e2', 100, 162, 17, 13, { lume: LUME }], sc: ['lolli', '#dfe0e2', 170, { lume: LUME }], x: [['date', 3, 142, WHITE, INK]] },
    { n: 'Snowflake diver', a: 'after the Tudor Submariner of 1969', Rd: 150, bz: { t: 'dive', f: NAVY, fg: '#e8e8e4', lume: LUME }, face: NAVY, mc: LUME, lume: LUME, mst: '#d8d9da', tk: 'ticks', tc: '#e8e8e4', mk: { t: 'squares' }, hd: ['snow', '#dfe0e2', 104, 162, 17, 13, { lume: LUME }], sc: ['lolli', '#dfe0e2', 170, { lume: LUME }] },
    { n: 'Expedition 3-6-9', a: 'after the Rolex Explorer', face: '#131416', mc: LUME, lume: LUME, mst: '#d8d9da', tk: 'ticks', tc: '#e8e8e4', mk: { t: 'explorer' }, hd: ['mercedes', '#dfe0e2', 100, 164, 17, 13, { lume: LUME }], sc: ['lolli', '#dfe0e2', 172, { lume: LUME }] },
    { n: 'California dial', a: 'after the 1940s half-Roman, half-Arabic dials', cs: 'cushion', Rd: 164, face: '#1a1a1a', mc: OLD, lume: OLD, tk: 'rail', tc: OLD, ra: 178, rb: 188, mk: { t: 'cali' }, hd: ['pencil', GOLD, 96, 156, 16, 13, { lume: OLD }], sc: null, pin: GOLD },
    { n: 'Sector dial', a: 'after the scientific dials of the 1930s', face: '#e9e4d6', mc: '#2a2a2c', mk: { t: 'sector' }, hd: ['leaf', BLUED, 100, 162, 12, 9], sc: ['counter', BLUED, 176] },
    { n: 'Rectangular Roman', a: 'after the Cartier Tank', cs: 'rect', cf: GOLD, sq: 1, mx: .64, my: .93, face: '#f6f4ec', mc: INK, tk: 'rail', tc: INK, ra: 96, rb: 112, mk: { t: 'roman', r: 150, s: 30 }, hd: ['sword', BLUED, 62, 92, 12, 10, { tail: 6 }], sc: null, pin: BLUED },
    { n: 'Moon chronograph', a: 'after the Omega Speedmaster', Rd: 158, bz: { t: 'tachy', f: '#101113', fg: '#e8e8e4' }, face: '#141517', mc: '#efefe8', tk: 'ticks', tc: '#efefe8', tkAll: 1, mk: { t: 'baton', w: 5, len: 26, r: 158 }, hd: ['baton', '#f2f2ec', 100, 156, 8, 6, { tail: 10 }], sc: { at: [-84, 0], r: 38, col: '#f2f2ec', tc: '#efefe8', n: 12 }, x: [['sub', 84, 0, 38, { tc: '#efefe8', n: 30, maj: 5, hand: 0 }], ['sub', 0, 84, 38, { tc: '#efefe8', n: 12, hand: 0 }], ['needle', '#f2f2ec', 172]], pin: '#f2f2ec' },
    { n: 'Panda chronograph', a: 'after the 1960s racing chronographs', Rd: 158, bz: { t: 'tachy', f: '#101113', fg: '#e8e8e4' }, face: '#f3f1ea', mc: INK, tk: 'ticks', tc: INK, tkAll: 1, mk: { t: 'baton', w: 6, len: 22, r: 160 }, hd: ['baton', INK, 100, 154, 8, 6, { tail: 10 }], sc: { at: [-84, 0], r: 40, col: '#f3f1ea', tc: '#f3f1ea', f: '#141517', n: 12 }, x: [['sub', 84, 0, 40, { f: '#141517', tc: '#f3f1ea', n: 30, maj: 5, hand: 0 }], ['sub', 0, 84, 40, { f: '#141517', tc: '#f3f1ea', n: 12, hand: 0 }], ['needle', RED, 172]], pin: INK },
    { n: 'Octagon and tapisserie', a: 'after Gérald Genta’s Royal Oak', cs: 'oct', Rd: 146, bz: { f: '#d3d6da', screws: 1 }, face: '#1d3b6e', pat: ['grid', '#16305c', '#274a85'], mc: '#f0f0ec', mst: '#c9ccd1', tk: 'ticks', tc: '#dfe3ea', date: 3, mk: { t: 'baton', w: 9, len: 38, dbl: 1, r: 158 }, hd: ['baton', '#eceef0', 100, 156, 12, 10, { st: '#9aa0a8', tail: 12 }], sc: ['thin', '#eceef0', 168], x: [['date', 3, 150, '#16305c', '#f0f0ec']] },
    { n: 'Porthole', a: 'after Gérald Genta’s Nautilus', cs: 'softoct', Rd: 160, ds: 'softoct', face: '#1f3f66', pat: ['ribs', '#2d5d8e', '#0f2238'], mc: '#f0f0ec', mst: '#c9ccd1', date: 3, mk: { t: 'baton', w: 10, len: 36, r: 150 }, hd: ['baton', '#eceef0', 96, 150, 13, 11, { st: '#9aa0a8', tail: 10 }], sc: ['thin', '#eceef0', 160], x: [['date', 3, 142, WHITE, INK]] },
    { n: 'Field watch', a: 'after the US A-11 of the 1940s', cf: '#8f9296', face: '#17181a', mc: LUME, lume: LUME, tk: 'ticks', tkAll: 1, mk: { t: 'field' }, hd: ['syringe', '#f0efe6', 96, 160, 11, 9, { tail: 10 }], sc: ['thin', '#f0efe6', 172] },
    { n: 'Military small seconds', a: 'after the British “Dirty Dozen” of 1945', cf: '#8f9296', face: '#151618', mc: LUME, lume: LUME, tk: 'rail', tc: LUME, mk: { t: 'arabic', s: 36, r: 142, only: [0, 1, 2, 3, 4, 5, 7, 8, 9, 10, 11], w: 0, len: 0 }, hd: ['pencil', '#f0efe6', 92, 150, 14, 11, { lume: LUME }], sc: { at: [0, 84], r: 42, col: '#f0efe6', tc: LUME, n: 12, rail: 1 }, pin: '#f0efe6' },
    { n: 'Marine chronometer', a: 'after 19th-century ship’s chronometers', cf: '#c9a85a', face: '#f3f0e6', mc: INK, tk: 'rail', tc: INK, mk: { t: 'roman', r: 146, s: 30, only: [1, 2, 3, 4, 5, 7, 8, 9, 10, 11] }, hd: ['breguet', BLUED, 92, 150, 9, 8, { tail: 14 }], sc: { at: [0, 90], r: 44, col: BLUED, tc: INK, n: 12, nums: [['60', 0], ['30', 180]] }, x: [['pr', 0, -62, 46, -60, 60, INK, 25, BLUED]], pin: BLUED },
    { n: 'Engine-turned Roman', a: 'after Abraham-Louis Breguet', cf: '#d9d9d6', face: '#e9e8e3', mc: '#26262a', tk: 'dots', x: [['guilloche', 122, '#b9b8b2'], ['ring', 124, '#8d8d88', 1.5], ['ring', 170, '#8d8d88', 1.5]], mk: { t: 'roman', r: 147, s: 27 }, hd: ['breguet', BLUED, 96, 160, 8, 7, { tail: 14 }], sc: null, pin: BLUED },
    { n: 'Round dress watch', a: 'after the Patek Philippe Calatrava', cf: GOLD, face: CREAM, mc: GOLD, mst: '#8c6d2a', tk: 'dots', tc: '#8c6d2a', mk: { t: 'baton', w: 7, len: 30, r: 158 }, hd: ['dauphine', GOLD, 100, 156, 17, 14, { st: '#8c6d2a' }], sc: { at: [0, 88], r: 38, col: '#8c6d2a', tc: '#8c6d2a', n: 12 }, pin: GOLD },
    { n: 'Snow-textured dial', a: 'after the Grand Seiko Snowflake', face: '#f4f5f7', pat: ['snow'], mc: '#dfe2e6', mst: '#70767e', date: 3, mk: { t: 'baton', w: 9, len: 34, dbl: 1, r: 160 }, tk: 'ticks', tc: '#70767e', hd: ['dauphine', '#d9dce1', 104, 160, 18, 14, { st: '#5d646d' }], sc: ['counter', BLUED, 174], x: [['date', 3, 142, WHITE, INK, '#70767e'], ['pr', -52, 62, 44, 200, 290, '#70767e', 262, '#3c4148']], pin: '#aab0b8' },
    { n: 'Sandwich dial', a: 'after the Panerai Luminor', cs: 'cushion', Rd: 162, face: '#141414', mc: OLD, lume: OLD, mk: { t: 'sandwich', only: [0, 3, 6] }, hd: ['pencil', GOLD, 88, 150, 16, 13, { lume: OLD }], sc: { at: [-92, 0], r: 34, col: GOLD, tc: OLD, n: 4, maj: 1 }, pin: GOLD },
    { n: 'Orange diver', a: 'after the DOXA Sub 300 of 1967', cs: 'cushion', Rd: 142, bz: { t: 'dive', f: '#d5d7da', fg: INK }, face: '#f47a1f', mc: INK, tk: 'ticks', tc: INK, tkAll: 1, date: 3, mk: { t: 'baton', w: 10, len: 26, r: 150 }, hd: ['block', INK, 62, 158, 12, 22, { lume: WHITE }], sc: ['lolli', INK, 168, { lume: WHITE }], x: [['date', 3, 126, WHITE, INK]], pin: INK },
    { n: 'Two-tone GMT', a: 'after the Rolex GMT-Master of 1954', Rd: 150, bz: { t: 'gmt', a: '#1c3f8f', b: '#b3262b', fg: '#f1f1ec' }, face: '#111214', mc: LUME, lume: LUME, mst: '#d8d9da', tk: 'ticks', tc: '#e8e8e4', date: 3, mk: { t: 'dots' }, hd: ['mercedes', '#dfe0e2', 100, 162, 17, 13, { lume: LUME }], sc: ['lolli', '#dfe0e2', 170, { lume: LUME }], gmt: RED, x: [['date', 3, 142, WHITE, INK]] },
    { n: 'Art Deco rectangle', a: 'after the Jaeger-LeCoultre Reverso', cs: 'rect', cf: '#cfd2d6', sq: 1, mx: .62, my: .8, face: '#16171a', mc: '#eeeee8', tk: 'rail', tc: '#eeeee8', ra: 92, rb: 106, mk: { t: 'arabic', r: 150, s: 30, only: [0, 2, 4, 6, 8, 10], w: 4, len: 24, wt: 400 }, hd: ['dauphine', '#e4e6e8', 58, 86, 13, 11, { tail: 8 }], sc: null, pin: '#e4e6e8' },
    { n: 'German functionalism', a: 'after Dietrich Lubs’s Braun AW 10', cf: '#2a2b2e', face: '#18191b', mc: '#f2f2ee', tk: 'ticks', tc: '#f2f2ee', tkAll: 1, mk: { t: 'arabic', s: 26, r: 150, wt: 500 }, hd: ['baton', '#f2f2ee', 92, 150, 9, 6, { tail: 14 }], sc: ['thin', '#f2c21a', 170], x: [['date', 3, 110, '#f2f2ee', INK]], pin: '#f2c21a' },
    { n: 'Off-centre dial', a: 'after the A. Lange & Söhne Lange 1', cf: ROSE, face: '#e7e5df', mc: '#2a2a2c', hm: [-52, 6, .62], x: [['bigdate', 44, -122, ROSE], ['pr', 150, 0, 60, 215, 325, '#2a2a2c', 250, ROSE]], tk: 'rail', tc: '#2a2a2c', ra: 172, rb: 187, mk: { t: 'roman', r: 138, s: 40, only: [0, 3, 6, 9], len: 34, w: 7 }, hd: ['sword', ROSE, 104, 160, 22, 18, { st: '#8a5d42' }], sc: { at: [96, 92], r: 46, col: ROSE, tc: '#2a2a2c', n: 12, nums: [['60', 0], ['30', 180]] }, pin: ROSE },
    { n: 'Regulator', a: 'after watchmakers’ master clocks', cf: '#d3d5d8', face: '#f2f0e8', mc: INK, tk: 'rail', tc: INK, mk: { t: 'arabic', s: 20, r: 152, wt: 500, minutes: 1 }, hAt: [0, -84, 44], hd: ['pencil', BLUED, 92, 162, 12, 8], sc: { at: [0, 84], r: 44, col: BLUED, tc: INK, n: 12, nums: [['60', 0], ['30', 180]] }, x: [['sub', 0, -84, 44, { st: INK, tc: INK, n: 12, maj: 1, nums: [['XII', 0], ['III', 90], ['VI', 180], ['IX', 270]], ns: .26, serif: 1 }]], pin: BLUED }
  ];

  let uid = 0, token = 0;
  function render(i) {
    const c = Object.assign({ cs: 'round', cf: STEEL, Rd: 186, lume: null }, D[i]), now = new Date(), id = ++uid, k = c.Rd / 190;
    if (c.cs === 'rect') c.Rd = 190;
    const kk = c.cs === 'rect' ? 1 : k;
    const face = c.sq ? `<rect x="${-190 * c.mx}" y="${-190 * c.my}" width="${380 * c.mx}" height="${380 * c.my}" rx="5" fill="${c.face}" stroke="${INK}" stroke-width="1.5"/>` : (c.ds ? shape(c.ds, 8, `fill="${c.face}" stroke="${INK}" stroke-width="1.5"`) : `<circle r="190" fill="${c.face}" stroke="${INK}" stroke-width="1.5"/>`);
    const hm = c.hm || [0, 0, 1], hd = c.hd, ho = hd[6] || {};
    // regulator: minute numerals instead of hours
    let mk = c.mk.minutes ? (() => { let s = ''; for (let h = 0; h < 12; h++) s += num(h ? h * 5 : 60, c.mk.r, h * 30, c.mk.s, c, { col: c.mc, wt: 500 }); return s; })() : marks(c);
    let secSub = '', secHand = '';
    if (c.sc && !Array.isArray(c.sc)) {
      const q = c.sc;
      secSub = q.rail ? `<g transform="translate(${q.at[0]} ${q.at[1]})"><circle r="${q.r}" fill="none" stroke="${q.tc}" stroke-width="1.2"/><circle r="${q.r * .8}" fill="none" stroke="${q.tc}" stroke-width="1.2"/>${Array.from({ length: 12 }, (_, j) => ln(q.r * .8, q.r, j * 30, 1.4, q.tc, {})).join('')}</g>` : sub(q.at[0], q.at[1], q.r, { f: q.f, tc: q.tc, n: q.n, maj: q.maj, nums: q.nums });
      secHand = `<g transform="translate(${q.at[0]} ${q.at[1]})"><g data-k="s">${S('needle', q.r * .82, q.col, { w: 2 })}</g></g>`;
    } else if (c.sc) secHand = `<g data-k="s">${S(c.sc[0], c.sc[2], c.sc[1], c.sc[3])}</g>`;
    const hourG = c.hAt ? `<g transform="translate(${c.hAt[0]} ${c.hAt[1]})"><g data-k="h">${H('pencil', c.hAt[2] * .7, 7, hd[1], { tail: 6 })}</g><circle r="3.5" fill="${hd[1]}"/></g>` : `<g data-k="${c.h24 ? 'H' : 'h'}">${H(hd[0], hd[2], hd[4], hd[1], ho)}</g>`;
    const minStyle = /mercedes|snow|arrow/.test(hd[0]) ? 'pencil' : hd[0];
    const gmt = c.gmt ? `<g data-k="g"><line y1="0" y2="-150" stroke="${c.gmt}" stroke-width="3"/><polygon points="-11,-146 0,-170 11,-146" fill="${c.gmt}"/></g>` : '';
    el.innerHTML = `<svg viewBox="-200 -200 400 400" aria-hidden="true">
      ${shape(c.cs, 0, `fill="${c.cf}" stroke="${INK}" stroke-width="2"`)}
      ${bezel(c)}
      <g transform="scale(${f1(kk * 100) / 100})">${face}${pattern(c, id)}${extras(c, now)}
        <g transform="translate(${hm[0]} ${hm[1]}) scale(${hm[2]})">${c.hm ? `<circle r="190" fill="none"/>` : ''}${track(c)}${mk}</g>
        ${secSub}
        <g transform="translate(${hm[0]} ${hm[1]}) scale(${hm[2]})">${gmt}${hourG}<g data-k="m">${H(minStyle, hd[3], hd[5], hd[1], ho)}</g>${c.sc && Array.isArray(c.sc) ? secHand : ''}<circle r="${c.sc && Array.isArray(c.sc) ? 3 : 6}" fill="${c.pin || (c.sc && c.sc[1]) || hd[1]}"/></g>
        ${c.sc && !Array.isArray(c.sc) ? secHand : ''}
      </g></svg>`;
    if (cap) cap.textContent = D[i].a.charAt(0).toUpperCase() + D[i].a.slice(1);
    const hands = [...el.querySelectorAll('[data-k]')], my = ++token;
    function draw() {
      const d = new Date(), s = d.getSeconds() + d.getMilliseconds() / 1000, m = d.getMinutes() + s / 60, h = d.getHours() + m / 60;
      const deg = { h: (h % 12) * 30, H: h * 15, m: m * 6, s: s * 6, g: (d.getUTCHours() + d.getUTCMinutes() / 60) * 15 };
      hands.forEach(n => { if (n.dataset.k === 's' && still) { n.setAttribute('visibility', 'hidden'); return; } n.setAttribute('transform', `rotate(${deg[n.dataset.k].toFixed(2)})`); });
    }
    draw();
    if (still) { const t = setInterval(() => { if (my !== token) return clearInterval(t); draw(); }, 15000); }
    else (function loop() { if (my !== token) return; draw(); requestAnimationFrame(loop); })();
  }

  // Which dial to show: a choice made this session wins, then a pinned dial, otherwise the next in the cycle.
  const pick = document.getElementById('dialPick'), pinBtn = document.getElementById('dialPin'), rnd = document.getElementById('dialRandom');
  const store = (st, k, v) => { try { if (v === undefined) return st.getItem(k); if (v === null) st.removeItem(k); else st.setItem(k, v); } catch (e) {} return null; };
  const LS = () => localStorage, SS = () => sessionStorage;
  const get = (st, k) => { try { const v = parseInt(store(st(), k), 10); return v >= 0 && v < D.length ? v : null; } catch (e) { return null; } };
  const set = (st, k, v) => { try { store(st(), k, v); } catch (e) {} };
  let idx, pinned = get(LS, 'wbm-dial-pin');
  const q = /[?&]dial=(\d+)/.exec(location.search), chosen = get(SS, 'wbm-dial-session');
  if (q && +q[1] >= 1 && +q[1] <= D.length) idx = +q[1] - 1;
  else if (chosen !== null) idx = chosen;
  else if (pinned !== null) idx = pinned;
  else { const last = get(LS, 'wbm-dial'); idx = last === null ? 0 : (last + 1) % D.length; set(LS, 'wbm-dial', idx); }

  if (pick) pick.innerHTML = D.map((d, i) => `<option value="${i}">${i + 1}. ${d.n}</option>`).join('');
  function show(i) {
    idx = i; render(i);
    if (pick) pick.value = i;
    if (pinBtn) { const on = pinned === i; pinBtn.setAttribute('aria-pressed', on); pinBtn.textContent = on ? 'Pinned' : 'Pin'; pinBtn.title = on ? 'Unpin this dial' : 'Keep this dial on every visit'; }
  }
  const choose = i => { set(SS, 'wbm-dial-session', i); show(i); };
  show(idx);
  el.addEventListener('click', () => choose((idx + 1) % D.length));
  if (pick) pick.addEventListener('change', () => choose(+pick.value));
  if (pinBtn) pinBtn.addEventListener('click', () => {
    if (pinned === idx) { pinned = null; set(LS, 'wbm-dial-pin', null); }
    else { pinned = idx; set(LS, 'wbm-dial-pin', idx); set(SS, 'wbm-dial-session', idx); }
    show(idx);
  });
  if (rnd) rnd.addEventListener('click', () => {
    let i = idx; while (i === idx) i = Math.floor(Math.random() * D.length);
    pinned = null; set(LS, 'wbm-dial-pin', null); set(SS, 'wbm-dial-session', null); set(LS, 'wbm-dial', i);
    show(i);
  });
})();
