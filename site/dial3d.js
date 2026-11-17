// Masthead dial, lit: a WebGL relief renderer for the watches that dials.js describes.
//
// The watch is always seen straight on, so it is a height field with materials, not a model. A scene's drawing
// operations are painted part by part into masks. Each mask becomes height (through the distance to the part's edge
// and a profile) and material (a finish, or two finishes split by that same distance). One fragment shader lights
// the maps from a lamp that follows the pointer, or on a phone its tilt. Hands are rasterised pointing up into an
// atlas and turned in the shader. This file knows nothing about the thirty designs: it works from part tags and each design's finish data.
(function () {
  'use strict';

  // ---- the look: every number worth tuning is in these tables ----
  const LOOK = {
    lampZ: 1.1, rest: [-.55, -.75],               // the lamp's height in half widths of the dial, and where it rests
    free: 1.5, minElev: 20,                       // it follows the pointer exactly this far out, then slows so it never sinks below this angle
    ease: 100,                                    // how fast it glides to the pointer, ms
    tilt: -1 / 28, tiltMax: 60,                   // on a phone: half widths the lamp moves per degree of tilt (negative: it stays put in the room), largest tilt used
    tiltRest: [.4, 0],                            // on a phone the lamp rests this much further right, clear of a right thumb
    tiltDrift: 4000,                              // how slowly the level the phone is held at becomes the new resting tilt, ms
    keyColour: [1, .965, .9], key: .95,           // the lamp on matte surfaces (warm)
    fillColour: [.82, .9, 1], fill: .16,          // a soft cool light from the far side
    ambColour: [.92, .95, 1], amb: .34,           // light from the room
    fall: .7,                                     // how fast the lamp fades with distance across the watch
    lamp: 5.5, lampSize: .17,                     // the lamp as metal and gloss mirror it: brightness, and half width as a slope
    strip: .9,                                    // a dimmer strip light opposite the lamp, seen only in reflections
    envTop: .2, envSide: .7, envMean: .34,        // the room as metal mirrors it: overhead, the wall behind the lamp, blurred
    envDark: .12, envBack: .3,                    // the walls beside the lamp and opposite it, as fractions of that wall
    shadow: .8, shadowSoft: .1, shadowReach: 40,  // cast shadows: darkness, blur per unit of distance, longest reach in dial units
    handShadow: .7, handBlur: .35,                // shadows of hands: darkness, blur per unit of height
    grainTilt: .5,                                // how far brushing grain tilts the surface
    crystal: .012, dome: .1, crystalColour: [.75, .85, 1],
    glow: .5, exposure: 1,
    handZ: 4.4, handStep: .9,                     // height of the lowest hand above the dial and the gap between hands, dial units
    hMin: -4, hMax: 12, hTop: 9,                  // range of heights the maps hold, and the highest thing that casts a shadow
    aoRadius: 5, ao: .1, aoMax: .5,               // baked shade in hollows: blur radius in dial units, strength per unit, limit
    maxSlope: 3
  };

  // Finishes. m metal, r roughness, a how strongly brushing stretches the highlight, g visible grain, c clear coat,
  // e lume's own glow, d the default direction. A finish is named in a design's data as 'name' or 'name direction',
  // where direction is degrees clockwise from the 12-to-6 line (0 = grain running 12 to 6, 90 = 9 to 3), 'circular'
  // (grain running round the centre) or 'radial' (sunray, grain running out from the centre).
  const FINISH = {
    polish: { m: 1, r: .05 },                           // mirror polish
    brush: { m: 1, r: .55, a: 1, g: .32, d: 0 },         // brushed, with a direction
    satin: { m: 1, r: .4, a: .6, g: .16, d: 0 },        // a finer, softer brushing
    blast: { m: 1, r: .7, g: .1 },                      // bead-blasted or matte metal: an even soft grey
    metallic: { m: .75, r: .45, g: .05 },               // a galvanic or PVD coloured dial: satin, not glossy
    sunray: { m: .8, r: .42, a: .8, g: .2, c: .25, d: 'radial' },
    ceramic: { m: 0, r: .4, c: 1 },                     // polished ceramic: the sharpest gloss
    gloss: { m: 0, r: .5, c: .45 },                      // gloss lacquer and enamel
    lacquer: { m: 0, r: .55, c: .3 },                   // semi-gloss, the default dial
    matte: { m: 0, r: .9 },                             // matte paint and print
    grained: { m: 0, r: .8, g: .05 },                   // silvered, opaline, frosted: matte with a fine grain
    lume: { m: 0, r: .95, e: .14, g: .04 }
  };

  // What each part is by default. A design overrides any of this per part in its fin data (see dials.js); a field it
  // leaves out keeps the value here. One part tag has one entry per design, so all of a watch's hands share handBody.
  //   z      where the part's foot sits, in dial units above the dial plane (1 unit is about 0.1 mm)
  //   on     1: z is measured from whatever lies beneath the part instead
  //   prof   how the part rises from its edge: 'flat', 'chamfer' (a straight bevel, then flat), 'roof' (two facets
  //          meeting on the centre line), 'pillow' (domed), 'soft' (an eased step). h is how far it rises (negative
  //          sinks it) and w how far in from the edge the rise takes; w 0 means all the way to the middle, and a
  //          roof always goes to the middle. A name that is none of these acts as 'chamfer'.
  //   mat    the finish. edge, ew: a second finish for the zone within ew dial units of the part's edge (the chamfer);
  //          ew defaults to w.
  //   col    a colour to paint the part when lit, instead of the drawing's
  //   c      [x, y]: the centre that circular and radial brushing turn about, dial units
  //   cut    parts whose shapes are cut out of this one before its edge is found; add: parts whose shapes join it
  //   steel  the finish to use instead when the part is drawn in a light neutral grey, that is, bare steel
  const PART = {
    case: { z: 5.5, prof: 'pillow', h: 2.5, w: 5, mat: 'polish', cut: ['dial'] },
    bezel: { z: 7, prof: 'chamfer', h: 1.2, w: 2.5, mat: 'gloss', steel: 'brush circular' },
    bezelMark: { on: 1, z: -.3, mat: 'matte' },
    bezelPip: { on: 1, prof: 'pillow', h: 1.2, mat: 'lume' },
    screw: { on: 1, z: -.5, prof: 'chamfer', h: .5, w: 1.5, mat: 'polish' },
    screwSlot: { on: 1, z: -1.2, mat: 'matte' },
    dial: { z: 0, mat: 'lacquer', glass: 1 },
    dialTex: { on: 1 },
    sub: { on: 1, prof: 'chamfer', h: -1, w: 1.5 },
    window: { on: 1, prof: 'chamfer', h: -2.4, w: 1, mat: 'matte' },
    frame: { on: 1, prof: 'chamfer', h: 1.6, w: .8, mat: 'polish' },
    print: { on: 1, mat: 'matte' },
    subPrint: { on: 1, mat: 'matte' },
    windowText: { on: 1, mat: 'matte' },
    lume: { on: 1, prof: 'pillow', h: .5, w: 2, mat: 'lume' },
    applied: { z: 2.2, prof: 'chamfer', h: 1, w: 1.4, mat: 'polish', add: ['appliedLume'] },
    appliedLume: { on: 1, z: -.3, mat: 'lume' },
    handBody: { prof: 'chamfer', h: .8, w: 1.2, mat: 'polish' },
    handLume: { on: 1, z: -.25, mat: 'lume' },
    cap: { prof: 'pillow', h: 1.2, mat: 'polish' }
  };
  const ORDER = ['case', 'bezel', 'bezelMark', 'bezelPip', 'screw', 'screwSlot', 'dial', 'dialTex', 'sub', 'window', 'frame', 'print', 'subPrint', 'windowText', 'lume', 'applied', 'appliedLume'];
  const HAND_ORDER = ['handBody', 'handLume', 'cap'];
  const SHAPED = { roof: { prof: 'roof', h: 1.3, w: 0 }, pillow: { prof: 'pillow', h: 1.1, w: 0 } };   // hand shapes dials.js names
  // Dial textures, in relief: h is the height of the pattern in dial units.
  const TEX = { grid: { h: .9, bevel: 2.2 }, ribs: { h: -.8 }, rings: { h: .35 }, snow: { h: 1 }, sun: { mat: 'sunray' } };
  const MAX_HANDS = 8, PAD = 12;

  // ---- small tools ----
  const RND = new Float32Array(4096);
  for (let i = 0, s = 12345; i < 4096; i++) { s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff; RND[i] = s / 0x7fffffff; }
  const hash = (a, b) => RND[(Math.imul(a, 73856093) ^ Math.imul(b, 19349663)) & 4095];
  const n1 = u => { const i = Math.floor(u), a = RND[i & 4095]; return a + (RND[(i + 1) & 4095] - a) * (u - i); };
  const n2 = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; };
  const ALPHA = new Uint8Array(new Uint32Array([0xff000000]).buffer)[3] ? 0xff000000 : 0xff;   // where alpha sits in a pixel read as one number
  const NEUTRAL = ALPHA === 0xff ? 0x80800080 : 0x80008080;   // the grain map where nothing is: no direction, no glow, no grain
  const scratch = document.createElement('canvas'), sx = scratch.getContext('2d', { willReadFrequently: true });
  const white = p => p.k === 'tex' || p.stroke ? '#fff' : { fill: '#fff', alpha: 1 };
  const CANCEL = {};

  function finish(s) {
    if (!s) return null;
    const p = String(s).split(' '), f = FINISH[p[0]] || FINISH.matte, dir = p[1] != null ? p[1] : f.d;
    const o = { m: f.m || 0, r: f.r, a: f.a || 0, c: f.c || 0, g: f.g || 0, e: f.e || 0, mode: 0, tx: 0, ty: 0 };
    if (dir === 'circular') o.mode = 2; else if (dir === 'radial') o.mode = 3;
    else if (dir != null) { const t = (+dir || 0) * Math.PI / 180; o.mode = 1; o.tx = Math.sin(t); o.ty = -Math.cos(t); }
    return o;
  }
  const steelish = col => { const m = /^#(..)(..)(..)$/.exec(col || ''); if (!m) return false; const v = m.slice(1).map(h => parseInt(h, 16)), hi = Math.max(...v), lo = Math.min(...v); return hi - lo < 24 && lo > 120 && hi < 240; };

  // The alpha of some ops painted in white, less the shapes in cut: the mask of a part.
  function paintMask(scene, list, cut, W, H, T) {
    sx.setTransform(1, 0, 0, 1, 0, 0); sx.clearRect(0, 0, W, H); sx.setTransform(T[0], 0, 0, T[0], T[1], T[2]);
    scene.paint(sx, list, white);
    if (cut && cut.length) { sx.globalCompositeOperation = 'destination-out'; scene.paint(sx, cut, white); sx.globalCompositeOperation = 'source-over'; }
    return sx.getImageData(0, 0, W, H).data;
  }
  // The part of a mask that is not empty, as coverage 0 to 1 with a one pixel border of nothing round it.
  function region(d, W, H) {
    const u = new Uint32Array(d.buffer, 0, W * H);
    let x0 = W, x1 = -1, y0 = -1, y1 = -1;
    for (let y = 0, i = 0; y < H; y++, i += W) {
      let a = 0; while (a < W && !(u[i + a] & ALPHA)) a++;
      if (a === W) continue;
      let b = W - 1; while (!(u[i + b] & ALPHA)) b--;
      if (y0 < 0) y0 = y; y1 = y; if (a < x0) x0 = a; if (b > x1) x1 = b;
    }
    if (y0 < 0) return null;
    const w = x1 - x0 + 3, h = y1 - y0 + 3, c = new Float32Array(w * h);
    for (let y = y0; y <= y1; y++) for (let x = x0, k = (y - y0 + 1) * w + 1, j = (y * W + x0) * 4 + 3; x <= x1; x++, k++, j += 4) c[k] = d[j] / 255;
    return { x0: x0 - 1, y0: y0 - 1, w, h, c };
  }
  // Distance in pixels from every covered pixel to the edge of the shape: an exact Euclidean distance transform
  // (Felzenszwalb and Huttenlocher) to the nearest pixel that is not fully covered, then moved by that pixel's
  // own coverage, so the distance is good to a fraction of a pixel and a bevel built on it does not stair-step.
  // Distances beyond cap pixels are not needed exactly (a chamfer only looks so far in), which saves most of the work.
  function edt(c, w, h, cap) {
    const n = w * h, g = new Float32Array(n), sy = new Int32Array(n), d = new Float32Array(n), v = new Int32Array(w), z = new Float64Array(w + 1), last = new Int32Array(w), BIG = 1e18, INF = 1e30, far = cap ? cap * cap : BIG / 2;
    // Down and up each column, a row at a time: the squared distance to the nearest seed in the column, and its row.
    last.fill(-1);
    for (let y = 0, i = 0; y < h; y++) for (let x = 0; x < w; x++, i++) { if (c[i] < .999) last[x] = y; const l = last[x]; g[i] = l < 0 ? BIG : (y - l) * (y - l); sy[i] = l; }
    last.fill(-1);
    for (let y = h - 1, i = n - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--, i--) { if (c[i] < .999) last[x] = y; const l = last[x]; if (l >= 0 && (l - y) * (l - y) < g[i]) { g[i] = (l - y) * (l - y); sy[i] = l; } }
    for (let y = 0, o = 0; y < h; y++, o += w) {
      const f = g.subarray(o, o + w);
      let k = -1;
      for (let q = 0; q < w; q++) {
        if (f[q] > far) continue;
        if (k < 0) { k = 0; v[0] = q; z[0] = -INF; z[1] = INF; continue; }
        let s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
        while (s <= z[k]) { k--; s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); }
        k++; v[k] = q; z[k] = s; z[k + 1] = INF;
      }
      if (k < 0) { for (let q = 0; q < w; q++) d[o + q] = cap; continue; }
      k = 0;
      for (let q = 0; q < w; q++) {
        while (z[k + 1] < q) k++;
        if (c[o + q] <= 0) continue;
        const p = v[k], r = sy[o + p];
        d[o + q] = r < 0 ? 0 : Math.sqrt((q - p) * (q - p) + f[p]) + c[r * w + p] - .5;
      }
    }
    return d;
  }

  // Rasterises ops into four byte maps of W by H: colour with coverage; normal, height and baked shade; metal,
  // roughness, under-glass and clear coat; grain direction, glow and grain. T = [scale, x, y] takes the ops' units to
  // pixels and ppu is pixels to a dial unit (the two differ for a hand drawn smaller than life).
  async function raster(scene, ops, W, H, T, ppu, order, base, tick) {
    const n = W * H, alb = new Uint8Array(n * 4), nrm = new Uint8Array(n * 4), m1 = new Uint8Array(n * 4), m2 = new Uint8Array(n * 4), Hf = new Float32Array(n);
    const by = {}, specs = {}, shown = ops.filter(p => p.part !== 'outline' && p.part !== 'handShade');
    for (const p of shown) (by[p.part] || (by[p.part] = [])).push(p);
    const ink = p => p.k === 'tex' ? p.b || p.stroke : p.fill || p.stroke;
    const spec = part => {
      if (specs[part]) return specs[part];
      const l = by[part] || [], hint = l.find(p => p.prof), own = l.find(p => p.fin), s = Object.assign({}, PART[part] || PART.print, hint ? SHAPED[hint.prof] : null, own ? own.fin : null);
      if (s.steel && !(own && own.fin.mat) && steelish(l.map(ink).find(Boolean))) s.mat = s.steel;
      return specs[part] = s;
    };
    new Uint32Array(m2.buffer).fill(NEUTRAL);
    if (scratch.width !== W) scratch.width = W;
    if (scratch.height !== H) scratch.height = H;

    // Colour: the drawing as it is, without the lines and shading that only the flat picture needs. The ground is
    // filled first so a soft edge never blends toward black; coverage comes from a mask of everything.
    const first = shown.find(ink);
    sx.setTransform(1, 0, 0, 1, 0, 0); sx.globalAlpha = 1; sx.fillStyle = (first && (spec(first.part).col || ink(first))) || '#888'; sx.fillRect(0, 0, W, H);
    sx.setTransform(T[0], 0, 0, T[0], T[1], T[2]);
    scene.paint(sx, shown.map(p => p.k === 'tex' && p.tex === 'ribs' ? Object.assign({}, p, { shade: 0 }) : p), p => {
      if (p.k === 'tex') return p.tex === 'snow' ? false : p.tex === 'sun' ? p.b : true;   // painted shading becomes relief or a finish
      const col = spec(p.part).col; return col ? (p.fill ? { fill: col } : { stroke: col }) : true;
    });
    alb.set(sx.getImageData(0, 0, W, H).data);
    const all = paintMask(scene, shown, null, W, H, T);
    for (let i = 3; i < n * 4; i += 4) alb[i] = all[i];
    await tick();

    const GT = [0, 0, 0];
    // The grain of finish f at a pixel: its direction (scaled by how strongly it brushes) and its light or dark streak.
    const grain = (f, X, Y, gx, gy) => {
      let tx = 0, ty = 0, u = 0;
      if (f.mode === 1) { tx = f.tx; ty = f.ty; u = (Y * tx - X * ty) * .8; }
      else if (f.mode) { const r = Math.sqrt(X * X + Y * Y) || 1; if (f.mode === 2) { tx = -Y / r; ty = X / r; u = r * .8; } else { tx = X / r; ty = Y / r; u = Math.atan2(Y, X) * 110; } }
      GT[0] = tx * f.a; GT[1] = ty * f.a;
      GT[2] = f.g ? ((f.mode ? n1(u) * .65 + n1(u * .23 + 7) * .35 : hash(gx, gy)) - .5) * f.g : 0;
    };
    // Lays a part into the height field and the material maps.
    const lay = (R, sp) => {
      const fa = finish(sp.mat), fb = finish(sp.edge), prof = sp.prof || 'flat', need = prof !== 'flat' || fb;
      let w = prof === 'roof' ? 0 : sp.w || 0;   // a roof's facets always run to the centre line
      const dist = need ? edt(R.c, R.w, R.h, w ? (Math.max(w, sp.ew || 0) + 1) * ppu + 2 : 0) : null;
      if (dist && !w) { let m = 0; for (let k = 0; k < dist.length; k++) if (dist[k] > m) m = dist[k]; w = m / ppu || 1; }
      const ew = sp.ew != null ? sp.ew : w, z = sp.z || 0, hh = sp.h || 0, on = sp.on, c0 = sp.c || [0, 0], cx = T[1] + c0[0] * T[0], cy = T[2] + c0[1] * T[0];
      for (let y = 0; y < R.h; y++) for (let x = 0; x < R.w; x++) {
        const k = y * R.w + x, c = R.c[k]; if (c <= 0) continue;
        const gx = R.x0 + x, gy = R.y0 + y, i = gy * W + gx, j = i * 4;
        let d = dist ? dist[k] / ppu : 0, s = 1; if (d < 0) d = 0;
        if (prof !== 'flat') { s = d >= w ? 1 : d / w; if (prof === 'pillow') s = Math.sqrt(s * (2 - s)); else if (prof === 'soft') s = s * s * (3 - 2 * s); }
        Hf[i] += c * ((on ? Hf[i] : 0) + z + hh * s - Hf[i]);
        if (sp.glass) m1[j + 2] += c * (255 - m1[j + 2]);
        if (!fa) continue;
        grain(fa, gx + .5 - cx, gy + .5 - cy, gx, gy);
        let tx = GT[0], ty = GT[1], g = GT[2], m = fa.m, r = fa.r, ct = fa.c, e = fa.e;
        const t = fb ? Math.min(1, Math.max(0, (ew - d) * ppu + .5)) : 0;
        if (t > 0) { grain(fb, gx + .5 - cx, gy + .5 - cy, gx, gy); tx += t * (GT[0] - tx); ty += t * (GT[1] - ty); g += t * (GT[2] - g); m += t * (fb.m - m); r += t * (fb.r - r); ct += t * (fb.c - ct); e += t * (fb.e - e); }
        m1[j] += c * (m * 255 - m1[j]); m1[j + 1] += c * (r * 255 - m1[j + 1]); m1[j + 3] += c * (ct * 255 - m1[j + 3]);
        m2[j] += c * (128 + tx * 127 - m2[j]); m2[j + 1] += c * (128 + ty * 127 - m2[j + 1]); m2[j + 2] += c * (e * 255 - m2[j + 2]); m2[j + 3] += c * (128 + g * 255 - m2[j + 3]);
      }
    };
    // A dial texture, written into the height field by formula from the numbers the drawing uses.
    const relief = p => {
      const R = region(paintMask(scene, [p], null, W, H, T), W, H), t = TEX[p.tex]; if (!R || !t) return;
      const m = p.m, det = m[0] * m[3] - m[1] * m[2] || 1, mat = (p.fin && p.fin.mat) || t.mat;
      if (mat) lay(R, { on: 1, mat });
      if (!t.h) return;
      for (let y = 0; y < R.h; y++) for (let x = 0; x < R.w; x++) {
        const c = R.c[y * R.w + x]; if (c <= 0) continue;
        const gx = R.x0 + x, gy = R.y0 + y, bx = (gx + .5 - T[1]) / T[0] - m[4], by2 = (gy + .5 - T[2]) / T[0] - m[5], X = (m[3] * bx - m[2] * by2) / det, Y = (m[0] * by2 - m[1] * bx) / det;
        let v = 0;
        if (p.tex === 'grid') { const fx = ((X - p.off) % p.pitch + p.pitch) % p.pitch, fy = ((Y - p.off) % p.pitch + p.pitch) % p.pitch, e = Math.min(fx, p.size - fx, fy, p.size - fy); v = e <= 0 ? 0 : Math.min(1, e / t.bevel); }
        else if (p.tex === 'ribs') { const fy = ((Y - p.off) % p.pitch + p.pitch) % p.pitch; v = fy < p.size ? Math.sin(Math.PI * fy / p.size) : 0; }
        else if (p.tex === 'rings') { const r = Math.sqrt(X * X + Y * Y); v = r > p.from - p.pitch / 2 && r < p.to ? Math.cos(2 * Math.PI * (r - p.from) / p.pitch) : 0; }
        else if (p.tex === 'snow') v = n2(X * p.f[0] * 2, Y * p.f[1] * 2) + n2(X * p.f[0] * 5, Y * p.f[1] * 5) * .5 + n2(X * .5, Y * .9) * .22 - .86;
        Hf[gy * W + gx] += c * v * t.h;
      }
    };
    for (const part of order.concat(Object.keys(by).filter(k => !order.includes(k)))) {
      const sp = spec(part); let list = by[part] || [];
      if (part === 'dialTex') { for (const p of list) { relief(p); await tick(); } continue; }
      (sp.add || []).forEach(a => { list = list.concat(by[a] || []); });
      if (!list.length) continue;
      let cut = []; (sp.cut || []).forEach(a => { cut = cut.concat(by[a] || []); });
      const R = region(paintMask(scene, list, cut, W, H, T), W, H);
      if (R) lay(R, sp);
      await tick();
    }

    // Normals straight from the float heights (a Sobel filter), the height itself for shadows, and shade for hollows.
    const k8 = ppu / 8, lim = LOOK.maxSlope * LOOK.maxSlope, hs = 255 / (LOOK.hMax - LOOK.hMin);
    for (let y = 0, i = 0; y < H; y++) {
      const u = y ? -W : 0, d = y < H - 1 ? W : 0;
      for (let x = 0; x < W; x++, i++) {
        const l = x ? -1 : 0, r = x < W - 1 ? 1 : 0;
        let gx = (Hf[i + u + r] + 2 * Hf[i + r] + Hf[i + d + r] - Hf[i + u + l] - 2 * Hf[i + l] - Hf[i + d + l]) * k8, gy = (Hf[i + d + l] + 2 * Hf[i + d] + Hf[i + d + r] - Hf[i + u + l] - 2 * Hf[i + u] - Hf[i + u + r]) * k8;
        const s = 1 / Math.sqrt(1 + (gx * gx + gy * gy) / lim); gx *= s; gy *= s;
        const il = 127 / Math.sqrt(gx * gx + gy * gy + 1), j = i * 4;
        nrm[j] = 128.5 - gx * il; nrm[j + 1] = 128.5 - gy * il; nrm[j + 2] = Math.min(255, Math.max(0, (Hf[i] - LOOK.hMin) * hs)); nrm[j + 3] = 255;
      }
    }
    if (base) {
      await tick();
      const r = Math.max(1, Math.round(LOOK.aoRadius * ppu)), tmp = new Float32Array(n), div = 1 / (2 * r + 1);
      for (let y = 0, o = 0; y < H; y++, o += W) { let s = 0; for (let x = -r; x <= r; x++) s += Hf[o + Math.min(W - 1, Math.max(0, x))]; for (let x = 0; x < W; x++) { tmp[o + x] = s * div; s += Hf[o + Math.min(W - 1, x + r + 1)] - Hf[o + Math.max(0, x - r)]; } }
      const sum = new Float32Array(W);
      for (let y = -r; y <= r; y++) for (let x = 0, o = Math.min(H - 1, Math.max(0, y)) * W; x < W; x++) sum[x] += tmp[o + x];
      for (let y = 0, i = 0; y < H; y++) {
        const add = Math.min(H - 1, y + r + 1) * W, sub = Math.max(0, y - r) * W;
        for (let x = 0; x < W; x++, i++) { const a = Math.min(LOOK.aoMax, Math.max(0, (sum[x] * div - Hf[i]) * LOOK.ao)); nrm[i * 4 + 3] = 255 * (1 - a); sum[x] += tmp[add + x] - tmp[sub + x]; }
      }
    }
    return { alb, nrm, m1, m2, W, H };
  }

  // ---- the shader ----
  const f = v => (+v).toFixed(4), v3 = a => 'vec3(' + a.map(f).join(',') + ')';
  const VERT = 'attribute vec2 aP;varying vec2 vP;void main(){vP=vec2(aP.x,-aP.y);gl_Position=vec4(aP,0.,1.);}';
  // Texture fetches for each pixel: 4 for the watch, 10 along the shadow ray, 8 for hand colour, 3 for the top
  // hand's surface, 8 for hand shadows: 33.
  const FRAG = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec2 vP;
uniform sampler2D uA, uN, uM, uG, uHA, uHN, uHM, uHG;
uniform vec3 uL;                      // the lamp, in half widths: x right, y down, z toward the eye
uniform vec4 uHp[${MAX_HANDS}];       // each hand: its pivot in dial units, then cos and sin of its turn over its scale
uniform vec4 uHb[${MAX_HANDS}];       // its box in its own units
uniform vec4 uHt[${MAX_HANDS}];       // atlas position: uv = xy + own position * zw
uniform float uHz[${MAX_HANDS}];      // its height above the dial
const float SB2 = ${f(LOOK.lampSize * LOOK.lampSize)};
vec2 dec(vec2 v) { return v * 2.007874 - 1.007874; }
float hgt(float v) { return v * ${f(LOOK.hMax - LOOK.hMin)} + ${f(LOOK.hMin)}; }
// How much of the lamp a surface mirrors to the eye. The lobe is as wide as the lamp and the finish together,
// wider across the grain than along it. A rough lobe fades softly; a polished one shows the lamp's edge.
float lobe(vec3 N, vec3 T, vec3 B, vec3 Hv, float aT, float aB, float sharp) {
  float nh = max(dot(N, Hv), .001), t = dot(Hv, T) / aT, b = dot(Hv, B) / aB, x = (t * t + b * b) / (nh * nh);
  return mix(1. / ((1. + x) * (1. + x)), 1. - smoothstep(.45, 1.25, x), sharp);
}
// The room as a mirror shows it: dark overhead where the camera is, the table below, and round the horizon a bright
// wall behind the lamp, a dimmer one opposite and dark between. This is what makes a bevel flip from bright to
// near black as the lamp goes round. With the lamp overhead the walls even out.
float env(vec3 N, float blur) {
  vec3 R = vec3(2. * N.z * N.xy, 2. * N.z * N.z - 1.);
  float t = 1. - R.z, az = dot(normalize(R.xy + 1e-5), normalize(uL.xy + 1e-5));
  float wall = mix(1., ${f(LOOK.envDark)} + smoothstep(.15, .95, az) + ${f(LOOK.envBack)} * smoothstep(.4, 1., -az), smoothstep(0., .5, length(uL.xy)));
  float e = mix(${f(LOOK.envTop)}, ${f(LOOK.envSide)} * wall, smoothstep(.02, .5, t)) * (1. - .75 * smoothstep(1., 1.35, t));
  return mix(e, ${f(LOOK.envMean)}, blur);
}
void main() {
  vec2 p = vP * 200., uv = vP * .5 + .5;
  vec4 A = texture2D(uA, uv), Nt = texture2D(uN, uv), M = texture2D(uM, uv), G = texture2D(uG, uv);
  // Hands, lowest first: their colour is laid over the watch, and the one that shows most gives the surface.
  vec3 col = A.rgb; float best = 0., bz = 0.; vec2 buv = vec2(0.), brot = vec2(1., 0.);
  for (int j = 0; j < ${MAX_HANDS}; j++) {
    vec4 hp = uHp[j], hb = uHb[j], ht = uHt[j];
    vec2 r = p - hp.xy, q = vec2(r.x * hp.z + r.y * hp.w, r.y * hp.z - r.x * hp.w), in2 = step(hb.xy, q) * step(q, hb.zw), huv = ht.xy + q * ht.zw;
    vec4 hc = texture2D(uHA, huv, -.5);
    float c = hc.a * in2.x * in2.y;
    col = mix(col, hc.rgb, c);
    if (c > best * (1. - c)) { best = c; buv = huv; brot = hp.zw; bz = uHz[j]; } else best *= 1. - c;
  }
  vec4 hN = texture2D(uHN, buv), hM = texture2D(uHM, buv), hG = texture2D(uHG, buv);
  vec2 rt = normalize(brot), hn = dec(hN.xy), hd = dec(hG.xy);
  vec2 n2 = mix(dec(Nt.xy), vec2(hn.x * rt.x - hn.y * rt.y, hn.x * rt.y + hn.y * rt.x), best);
  vec2 T2 = mix(dec(G.xy), vec2(hd.x * rt.x - hd.y * rt.y, hd.x * rt.y + hd.y * rt.x), best);
  float metal = mix(M.r, hM.r, best), rough = mix(M.g, hM.g, best), coat = mix(M.a, hM.a, best), glass = max(M.b, best);
  float glow = mix(G.b, hG.b, best), grain = mix(G.a, hG.a, best) - .502, ao = mix(Nt.a, 1., best);
  float hb0 = hgt(Nt.z), zs = mix(hb0, bz, best);

  vec3 Lv = uL - vec3(vP, zs / 200.); float Ld = length(Lv); vec3 L = Lv / Ld, V = vec3(0., 0., 1.);
  // Shadows on the watch itself: walk from the surface toward the lamp and see what stands in the way.
  float flat2 = max(length(L.xy), .0001), rise = L.z / flat2, reach = clamp((${f(LOOK.hTop)} - hb0) / rise, 0., ${f(LOOK.shadowReach)}), sh = 0.;
  vec2 dir = L.xy / flat2 / 400.;
  float jit = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - .5;
  for (int i = 0; i < 10; i++) {
    float s = reach * (float(i) + .6 + jit * .5) / 10.;
    float over = hgt(texture2D(uN, uv + dir * s).z) - hb0 - s * rise - .2;
    sh = max(sh, clamp(over / (.3 + s * ${f(LOOK.shadowSoft)}), 0., 1.));
  }
  float vis = 1. - sh * (1. - best) * ${f(LOOK.shadow)};
  // Shadows of the hands above this surface: each hand's shape, moved along the light by the gap and blurred with it.
  vec2 so = L.xy / max(L.z, .2);
  for (int j = 0; j < ${MAX_HANDS}; j++) {
    vec4 hp = uHp[j], hb = uHb[j], ht = uHt[j];
    float gap = uHz[j] - zs;
    vec2 r = p + so * gap - hp.xy, q = vec2(r.x * hp.z + r.y * hp.w, r.y * hp.z - r.x * hp.w), in2 = step(hb.xy, q) * step(q, hb.zw);
    float c = texture2D(uHA, ht.xy + q * ht.zw, clamp(log2(1. + max(gap, 0.) * ${f(LOOK.handBlur)}), 0., 3.)).a * in2.x * in2.y;
    vis *= 1. - c * smoothstep(.2, .8, gap) * ${f(LOOK.handShadow)};
  }

  // The surface: its normal, tilted across the grain where it is brushed.
  float tl = length(T2); vec2 Tn = tl > .02 ? T2 / tl : vec2(1., 0.);
  vec3 Ng = normalize(vec3(n2, sqrt(max(1. - dot(n2, n2), .02))));
  vec2 nb = n2 + vec2(-Tn.y, Tn.x) * grain * ${f(LOOK.grainTilt)} * step(.02, tl);
  vec3 N = normalize(vec3(nb, sqrt(max(1. - dot(nb, nb), .02))));
  vec3 T3 = normalize(vec3(Tn, 0.) - N * dot(N.xy, Tn)), B3 = cross(N, T3);
  vec3 alb = pow(col, vec3(2.2));
  float gain = 1. / (.4 + .6 * uL.z / length(uL)) * pow(length(uL) / Ld, ${f(LOOK.fall)});
  vec3 Lf = normalize(vec3(-uL.xy * 1.3, 1.)), Hk = normalize(L + V), Hf = normalize(Lf + V);
  float NL = max(dot(N, L), 0.), facing = clamp(NL * 6., 0., 1.);
  vec3 key = ${v3(LOOK.keyColour)}, fill = ${v3(LOOK.fillColour)};
  // Matte light.
  vec3 c = alb * (1. - metal) * (key * (${f(LOOK.key)} * gain * NL * vis) + fill * (${f(LOOK.fill)} * max(dot(N, Lf), 0.)) + ${v3(LOOK.ambColour)} * (${f(LOOK.amb)} * (.7 + .3 * N.z) * ao));
  // Mirrored light: the lamp, the strip opposite, and for metal the room.
  float a = max(rough * rough, .003), aL = a * (1. - .85 * tl), aW = a * (1. + 1.5 * tl), aT = sqrt(aL * aL + SB2), aB = sqrt(aW * aW + SB2);
  float en = SB2 / (aT * aB), sharp = clamp(1. - a * 10., 0., 1.), vs = mix(1., vis, .8);
  vec3 F0 = mix(vec3(.04), alb, metal), F = F0 + (1. - F0) * pow(clamp(1. - dot(V, Hk), 0., 1.), 5.);
  c += F * (key * (${f(LOOK.lamp)} * gain * vs * facing * en * lobe(N, T3, B3, Hk, aT, aB, sharp)) + fill * (${f(LOOK.strip)} * en * lobe(N, T3, B3, Hf, aT * 1.6, aB * 1.6, sharp * .5)));
  c += F0 * metal * env(N, clamp(a * 2.5, 0., 1.)) * mix(1., ao, .7) * (1. + grain * 1.6);
  // Clear coat on lacquer, enamel and ceramic: a second mirror over the colour, sharp-edged at full strength (ceramic)
  // and a soft glow below it.
  float nh = max(dot(Ng, Hk), .001), xc = (1. - nh * nh) / (nh * nh) / SB2;
  c += coat * (.04 + .96 * pow(clamp(1. - Ng.z, 0., 1.), 5.)) * (key * (${f(LOOK.lamp)} * gain * vs * facing * mix(1. / ((1. + xc * .6) * (1. + xc * .6)), 1. - smoothstep(.35, 1.6, xc), smoothstep(.6, 1., coat))) + vec3(env(Ng, 0.)));
  c += alb * glow * ${f(LOOK.glow)};
  // The crystal: a faint cool glint of the lamp on a slightly domed glass.
  vec3 Nx = normalize(vec3(vP * ${f(LOOK.dome)}, 1.)); float nx = max(dot(Nx, Hk), .001), xx = (1. - nx * nx) / (nx * nx) / (SB2 * 2.);
  c += glass * ${v3(LOOK.crystalColour)} * (${f(LOOK.crystal * LOOK.lamp)} * gain * (1. - smoothstep(.2, 1.8, xx)));
  // Filmic tone curve, then back to sRGB; premultiplied so the page shows round the watch.
  c *= ${f(LOOK.exposure)}; c = (c * (2.51 * c + .03)) / (c * (2.43 * c + .59) + .14);
  gl_FragColor = vec4(pow(clamp(c, 0., 1.), vec3(1. / 2.2)) * A.a, A.a);
}`;

  function setup(gl, warn) {
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (gl.getShaderParameter(s, gl.COMPILE_STATUS)) return s; if (warn) console.warn('dial3d shader: ' + gl.getShaderInfoLog(s)); return null; };
    const vs = sh(gl.VERTEX_SHADER, VERT), fs = sh(gl.FRAGMENT_SHADER, FRAG); if (!vs || !fs) return null;
    const pr = gl.createProgram(); gl.attachShader(pr, vs); gl.attachShader(pr, fs); gl.bindAttribLocation(pr, 0, 'aP'); gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) { if (warn) console.warn('dial3d link: ' + gl.getProgramInfoLog(pr)); return null; }
    gl.useProgram(pr);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    ['uA', 'uN', 'uM', 'uG', 'uHA', 'uHN', 'uHM', 'uHG'].forEach((nm, i) => gl.uniform1i(gl.getUniformLocation(pr, nm), i));
    gl.disable(gl.BLEND); gl.disable(gl.DEPTH_TEST); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    const u = {}; ['uL', 'uHp', 'uHb', 'uHt', 'uHz'].forEach(nm => { u[nm] = gl.getUniformLocation(pr, nm); });
    return { u, tex: [] };
  }

  // ---- phone tilt ----
  // On a touch screen the lamp follows how the phone is tilted instead of the finger, as if it hung still in the room
  // while the watch turned under it. The tilt is measured from how the phone is usually held, which follows the phone
  // slowly, so the lamp drifts home when the phone is held still at any angle. iOS asks permission first, and only
  // from a tap, so the first tap on the page asks; until tilt readings arrive the finger still moves the lamp.
  const tilt = (() => {
    const subs = new Set();
    let started = false, base = null, lastT = 0;
    const api = { on: false, at: [0, 0], add(f) { subs.add(f); start(); }, remove(f) { subs.delete(f); } };
    const angle = () => ((screen.orientation && screen.orientation.angle) || window.orientation || 0) % 360 + 360;
    const clamp = v => Math.max(-LOOK.tiltMax, Math.min(LOOK.tiltMax, v));
    const read = e => {
      if (e.beta == null || e.gamma == null) return;
      // Tilt about the screen's own axes: x when its right edge dips, y when its top edge rises.
      const b = e.beta, g = e.gamma, r = angle() % 360;
      const v = r === 90 ? [b, -g] : r === 180 ? [-g, -b] : r === 270 ? [-b, g] : [g, b], now = performance.now();
      if (!base || now - lastT > 1000) base = v.slice();
      else { const k = 1 - Math.exp(-(now - lastT) / LOOK.tiltDrift); base[0] += (v[0] - base[0]) * k; base[1] += (v[1] - base[1]) * k; }
      lastT = now;
      api.at = [clamp(v[0] - base[0]) * LOOK.tilt, clamp(v[1] - base[1]) * LOOK.tilt]; api.on = true;
      subs.forEach(f => f());
    };
    const listen = () => addEventListener('deviceorientation', read, { passive: true });
    function start() {
      if (started || !window.DeviceOrientationEvent || !matchMedia('(hover: none) and (pointer: coarse)').matches) return;
      started = true; listen();
      // Where the browser wants permission (iOS), readings start only once it is given; elsewhere they start now.
      const ask = DeviceOrientationEvent.requestPermission;
      if (typeof ask !== 'function') return;
      const tap = () => {
        removeEventListener('click', tap, true); removeEventListener('touchend', tap, true);
        if (!api.on) ask.call(DeviceOrientationEvent).catch(() => {});
      };
      addEventListener('click', tap, true); addEventListener('touchend', tap, true);
    }
    // Coming back to the page, the phone is likely held differently: start level again.
    document.addEventListener('visibilitychange', () => { base = null; });
    return api;
  })();

  // ---- the renderer ----
  // create(button, { light, still, debug, redraw, lost, restored }) gives a renderer like the flat one in dials.js,
  // or null when WebGL cannot be had. show(scene, done) builds the maps in the background and calls done() when the
  // scene can be drawn, or done(false) if it cannot; it returns false at once when the context is lost for now.
  function create(el, opts) {
    opts = opts || {};
    const cv = document.createElement('canvas'), still = !!opts.still, dbg = opts.debug || null;
    cv.setAttribute('aria-hidden', 'true');
    const gl = cv.getContext('webgl', { alpha: true, antialias: false, premultipliedAlpha: true, failIfMajorPerformanceCaveat: true });
    if (!gl || gl.getParameter(gl.MAX_TEXTURE_SIZE) < 1024 || gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS) < 8) return null;
    let G = setup(gl, dbg); if (!G) return null;
    let token = 0, ready = false, lost = false, cur = null, hands = [], size = 0, N = 0, lastKey = null, lastDraw = 0;
    const Hp = new Float32Array(MAX_HANDS * 4), Hb = new Float32Array(MAX_HANDS * 4), Ht = new Float32Array(MAX_HANDS * 4), Hz = new Float32Array(MAX_HANDS);

    // The lamp. A target (the pointer, ?light= or the resting place) goes through one mapping to a position.
    const lampAt = v => {
      const z = v[2] > 0 ? v[2] : LOOK.lampZ, r = Math.hypot(v[0], v[1]), max = z / Math.tan(LOOK.minElev * Math.PI / 180), fr = Math.min(LOOK.free, max);
      const q = r <= fr ? r : fr + (max - fr) * Math.tanh((r - fr) / (max - fr || 1)), k = r ? q / r : 0;
      return [v[0] * k, v[1] * k, z];
    };
    const fixed = opts.light || null;
    let ptr = null, target = lampAt(fixed || LOOK.rest), lamp = target.slice(), drawn = [], dirty = false, lastT = 0, wake = 0, settled = true;
    const aim = () => { dirty = true; if (still && opts.redraw && !wake) wake = requestAnimationFrame(() => { wake = 0; opts.redraw(); }); };
    const move = e => { if (e.pointerType === 'touch') return; ptr = [e.clientX, e.clientY]; aim(); };
    const touch = e => { if (tilt.on && !still) return; const t = e.touches[0]; if (t) { ptr = [t.clientX, t.clientY]; aim(); } };
    const leave = () => { ptr = null; aim(); }, shift = () => { if (ptr) aim(); };
    const root = document.documentElement, quiet = { passive: true };
    if (!fixed) {
      addEventListener('pointermove', move, quiet); addEventListener('touchstart', touch, quiet); addEventListener('touchmove', touch, quiet);
      addEventListener('touchend', leave, quiet); addEventListener('touchcancel', leave, quiet); root.addEventListener('pointerleave', leave);
      addEventListener('scroll', shift, quiet); addEventListener('resize', shift);
      if (!still) tilt.add(aim);   // under reduced motion the lamp moves only when asked to, by a finger
    }
    // Moves the lamp toward its target: a glide with a time constant, or a jump under reduced motion.
    const stepLamp = now => {
      if (dirty) {
        dirty = false;
        if (tilt.on && !still && !fixed) { ptr = null; target = lampAt([LOOK.rest[0] + LOOK.tiltRest[0] + tilt.at[0], LOOK.rest[1] + LOOK.tiltRest[1] + tilt.at[1]]); }
        else if (ptr) { const b = el.getBoundingClientRect(), h = b.width / 2 || 1; target = lampAt([(ptr[0] - b.left - h) / h, (ptr[1] - b.top - b.height / 2) / h]); }
        else target = lampAt(LOOK.rest);
      }
      const k = still ? 1 : 1 - Math.exp(-(settled ? 16 : Math.min(50, now - lastT)) / LOOK.ease); lastT = now; settled = true;
      for (let i = 0; i < 3; i++) { const d = target[i] - lamp[i]; if (Math.abs(d) < .002) lamp[i] = target[i]; else { lamp[i] += d * k; settled = false; } }
      return lamp[0] !== drawn[0] || lamp[1] !== drawn[1] || lamp[2] !== drawn[2];
    };

    const fit = () => {
      const s = Math.max(1, Math.round(el.getBoundingClientRect().width * Math.min(window.devicePixelRatio || 1, 2)));
      if (s === size) return false;
      size = cv.width = cv.height = s; return true;
    };
    const wanted = () => size > 512 ? 1024 : 512;

    async function build(sc, my) {
      let work = 0, t0 = performance.now();
      const tick = async () => {
        if (my !== token) throw CANCEL;
        const now = performance.now();
        if (now - t0 > 12) { work += now - t0; await new Promise(r => setTimeout(r, 0)); t0 = performance.now(); if (my !== token) throw CANCEL; }
      };
      fit();
      const n = wanted(), ppu = n / 400, baseMaps = await raster(sc, sc.base, n, n, [ppu, n / 2, n / 2], ppu, ORDER, true, tick);
      // Hands, each pointing up in its own strip of one atlas. The seconds hand is left out under reduced motion.
      const list = sc.hands.filter(h => !(h.hideWhenStill && still)).slice(-MAX_HANDS), strips = [];
      let x = 0, tall = 1;
      for (const h of list) {
        const b = h.box, k = ppu * h.scale, w = Math.ceil((b[2] - b[0]) * k) + 2 * PAD, hh = Math.ceil((b[3] - b[1]) * k) + 2 * PAD;
        const m = await raster(sc, h.ops, w, hh, [k, PAD - b[0] * k, PAD - b[1] * k], ppu, HAND_ORDER, false, tick);
        strips.push({ h, m, x, k }); x += w; tall = Math.max(tall, hh); await tick();
      }
      let AW = 64, AH = 64; while (AW < x) AW *= 2; while (AH < tall) AH *= 2;
      const atlas = ['alb', 'nrm', 'm1', 'm2'].map(() => new Uint8Array(AW * AH * 4)), gm = atlas[3];
      new Uint32Array(gm.buffer).fill(NEUTRAL);
      strips.forEach(s => ['alb', 'nrm', 'm1', 'm2'].forEach((nm, t) => { for (let y = 0; y < s.m.H; y++) atlas[t].set(s.m[nm].subarray(y * s.m.W * 4, (y + 1) * s.m.W * 4), (y * AW + s.x) * 4); }));
      work += performance.now() - t0;
      return { base: baseMaps, atlas, AW, AH, strips, n, work };
    }
    function upload(B) {
      G.tex.forEach(t => gl.deleteTexture(t)); G.tex = [];
      const tex = (unit, data, w, h, mips) => {
        const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mips ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
        if (mips) gl.generateMipmap(gl.TEXTURE_2D);
        G.tex.push(t);
      };
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      ['alb', 'nrm', 'm1', 'm2'].forEach((nm, i) => tex(i, B.base[nm], B.n, B.n, false));
      B.atlas.forEach((d, i) => tex(4 + i, d, B.AW, B.AH, i === 0));   // only hand colour is blurred, for shadows
      Hb.fill(0); Ht.fill(0); Hp.fill(0); Hz.fill(-100);
      for (let j = 0; j < MAX_HANDS; j++) { Hb[j * 4] = Hb[j * 4 + 1] = 1e5; Hb[j * 4 + 2] = Hb[j * 4 + 3] = -1e5; }
      hands = B.strips.map((s, j) => {
        const b = s.h.box, e = (PAD - 1) / s.k;
        Hb.set([b[0] - e, b[1] - e, b[2] + e, b[3] + e], j * 4);
        Ht.set([(s.x + PAD - b[0] * s.k) / B.AW, (PAD - b[1] * s.k) / B.AH, s.k / B.AW, s.k / B.AH], j * 4);
        Hz[j] = LOOK.handZ + j * LOOK.handStep;
        return s.h;
      });
      gl.uniform4fv(G.u.uHb, Hb); gl.uniform4fv(G.u.uHt, Ht); gl.uniform1fv(G.u.uHz, Hz);
      N = B.n; if (dbg) { dbg.texSize = N; dbg.buildMs = B.work; }
    }
    function show(sc, done) {
      if (lost) return false;
      const my = ++token;
      build(sc, my).then(B => {
        if (my !== token || lost) return;
        upload(B); cur = sc; ready = true; lastKey = null; fit();
        if (done) done(); else if (opts.redraw) opts.redraw();
      }, e => { if (e !== CANCEL && my === token) { if (dbg) console.warn('dial3d build: ' + (e && e.stack || e)); if (done) done(false); } });
      return true;
    }

    cv.addEventListener('webglcontextlost', e => { e.preventDefault(); lost = true; ready = false; token++; if (opts.lost) opts.lost(); });
    cv.addEventListener('webglcontextrestored', () => { G = setup(gl, dbg); if (!G) return; lost = false; if (opts.restored) opts.restored(); });

    return {
      mode: 'gl', canvas: cv, show,
      // Draws only when something changed: the lamp is moving, or a hand has turned (at most about thirty times a second).
      draw(deg, force) {
        if (!ready || lost) return false;
        const now = performance.now(), moved = stepLamp(now);
        const key = hands.map(h => h.key ? Math.round(deg[h.key] * 100) : 0).join();
        if (!force && !moved && (key === lastKey || now - lastDraw < 30)) return false;
        lastKey = key; lastDraw = now; drawn = lamp.slice();
        hands.forEach((h, j) => { const a = (h.key ? deg[h.key] : h.angle) * Math.PI / 180; Hp.set([h.pivot[0], h.pivot[1], Math.cos(a) / h.scale, Math.sin(a) / h.scale], j * 4); });
        gl.viewport(0, 0, size, size); gl.uniform4fv(G.u.uHp, Hp); gl.uniform3fv(G.u.uL, lamp);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        if (dbg) dbg.light = lamp.slice();
        return true;
      },
      // The canvas is the box in device pixels, at most two to a CSS pixel; the maps are remade if their size no longer suits it.
      resize() { if (!fit()) return false; if (cur && !lost && wanted() !== N) show(cur); return true; },
      destroy() {
        token++; cv.remove(); tilt.remove(aim);
        ['pointermove', 'touchstart', 'touchmove'].forEach((nm, i) => removeEventListener(nm, i ? touch : move));
        removeEventListener('touchend', leave); removeEventListener('touchcancel', leave); root.removeEventListener('pointerleave', leave);
        removeEventListener('scroll', shift); removeEventListener('resize', shift);
      }
    };
  }

  window.WBMDial3D = { create };
})();
