// A bracelet or strap for the watch face at the top of the page, and a wrist to wear it on. Both are an option the
// reader turns on; the choice is kept in the browser. The band is a flat drawing on its own canvas behind the watch
// head, which shrinks to the middle of its box to make room. dials.js says which case the head has (its shape and
// colour, as data-cs and data-cf on the button, and a wbm-dial event when it changes), so a gold watch gets a gold
// bracelet. ?band=steel|brown|black|rubber and ?wrist=1 set the option from the address, for the test tools.
(() => {
  'use strict';
  const stage = document.getElementById('dialStage'), cv = document.getElementById('band'), head = document.getElementById('dial');
  const pick = document.getElementById('dialBand'), wristBtn = document.getElementById('dialWrist');
  if (!stage || !cv || !head || !pick || !wristBtn) return;
  const ctx = cv.getContext('2d'); if (!ctx) return;
  const KINDS = ['none', 'steel', 'brown', 'black', 'rubber'];
  const HEAD = .6, S = 400 / HEAD, HALF = S / 2;   // the head takes six tenths of the box; S is the box in the head's own units (its case is 396 across)
  const WRIST = 287;                               // half the wrist, top to bottom: a wrist about one and a half cases wide
  const BW = 200, PITCH = 30;                      // the band between the lugs, and one bracelet link
  const SKIN = '#c79a7b';
  const get = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const put = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
  const qs = n => { const m = new RegExp('[?&]' + n + '=([a-z0-9]+)').exec(location.search); return m ? m[1] : null; };
  let kind = qs('band') || get('wbm-dial-band') || 'none', wrist = (qs('wrist') || get('wbm-dial-wrist')) === '1';
  if (!KINDS.includes(kind)) kind = 'none';

  // ---- colour: #rrggbb to [r, g, b] and back, lighter or darker by a factor
  const rgb = h => { const m = /^#(..)(..)(..)$/.exec(h) || [0, 'c9', 'cc', 'd1']; return [1, 2, 3].map(i => parseInt(m[i], 16)); };
  const tone = (c, k) => 'rgb(' + c.map(v => Math.round(Math.max(0, Math.min(255, k <= 1 ? v * k : v + (255 - v) * (k - 1))))).join(',') + ')';

  // Where a point on the band is drawn. s is the distance along the band from the end of the lugs (negative under
  // the head). Lying flat it runs straight off the box. On a wrist it bends over the edge and out of sight, so the
  // far links are squeezed together and darker. Returns [y, light].
  function along(s, y0) {
    if (s <= 0 || !wrist) return [y0 + s, 1];
    const R = WRIST + 8 - y0, a = Math.min(s / R, Math.PI / 2);
    return [y0 + R * Math.sin(a), .3 + .7 * Math.cos(a)];
  }
  const reach = y0 => wrist ? (WRIST + 8 - y0) * Math.PI / 2 : HALF - y0 + PITCH;
  const width = s => BW * (1 - .13 * Math.max(0, Math.min(1, s / 260)));
  const box = (x, y, w, h, r) => { ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, w, h, Math.min(r, Math.abs(h) / 2, w / 2)); else ctx.rect(x, y, w, h); };

  // One half of a three-link bracelet. The middle links sit half a link out of step with the outer ones.
  function bracelet(sign, y0, col) {
    const end = reach(y0), link = (x, w, s0, s1) => {
      const [ya, la] = along(s0, y0), [yb, lb] = along(Math.min(s1, end), y0), l = (la + lb) / 2;
      if (yb - ya < .6) return;
      const top = sign > 0 ? ya : -yb, h = yb - ya, g = ctx.createLinearGradient(0, top, 0, top + h);
      g.addColorStop(0, tone(col, 1.28 * l > 1 ? 1 + .28 * l : 1.28 * l)); g.addColorStop(.5, tone(col, .96 * l)); g.addColorStop(1, tone(col, .62 * l));
      box(x, top + .7, w, h - 1.4, 5); ctx.fillStyle = g; ctx.fill();
    };
    for (let s = -Math.ceil((y0 - 110) / PITCH) * PITCH; s < end; s += PITCH) {
      const w = width(s), side = w * .27, mid = w - 2 * side;
      ctx.fillStyle = tone(col, .25); const [ya] = along(s, y0), [yb] = along(Math.min(s + PITCH, end), y0);
      ctx.fillRect(-w / 2, sign > 0 ? ya : -yb, w, yb - ya);   // the dark between the links
      link(-w / 2, side - 1, s, s + PITCH); link(w / 2 - side + 1, side - 1, s, s + PITCH);
      link(-mid / 2 + 1, mid - 2, s - PITCH / 2, s + PITCH / 2); link(-mid / 2 + 1, mid - 2, s + PITCH / 2, s + PITCH * 1.5);
    }
  }
  // One half of a strap, drawn in thin slices so it can bend: rounded across its width, stitched if it is leather,
  // ribbed near the case if it is rubber.
  function strap(sign, y0, col, stitch) {
    const end = reach(y0), step = 4;
    for (let s = -(y0 - 110), n = 0; s < end; s += step, n++) {
      const [ya, la] = along(s, y0), [yb, lb] = along(Math.min(s + step, end), y0), l = (la + lb) / 2, w = width(s), h = yb - ya + .6;
      if (h < .7) continue;
      const top = sign > 0 ? ya : -yb - .6, g = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
      g.addColorStop(0, tone(col, .5 * l)); g.addColorStop(.12, tone(col, .95 * l)); g.addColorStop(.42, tone(col, 1.14 * l > 1 ? 1 + .14 * l : 1.14 * l)); g.addColorStop(.85, tone(col, .85 * l)); g.addColorStop(1, tone(col, .45 * l));
      ctx.fillStyle = g; ctx.fillRect(-w / 2, top, w, h);
      if (stitch && s > 4 && n % 4 < 2) { ctx.fillStyle = tone(stitch, l); ctx.fillRect(-w / 2 + 8, top, 2.4, h); ctx.fillRect(w / 2 - 10.4, top, 2.4, h); }
      if (!stitch && s > 6 && s < 96 && n % 3 === 0) { ctx.fillStyle = tone(col, .4 * l); ctx.fillRect(-w / 2 + 14, top, w - 28, h * .6); }
    }
  }
  // The four lugs, in the colour of the case, reaching from under the head to the end of the band's first link.
  function lugs(y0, col) {
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
      const x = sx > 0 ? BW / 2 + 2 : -BW / 2 - 30, y = sy > 0 ? 110 : -y0 - 6, g = ctx.createLinearGradient(x, 0, x + 28, 0);
      g.addColorStop(0, tone(col, .7)); g.addColorStop(.4, tone(col, 1.3)); g.addColorStop(1, tone(col, .6));
      box(x, y, 28, y0 + 6 - 110, 9); ctx.fillStyle = g; ctx.fill();
    }
  }
  const outline = (cs, dx, dy) => {
    ctx.beginPath();
    if (cs === 'rect') ctx.rect(-138 + dx, -194 + dy, 276, 388);
    else if (cs === 'cushion' || cs === 'softoct') { const hh = cs === 'softoct' ? 182 : 198; if (ctx.roundRect) ctx.roundRect(-198 + dx, -hh + dy, 396, 2 * hh, 92); else ctx.rect(-198 + dx, -hh + dy, 396, 2 * hh); }
    else ctx.arc(dx, dy, 198, 0, Math.PI * 2);
  };

  let px = 0;
  function draw() {
    const on = kind !== 'none';
    stage.classList.toggle('worn', on); cv.hidden = !on;
    pick.value = kind; wristBtn.setAttribute('aria-pressed', String(on && wrist)); wristBtn.disabled = !on;
    if (!on) return;
    const cw = stage.getBoundingClientRect().width, n = Math.max(1, Math.round(cw * Math.min(window.devicePixelRatio || 1, 2)));
    if (n !== px) px = cv.width = cv.height = n;
    const u = px / S, cs = head.dataset.cs || 'round', metal = rgb(head.dataset.cf || '#c9ccd1');
    const y0 = (cs === 'rect' ? 194 : cs === 'softoct' ? 182 : 198) + 14;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, px, px); ctx.setTransform(u, 0, 0, u, px / 2, px / 2);
    if (wrist) {
      // The arm runs across the picture, lit along its top and falling away at both edges.
      const skin = rgb(SKIN), g = ctx.createLinearGradient(0, -WRIST, 0, WRIST);
      g.addColorStop(0, tone(skin, .5)); g.addColorStop(.08, tone(skin, .8)); g.addColorStop(.38, tone(skin, 1.12)); g.addColorStop(.75, tone(skin, .9)); g.addColorStop(.94, tone(skin, .66)); g.addColorStop(1, tone(skin, .42));
      ctx.fillStyle = g; ctx.fillRect(-HALF, -WRIST, S, 2 * WRIST);
      // The band's shadow on the skin.
      ctx.save(); ctx.globalCompositeOperation = 'source-atop'; ctx.shadowColor = 'rgba(30,14,6,.55)'; ctx.shadowBlur = 16 * u; ctx.shadowOffsetX = 7 * u; ctx.shadowOffsetY = 3 * u;
      ctx.fillStyle = 'rgba(30,14,6,.35)'; ctx.fillRect(-BW / 2, -WRIST, BW, 2 * WRIST); ctx.restore();
    }
    for (const sign of [-1, 1]) {
      if (kind === 'steel') bracelet(sign, y0, metal);
      else if (kind === 'brown') strap(sign, y0, rgb('#6b4226'), rgb('#dcc9a3'));
      else if (kind === 'black') strap(sign, y0, rgb('#2b2a2a'), rgb('#9c9a96'));
      else strap(sign, y0, rgb('#26282b'), null);
    }
    lugs(y0, metal);
    // The head's shadow, on whatever is drawn under it.
    ctx.save(); ctx.globalCompositeOperation = 'source-atop'; ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 26 * u; ctx.shadowOffsetX = 9 * u; ctx.shadowOffsetY = 14 * u;
    ctx.fillStyle = 'rgba(0,0,0,.4)'; outline(cs, 0, 0); ctx.fill(); ctx.restore();
    // Fade the ends that run off the box: the arm at the sides, and a band lying flat at the top and bottom.
    ctx.save(); ctx.globalCompositeOperation = 'destination-in';
    const f = wrist ? ctx.createLinearGradient(-HALF, 0, HALF, 0) : ctx.createLinearGradient(0, -HALF, 0, HALF);
    f.addColorStop(0, 'rgba(0,0,0,0)'); f.addColorStop(.09, '#000'); f.addColorStop(.91, '#000'); f.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = f; ctx.fillRect(-HALF, -HALF, S, S); ctx.restore();
  }

  pick.addEventListener('change', () => { kind = pick.value; put('wbm-dial-band', kind); draw(); });
  wristBtn.addEventListener('click', () => { wrist = !wrist; put('wbm-dial-wrist', wrist ? '1' : '0'); draw(); });
  document.addEventListener('wbm-dial', draw);
  if (window.ResizeObserver) new ResizeObserver(draw).observe(stage); else addEventListener('resize', draw);
  draw();
})();
