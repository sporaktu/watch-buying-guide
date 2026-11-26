// The stage: a 3D watch in one element of the page. Renderer, studio, lamps, camera, views, pointer handling and the
// frame loop are here and shared by every watch; which watch it shows is a watch id, whose folder under watches/ is
// imported when it is asked for. Adapted from the first watch's own full-window page. The differences: it fills and
// follows a container instead of the window, it draws on a transparent ground (and the crystal's blending is set to
// suit one), the wheel is left to the page, options take the place of the page-address parameters, and the loop can
// be stopped and the whole thing disposed.
import * as THREE from '../vendor/three.module.js';
import { OrbitControls } from '../vendor/OrbitControls.js';
import { makeEnvironment } from './env.js';
import { makeMaterials } from './materials.js';

// Named views: camera direction from the target, distance, and where to look.
const VIEWS = {
  hero: { dir: [0.46, 0.28, 1], dist: 172, target: [0, 0, -9] },
  front: { dir: [0, 0, 1], dist: 166, target: [0, 0, 2] },
  side: { dir: [1, 0.06, 0.03], dist: 182, target: [0, 0, -19] },
  back: { dir: [0.6, 0.1, -0.79], dist: 164, target: [0, 0, -8] },
  clasp: { dir: [0.12, -0.16, -1], dist: 170, target: [0, 0, -30] },
  bracelet: { dir: [0.5, -0.9, 0.33], dist: 165, target: [0, -6, -19] },
};

/** The textures a material holds: its own maps, and those in a ShaderMaterial's uniforms (a value or an array). */
function texturesOf(m) {
  const found = [];
  for (const v of Object.values(m)) if (v && v.isTexture) found.push(v);
  if (m.uniforms) {
    for (const u of Object.values(m.uniforms)) {
      for (const v of [].concat(u && u.value)) if (v && v.isTexture) found.push(v);
    }
  }
  return found;
}

/**
 * A camera position written as text, for close-ups from a page address (the page's ?cam=):
 *   'az,el,dist' or 'az,el,dist,x,y,z'
 * az: degrees round the watch from the front, positive towards 3 o'clock (0 front, 90 the 3 o'clock side, 180 behind);
 * el: degrees up towards 12 o'clock (negative towards 6), more than -90 and less than 90; dist: millimetres from the
 * camera to the point looked at, from 30 to 520 (the reader's zoom limits); x,y,z: that point in millimetres (the
 * watch's axes: dial +Z, 12 o'clock +Y, 3 o'clock +X, z = 0 the underside of the mid-case), 0,0,0 if left out.
 * As with a view, a window narrower than the views are composed for stands back by the same factor.
 * Returns a view ({ dir, dist, target }), or null when the text is not of that form or out of range.
 */
export function parseCam(text) {
  if (typeof text !== 'string' || !/^-?[\d.]+(,-?[\d.]+){2}((,-?[\d.]+){3})?$/.test(text)) return null;
  const n = text.split(',').map(Number);
  if (!n.every(Number.isFinite)) return null;
  const [az, el, dist, x = 0, y = 0, z = 0] = n;
  if (!(el > -90 && el < 90) || !(dist >= 30 && dist <= 520)) return null;
  const a = az * Math.PI / 180, e = el * Math.PI / 180;
  return { dir: [Math.cos(e) * Math.sin(a), Math.sin(e), Math.cos(e) * Math.cos(a)], dist, target: [x, y, z] };
}

/** What is wrong with a watch's about.light (see the watch contract below), or '' when nothing is. */
function lightFault(a) {
  if (a == null) return '';
  const factor = v => v === undefined || (typeof v === 'number' && v >= 0 && v <= 4);
  if (typeof a !== 'object') return 'about.light must be an object';
  for (const k of Object.keys(a)) {
    if (k === 'exposure' || k === 'environment') { if (!factor(a[k])) return `about.light.${k} must be a number from 0 to 4`; continue; }
    if (k !== 'key' && k !== 'rim' && k !== 'back') return `about.light.${k} is not something a watch may set`;
    const l = a[k];
    if (!l || typeof l !== 'object') return `about.light.${k} must be an object`;
    for (const f of Object.keys(l)) if (f !== 'strength' && f !== 'dir') return `about.light.${k}.${f} is not something a watch may set`;
    if (!factor(l.strength)) return `about.light.${k}.strength must be a number from 0 to 4`;
    if (l.dir !== undefined && !(Array.isArray(l.dir) && l.dir.length === 3 && l.dir.every(Number.isFinite) && l.dir.some(v => v !== 0))) {
      return `about.light.${k}.dir must be [x, y, z], not all zero`;
    }
  }
  return '';
}

/** Wall-clock source. A time of 'HH:MM:SS' pins it, so screenshots are comparable. */
function makeClock(time) {
  if (!time) return () => new Date();
  const [h, m, s] = String(time).split(':').map(Number);
  const fixed = new Date();
  fixed.setHours(h || 0, m || 0, s || 0, 0);
  return () => fixed;
}

/**
 * @param {HTMLElement} container  the watch fills this element and follows its size
 * @param {{ watch: string, shadowSize?: 4096|2048, reducedMotion?: boolean, onLost?: () => void, onError?: (err: Error) => void, onInteract?: () => void, time?: string }} options
 *        watch: the id of the watch to show first, the name of its folder under watches/ (required)
 *        time: 'HH:MM:SS' freezes the hands, for comparable screenshots
 *        onError: called once if the watch showing throws after show() has resolved (its tick or idle, while the loop
 *                 runs or a frame is drawn on request). The loop is stopped and the watch freed first, so no watch is
 *                 showing; without onError the error goes to the console, once.
 *        onInteract: called when the reader starts to turn or zoom the watch by hand, so a named view no longer applies
 * @returns {Promise<Handle>} resolves when the first frame has been drawn; rejects if WebGL is missing or the build throws
 *
 * Handle:
 *   canvas: HTMLCanvasElement          appended to container by mount
 *   views: string[]                    ['hero', 'front', 'side', 'back', 'clasp', 'bracelet']
 *   about: object                      the about of the watch showing (null while show() is replacing it)
 *   report: object                     the report of the watch showing (null while none is), as below
 *   setView(name: string, instant?: boolean): boolean
 *   setCamera(cam: string, instant?: boolean): boolean
 *                                      put the camera where cam says (the form is parseCam's, above), as setView does
 *                                      for a named view; false, and nothing moves, when cam is malformed
 *   start(): void                      begin the frame loop (idempotent; does nothing while no watch is showing)
 *   stop(): void                       cancel it (idempotent)
 *   running: boolean
 *   show(id: string): Promise<void>    stop the loop, free the watch showing (but not the kit's shared materials and
 *                                      studio), import and build watches/<id>/index.js, put it in the three-quarter
 *                                      view and draw one frame. Calls run in turn and the last one wins: one overtaken
 *                                      by a later call resolves without showing its watch. If the build throws,
 *                                      returns something that is not a group and a tick, or the first frame throws,
 *                                      the promise rejects and no watch is showing. The loop is left stopped.
 *   dispose(): void                    stop, free GL resources, remove the canvas and every listener
 *
 * A watch module (watches/<id>/index.js) exports
 *   about: { id, label, hint, caption?, views?, light? }
 *                                                  label is the canvas's aria-label while the watch shows (it is
 *                                                  '3D watch' while none does); label and hint must be strings, and
 *                                                  caption one if given, or show() rejects before building. views
 *                                                  replaces any of the six views by name; other names are ignored, so
 *                                                  a watch cannot add a view
 *   about.light, if given, adjusts the kit's light for this watch only. Every field is optional:
 *     { key?: { strength?, dir? }, rim?: { strength?, dir? }, back?: { strength?, dir? }, exposure?, environment? }
 *   strength, exposure and environment multiply the kit's own value (a number from 0 to 4; 1 leaves it as it is): the
 *   key lamp's 2.3, the rim's 0.9, the back's 1.1, the tone mapping's exposure 1.0 and the studio's strength 1.0. dir
 *   is the direction from the point the lamp aims at to the lamp, [x, y, z] in the watch's axes (any length but zero);
 *   the lamp keeps its distance from that point, and the key lamp its shadow. A watch cannot replace the studio, the
 *   lamps' colours, the shadows or the tone mapping. The stage applies it when the watch is shown and puts its own
 *   values back when the watch is freed (another is shown, it fails, or the stage is disposed). Anything else in it,
 *   or a value out of range, makes show() reject before building. List each change in the watch's notes with why.
 *   build({ M, renderer, frozen }): Promise<{ group, tick(date, dt, camera), press: [{ object, down(), up?() }],
 *                                             idle?(seconds), dispose?(), report? }>
 *   group must be a THREE.Object3D and tick a function, or show() rejects.
 *   report is the watch's own account of its build: any entries it likes (plain data, so it can be written as JSON),
 *   and warnings: string[], one line for each check of its own that failed (a bracelet loop that does not close, say).
 *   A warning is for the builder, not the reader: the watch is still shown. The stage's handle gives out a copy with
 *   the stage's own figures for the first frame (the three-quarter view, the shadow pass included) put over the top:
 *     { watch: id, triangles, drawCalls, geometries, textures, warnings: string[], ...the watch's own entries }
 *   triangles and drawCalls are renderer.info.render, geometries and textures renderer.info.memory (all the renderer
 *   holds, the studio and shared materials included). warnings is [] when the watch gives none.
 *   When the watch is freed (another is shown, or the stage is disposed) the stage disposes every geometry, material
 *   and texture it finds on the meshes in group: material properties, and textures in a ShaderMaterial's uniforms.
 *   It does not dispose the kit's shared materials (M) and studio. Anything else the watch made on the graphics card is
 *   the watch's to release in its dispose(), which the stage calls at that moment: render targets, textures kept only
 *   in userData, closures or objects outside group, and geometry or materials taken out of group after the build.
 */
export async function mount(container, options = {}) {
  if (typeof options.watch !== 'string' || !/^[a-z0-9-]+$/.test(options.watch)) throw new Error('mount needs a watch id');
  const reducedMotion = !!options.reducedMotion;
  const shadowSize = options.shadowSize === 2048 ? 2048 : 4096;

  // The lettering is drawn on canvases in Jost, which the page's stylesheet declares.
  await document.fonts.load('600 40px Jost');

  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none;cursor:grab';
  canvas.setAttribute('role', 'img');
  // The canvas's name while no watch is showing (being built, or after a failure); a watch's own label replaces it.
  const UNNAMED = '3D watch';
  canvas.setAttribute('aria-label', UNNAMED);

  // Everything that has to be undone; dispose works back through it.
  const undo = [];
  const listen = (target, type, fn, opts) => { target.addEventListener(type, fn, opts); undo.push(() => target.removeEventListener(type, fn, opts)); };
  let renderer = null, scene = null, disposed = false, ready = false, raf = 0;
  let releaseWatch = null;   // the dispose() of the watch showing, if it has one

  function dispose() {
    if (disposed) return;
    disposed = true;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    while (undo.length) { try { undo.pop()(); } catch (e) { /* keep undoing */ } }
    if (releaseWatch) { try { releaseWatch(); } catch (e) { /* the GL context goes anyway */ } releaseWatch = null; }
    if (scene) {
      const seen = new Set();
      const drop = (x) => { if (x && typeof x.dispose === 'function' && !seen.has(x)) { seen.add(x); x.dispose(); } };
      scene.traverse((o) => {
        drop(o.geometry);
        for (const m of [].concat(o.material || [])) {
          for (const t of texturesOf(m)) drop(t);
          drop(m);
        }
        if (o.isLight && o.shadow) drop(o.shadow);
      });
      drop(scene.environment);
    }
    if (renderer) {
      renderer.dispose();
      // Browsers allow only a few live contexts; give this one back now rather than when the canvas is collected.
      if (!renderer.getContext().isContextLost()) renderer.forceContextLoss();
    }
    canvas.remove();
  }

  try {
    container.append(canvas);
    // 'default', not 'high-performance': the built watch is kept for the rest of the visit, and a context that asked for
    // the discrete GPU of a laptop with two would keep that GPU awake all that time.
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'default' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.setClearColor(0x000000, 0);   // the page's own ground shows round the watch

    scene = new THREE.Scene();
    scene.environment = makeEnvironment(renderer, 512);
    scene.environmentIntensity = 1.0;

    const camera = new THREE.PerspectiveCamera(26, 1, 2, 3000);
    // The wheel belongs to the page, so it scrolls with the pointer over the watch. The controls' own wheel listener
    // zooms and swallows the event; this one is on the same element, in the capture phase and added first, so it runs
    // before theirs and stops it, without preventing the scroll. A two-finger pinch still zooms.
    listen(canvas, 'wheel', (ev) => { ev.stopImmediatePropagation(); }, { capture: true, passive: true });
    const controls = new OrbitControls(camera, canvas);
    undo.push(() => controls.dispose());
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 30;
    controls.maxDistance = 520;
    controls.rotateSpeed = 0.8;
    controls.zoomSpeed = 0.9;
    controls.enablePan = false;

    // A key lamp for cast shadows (hands on the dial, bezel on the case) and for the sunray sweep.
    const key = new THREE.DirectionalLight(0xfff4e6, 2.3);
    key.position.set(-70, 85, 100);
    key.castShadow = true;
    key.shadow.mapSize.set(shadowSize, shadowSize);
    const sc = key.shadow.camera;
    sc.left = -75; sc.right = 75; sc.top = 75; sc.bottom = -75; sc.near = 20; sc.far = 320;
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.03;
    key.shadow.radius = 2.2;
    key.target.position.set(0, -4, -22);
    scene.add(key, key.target);
    const rim = new THREE.DirectionalLight(0xdde8ff, 0.9);
    rim.position.set(95, 20, 50);
    scene.add(rim);
    const back = new THREE.DirectionalLight(0xe8eeff, 1.1);
    back.position.set(-45, 45, -95);
    scene.add(back);
    // The kit's own light, which a watch's about.light adjusts and unload() puts back.
    const lamps = { key, rim, back };
    const kitLight = {};
    for (const [k, l] of Object.entries(lamps)) kitLight[k] = { strength: l.intensity, position: l.position.clone() };
    function light(a) {
      for (const [k, l] of Object.entries(lamps)) {
        const mine = (a && a[k]) || {};
        l.intensity = kitLight[k].strength * (mine.strength ?? 1);
        if (mine.dir) {
          const reach = kitLight[k].position.distanceTo(l.target.position);
          l.position.copy(l.target.position).addScaledVector(new THREE.Vector3(...mine.dir).normalize(), reach);
        } else {
          l.position.copy(kitLight[k].position);
        }
      }
      renderer.toneMappingExposure = 1.0 * ((a && a.exposure) ?? 1);
      scene.environmentIntensity = 1.0 * ((a && a.environment) ?? 1);
    }

    const M = makeMaterials(renderer);
    // The crystal only adds its reflections to what is behind it. On a transparent canvas it must not add to the
    // alpha as well, or the glass shows as an opaque dark shape wherever the page, not the watch, is behind it.
    for (const glass of [M.crystal, M.crystalInner]) {
      glass.blending = THREE.CustomBlending;
      glass.blendEquation = THREE.AddEquation;
      glass.blendSrc = THREE.SrcAlphaFactor; glass.blendDst = THREE.OneFactor;
      glass.blendSrcAlpha = THREE.ZeroFactor; glass.blendDstAlpha = THREE.OneFactor;
    }
    undo.push(() => { M.brushN.dispose(); M.brushC.dispose(); });
    // The kit's own materials and textures, and the studio: kept when a watch is freed, so the next one can use them.
    const shared = new Set([scene.environment]);
    for (const v of Object.values(M)) {
      if (v && v.isTexture) shared.add(v);
      if (v && v.isMaterial) {
        shared.add(v);
        for (const t of texturesOf(v)) shared.add(t);
      }
    }
    const clock = makeClock(options.time);
    const frozen = !!options.time;

    // The watch showing: { about, group, tick, press, idle }, or null while there is none.
    let current = null;
    let views = VIEWS;

    let flight = null;
    // Views are composed for a wide window; a narrow one stands further back by this factor.
    let fit = 1;
    function place(name, instant) {
      return placeAt(Object.prototype.hasOwnProperty.call(views, name) ? views[name] : null, instant);
    }
    function placeAt(v, instant) {
      if (!v || disposed) return false;
      const dir = new THREE.Vector3(...v.dir).normalize();
      const target = new THREE.Vector3(...v.target);
      const pos = target.clone().addScaledVector(dir, v.dist * fit);
      if (instant || reducedMotion) {
        camera.position.copy(pos); controls.target.copy(target); controls.update(); flight = null;
      } else {
        flight = { t: 0, p0: camera.position.clone(), p1: pos, q0: controls.target.clone(), q1: target };
      }
      return true;
    }
    function setView(name, instant = false) {
      if (!place(name, instant)) return false;
      if ((instant || reducedMotion) && ready && !raf) redraw();   // the loop is stopped, so show the new view now
      return true;
    }
    function setCamera(cam, instant = false) {
      if (!placeAt(parseCam(cam), instant)) return false;
      if ((instant || reducedMotion) && ready && !raf) redraw();
      return true;
    }
    controls.addEventListener('start', () => { flight = null; if (typeof options.onInteract === 'function') options.onInteract(); });

    // Parts the reader can press (a watch's press list): pressing one calls its down(), letting go its up(), and the
    // orbit controls sit that gesture out. Everywhere else a drag turns the watch.
    const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
    const hit = (ev) => {
      const press = current ? current.press : null;
      if (!press || !press.length) return null;
      const r = canvas.getBoundingClientRect();
      ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      const targets = press.map(p => p.object);
      const found = ray.intersectObjects(targets, true)[0];
      if (!found) return null;
      let o = found.object;
      while (o && !targets.includes(o)) o = o.parent;
      return o ? press[targets.indexOf(o)] : null;
    };
    let held = null;
    // capture phase, so the orbit controls can be told to sit this gesture out before they see it
    listen(canvas, 'pointerdown', (ev) => {
      held = hit(ev);
      if (!held) return;
      controls.enabled = false;
      held.down();
    }, { capture: true });
    const release = () => {
      if (!held) return;
      const was = held;
      held = null; controls.enabled = true;
      if (typeof was.up === 'function') was.up();
    };
    listen(window, 'pointerup', release);
    listen(window, 'pointercancel', release);
    listen(canvas, 'pointermove', (ev) => {
      if (ev.buttons === 0) canvas.style.cursor = hit(ev) ? 'pointer' : 'grab';
    });

    function renderOnce() {
      controls.update();
      if (current) current.tick(clock(), 0, camera);
      renderer.render(scene, camera);
    }
    // A watch that throws once it is showing is stopped and freed, and the error reported once, not every frame.
    function broken(err) {
      stop();
      unload();
      if (typeof options.onError === 'function') options.onError(err);
      else console.error('The 3D watch stopped: its code threw.', err);
    }
    // A frame asked for outside the loop (a new view, a resize): the same, guarded.
    function redraw() {
      try { renderOnce(); } catch (err) { broken(err); }
    }

    let width = 0, height = 0;
    function resize() {
      const w = Math.round(container.clientWidth), h = Math.round(container.clientHeight);
      if (!w || !h || (w === width && h === height)) return false;
      width = w; height = h;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      const next = Math.max(1, 0.86 / camera.aspect);
      if (next !== fit) {
        // keep the watch the same size across the element when its shape changes
        camera.position.sub(controls.target).multiplyScalar(next / fit).add(controls.target);
        if (flight) flight.p1.sub(flight.q1).multiplyScalar(next / fit).add(flight.q1);
        fit = next;
      }
      return true;
    }
    // Resizing clears the canvas, and the observer runs after this frame's draw, so draw again at once. A canvas that
    // is stopped and not displayed is left alone; start() fits it before its first frame.
    const ro = new ResizeObserver(() => {
      if (disposed || (!raf && !canvas.getClientRects().length)) return;
      if (resize()) redraw();
    });
    ro.observe(container);
    undo.push(() => ro.disconnect());
    resize();

    const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    let last = 0, stoppedAt = performance.now();
    function frame(now) {
      raf = requestAnimationFrame(frame);
      try { step(now); } catch (err) { broken(err); }
    }
    function step(now) {
      const dt = Math.max(0, Math.min(0.1, (now - last) / 1000)); last = now;
      if (flight) {
        flight.t = Math.min(1, flight.t + dt / 1.1);
        const k = ease(flight.t);
        // Swing round the target rather than cutting through the watch.
        const a = flight.p0.clone().sub(flight.q0), b = flight.p1.clone().sub(flight.q1);
        const la = a.length(), lb = b.length();
        const q = new THREE.Quaternion().setFromUnitVectors(a.clone().normalize(), b.clone().normalize());
        const dirNow = a.clone().normalize().applyQuaternion(new THREE.Quaternion().slerp(q, k));
        const tgt = flight.q0.clone().lerp(flight.q1, k);
        camera.position.copy(tgt).addScaledVector(dirNow, la + (lb - la) * k);
        controls.target.copy(tgt);
        if (flight.t >= 1) flight = null;
      }
      controls.update();
      if (current) current.tick(clock(), dt, camera);
      renderer.render(scene, camera);
    }
    // The loop runs only with a watch to show; show() stops it, and the caller starts it again when it wants it.
    function start() {
      if (raf || disposed || !current) return;
      const now = performance.now();
      // A watch whose works count frame by frame is told how long the loop was stopped.
      if (typeof current.idle === 'function' && stoppedAt !== null) {
        try { current.idle(Math.max(0, now - stoppedAt) / 1000); } catch (err) { broken(err); return; }
      }
      stoppedAt = null;
      last = now;
      resize();
      raf = requestAnimationFrame((t) => { last = t; frame(t); });
    }
    function stop() {
      if (!raf) return;
      cancelAnimationFrame(raf);
      raf = 0;
      stoppedAt = performance.now();
    }

    // A context lost during a build is reported by show's rejection; onLost is for one lost afterwards.
    listen(canvas, 'webglcontextlost', () => {
      stop();
      if (ready && !disposed && typeof options.onLost === 'function') options.onLost();
    });

    /** Free a watch's geometries, and every material and texture of it that is not one of the kit's shared ones; then
     *  call its own dispose(), for what the stage cannot find. */
    function free(group, own) {
      group.removeFromParent();
      const seen = new Set();
      const drop = (x) => { if (x && typeof x.dispose === 'function' && !seen.has(x) && !shared.has(x)) { seen.add(x); x.dispose(); } };
      group.traverse((o) => {
        drop(o.geometry);
        for (const m of [].concat(o.material || [])) {
          for (const t of texturesOf(m)) drop(t);
          drop(m);
        }
      });
      if (typeof own === 'function') {
        try { own(); } catch (err) { console.error('The 3D watch threw while releasing what it made.', err); }
      }
    }
    function unload() {
      if (held) { held = null; controls.enabled = true; }
      canvas.style.cursor = 'grab';
      canvas.setAttribute('aria-label', UNNAMED);
      if (current) { const was = current; current = null; releaseWatch = null; free(was.group, was.dispose); }
      views = VIEWS;
      light(null);
    }

    // show() calls run one after another, and only the last one asked for puts its watch in the scene: an earlier call
    // that finds a later one waiting resolves without showing anything.
    let latest = 0, queue = Promise.resolve();
    async function load(id, ticket) {
      if (disposed) throw new Error('The 3D watch has been disposed');
      if (ticket !== latest) return;
      stop();
      unload();
      const mod = await import(`../watches/${id}/index.js`);
      if (disposed || ticket !== latest) return;
      if (!mod.about || mod.about.id !== id || typeof mod.build !== 'function') throw new Error(`watches/${id}/index.js does not export about and build`);
      const a = mod.about;
      if (typeof a.label !== 'string' || typeof a.hint !== 'string' || (a.caption != null && typeof a.caption !== 'string')) {
        throw new Error(`watches/${id}/index.js: about.label and about.hint must be strings, and about.caption one if given`);
      }
      const fault = lightFault(a.light);
      if (fault) throw new Error(`watches/${id}/index.js: ${fault}`);
      const built = await mod.build({ M, renderer, frozen });
      const group = built && built.group && built.group.isObject3D ? built.group : null;
      const own = built && typeof built.dispose === 'function' ? () => built.dispose() : null;
      if (disposed || ticket !== latest) { if (!disposed && group) free(group, own); return; }
      if (!group || typeof built.tick !== 'function') {
        if (group) free(group, own);
        throw new Error(`watches/${id}/index.js: build() must return a group (an Object3D) and a tick function`);
      }
      scene.add(built.group);
      light(mod.about.light);
      current = {
        about: mod.about, group: built.group, tick: built.tick,
        press: Array.isArray(built.press) ? built.press : [], idle: built.idle, dispose: own, report: null,
      };
      releaseWatch = own;
      // A watch's views replace the kit's by name. Only the kit's six names are taken: the page offers only those.
      views = { ...VIEWS };
      const mine = mod.about.views || {};
      for (const name of Object.keys(VIEWS)) if (Object.prototype.hasOwnProperty.call(mine, name)) views[name] = mine[name];
      canvas.setAttribute('aria-label', mod.about.label);
      place('hero', true);
      try {
        renderOnce();   // the first frame, which also compiles the shaders
      } catch (err) {
        unload();
        throw err;
      }
      const given = built.report && typeof built.report === 'object' ? built.report : {};
      const info = renderer.info;
      current.report = {
        ...given, watch: id,
        triangles: info.render.triangles, drawCalls: info.render.calls,
        geometries: info.memory.geometries, textures: info.memory.textures,
        warnings: Array.isArray(given.warnings) ? given.warnings.map(String) : [],
      };
      if (renderer.getContext().isContextLost()) {
        unload();
        throw new Error('The WebGL context was lost while the watch was being built');
      }
      stoppedAt = performance.now();
    }
    function show(id) {
      if (typeof id !== 'string' || !/^[a-z0-9-]+$/.test(id)) return Promise.reject(new Error(`Not a watch id: ${id}`));
      const ticket = ++latest;
      const job = queue.then(() => load(id, ticket));
      queue = job.catch(() => {});
      return job;
    }

    await show(options.watch);
    if (!current) throw new Error('The watch was not shown');
    ready = true;

    return {
      canvas,
      get views() { return Object.keys(views); },
      get about() { return current ? current.about : null; },
      get report() { return current ? current.report : null; },
      setView,
      setCamera,
      start,
      stop,
      get running() { return raf !== 0; },
      show,
      dispose,
    };
  } catch (err) {
    dispose();
    throw err;
  }
}
